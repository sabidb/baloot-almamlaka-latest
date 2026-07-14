// Cloud Function: fair, server-side Baloot dealing.
//
// The room doc is public, so client-dealt hands can be read by any player —
// a cheat vector for a hidden-hand card game. This function deals on the
// server with a CSPRNG and writes each HUMAN player's hand to a private
// document (rooms/{code}/private/{uid}) that only that player can read.
// Bot hands stay in the public state (bots are host-run, nothing to hide).
//
// Deploy:  firebase deploy --only functions
// The client enables this path automatically when the function exists (see
// FIREBASE_SETUP.md → "Fair dealing").

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');

initializeApp();
const db = getFirestore();

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1); // cryptographically secure
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function deal() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ r, s, id: r + s });
  shuffle(d);
  return [d.slice(0, 8), d.slice(8, 16), d.slice(16, 24), d.slice(24, 32)];
}

exports.dealBaloot = onCall(async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const code = String((req.data || {}).code || '');
  if (!code) throw new HttpsError('invalid-argument', 'Missing room code.');

  const ref = db.doc('rooms/' + code);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Room not found.');
  const room = snap.data();
  if (room.host !== uid) throw new HttpsError('permission-denied', 'Only the host can deal.');

  const players = room.players || {};
  const hands = deal();
  const dealer = crypto.randomInt(4);
  const prevMatch = (room.state && room.state.matchScores) || [0, 0];
  const prevEvt = (room.state && room.state.evt) || 0;

  // Public state: bot hands stay public; human hands are stripped out.
  const publicHands = hands.map((h, seat) => (players[seat] ? [] : h));
  const state = {
    phase: 'bidding', dealer, bidTurn: (dealer + 1) % 4, turn: (dealer + 1) % 4, passCount: 0,
    contract: null, trick: [], roundScores: [0, 0], tricksWon: [0, 0], lastWinner: null,
    roundResult: null, matchScores: prevMatch, hands: publicHands, evt: prevEvt + 1,
    banner: null, serverDealt: true,
  };

  const batch = db.batch();
  batch.set(ref, { ...room, status: 'playing', state, ts: Date.now() });
  for (let seat = 0; seat < 4; seat++) {
    const pl = players[seat];
    if (pl && pl.uid) {
      batch.set(db.doc(`rooms/${code}/private/${pl.uid}`), { seat, hand: hands[seat], evt: state.evt });
    }
  }
  await batch.commit();
  return { ok: true, evt: state.evt };
});
