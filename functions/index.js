// ── Baloot Al-Mamlaka — autonomous backend agents ─────────────────────
// Deploy requires the Blaze plan: firebase deploy --only functions
// All agents run with Admin SDK privileges (bypass Firestore rules).

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp();
const db = getFirestore();

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

    let changed = false;

    // Resolve matches whose game room has finished. This replaces a live
    // Firestore trigger — Cloud Functions/Eventarc are not available in the
    // me-central2 (Dammam) database region, so the scheduler polls instead.
    for (const m of matches) {
      if (m.room && !m.winner) {
        const rs = await db.doc(`rooms/${m.room}`).get();
        const rd = rs.exists ? rs.data() : null;
        if (rd?.gd?.phase === 'gameOver') {
          const winTeam = rd.gd.scores.a >= rd.gd.scores.b ? 0 : 1;
          const winnerUids = (rd.players || []).filter(p => p.seat % 2 === winTeam).map(p => p.uid);
          m.winner = winnerUids.includes(m.p1?.uid) ? m.p1.uid : m.p2?.uid;
          changed = true;
        }
      }
    }

    // BYE auto-advance
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
          coins: FieldValue.increment(Math.floor(prizeCoins * PRIZE_SPLIT[i])),
          tournamentWins: FieldValue.increment(i === 0 ? 1 : 0),
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

// (Tournament match rooms are resolved by polling inside
// advanceTournaments above — see note there. A live Firestore trigger
// isn't possible because Cloud Functions aren't offered in the
// me-central2 database region.)

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
      wins: FieldValue.increment(-decay),
      decayedWins: FieldValue.increment(decay),
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

  await getAuth().setCustomUserClaims(targetUid, { admin: true });
  return { ok: true, uid: targetUid };
});

// ── Server-authoritative settlement — the "referee" ──────────────────
// Rewards: win = 50 coins + 1 win, loss = 10 coins + 1 loss.
const WIN_COINS = 50;
const LOSS_COINS = 10;

// Multiplayer: the room doc holds the authoritative game state, so the
// server reads it directly — the client cannot lie about who won.
exports.settleGame = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'sign in first');
  const { roomCode } = request.data || {};
  if (!roomCode) throw new HttpsError('invalid-argument', 'roomCode required');

  return await db.runTransaction(async (tx) => {
    const roomRef = db.doc(`rooms/${roomCode}`);
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) throw new HttpsError('not-found', 'room not found');
    const room = roomSnap.data();
    if (room.gd?.phase !== 'gameOver') throw new HttpsError('failed-precondition', 'game not over');
    // Caller must actually be a player in this room.
    if (!(room.players || []).some(p => p.uid === request.auth.uid)) {
      throw new HttpsError('permission-denied', 'not a player in this room');
    }
    if (room.settled) return { ok: true, already: true };

    const winTeam = room.gd.scores.a >= room.gd.scores.b ? 0 : 1;
    (room.players || []).forEach(p => {
      if (p.isBot) return;
      const won = p.seat % 2 === winTeam;
      tx.update(db.doc(`users/${p.uid}`), {
        wins: FieldValue.increment(won ? 1 : 0),
        losses: FieldValue.increment(won ? 0 : 1),
        coins: FieldValue.increment(won ? WIN_COINS : LOSS_COINS),
        lastActive: Date.now(),
      });
    });
    tx.update(roomRef, { settled: true });
    return { ok: true, winTeam };
  });
});

// Bot games have no shared server state, so the outcome can't be verified
// the same way. We still route rewards through the server (so clients
// can't mint coins directly) and rate-limit to block scripted farming.
// A real Baloot game to 152 takes minutes; 20s is a generous floor.
const BOT_SETTLE_COOLDOWN_MS = 20000;
exports.settleBotGame = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'sign in first');
  const won = !!(request.data && request.data.won);
  const uid = request.auth.uid;

  return await db.runTransaction(async (tx) => {
    const ref = db.doc(`users/${uid}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'profile missing');
    const now = Date.now();
    const last = snap.data().lastBotSettleAt || 0;
    if (now - last < BOT_SETTLE_COOLDOWN_MS) {
      throw new HttpsError('resource-exhausted', 'too soon');
    }
    tx.update(ref, {
      wins: FieldValue.increment(won ? 1 : 0),
      losses: FieldValue.increment(won ? 0 : 1),
      coins: FieldValue.increment(won ? WIN_COINS : LOSS_COINS),
      lastActive: now,
      lastBotSettleAt: now,
    });
    return { ok: true, coins: won ? WIN_COINS : LOSS_COINS };
  });
});

// Daily reward: streak and payout computed server-side so the coin grant
// is authoritative (clients can no longer self-award).
const DAILY_COINS = [50, 75, 100, 150, 200, 300, 500];
exports.claimDailyReward = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'sign in first');
  const uid = request.auth.uid;

  return await db.runTransaction(async (tx) => {
    const ref = db.doc(`users/${uid}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'profile missing');
    const d = snap.data();
    const now = Date.now();
    const hoursSince = (now - (d.lastDailyClaim || 0)) / 3600000;
    if (hoursSince < 20) throw new HttpsError('failed-precondition', 'already claimed today');

    const streakBroken = hoursSince > 48;
    const newStreak = streakBroken ? 1 : Math.min((d.dailyStreak || 0) + 1, 7);
    const reward = DAILY_COINS[newStreak - 1];

    tx.update(ref, {
      coins: FieldValue.increment(reward),
      dailyStreak: newStreak,
      lastDailyClaim: now,
      lastActive: now,
      totalDailysClaimed: FieldValue.increment(1),
    });
    return { ok: true, reward, dailyStreak: newStreak };
  });
});
