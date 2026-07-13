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

## Notes / later

- Rooms aren't auto-deleted. Add a scheduled Cloud Function or a TTL policy to
  clean up old `rooms/*`.
- The room model is client-authoritative (fine for casual play with friends).
  For anti-cheat, move turn resolution into a Cloud Function or validate
  seat/turn ownership in the rules.
