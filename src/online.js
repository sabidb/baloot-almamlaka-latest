// ── Online room transport ────────────────────────────────
// One tiny interface, two backends:
//   • Firestore  — real cross-device play (used when Firebase is configured)
//   • Local (BroadcastChannel + localStorage) — same-browser play, so the
//     whole room/sync flow works (and is testable) even without a backend.
// A "room" is a single JSON document keyed by a short code.
import { getApps } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

let _db = null;
try { if (getApps().length) _db = getFirestore(getApps()[0]); } catch { _db = null; }

export const ONLINE_MODE = _db ? 'firestore' : 'local';
export function genRoomCode(){ return Math.floor(1000 + Math.random()*9000).toString(); }
export function now(){ return Date.now(); }

// ── Firestore backend ──
function firestoreRoom(code){
  const ref = doc(_db, 'rooms', code);
  return {
    async get(){ const s = await getDoc(ref); return s.exists() ? s.data() : null; },
    async set(state){ await setDoc(ref, state); },
    subscribe(cb){ return onSnapshot(ref, s => cb(s.exists() ? s.data() : null)); },
  };
}

// ── Local backend (same browser: BroadcastChannel + localStorage) ──
function localRoom(code){
  const key = `ludoroom:${code}`;
  const bc = ('BroadcastChannel' in globalThis) ? new BroadcastChannel(`ludoroom:${code}`) : null;
  const read = () => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } };
  return {
    async get(){ return read(); },
    async set(state){
      try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* quota */ }
      if (bc) bc.postMessage(state);
    },
    subscribe(cb){
      const onMsg = e => cb(e.data);
      const onStorage = e => { if (e.key === key) cb(read()); };
      if (bc) bc.addEventListener('message', onMsg);
      window.addEventListener('storage', onStorage);
      cb(read()); // prime with current value
      return () => { if (bc) bc.removeEventListener('message', onMsg); window.removeEventListener('storage', onStorage); if (bc) bc.close(); };
    },
  };
}

export function openRoom(code){
  return _db ? firestoreRoom(code) : localRoom(code);
}
