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
| `settleGame` | callable | Server-authoritative win/coin settlement (migration target) |

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
- **Server-authoritative economy** — clients currently self-report
  wins/coins. Migrate game-end writes to `settleGame` and then tighten
  `firestore.rules` to forbid client-side `coins`/`wins` increments.
- **Provably-fair RNG** — shuffles now use `crypto.getRandomValues`; a
  commit-reveal seed scheme would make fairness verifiable by players.
