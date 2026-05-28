import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getApp } from 'firebase/app';

let _auth = null;
let _provider = null;

function getFirebaseAuth() {
  if (!_auth) {
    _auth = getAuth(getApp());
    _provider = new GoogleAuthProvider();
    _provider.setCustomParameters({ prompt: 'select_account' });
  }
  return { auth: _auth, provider: _provider };
}

export function listenAuth(callback) {
  const { auth } = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

export async function signInGoogle() {
  const { auth, provider } = getFirebaseAuth();
  return signInWithPopup(auth, provider);
}

export async function signOutUser() {
  const { auth } = getFirebaseAuth();
  return signOut(auth);
}
