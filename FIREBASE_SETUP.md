# Firebase setup — auth, leaderboard & online Ludo

The app works with **zero setup** in guest/offline mode. To turn on Google
sign-in, the persistent leaderboard, and **true cross-device online Ludo**,
connect a Firebase project.

## How online mode is chosen

`src/online.js` picks a transport at runtime:

- **Firebase configured** → Firestore. Real online play across devices.
- **Not configured** → a same-browser channel (BroadcastChannel + localStorage).
  Online Ludo still works between tabs on one device — handy for testing.

The online lobby shows which mode is active.

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project**.
2. In the project, **Build → Firestore Database → Create database**
   (start in production mode; we ship rules below).
3. **Build → Authentication → Get started → enable Google** (for sign-in).
   Optional: also enable **Anonymous** if you later want signed-in guests.

## 2. Get the web config

**Project settings → General → Your apps →** add a **Web app**, then copy the
`firebaseConfig` values into a local `.env` (copy from `.env.example`):

```
VITE_FIREBASE_API_KEY=…
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=…
VITE_FIREBASE_APP_ID=…
```

`.env` is git-ignored. For hosting/CI, set the same as build-time env vars.

## 3. Deploy the security rules

```
npm i -g firebase-tools
firebase login
firebase use --add            # pick your project
firebase deploy --only firestore:rules
```

Rules live in `firestore.rules`:

- `users/{uid}` — world-readable (leaderboard), owner-writable.
- `rooms/{code}` — open read/write so guests can play online without auth.
  Ephemeral game state, no sensitive data. Hardening notes are in the file.

## 4. Run / build / host

```
npm run dev            # local dev with your .env
npm run build          # → dist/
firebase deploy --only hosting   # optional: host on Firebase (firebase.json)
```

## Data model

- `users/{uid}` — profile: name, avatar, city, coins, wins, losses, ludoWins,
  inventory, equipped cosmetics.
- `rooms/{code}` — an online Ludo room:
  `{ code, host, seatsWanted, active[], players{seat→{uid,name,avatar}},
     status: waiting|playing|over, state: <ludo game state> }`.
  The client whose turn it is writes the next state; the host also runs bot
  seats and covers a disconnected player after a timeout.

## Fair dealing (anti-cheat) for online Baloot

Online rooms are client-authoritative: the room doc holds the full game
state. That's fine for Ludo (all pieces are public) and works for casual
Baloot with friends — but because the doc is readable, a determined player
could inspect opponents' **hidden hands**. To remove that vector, deal on
the server.

`functions/dealBaloot` (provided) deals with a CSPRNG and writes each human
player's hand to a **private** doc `rooms/{code}/private/{uid}` that only
that player can read (see `firestore.rules`); bot hands stay public. Deploy:

```
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules
```

The client wiring now ships, gated behind an **opt-in flag** so nothing
changes until you deploy the function:

1. Deploy the function and rules (command above).
2. Set `VITE_FAIR_DEAL=1` in your `.env` (see `.env.example`) and rebuild.

With the flag on, the host deals every round through `dealBaloot`; each
client subscribes to its private hand (`rooms/{code}/private/{uid}`),
rehydrates the compact server cards, and renders/validates from it. Public
state carries `[]` for human seats and full hands only for bots. If the
function is unreachable, the host transparently falls back to a local deal so
the game still starts.

Known limits of the client-authoritative fallback within fair mode: a fully
**disconnected** human can't be auto-covered by the host (their hand is
hidden), and a **mid-round reload** re-seeds the full private hand. For full
server authority (covering disconnects, validating plays), move turn
resolution into a second Cloud Function.

With the flag off (default), online Baloot uses the verified
client-authoritative path.

## Notes / later

- Rooms aren't auto-deleted. Add a scheduled Cloud Function or a TTL policy to
  clean up old `rooms/*`.
- The room model is client-authoritative (fine for casual play with friends).
  For anti-cheat, move turn resolution into a Cloud Function or validate
  seat/turn ownership in the rules.
