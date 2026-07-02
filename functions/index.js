// ── Baloot Al-Mamlaka — autonomous backend agents ─────────────────────
// Deploy requires the Blaze plan: firebase deploy --only functions
// All agents run with Admin SDK privileges (bypass Firestore rules).

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// PDPL note: pin compute to the closest region to KSA data.
setGlobalOptions({ region: 'me-central1', maxInstances: 10 });

const ADMIN_SETUP_SECRET = defineSecret('ADMIN_SETUP_SECRET');

// Prize split for tournament podium finishes.
const PRIZE_SPLIT = [0.6, 0.25, 0.15];

// ── Agent 1: Tournament engine ────────────────────────────────────────
// Runs every 5 minutes. Advances brackets whose current round is fully
// decided, seeds the next round, and settles prizes the moment a
// tournament completes. No manual intervention.
exports.advanceTournaments = onSchedule('every 5 minutes', async () => {
  const snap = await db.collection('tournaments').where('status', '==', 'active').get();

  for (const docSnap of snap.docs) {
    const t = docSnap.data();
    const rounds = t.rounds || [];
    if (rounds.length === 0) continue;
    const current = rounds[rounds.length - 1];
    const matches = current.matches || [];

    // BYE auto-advance
    let changed = false;
    for (const m of matches) {
      if (!m.winner && m.p1 && !m.p2) { m.winner = m.p1.uid; changed = true; }
    }

    const allDecided = matches.length > 0 && matches.every(m => m.winner);
    if (!allDecided) {
      if (changed) await docSnap.ref.update({ rounds });
      continue;
    }

    const winners = matches.map(m => (m.winner === m.p1?.uid ? m.p1 : m.p2)).filter(Boolean);

    if (winners.length <= 1) {
      // Tournament complete → settle prizes instantly.
      const champion = winners[0] || null;
      const runnerUp = matches[0] ? (matches[0].winner === matches[0].p1?.uid ? matches[0].p2 : matches[0].p1) : null;
      const podium = [champion, runnerUp].filter(Boolean);
      const prizeCoins = t.prizePool?.coins || 0;

      const batch = db.batch();
      podium.forEach((p, i) => {
        if (!p || p.uid.startsWith('bot-')) return;
        batch.update(db.doc(`users/${p.uid}`), {
          coins: admin.firestore.FieldValue.increment(Math.floor(prizeCoins * PRIZE_SPLIT[i])),
          tournamentWins: admin.firestore.FieldValue.increment(i === 0 ? 1 : 0),
        });
      });
      batch.update(docSnap.ref, { status: 'completed', winner: champion, completedAt: Date.now() });
      await batch.commit();
      console.log(`Tournament ${docSnap.id} settled — champion ${champion?.name}`);
    } else {
      // Seed next round from winners.
      const nextMatches = [];
      for (let i = 0; i < winners.length; i += 2) {
        nextMatches.push({ p1: winners[i], p2: winners[i + 1] || null, winner: null, room: null });
      }
      rounds.push({ matches: nextMatches });
      await docSnap.ref.update({ rounds });
      console.log(`Tournament ${docSnap.id} advanced to round ${rounds.length}`);
    }
  }
});

// Bridges finished tournament rooms into the bracket: when a room tied to
// a tournament match reaches gameOver, record the match winner.
exports.onRoomFinished = onDocumentUpdated('rooms/{code}', async (event) => {
  const after = event.data.after.data();
  const before = event.data.before.data();
  if (!after?.tournamentId || after.gd?.phase !== 'gameOver' || before.gd?.phase === 'gameOver') return;

  const winTeam = after.gd.scores.a >= after.gd.scores.b ? 0 : 1;
  const winnerUids = (after.players || []).filter(p => p.seat % 2 === winTeam).map(p => p.uid);

  const tRef = db.doc(`tournaments/${after.tournamentId}`);
  await db.runTransaction(async (tx) => {
    const tSnap = await tx.get(tRef);
    if (!tSnap.exists) return;
    const t = tSnap.data();
    const rounds = t.rounds || [];
    const current = rounds[rounds.length - 1];
    if (!current) return;
    for (const m of current.matches) {
      if (m.room === event.params.code && !m.winner) {
        m.winner = winnerUids.includes(m.p1?.uid) ? m.p1.uid : m.p2?.uid;
      }
    }
    tx.update(tRef, { rounds });
  });
});

// ── Agent 2: Rank decay ───────────────────────────────────────────────
// Daily 03:00 KSA. Top players who go inactive for 14+ days lose 2% of
// their wins per day of further inactivity — keeps leaderboards live.
exports.rankDecay = onSchedule({ schedule: '0 3 * * *', timeZone: 'Asia/Riyadh' }, async () => {
  const cutoff = Date.now() - 14 * 86400000;
  const snap = await db.collection('users')
    .where('wins', '>=', 50)
    .orderBy('wins', 'desc')
    .limit(500)
    .get();

  const batch = db.batch();
  let decayed = 0;
  snap.docs.forEach(u => {
    const d = u.data();
    const lastActive = d.lastActive || 0;
    if (lastActive > cutoff) return;
    const decay = Math.max(1, Math.floor((d.wins || 0) * 0.02));
    batch.update(u.ref, {
      wins: admin.firestore.FieldValue.increment(-decay),
      decayedWins: admin.firestore.FieldValue.increment(decay),
    });
    decayed++;
  });
  if (decayed) await batch.commit();
  console.log(`Rank decay applied to ${decayed} inactive players`);
});

// ── Agent 3: Anti-collusion scan ──────────────────────────────────────
// Daily. Reads the last 24h of match telemetry and flags suspicious
// pairs: repeatedly matched together with an abnormal win rate.
exports.collusionScan = onSchedule({ schedule: '30 3 * * *', timeZone: 'Asia/Riyadh' }, async () => {
  const since = Date.now() - 86400000;
  const snap = await db.collection('matches')
    .where('endedAt', '>=', since)
    .where('mode', '==', 'multiplayer')
    .get();

  // pairKey -> { games, winsTogether }
  const pairs = new Map();
  snap.docs.forEach(m => {
    const d = m.data();
    const humans = (d.players || []).filter(p => !p.isBot);
    const winTeam = d.scores?.a >= d.scores?.b ? 0 : 1;
    for (let i = 0; i < humans.length; i++) {
      for (let j = i + 1; j < humans.length; j++) {
        const a = humans[i], b = humans[j];
        const sameTeam = a.seat % 2 === b.seat % 2;
        if (!sameTeam) continue;
        const key = [a.uid, b.uid].sort().join('|');
        const cur = pairs.get(key) || { games: 0, wins: 0 };
        cur.games++;
        if (a.seat % 2 === winTeam) cur.wins++;
        pairs.set(key, cur);
      }
    }
  });

  const batch = db.batch();
  let flagged = 0;
  for (const [key, stat] of pairs) {
    if (stat.games >= 10 && stat.wins / stat.games >= 0.75) {
      const [uidA, uidB] = key.split('|');
      batch.set(db.collection('flags').doc(key), {
        type: 'collusion_suspect',
        uids: [uidA, uidB],
        games24h: stat.games,
        winRate: stat.wins / stat.games,
        flaggedAt: Date.now(),
        reviewed: false,
      }, { merge: true });
      flagged++;
    }
  }
  if (flagged) await batch.commit();
  console.log(`Collusion scan: ${snap.size} matches analyzed, ${flagged} pairs flagged`);
});

// ── Admin bootstrap ───────────────────────────────────────────────────
// Grants the `admin` custom claim that firestore.rules gates admin ops on.
// Callable by an existing admin, or with the one-time setup secret.
exports.setAdminClaim = onCall({ secrets: [ADMIN_SETUP_SECRET] }, async (request) => {
  const { targetUid, secret } = request.data || {};
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid required');

  const callerIsAdmin = request.auth?.token?.admin === true;
  const secretOk = secret && secret === ADMIN_SETUP_SECRET.value();
  if (!callerIsAdmin && !secretOk) throw new HttpsError('permission-denied', 'not authorized');

  await admin.auth().setCustomUserClaims(targetUid, { admin: true });
  return { ok: true, uid: targetUid };
});

// ── Server-authoritative settlement (migration target) ───────────────
// Clients currently self-report wins/coins; once this is deployed, move
// game-end writes here and tighten firestore.rules so users can no
// longer increment their own coins/wins.
exports.settleGame = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'sign in first');
  const { roomCode } = request.data || {};
  if (!roomCode) throw new HttpsError('invalid-argument', 'roomCode required');

  const roomSnap = await db.doc(`rooms/${roomCode}`).get();
  if (!roomSnap.exists) throw new HttpsError('not-found', 'room not found');
  const room = roomSnap.data();
  if (room.gd?.phase !== 'gameOver') throw new HttpsError('failed-precondition', 'game not over');
  if (room.settled) return { ok: true, already: true };

  const winTeam = room.gd.scores.a >= room.gd.scores.b ? 0 : 1;
  const batch = db.batch();
  (room.players || []).forEach(p => {
    if (p.isBot) return;
    const won = p.seat % 2 === winTeam;
    batch.update(db.doc(`users/${p.uid}`), {
      wins: admin.firestore.FieldValue.increment(won ? 1 : 0),
      losses: admin.firestore.FieldValue.increment(won ? 0 : 1),
      coins: admin.firestore.FieldValue.increment(won ? 50 : 10),
      lastActive: Date.now(),
    });
  });
  batch.update(roomSnap.ref, { settled: true });
  await batch.commit();
  return { ok: true, winTeam };
});
