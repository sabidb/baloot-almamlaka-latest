# Baloot Al-Mamlaka — Backend & Deployment

This document covers the Firestore security model, the autonomous backend
agents (Cloud Functions), and how to deploy everything.

## 1. Environment

Client Firebase config lives in `.env` (gitignored). Required keys:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## 2. Firestore rules & indexes

- `firestore.rules` — authenticated-only access; self-only profile writes;
  recipient-only friend-request/notification updates; append-only match
  telemetry; admin operations gated on a server-set `admin` custom claim.
- `firestore.indexes.json` — composite indexes for regional leaderboards
  (`city`+`wins`), notifications, and tournament queries.

Deploy:

```
firebase deploy --only firestore:rules,firestore:indexes
```

## 3. Autonomous agents (`functions/index.js`)

Requires the **Blaze** (pay-as-you-go) plan. `me-central1` region is set
for KSA data-locality (PDPL). Deploy:

```
cd functions && npm install && cd ..
firebase deploy --only functions
```

| Function | Trigger | Job |
|----------|---------|-----|
| `advanceTournaments` | every 5 min | Auto-advance brackets, seed next round, settle prizes on completion |
| `onRoomFinished` | room update | Records a tournament match winner when its room hits `gameOver` |
| `rankDecay` | daily 03:00 KSA | Decays wins of top players inactive 14+ days |
| `collusionScan` | daily 03:30 KSA | Scans 24h of match telemetry, flags suspicious same-team pairs |
| `setAdminClaim` | callable | Grants the `admin` custom claim |
| `settleGame` | callable | Server-authoritative multiplayer settlement (reads the room's authoritative state) |
| `settleBotGame` | callable | Bot-game reward, rate-limited (20s floor) to block farming |
| `claimDailyReward` | callable | Server-computed daily streak + coin grant |

### The economy is now server-authoritative ("the referee")
Clients can no longer write their own `coins`/`wins`/`losses`. `firestore.rules`
lets a client only *lower* its coins (spending in the store / tournament entry)
and never touch wins/losses/isVip; all increases go through the callables above,
which run with Admin SDK privileges and bypass the rules. This closes the
"open the console and mint 999,999 coins" hole.

- **Multiplayer** is fully refereed: `settleGame` reads the room doc's
  `gd.phase === 'gameOver'` and scores, so the client cannot lie about who won.
- **Bot games** have no shared server state to verify, so `settleBotGame`
  instead rate-limits (one settle per 20s) and centralizes the grant. The
  anti-collusion/telemetry pipeline catches abnormal patterns.

The region for callables is set in both `functions/index.js`
(`setGlobalOptions`) and `src/functions.js` (`FUNCTIONS_REGION`) — keep them
identical, and ideally matching your Firestore location.

### Anti-collusion logic (summary)
For each multiplayer match in the last 24h, every same-team human pair is
tallied (games together, wins together). Pairs with **≥10 games** and a
**≥75% win rate** are written to `flags/{pairKey}` for admin review. Tune
the thresholds in `collusionScan`.

## 4. Becoming an admin

The client admin PIN is **not** security — admin Firestore access needs the
`admin` custom claim. Two ways to grant it:

**A. Via the deployed callable (first admin uses the setup secret):**
```
firebase functions:secrets:set ADMIN_SETUP_SECRET   # set a strong value
# then call setAdminClaim({ targetUid, secret }) once from a signed-in client
```

**B. Locally with a service account (no deploy needed):**
```
# Console → Project settings → Service accounts → Generate new private key
node scripts/set-admin.js ./serviceAccount.json <your-uid>
```
Sign out/in afterwards to refresh your ID token.

## 5. Local testing with emulators

```
firebase emulators:start --only firestore,auth,functions --project baloot-almamlaka
```
The app points at production Firebase by default; the emulator harnesses
used during development connect explicitly via `connectFirestoreEmulator`.

## 6. Still to do (out of current scope)

- **Payments / ZATCA** — Apple Pay + Mada checkout and ZATCA Phase-2
  e-invoicing are not implemented; the coin-pack store shows "coming soon".
  This is the only remaining major backend track.
- **Provably-fair RNG** — shuffles now use `crypto.getRandomValues`; a
  commit-reveal seed scheme would make fairness verifiable by players.

## 7. Deploy order (first time)

```
firebase deploy --only firestore:rules,firestore:indexes   # security first
cd functions && npm install && cd ..
firebase deploy --only functions                           # referee + agents
node scripts/set-admin.js ./serviceAccount.json <your-uid> # become admin
```
The rules assume the referee callables exist, so deploy functions in the same
session. Until then, game rewards will fail silently (rules deny the client
writes) — expected, not a bug.
