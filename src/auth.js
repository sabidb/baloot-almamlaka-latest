import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';
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

// Popups are blocked/broken on most mobile browsers, so phones and tablets
// use a full-page redirect instead. The redirect result is picked up on
// return by getRedirect() + the auth-state listener.
function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
}

export function listenAuth(callback) {
  const { auth } = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

export async function signInGoogle() {
  const { auth, provider } = getFirebaseAuth();
  if (isMobile()) {
    // navigates away; result handled after the redirect returns
    return signInWithRedirect(auth, provider);
  }
  try {
    return await signInWithPopup(auth, provider);
  } catch (e) {
    const fallback = ['auth/popup-blocked', 'auth/cancelled-popup-request', 'auth/popup-closed-by-user', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'];
    if (e && fallback.includes(e.code)) {
      return signInWithRedirect(auth, provider);
    }
    throw e;
  }
}

// Completes a redirect sign-in on app load. Returns the result (or null).
export function getRedirect() {
  const { auth } = getFirebaseAuth();
  return getRedirectResult(auth);
}

export async function signOutUser() {
  const { auth } = getFirebaseAuth();
  return signOut(auth);
}
