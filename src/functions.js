import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Must match the region set in functions/index.js (setGlobalOptions).
// Keep this in sync with your Firestore location for lowest latency.
export const FUNCTIONS_REGION = 'me-central1';

const fns = getFunctions(getApp(), FUNCTIONS_REGION);

// The referee: server-authoritative game settlement & reward grants.
// Each returns the callable's data payload, or throws on failure.
export const settleMultiplayerGame = (roomCode) =>
  httpsCallable(fns, 'settleGame')({ roomCode }).then(r => r.data);

export const settleBotGame = (won, myScore = 0) =>
  httpsCallable(fns, 'settleBotGame')({ won, myScore }).then(r => r.data);

export const claimDailyReward = () =>
  httpsCallable(fns, 'claimDailyReward')().then(r => r.data);

// Claim a completed daily mission — validated server-side against the
// referee's progress record. Returns { reward } (coins granted).
export const claimMission = (missionId) =>
  httpsCallable(fns, 'claimMission')({ missionId }).then(r => r.data);
