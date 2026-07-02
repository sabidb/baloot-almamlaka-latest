#!/usr/bin/env node
// Grants the `admin` custom claim locally with a service account —
// use this before Cloud Functions are deployed, or as a fallback.
//
// 1. Firebase Console → Project settings → Service accounts →
//    Generate new private key → save as serviceAccount.json (DO NOT COMMIT)
// 2. node scripts/set-admin.js ./serviceAccount.json <uid>
//    (find your uid in Console → Authentication → Users)
//
// The user must sign out/in afterwards to refresh their ID token.

const admin = require('firebase-admin');

const [, , keyPath, uid] = process.argv;
if (!keyPath || !uid) {
  console.error('usage: node scripts/set-admin.js <serviceAccount.json> <uid>');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(require('path').resolve(keyPath))) });

admin.auth().setCustomUserClaims(uid, { admin: true }).then(() => {
  console.log(`admin claim granted to ${uid} — user must sign out/in to take effect`);
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
