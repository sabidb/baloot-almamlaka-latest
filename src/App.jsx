import { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';

// ─── Firebase ────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const app      = initializeApp(firebaseConfig);
const db       = getFirestore(app);
const auth     = getAuth(app);
const gProvider= new GoogleAuthProvider();

// ─── Design tokens ───────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;700&family=Tajawal:wght@300;400;500;700;900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

:root {
  --black:       #07090A;
  --s1:          #0C1410;
  --s2:          #101A12;
  --s3:          #162014;
  --felt:        #0A1F0E;
  --gd:          #7A5B1A;
  --gm:          #C49B2E;
  --gold:        #F0C040;
  --gl:          #FFE08A;
  --gg:          rgba(240,192,64,.35);
  --green:       #2ECC71;
  --red:         #E74C3C;
  --blue:        #3498DB;
  --white:       #F0EDE5;
  --wd:          rgba(240,237,229,.55);
  --wf:          rgba(240,237,229,.10);
  --sh-gold:     0 0 40px rgba(240,192,64,.25),0 0 80px rgba(240,192,64,.10);
  --sh-card:     0 8px 32px rgba(0,0,0,.7),0 2px 8px rgba(0,0,0,.5);
  --r-card:      12px;
  --r-btn:       12px;
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bot:    env(safe-area-inset-bottom, 0px);
  --nav-h:       60px;
}

html, body, #root {
  height: 100%;
  background: var(--black);
  font-family: 'Tajawal', sans-serif;
  color: var(--white);
  direction: rtl;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

/* ── SCROLLABLE INNER ── */
.scroll-page {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* ── APP SHELL ── */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  height: 100dvh;
  background: var(--black);
}
.app-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}
.page {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding-top: var(--safe-top);
}

/* ── BOTTOM NAV ── */
.bottom-nav {
  flex-shrink: 0;
  height: calc(var(--nav-h) + var(--safe-bot));
  padding-bottom: var(--safe-bot);
  background: rgba(10,14,12,.97);
  border-top: 1px solid rgba(240,192,64,.13);
  display: flex;
  backdrop-filter: blur(20px);
  z-index: 100;
}
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  transition: all .2s;
  padding: 6px 2px;
  position: relative;
  min-width: 0;
}
.nav-icon { font-size: 20px; line-height: 1; transition: transform .25s cubic-bezier(.34,1.56,.64,1); }
.nav-label { font-size: 9px; font-weight: 700; color: var(--wd); white-space: nowrap; transition: color .2s; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.nav-item.active .nav-icon { transform: translateY(-3px) scale(1.15); }
.nav-item.active .nav-label { color: var(--gold); }
.nav-item.active::after {
  content: '';
  position: absolute;
  bottom: 0; left: 50%;
  transform: translateX(-50%);
  width: 28px; height: 2px;
  border-radius: 2px;
  background: var(--gold);
  box-shadow: 0 0 8px var(--gg);
}
.nav-badge {
  position: absolute;
  top: 4px; left: 50%;
  transform: translateX(4px);
  background: var(--red);
  color: #fff;
  font-size: 9px; font-weight: 900;
  min-width: 15px; height: 15px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  padding: 0 3px;
  border: 1px solid var(--black);
}

/* ── FELT TABLE ── */
.table {
  width: 100%; height: 100%;
  min-height: 100%;
  background: radial-gradient(ellipse 90% 70% at 50% 50%, #0F2A14 0%, #07090A 100%);
  position: relative;
  overflow: hidden;
}
.table::before {
  content: '';
  position: absolute; inset: 0;
  background-image:
    repeating-linear-gradient(0deg,  transparent, transparent 3px, rgba(255,255,255,.012) 3px, rgba(255,255,255,.012) 4px),
    repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,.012) 3px, rgba(255,255,255,.012) 4px);
  pointer-events: none; z-index: 0;
}
.table::after {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 100% 100% at 50% 50%, transparent 30%, rgba(0,0,0,.65) 100%);
  pointer-events: none; z-index: 0;
}

/* ── ORNAMENT RINGS ── */
.ring {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 1;
  top: 50%; left: 50%;
  transform: translate(-50%,-50%);
}
.ring-1 {
  width: min(82vw,340px); height: min(82vw,340px);
  border: 1px solid rgba(240,192,64,.18);
  animation: rotateSlow 60s linear infinite;
}
.ring-2 {
  width: min(66vw,270px); height: min(66vw,270px);
  border: 1px dashed rgba(240,192,64,.1);
  animation: rotateSlow 40s linear infinite reverse;
}
@keyframes rotateSlow { to { transform: translate(-50%,-50%) rotate(360deg); } }

/* ── CARDS ── */
.card {
  width: 56px; height: 80px;
  border-radius: var(--r-card);
  background: linear-gradient(145deg,#FEFDF8,#F5F0E8);
  border: 1px solid rgba(0,0,0,.12);
  box-shadow: var(--sh-card);
  display: flex; flex-direction: column;
  align-items: center; justify-content: space-between;
  padding: 4px 3px;
  position: relative;
  cursor: pointer;
  will-change: transform;
  backface-visibility: hidden;
  touch-action: manipulation;
}
.card.red .cr, .card.red .cs, .card.crb { color: #C0392B; }
.card.black .cr, .card.black .cs, .card.crb { color: #1a1a1a; }
.cr  { font-family:'Scheherazade New',serif; font-size:16px; font-weight:700; line-height:1; align-self:flex-start; }
.cs  { font-size:22px; line-height:1; }
.crb { font-family:'Scheherazade New',serif; font-size:16px; font-weight:700; line-height:1; align-self:flex-end; transform:rotate(180deg); }
.card-back-inner {
  width:100%; height:100%;
  border-radius: calc(var(--r-card) - 1px);
  background: linear-gradient(135deg,#0D5C2A,#1A3D20,#0D5C2A);
  display:flex; align-items:center; justify-content:center;
  position:relative;
}
.card-back-inner::before {
  content:'';
  position:absolute; inset:4px;
  border-radius:8px;
  border:1px solid rgba(240,192,64,.4);
}
.card-back-logo { font-family:'Scheherazade New',serif; font-size:16px; color:rgba(240,192,64,.6); }

/* ── HAND CARDS ── */
.hand-wrap {
  position: absolute;
  bottom: 8px;
  left: 0; right: 0;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 110px;
  z-index: 30;
  padding: 0 8px;
}
.hand-card {
  width: 56px; height: 80px;
  border-radius: var(--r-card);
  background: linear-gradient(145deg,#FEFDF8,#F5F0E8);
  border: 1px solid rgba(0,0,0,.12);
  box-shadow: var(--sh-card);
  display: flex; flex-direction: column;
  align-items: center; justify-content: space-between;
  padding: 4px 3px;
  cursor: pointer;
  transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s, border-color .2s;
  transform-origin: center bottom;
  position: absolute;
  will-change: transform;
  touch-action: manipulation;
}
.hand-card.selected {
  border-color: var(--green);
  box-shadow: 0 0 0 2px rgba(46,204,113,.4), var(--sh-card);
}

/* ── TRICK AREA ── */
.trick-wrap {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  width: 200px; height: 160px;
  z-index: 20;
}
.trick-card {
  width: 56px; height: 80px;
  border-radius: var(--r-card);
  background: linear-gradient(145deg,#FEFDF8,#F5F0E8);
  border: 1px solid rgba(0,0,0,.12);
  box-shadow: var(--sh-card);
  display: flex; flex-direction: column;
  align-items: center; justify-content: space-between;
  padding: 4px 3px;
  position: absolute;
  animation: dealIn .35s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes dealIn {
  from { opacity:0; transform: scale(.5) translateY(30px) rotate(20deg); }
  to   { opacity:1; }
}
.trick-flash {
  position: absolute;
  inset: -30px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(240,192,64,.3) 0%, transparent 70%);
  pointer-events: none;
  animation: flashBurst .6s ease-out forwards;
  z-index: 21;
}
@keyframes flashBurst {
  0%   { opacity:0; transform:scale(.5); }
  40%  { opacity:1; transform:scale(1.2); }
  100% { opacity:0; transform:scale(2.2); }
}

/* ── PLAYER ZONES ── */
.pzone { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 10; }
.pzone-top    { top: 8px;  left: 50%; transform: translateX(-50%); }
.pzone-left   { left: 6px; top: 50%; transform: translateY(-50%); }
.pzone-right  { right: 6px; top: 50%; transform: translateY(-50%); }

.avatar {
  width: 44px; height: 44px;
  border-radius: 50%;
  border: 2px solid var(--gd);
  background: var(--s2);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
  transition: border-color .3s, box-shadow .3s;
  flex-shrink: 0;
}
.avatar.active {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(240,192,64,.25), var(--sh-gold);
  animation: avPulse 1.5s ease-in-out infinite;
}
@keyframes avPulse {
  0%,100% { box-shadow: 0 0 0 3px rgba(240,192,64,.25), 0 0 15px rgba(240,192,64,.2); }
  50%     { box-shadow: 0 0 0 5px rgba(240,192,64,.4),  0 0 30px rgba(240,192,64,.35); }
}
.pname { font-size: 11px; font-weight: 700; color: var(--wd); white-space: nowrap; max-width: 70px; overflow: hidden; text-overflow: ellipsis; }
.pname.active { color: var(--gold); }
.pscore {
  background: var(--s2);
  border: 1px solid var(--s3);
  border-radius: 20px;
  padding: 1px 8px;
  font-size: 11px; font-weight: 700;
  color: var(--wd);
}
.pscore.active { border-color: var(--gd); color: var(--gold); }

/* opponent mini cards */
.opp-cards { display: flex; margin-top: 2px; }
.opp-card {
  width: 20px; height: 30px;
  border-radius: 4px;
  background: linear-gradient(135deg,#0D5C2A,#1A3D20);
  border: 1px solid rgba(240,192,64,.3);
  margin-right: -8px;
  box-shadow: 0 2px 8px rgba(0,0,0,.6);
}

/* ── TRUMP ── */
.trump {
  position: absolute;
  top: 50%; right: 10px;
  transform: translateY(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  z-index: 15;
  background: rgba(10,14,12,.7);
  border: 1px solid rgba(240,192,64,.2);
  border-radius: 10px;
  padding: 6px 8px;
  backdrop-filter: blur(10px);
}
.trump-lbl { font-size: 9px; color: var(--wd); font-weight: 700; letter-spacing: 1px; }
.trump-suit { font-size: 26px; animation: suitGlow 2s ease-in-out infinite; }
@keyframes suitGlow {
  0%,100% { filter: drop-shadow(0 0 6px rgba(240,192,64,.4)); }
  50%      { filter: drop-shadow(0 0 14px rgba(240,192,64,.7)); }
}

/* ── MODE CHIPS ── */
.mode-row {
  position: absolute;
  top: 8px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 6px;
  z-index: 15;
}
.mode-chip {
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 11px; font-weight: 700;
  border: 1.5px solid;
  cursor: pointer;
  transition: all .2s;
  font-family: 'Tajawal',sans-serif;
}
.mode-chip.hokum { border-color: var(--gd); background: rgba(122,91,26,.18); color: var(--gold); }
.mode-chip.hokum.active { background: linear-gradient(135deg,var(--gd),var(--gm)); color: var(--black); box-shadow: 0 4px 16px var(--gg); }
.mode-chip.sun { border-color: rgba(46,204,113,.5); background: rgba(26,61,32,.18); color: var(--green); }
.mode-chip.sun.active { background: linear-gradient(135deg,#1A5C28,#26592E); color:#fff; box-shadow:0 4px 16px rgba(46,204,113,.3); }

/* ── SCORE TICKER ── */
.score-ticker {
  position: absolute;
  top: 32px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 8px; align-items: center;
  z-index: 15;
  margin-top: 0;
}
.score-team {
  background: rgba(10,14,12,.8);
  border: 1px solid rgba(240,192,64,.15);
  border-radius: 10px;
  padding: 3px 10px;
  font-size: 12px; font-weight: 900;
  backdrop-filter: blur(10px);
}
.score-team span { color: var(--gold); font-size: 14px; }
.score-vs { font-size: 10px; color: var(--wd); }

/* ── GAME ACTION BAR ── */
.game-action-bar {
  position: absolute;
  bottom: calc(var(--nav-h) + var(--safe-bot) + 118px);
  left: 0; right: 0;
  display: flex;
  justify-content: center;
  gap: 8px;
  z-index: 35;
  padding: 0 12px;
}

/* ── BUTTONS ── */
.btn {
  padding: 10px 18px;
  border-radius: var(--r-btn);
  font-family: 'Tajawal',sans-serif;
  font-size: 13px; font-weight: 700;
  border: none; cursor: pointer;
  transition: all .2s cubic-bezier(.34,1.56,.64,1);
  position: relative; overflow: hidden;
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.btn:active { transform: scale(.94); }
.btn-gold {
  background: linear-gradient(135deg,#8B6914,#D4A820,#F0C040,#D4A820);
  background-size: 200% 200%;
  color: var(--black);
  box-shadow: 0 4px 16px var(--gg), 0 2px 6px rgba(0,0,0,.4);
  animation: gradShift 3s ease infinite;
}
@keyframes gradShift { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }
.btn-gold:hover { box-shadow: 0 6px 24px var(--gg); transform: translateY(-1px); }
.btn-ghost {
  background: var(--wf);
  color: var(--wd);
  border: 1px solid rgba(255,255,255,.1);
  backdrop-filter: blur(10px);
}
.btn-ghost:hover { background: rgba(255,255,255,.14); color: var(--white); }
.btn-green { background: linear-gradient(135deg,#1A5C28,var(--green)); color:#fff; box-shadow:0 4px 16px rgba(46,204,113,.3); }
.btn-red   { background: linear-gradient(135deg,#8B1A1A,var(--red)); color:#fff; }
.btn-sm    { padding: 7px 14px; font-size: 12px; }
.btn-lg    { padding: 14px 28px; font-size: 15px; }
.btn-full  { width: 100%; }

/* ── TAKE TRICK BUTTON ── */
.take-trick-btn {
  position: absolute;
  bottom: -44px; left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  white-space: nowrap;
}

/* ── TOAST ── */
.toast {
  position: fixed;
  top: calc(var(--safe-top) + 12px);
  left: 50%; transform: translateX(-50%);
  background: rgba(8,12,10,.95);
  border: 1px solid var(--gd);
  border-radius: 10px;
  padding: 10px 20px;
  font-size: 13px; font-weight: 700;
  color: var(--gold);
  backdrop-filter: blur(20px);
  z-index: 600;
  white-space: nowrap;
  animation: toastIn .4s cubic-bezier(.34,1.56,.64,1) both, toastOut .3s ease forwards 2.1s;
  box-shadow: 0 8px 28px rgba(0,0,0,.6), var(--sh-gold);
  pointer-events: none;
}
@keyframes toastIn  { from { opacity:0; transform:translateX(-50%) translateY(-18px) scale(.9); } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } }
@keyframes toastOut { to   { opacity:0; transform:translateX(-50%) translateY(-10px); } }

/* ── PARTICLES ── */
.particle {
  position: fixed; pointer-events: none;
  border-radius: 50%; z-index: 999;
  animation: particleFly var(--dur) ease-out forwards;
}
@keyframes particleFly {
  0%   { opacity:1; transform:translate(0,0) scale(1) rotate(0deg); }
  100% { opacity:0; transform:translate(var(--tx),var(--ty)) scale(0) rotate(720deg); }
}
.coin-fly {
  position: fixed; pointer-events: none;
  font-size: 20px; z-index: 998;
  animation: coinFly var(--dur) ease-out forwards;
}
@keyframes coinFly {
  0%   { opacity:1; transform:translate(0,0) scale(1) rotate(0deg); }
  80%  { opacity:1; }
  100% { opacity:0; transform:translate(var(--tx),var(--ty)) scale(.5) rotate(540deg); }
}

/* ── WIN OVERLAY ── */
.win-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.88);
  display: flex; align-items: center; justify-content: center;
  z-index: 500;
  animation: fadeIn .4s ease both;
  padding: 20px;
}
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
.win-card {
  background: radial-gradient(ellipse at top, #1A3D20, var(--s1));
  border: 1px solid var(--gold);
  border-radius: 22px;
  padding: 36px 28px;
  text-align: center;
  box-shadow: var(--sh-gold), 0 50px 100px rgba(0,0,0,.9);
  animation: winIn .6s cubic-bezier(.34,1.56,.64,1) both .2s;
  width: 100%; max-width: 340px;
}
@keyframes winIn { from { opacity:0; transform:scale(.6) translateY(50px); } to { opacity:1; transform:scale(1) translateY(0); } }
.win-trophy { font-size: 60px; animation: trophyBounce .6s cubic-bezier(.34,1.56,.64,1) both .5s; display:block; }
@keyframes trophyBounce { from { opacity:0; transform:scale(0) rotate(-20deg); } to { opacity:1; transform:scale(1) rotate(0); } }
.win-title { font-family:'Scheherazade New',serif; font-size:30px; color:var(--gold); margin:12px 0 6px; text-shadow:0 0 24px var(--gg); animation:fadeUp .5s ease both .7s; }
.win-sub   { font-size:13px; color:var(--wd); animation:fadeUp .5s ease both .85s; }
.win-scores { margin:20px 0; display:flex; justify-content:center; gap:30px; animation:fadeUp .5s ease both 1s; }
.win-score-item { display:flex; flex-direction:column; align-items:center; gap:2px; }
.win-score-num  { font-size:36px; font-weight:900; color:var(--gold); line-height:1; }
.win-score-lbl  { font-size:11px; color:var(--wd); }
@keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }

/* ── PANEL (modal) ── */
.panel-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.75);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 400;
  animation: fadeIn .25s ease both;
  padding-bottom: var(--safe-bot);
}
.panel {
  background: var(--s1);
  border: 1px solid rgba(240,192,64,.18);
  border-radius: 22px 22px 0 0;
  padding: 24px 20px;
  width: 100%; max-width: 480px;
  animation: slideUp .35s cubic-bezier(.34,1.56,.64,1) both;
  max-height: 80vh;
  overflow-y: auto;
}
@keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
.panel-handle {
  width: 40px; height: 4px;
  border-radius: 2px;
  background: rgba(255,255,255,.15);
  margin: 0 auto 20px;
}
.panel-title {
  font-family:'Scheherazade New',serif;
  font-size: 22px; color: var(--gold);
  text-align: center;
  margin-bottom: 20px;
}

/* ── HOME / LOBBY ── */
.home-hero {
  text-align: center;
  padding: 20px 16px 0;
  position: relative;
}
.home-logo {
  font-family:'Scheherazade New',serif;
  font-size: clamp(32px,10vw,50px);
  background: linear-gradient(135deg,#7A5B1A,#F0C040,#FFE08A,#F0C040,#7A5B1A);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 16px rgba(240,192,64,.35));
  line-height: 1.1; margin-bottom: 4px;
}
.home-tagline { color: var(--wd); font-size: 12px; letter-spacing: 2px; margin-bottom: 10px; }
.home-divider { width:80px; height:1px; margin:0 auto 20px; background:linear-gradient(90deg,transparent,var(--gd),transparent); }
.mode-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 12px; }
.mode-card {
  background: rgba(13,20,16,.75);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px;
  padding: 18px 12px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  cursor: pointer;
  transition: all .25s cubic-bezier(.34,1.56,.64,1);
  backdrop-filter: blur(10px);
  position: relative; overflow: hidden;
  touch-action: manipulation;
}
.mode-card:active { transform: scale(.95); }
.mode-card-icon  { font-size: 28px; }
.mode-card-title { font-size: 13px; font-weight: 700; }
.mode-card-sub   { font-size: 10px; color: var(--wd); text-align: center; line-height: 1.3; }
.mode-card-tag {
  position: absolute; top: 8px; right: 8px;
  font-size: 8px; font-weight: 700; padding: 2px 5px; border-radius: 5px;
  line-height: 1.4;
}

.stats-bar {
  display: flex; gap: 0;
  background: rgba(13,20,16,.75);
  border: 1px solid rgba(240,192,64,.1);
  border-radius: 14px;
  margin: 12px 12px 0;
  backdrop-filter: blur(10px);
  overflow: hidden;
}
.stat-item {
  flex: 1; text-align: center;
  padding: 10px 4px;
  border-right: 1px solid rgba(255,255,255,.06);
}
.stat-item:last-child { border-right: none; }
.stat-num  { font-size: 16px; font-weight: 900; color: var(--gold); }
.stat-lbl  { font-size: 9px;  color: var(--wd); margin-top: 1px; }

/* ── LEADERBOARD ── */
.lb-header { padding: 16px 14px 8px; }
.lb-title  { font-family:'Scheherazade New',serif; font-size:22px; color:var(--gold); text-align:center; }
.lb-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--wf);
  transition: background .2s;
  cursor: pointer;
}
.lb-row:active { background: var(--wf); }
.lb-rank { font-size: 14px; font-weight: 900; color: var(--wd); width: 24px; text-align: center; flex-shrink:0; }
.lb-rank.gold   { color:#FFD700; font-size:18px; }
.lb-rank.silver { color:#C0C0C0; font-size:18px; }
.lb-rank.bronze { color:#CD7F32; font-size:18px; }
.lb-av   { font-size: 24px; flex-shrink:0; }
.lb-name { flex:1; font-size:13px; font-weight:700; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lb-city { font-size:10px; color:var(--wd); }
.lb-win  { font-size:13px; font-weight:900; color:var(--gold); flex-shrink:0; }

/* ── PROFILE ── */
.profile-hero {
  text-align: center;
  padding: 24px 16px 16px;
  background: linear-gradient(180deg, rgba(26,61,32,.5) 0%, transparent 100%);
}
.profile-av   { font-size:60px; margin-bottom:8px; }
.profile-name { font-size:20px; font-weight:900; margin-bottom:2px; }
.profile-city { font-size:12px; color:var(--wd); margin-bottom:12px; }
.profile-stats { display:flex; justify-content:center; gap:20px; }
.profile-stat  { display:flex; flex-direction:column; align-items:center; gap:2px; }
.profile-stat-num { font-size:22px; font-weight:900; color:var(--gold); }
.profile-stat-lbl { font-size:10px; color:var(--wd); }

.profile-section  { padding: 0 14px; margin-top: 16px; }
.profile-sec-title { font-size:11px; font-weight:700; color:var(--wd); letter-spacing:1px; margin-bottom:8px; text-transform:uppercase; }
.profile-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px;
  background: var(--s2);
  border-radius: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background .2s;
}
.profile-item:active { background: var(--s3); }
.profile-item-icon { font-size:20px; flex-shrink:0; }
.profile-item-text { flex:1; }
.profile-item-label { font-size:13px; font-weight:700; }
.profile-item-sub   { font-size:11px; color:var(--wd); }
.profile-item-arrow { color:var(--wd); font-size:12px; }

/* ── STORE ── */
.store-header { padding: 16px 14px 8px; text-align:center; }
.store-title  { font-family:'Scheherazade New',serif; font-size:22px; color:var(--gold); }
.coin-bar {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(13,20,16,.8);
  border: 1px solid var(--gd);
  border-radius: 12px;
  margin: 0 12px 12px; padding: 10px 14px;
  backdrop-filter: blur(10px);
}
.coin-bal { display:flex; align-items:center; gap:6px; font-size:16px; font-weight:900; color:var(--gold); }
.store-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 12px 16px; }
.store-item {
  background: rgba(13,20,16,.75);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px;
  padding: 16px 12px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  cursor: pointer;
  transition: all .25s cubic-bezier(.34,1.56,.64,1);
  backdrop-filter: blur(10px);
  position: relative; overflow: hidden;
  touch-action: manipulation;
}
.store-item:active { transform:scale(.95); border-color:var(--gd); box-shadow:var(--sh-gold); }
.store-item-icon  { font-size:30px; }
.store-item-name  { font-size:12px; font-weight:700; text-align:center; }
.store-item-price {
  font-size:13px; font-weight:900; color:var(--gold);
  background: rgba(240,192,64,.1);
  padding: 3px 10px; border-radius:20px;
  border: 1px solid rgba(240,192,64,.2);
}
.store-item-tag {
  position:absolute; top:8px; right:8px;
  font-size:8px; font-weight:700; padding:2px 5px; border-radius:5px;
  line-height: 1.4;
}

/* ── ROOM SCREEN ── */
.room-wrap { padding: 20px 16px; display:flex; flex-direction:column; gap:14px; }
.room-code-box {
  text-align:center;
  background: var(--s2);
  border: 1px solid var(--gd);
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--sh-gold);
}
.room-code-lbl { font-size:11px; color:var(--wd); letter-spacing:1px; margin-bottom:4px; }
.room-code-num {
  font-family:'Scheherazade New',serif;
  font-size:38px; font-weight:700; color:var(--gold);
  letter-spacing:8px;
  text-shadow:0 0 20px var(--gg);
}
.player-slot {
  display:flex; align-items:center; gap:10px;
  background: var(--s2);
  border: 1px solid rgba(255,255,255,.07);
  border-radius:12px; padding:12px;
}
.slot-av    { font-size:24px; }
.slot-name  { flex:1; font-size:13px; font-weight:700; }
.slot-badge { font-size:10px; color:var(--wd); background:var(--wf); padding:3px 8px; border-radius:8px; }
.join-input {
  background: var(--s2);
  border: 1px solid rgba(240,192,64,.3);
  border-radius: 12px;
  padding: 14px 16px;
  font-family:'Tajawal',sans-serif;
  font-size:18px; font-weight:700;
  color:var(--white);
  text-align:center;
  letter-spacing:4px;
  width:100%;
  outline:none;
}
.join-input:focus { border-color:var(--gold); box-shadow:0 0 0 2px var(--gg); }

/* ── INPUT ── */
.input-field {
  background: var(--s2);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  padding: 12px 14px;
  font-family:'Tajawal',sans-serif;
  font-size:14px; font-weight:500;
  color:var(--white);
  width:100%; outline:none;
  transition: border-color .2s;
}
.input-field:focus { border-color: rgba(240,192,64,.5); }
.input-label { font-size:11px; font-weight:700; color:var(--wd); margin-bottom:4px; letter-spacing:.5px; }

/* ── AUTH SCREEN ── */
.auth-wrap {
  min-height:100%;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding: 30px 24px;
  background: radial-gradient(ellipse 80% 60% at 50% 40%, #0F2A14 0%, #07090A 100%);
}
.auth-logo { font-family:'Scheherazade New',serif; font-size:48px; color:var(--gold); text-shadow:0 0 30px var(--gg); margin-bottom:6px; }
.auth-sub  { font-size:13px; color:var(--wd); letter-spacing:2px; margin-bottom:32px; }
.auth-card {
  width:100%; max-width:360px;
  background: var(--s1);
  border: 1px solid rgba(240,192,64,.15);
  border-radius:20px;
  padding: 24px 20px;
}
.auth-title { font-size:17px; font-weight:900; text-align:center; margin-bottom:20px; }

/* ── AVATAR GRID ── */
.avatar-grid { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
.av-option {
  width:48px; height:48px;
  border-radius:50%;
  background: var(--s2);
  border: 2px solid rgba(255,255,255,.08);
  display:flex; align-items:center; justify-content:center;
  font-size:24px;
  cursor:pointer;
  transition: all .2s cubic-bezier(.34,1.56,.64,1);
  touch-action: manipulation;
}
.av-option.sel { border-color:var(--gold); box-shadow:0 0 0 3px var(--gg); transform:scale(1.1); }

/* ── WAITING SPINNER ── */
.spinner {
  width:36px; height:36px;
  border:3px solid rgba(240,192,64,.2);
  border-top-color:var(--gold);
  border-radius:50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform:rotate(360deg); } }

/* ── WHATSAPP BTN ── */
.wa-btn {
  display:flex; align-items:center; justify-content:center; gap:8px;
  background: linear-gradient(135deg,#128C7E,#25D366);
  color:#fff; font-size:13px; font-weight:700;
  border:none; border-radius:12px; padding:12px;
  width:100%; cursor:pointer;
  font-family:'Tajawal',sans-serif;
  touch-action:manipulation;
}
.wa-btn:active { transform:scale(.97); }

/* ── MISC ── */
.section-title {
  font-family:'Scheherazade New',serif;
  font-size:18px; color:var(--gold);
  padding:12px 14px 6px;
}
.divider { height:1px; background:var(--wf); margin:0 14px; }
.center { display:flex; align-items:center; justify-content:center; }
.gap-8  { gap:8px; }
.gap-12 { gap:12px; }
.mt-8   { margin-top:8px; }
.mt-12  { margin-top:12px; }
.mt-16  { margin-top:16px; }
.pb-nav { padding-bottom: calc(var(--nav-h) + var(--safe-bot) + 12px); }
.text-center { text-align:center; }
.text-gold  { color:var(--gold); }
.text-dim   { color:var(--wd); }
.text-sm    { font-size:12px; }
.font-bold  { font-weight:700; }
.font-black { font-weight:900; }
`;

// ─── Game constants ───────────────────────────────────────────
const SUITS  = { spade:'♠', heart:'♥', diamond:'♦', club:'♣' };
const SC     = { spade:'black', heart:'red', diamond:'red', club:'black' };
const AR     = { A:'أ', K:'ك', Q:'ق', J:'ج', '10':'١٠', '9':'٩', '8':'٨', '7':'٧' };
const AVATARS= ['🧔','👲','🧕','👨‍💼','👩‍💼','🤴','👸','🧙','🦸','🎩'];
const CITIES = ['الرياض','جدة','مكة','المدينة','الدمام','الخبر','أبها','تبوك','حائل','القصيم'];

function mkDeck() {
  const ranks=['A','K','Q','J','10','9','8','7'];
  const suits=['spade','heart','diamond','club'];
  const d=[];
  suits.forEach(s=>ranks.forEach(r=>d.push({rank:r,suit:s})));
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}

// ─── Particle helpers ────────────────────────────────────────
function spawnParts(x,y,n=20,colors=['#F0C040','#FFE08A','#2ECC71','#fff']){
  for(let i=0;i<n;i++){
    const el=document.createElement('div'); el.className='particle';
    const sz=3+Math.random()*8, a=(Math.PI*2/n)*i+Math.random()*.5, d=50+Math.random()*110;
    el.style.cssText=`left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;background:${colors[Math.floor(Math.random()*colors.length)]};--tx:${Math.cos(a)*d}px;--ty:${Math.sin(a)*d}px;--dur:${.5+Math.random()*.8}s;`;
    document.body.appendChild(el); setTimeout(()=>el.remove(),1400);
  }
}
function spawnCoins(x,y,n=10){
  for(let i=0;i<n;i++){
    const el=document.createElement('div'); el.className='coin-fly';
    const a=(Math.PI*2/n)*i, d=70+Math.random()*90;
    el.style.cssText=`left:${x}px;top:${y}px;--tx:${Math.cos(a)*d}px;--ty:${Math.sin(a)*d}px;--dur:${.7+Math.random()*.6}s;`;
    el.textContent='🪙'; document.body.appendChild(el); setTimeout(()=>el.remove(),1400);
  }
}

// ─── Sub-components ───────────────────────────────────────────
function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2500);return()=>clearTimeout(t);},[]);
  return <div className="toast">{msg}</div>;
}

function CardFace({rank,suit}){
  return(<>
    <span className="cr">{AR[rank]}</span>
    <span className="cs">{SUITS[suit]}</span>
    <span className="crb">{AR[rank]}</span>
  </>);
}
function CardBack(){
  return <div className="card-back-inner"><span className="card-back-logo">بلوت</span></div>;
}

// ─── Bottom Nav ───────────────────────────────────────────────
function BottomNav({tab,onChange,badge}){
  const items=[
    {id:'home',icon:'🏠',label:'الرئيسية'},
    {id:'board',icon:'🏆',label:'المتصدرون'},
    {id:'store',icon:'🛍️',label:'المتجر'},
    {id:'friends',icon:'👥',label:'أصدقاء', badge: badge?.friends},
    {id:'profile',icon:'👤',label:'ملفي'},
  ];
  return(
    <nav className="bottom-nav">
      {items.map(it=>(
        <div key={it.id} className={`nav-item${tab===it.id?' active':''}`} onClick={()=>onChange(it.id)}>
          <span className="nav-icon">{it.icon}</span>
          {it.badge>0 && <span className="nav-badge">{it.badge}</span>}
          <span className="nav-label">{it.label}</span>
        </div>
      ))}
    </nav>
  );
}

// ─── Auth / Setup Screen ──────────────────────────────────────
function AuthScreen({onDone}){
  const [step,setStep]=useState('signin'); // 'signin' | 'setup'
  const [pendingUser,setPendingUser]=useState(null);
  const [av,setAv]=useState(AVATARS[0]);
  const [city,setCity]=useState('الرياض');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  // Handle Google redirect result on mount
  useEffect(()=>{
    (async()=>{
      try{
        const result=await getRedirectResult(auth);
        if(result?.user) await handleGoogleUser(result.user);
      }catch(e){
        // ignore no-redirect errors silently
      }
    })();
  },[]);

  const handleGoogleUser=async(user)=>{
    setLoading(true);
    try{
      const snap=await getDoc(doc(db,'users',user.uid));
      if(snap.exists()){
        onDone({uid:user.uid,...snap.data()});
      } else {
        setPendingUser(user);
        setStep('setup');
      }
    }catch(e){ setError('خطأ: '+e.message); setLoading(false); }
  };

  const signInGoogle=async()=>{
    setLoading(true); setError('');
    try{
      // Try popup first (works on desktop + most mobile browsers)
      const result=await signInWithPopup(auth, gProvider);
      if(result?.user) await handleGoogleUser(result.user);
    }catch(e){
      // Popup blocked (some mobile browsers) — fall back to redirect
      if(e.code==='auth/popup-blocked'||e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request'){
        try{
          await signInWithRedirect(auth, gProvider);
        }catch(e2){
          setError('تعذر تسجيل الدخول، حاول مجدداً');
          setLoading(false);
        }
      } else {
        setError('خطأ: '+e.message);
        setLoading(false);
      }
    }
  };

  const finishSetup=async()=>{
    if(!pendingUser) return;
    setLoading(true);
    try{
      const profile={
        uid:pendingUser.uid,
        name:pendingUser.displayName||'لاعب',
        avatar:av,
        city,
        wins:0,losses:0,coins:500,
        createdAt:serverTimestamp(),
      };
      await setDoc(doc(db,'users',pendingUser.uid),profile,{merge:true});
      onDone(profile);
    }catch(e){ setError('خطأ: '+e.message); setLoading(false); }
  };

  if(step==='setup') return(
    <div className="auth-wrap">
      <div className="auth-logo">بلوت</div>
      <div className="auth-sub">أكمل ملفك</div>
      <div className="auth-card">
        <div className="auth-title">مرحباً {pendingUser?.displayName?.split(' ')[0]} 👋</div>
        <div style={{marginBottom:14}}>
          <div className="input-label">اختر مدينتك</div>
          <select className="input-field" value={city} onChange={e=>setCity(e.target.value)}>
            {CITIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{marginBottom:20}}>
          <div className="input-label" style={{marginBottom:8}}>اختر رمزك</div>
          <div className="avatar-grid">
            {AVATARS.map(a=><div key={a} className={`av-option${av===a?' sel':''}`} onClick={()=>setAv(a)}>{a}</div>)}
          </div>
        </div>
        {error&&<div style={{color:'var(--red)',fontSize:12,textAlign:'center',marginBottom:10}}>{error}</div>}
        <button className="btn btn-gold btn-full btn-lg" onClick={finishSetup} disabled={loading}>
          {loading?'جاري...':'ابدأ اللعب 🃏'}
        </button>
      </div>
    </div>
  );

  return(
    <div className="auth-wrap">
      <div className="auth-logo">بلوت</div>
      <div className="auth-sub">المملكة العربية السعودية</div>
      <div className="auth-card">
        <div className="auth-title">سجّل دخولك</div>
        <div style={{fontSize:12,color:'var(--wd)',textAlign:'center',marginBottom:20,lineHeight:1.6}}>
          سجّل باستخدام Google للحفاظ على تقدمك وترتيبك
        </div>
        {error&&<div style={{color:'var(--red)',fontSize:12,textAlign:'center',marginBottom:12,background:'rgba(231,76,60,.1)',padding:'8px',borderRadius:8}}>{error}</div>}
        <button
          onClick={signInGoogle}
          disabled={loading}
          style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:10,
            width:'100%',padding:'14px',borderRadius:12,
            background:'#fff',color:'#1a1a1a',
            border:'none',cursor:'pointer',
            fontFamily:"'Tajawal',sans-serif",fontSize:15,fontWeight:700,
            boxShadow:'0 4px 20px rgba(0,0,0,0.4)',
            transition:'all .2s',
            opacity:loading?0.7:1,
          }}
        >
          {loading?(
            <div className="spinner" style={{width:22,height:22,borderColor:'rgba(0,0,0,.2)',borderTopColor:'#333'}}/>
          ):(
            <>
              <svg width="22" height="22" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              تسجيل الدخول بـ Google
            </>
          )}
        </button>
        <div style={{fontSize:10,color:'var(--wd)',textAlign:'center',marginTop:14,lineHeight:1.5}}>
          بالمتابعة توافق على شروط الاستخدام وسياسة الخصوصية
        </div>
      </div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────
function HomeScreen({profile,onMode}){
  const modes=[
    {id:'quick', icon:'⚡', title:'لعبة سريعة', sub:'ابدأ مع لاعبين عشوائيين', color:'#2ECC71', tag:'', tagColor:''},
    {id:'create',icon:'👥', title:'مع الأصدقاء', sub:'أنشئ غرفة وشارك الكود', color:'#F0C040', tag:'🔥', tagColor:'#E74C3C'},
    {id:'join',  icon:'🔑', title:'انضم لغرفة',  sub:'أدخل كود الغرفة', color:'#3498DB', tag:'', tagColor:''},
    {id:'bot',   icon:'🤖', title:'مع الروبوت',  sub:'تدرب بدون انتظار', color:'#9B59B6', tag:'', tagColor:''},
  ];

  return(
    <div className="page scroll-page pb-nav">
      {/* Hero */}
      <div className="home-hero">
        <div className="home-logo">بلوت المملكة</div>
        <div className="home-tagline">العب · تنافس · افوز</div>
        <div className="home-divider"/>
      </div>

      {/* Profile quick */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 12px',marginBottom:12}}>
        <span style={{fontSize:32}}>{profile.avatar}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:14}}>{profile.name}</div>
          <div style={{fontSize:11,color:'var(--wd)'}}>{profile.city} · {profile.wins} انتصار</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4,background:'rgba(240,192,64,.1)',border:'1px solid rgba(240,192,64,.2)',borderRadius:20,padding:'4px 10px'}}>
          <span style={{fontSize:14}}>🪙</span>
          <span style={{fontSize:13,fontWeight:900,color:'var(--gold)'}}>{profile.coins}</span>
        </div>
      </div>

      {/* Mode grid */}
      <div className="mode-grid">
        {modes.map(m=>(
          <div key={m.id} className="mode-card" onClick={()=>onMode(m.id)}
            style={{borderColor: `rgba(${m.color==='#F0C040'?'122,91,26':'26,92,40'},0.15)`}}
          >
            {m.tag && <span className="mode-card-tag" style={{background:m.tagColor,color:'#fff'}}>{m.tag}</span>}
            <span className="mode-card-icon">{m.icon}</span>
            <span className="mode-card-title" style={{color:m.color+'CC'}}>{m.title}</span>
            <span className="mode-card-sub">{m.sub}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="stats-bar">
        <div className="stat-item"><div className="stat-num">٦.٢م</div><div className="stat-lbl">لاعب</div></div>
        <div className="stat-item"><div className="stat-num">٩٨٤</div><div className="stat-lbl">مباراة الآن</div></div>
        <div className="stat-item"><div className="stat-num">٤.٨</div><div className="stat-lbl">التقييم</div></div>
      </div>
    </div>
  );
}

// ─── Create/Join Room ─────────────────────────────────────────
function RoomScreen({profile,mode,onStart,onBack}){
  const [roomCode,setRoomCode]=useState('');
  const [joinInput,setJoinInput]=useState('');
  const [players,setPlayers]=useState([]);
  const [loading,setLoading]=useState(false);
  const [joined,setJoined]=useState(false);
  const unsubRef=useRef(null);

  useEffect(()=>{
    if(mode==='create') createRoom();
    return ()=>{ if(unsubRef.current) unsubRef.current(); };
  },[]);

  async function createRoom(){
    setLoading(true);
    const code=Math.floor(100000+Math.random()*900000).toString();
    try{
      await setDoc(doc(db,'rooms',code),{
        code, host:profile.uid, status:'waiting',
        players:[{uid:profile.uid,name:profile.name,avatar:profile.avatar,team:1}],
        createdAt:serverTimestamp()
      });
      setRoomCode(code); setJoined(true);
      listenRoom(code);
    }catch(e){ alert('خطأ: '+e.message); }
    setLoading(false);
  }

  async function joinRoom(){
    if(!joinInput.trim()){return;}
    setLoading(true);
    try{
      const roomRef=doc(db,'rooms',joinInput.trim());
      const snap=await getDoc(roomRef);
      if(!snap.exists()){alert('الغرفة غير موجودة');setLoading(false);return;}
      const data=snap.data();
      if(data.players.length>=4){alert('الغرفة ممتلئة');setLoading(false);return;}
      const alreadyIn=data.players.find(p=>p.uid===profile.uid);
      if(!alreadyIn){
        const team=data.players.length<2?1:2;
        await updateDoc(roomRef,{players:[...data.players,{uid:profile.uid,name:profile.name,avatar:profile.avatar,team}]});
      }
      setRoomCode(joinInput.trim()); setJoined(true);
      listenRoom(joinInput.trim());
    }catch(e){ alert('خطأ: '+e.message); }
    setLoading(false);
  }

  function listenRoom(code){
    unsubRef.current=onSnapshot(doc(db,'rooms',code),snap=>{
      if(!snap.exists()) return;
      const d=snap.data();
      setPlayers(d.players||[]);
      if(d.status==='playing') onStart(code,d);
    });
  }

  async function startGame(){
    if(players.length<2){alert('تحتاج لاعبين على الأقل');return;}
    await updateDoc(doc(db,'rooms',roomCode),{status:'playing',deck:mkDeck(),trick:[],scores:{1:0,2:0},round:1});
  }

  const shareWA=()=>{
    const url=`https://wa.me/?text=${encodeURIComponent(`انضم إلي في بلوت المملكة!\nكود الغرفة: ${roomCode}\n${window.location.origin}`)}`;
    window.open(url,'_blank');
  };

  const slots=Array(4).fill(null).map((_,i)=>players[i]||null);

  return(
    <div className="page scroll-page pb-nav">
      <div style={{display:'flex',alignItems:'center',padding:'14px 14px 0'}}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع</button>
        <div style={{flex:1,textAlign:'center',fontFamily:"'Scheherazade New',serif",fontSize:18,color:'var(--gold)'}}>
          {mode==='create'?'غرفتك':'انضم لغرفة'}
        </div>
      </div>

      <div className="room-wrap">
        {/* Code display or input */}
        {mode==='create'&&roomCode?(
          <div className="room-code-box">
            <div className="room-code-lbl">كود الغرفة</div>
            <div className="room-code-num">{roomCode}</div>
            <div style={{fontSize:11,color:'var(--wd)',marginTop:6}}>شارك الكود مع أصدقائك</div>
          </div>
        ):mode==='join'&&!joined?(
          <div>
            <div className="input-label" style={{marginBottom:6,textAlign:'center'}}>أدخل كود الغرفة</div>
            <input className="join-input" placeholder="------" value={joinInput}
              onChange={e=>setJoinInput(e.target.value.replace(/\D/g,'').slice(0,6))}
              inputMode="numeric" maxLength={6}
            />
            <div style={{marginTop:10}}>
              <button className="btn btn-gold btn-full" onClick={joinRoom} disabled={loading||joinInput.length!==6}>
                {loading?'جاري...':'انضم الآن'}
              </button>
            </div>
          </div>
        ):null}

        {/* Player slots */}
        {joined&&(
          <>
            <div className="section-title" style={{padding:0}}>اللاعبون</div>
            {slots.map((p,i)=>(
              <div key={i} className="player-slot">
                {p?(
                  <>
                    <span className="slot-av">{p.avatar}</span>
                    <span className="slot-name">{p.name}</span>
                    <span className="slot-badge">فريق {p.team}</span>
                  </>
                ):(
                  <>
                    <span className="slot-av" style={{opacity:.3}}>👤</span>
                    <span className="slot-name" style={{color:'var(--wd)'}}>في انتظار لاعب...</span>
                    <div className="spinner" style={{width:18,height:18,borderWidth:2}}/>
                  </>
                )}
              </div>
            ))}

            {/* Actions */}
            {mode==='create'&&(
              <>
                <button className="wa-btn" onClick={shareWA}>
                  <span>📲</span> شارك على واتساب
                </button>
                {profile.uid===players[0]?.uid&&(
                  <button className="btn btn-gold btn-full btn-lg" onClick={startGame} disabled={players.length<2}>
                    ابدأ اللعبة {players.length}/4
                  </button>
                )}
              </>
            )}
          </>
        )}

        {loading&&<div className="center" style={{padding:20}}><div className="spinner"/></div>}
      </div>
    </div>
  );
}

// ─── Game Screen ──────────────────────────────────────────────
function GameScreen({profile,roomCode,roomData,onExit}){
  const [gameState,setGameState]=useState(null);
  const [selectedIdx,setSelectedIdx]=useState(null);
  const [trickCards,setTrickCards]=useState([]);
  const [myHand,setMyHand]=useState([]);
  const [mode,setMode]=useState('hokum');
  const [toast,setToast]=useState(null);
  const [trickFlash,setTrickFlash]=useState(false);
  const [showWin,setShowWin]=useState(false);
  const [scores,setScores]=useState({1:0,2:0});
  const toastKey=useRef(0);
  const unsubRef=useRef(null);

  const players=roomData?.players||[
    {uid:'p1',name:'أنت',     avatar:'🧔',team:1},
    {uid:'p2',name:'محمد',   avatar:'👲',team:2},
    {uid:'p3',name:'عبدالله',avatar:'🧔',team:1},
    {uid:'p4',name:'سعد',    avatar:'🧔',team:2},
  ];
  const myIdx=players.findIndex(p=>p.uid===profile.uid);
  const myTeam=players[myIdx]?.team||1;

  // Demo hand if no real room
  useEffect(()=>{
    if(!roomCode){
      const deck=mkDeck();
      setMyHand(deck.slice(0,8));
      return;
    }
    unsubRef.current=onSnapshot(doc(db,'rooms',roomCode),snap=>{
      if(!snap.exists()) return;
      const d=snap.data();
      setGameState(d);
      setScores(d.scores||{1:0,2:0});
      setTrickCards(d.trick||[]);
      const hands=d.hands||{};
      setMyHand(hands[profile.uid]||[]);
      if((d.scores?.[1]||0)>=152||(d.scores?.[2]||0)>=152) setShowWin(true);
    });
    return()=>{ if(unsubRef.current) unsubRef.current(); };
  },[roomCode]);

  const showToast=(msg)=>{ toastKey.current++; setToast({msg,key:toastKey.current}); };

  const playCard=(e,card,idx)=>{
    if(selectedIdx!==idx){ setSelectedIdx(idx); return; }
    const r=e.currentTarget.getBoundingClientRect();
    spawnParts(r.left+28,r.top+40,12,['#F0C040','#fff','#2ECC71']);
    const newHand=myHand.filter((_,i)=>i!==idx);
    setMyHand(newHand);
    setTrickCards(t=>[...t,{...card,playerName:profile.name}]);
    setSelectedIdx(null);
    showToast('أحسنت! 🎯');
    setTimeout(()=>{setTrickFlash(true);setTimeout(()=>setTrickFlash(false),650);},300);
    if(roomCode){
      updateDoc(doc(db,'rooms',roomCode),{trick:[...trickCards,{...card,playerName:profile.name}],hands:{...gameState?.hands,[profile.uid]:newHand}});
    }
  };

  const takeTrick=(e)=>{
    const r=e.currentTarget.getBoundingClientRect();
    spawnCoins(r.left+r.width/2,r.top+r.height/2,12);
    spawnParts(r.left+r.width/2,r.top+r.height/2,20,['#F0C040','#FFE08A']);
    setScores(s=>({...s,[myTeam]:(s[myTeam]||0)+10}));
    setTrickCards([]);
    showToast('فزت بالضربة! ✨');
    if(roomCode) updateDoc(doc(db,'rooms',roomCode),{trick:[],scores:{...scores,[myTeam]:(scores[myTeam]||0)+10}});
  };

  const dealNew=()=>{
    const deck=mkDeck();
    setMyHand(deck.slice(0,8));
    setTrickCards([]);
    setSelectedIdx(null);
    showToast('تم التوزيع 🃏');
  };

  // Layout: top=opp partner, left=opp, right=opp
  const top   = players[(myIdx+2)%players.length]||players[0];
  const left  = players[(myIdx+1)%players.length]||players[1];
  const right = players[(myIdx+3)%players.length]||players[2] ;
  const me    = players[myIdx]||players[0];
  const activePlayer=players[gameState?.currentTurn%players.length]||players[0];

  return(
    <div className="table" style={{position:'relative'}}>
      {toast&&<Toast key={toast.key} msg={toast.msg} onDone={()=>setToast(null)}/>}

      {/* Ornaments */}
      <div className="ring ring-1"/>
      <div className="ring ring-2"/>

      {/* Mode chips — top center */}
      <div className="mode-row">
        <div className={`mode-chip hokum${mode==='hokum'?' active':''}`} onClick={()=>setMode('hokum')}>حكم</div>
        <div className={`mode-chip sun${mode==='sun'?' active':''}`}   onClick={()=>setMode('sun')}>صن</div>
      </div>

      {/* Score ticker below mode chips */}
      <div className="score-ticker" style={{top:42}}>
        <div className="score-team">أ <span>{scores[1]}</span></div>
        <div className="score-vs">—</div>
        <div className="score-team">ب <span>{scores[2]}</span></div>
      </div>

      {/* Trump suit */}
      <div className="trump">
        <span className="trump-lbl">الكوز</span>
        <span className="trump-suit">♠</span>
      </div>

      {/* Exit button — top left */}
      <button className="btn btn-ghost btn-sm" style={{position:'absolute',top:8,left:8,zIndex:50,fontSize:11,padding:'5px 10px'}} onClick={onExit}>
        خروج
      </button>

      {/* Top player */}
      <div className="pzone pzone-top" style={{top:70}}>
        <div className={`avatar${activePlayer.uid===top.uid?' active':''}`}>{top.avatar}</div>
        <span className={`pname${activePlayer.uid===top.uid?' active':''}`}>{top.name}</span>
        <div className="opp-cards">{[0,1,2,3].map(i=><div key={i} className="opp-card" style={{transform:`rotate(${(i-1.5)*5}deg)`}}/>)}</div>
      </div>

      {/* Left player */}
      <div className="pzone pzone-left">
        <div className={`avatar${activePlayer.uid===left.uid?' active':''}`}>{left.avatar}</div>
        <span className={`pname${activePlayer.uid===left.uid?' active':''}`}>{left.name}</span>
        <div className="opp-cards">{[0,1,2].map(i=><div key={i} className="opp-card" style={{transform:`rotate(${(i-1)*6}deg)`}}/>)}</div>
      </div>

      {/* Right player */}
      <div className="pzone pzone-right">
        <div className={`avatar${activePlayer.uid===right.uid?' active':''}`}>{right.avatar}</div>
        <span className={`pname${activePlayer.uid===right.uid?' active':''}`}>{right.name}</span>
        <div className="opp-cards">{[0,1,2].map(i=><div key={i} className="opp-card" style={{transform:`rotate(${(i-1)*6}deg)`}}/>)}</div>
      </div>

      {/* Trick area — center */}
      <div className="trick-wrap">
        {trickFlash&&<div className="trick-flash"/>}
        {trickCards.map((c,i)=>(
          <div key={i} className={`trick-card ${SC[c.suit]}`} style={{
            top:  [20,50,10,40][i%4],
            left: [40,20,60,35][i%4]+'%',
            transform:`rotate(${[-8,5,-3,10][i%4]}deg)`,
            zIndex:i+1,
          }}>
            <CardFace rank={c.rank} suit={c.suit}/>
          </div>
        ))}
        {trickCards.length===0&&(
          <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',color:'var(--wd)',fontSize:11,fontWeight:600,whiteSpace:'nowrap',opacity:.5}}>
            دورك أنت
          </div>
        )}
        {trickCards.length>=4&&(
          <button className="btn btn-gold btn-sm take-trick-btn" onClick={takeTrick}>
            خذ الضربة 🏆
          </button>
        )}
      </div>

      {/* Player hand — bottom, above nav */}
      <div className="hand-wrap">
        {myHand.map((card,i)=>{
          const total=myHand.length;
          const spread=Math.min(30,220/Math.max(total,1));
          const offset=(i-(total-1)/2)*spread;
          const rot=(i-(total-1)/2)*3.5;
          const lift=Math.abs(i-(total-1)/2)*1.5;
          const isSelected=selectedIdx===i;
          return(
            <div key={`${card.rank}${card.suit}${i}`}
              className={`hand-card ${SC[card.suit]}${isSelected?' selected':''}`}
              style={{
                left:`calc(50% + ${offset}px - 28px)`,
                transform:`rotate(${rot}deg) translateY(${isSelected?-28:lift}px) scale(${isSelected?1.08:1})`,
                zIndex:isSelected?90:i+1,
                boxShadow:isSelected?`0 0 0 2px rgba(46,204,113,.5),var(--sh-card)`:undefined,
                transition:'transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .2s',
              }}
              onClick={(e)=>playCard(e,card,i)}
            >
              <CardFace rank={card.rank} suit={card.suit}/>
            </div>
          );
        })}
      </div>

      {/* Game action bar — above hand */}
      <div className="game-action-bar">
        <button className="btn btn-ghost btn-sm" onClick={dealNew}>توزيع 🃏</button>
        <button className="btn btn-gold btn-sm" onClick={()=>setShowWin(true)}>نهاية اللعبة</button>
      </div>

      {/* Win overlay */}
      {showWin&&(
        <div className="win-overlay" onClick={()=>{setShowWin(false);onExit();}}>
          <div className="win-card" onClick={e=>e.stopPropagation()}>
            <span className="win-trophy">🏆</span>
            <div className="win-title">الفريق أ يفوز!</div>
            <div className="win-sub">وصلتم إلى ١٥٢ نقطة أولاً</div>
            <div className="win-scores">
              <div className="win-score-item"><span className="win-score-num">{scores[1]}</span><span className="win-score-lbl">الفريق أ</span></div>
              <div style={{color:'var(--wf)',fontSize:24,alignSelf:'center'}}>—</div>
              <div className="win-score-item"><span className="win-score-num" style={{color:'var(--wd)'}}>{scores[2]}</span><span className="win-score-lbl">الفريق ب</span></div>
            </div>
            <button className="btn btn-gold btn-full btn-lg" style={{marginTop:4}} onClick={()=>{setShowWin(false);onExit();}}>
              العب مجدداً
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────
function LeaderboardScreen(){
  const [players,setPlayers]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      try{
        const q=query(collection(db,'users'),orderBy('wins','desc'),limit(20));
        const snap=await getDocs(q);
        setPlayers(snap.docs.map(d=>({id:d.id,...d.data()})));
      }catch{
        // Demo data
        setPlayers([
          {id:'1',name:'أبو عبدالله',avatar:'🧔',city:'الرياض',wins:247},
          {id:'2',name:'محمد الغامدي',avatar:'👲',city:'جدة',wins:198},
          {id:'3',name:'سعد العتيبي',avatar:'🤴',city:'الدمام',wins:187},
          {id:'4',name:'فهد القحطاني',avatar:'🧙',city:'مكة',wins:156},
          {id:'5',name:'عبدالرحمن',avatar:'👨‍💼',city:'المدينة',wins:143},
          {id:'6',name:'خالد الزهراني',avatar:'🦸',city:'تبوك',wins:132},
          {id:'7',name:'نايف الشمري',avatar:'🧔',city:'حائل',wins:121},
          {id:'8',name:'بدر المطيري',avatar:'👲',city:'أبها',wins:118},
          {id:'9',name:'تركي العسيري',avatar:'🤴',city:'الخبر',wins:109},
          {id:'10',name:'وليد الدوسري',avatar:'🧙',city:'القصيم',wins:97},
        ]);
      }
      setLoading(false);
    })();
  },[]);

  const rankIcon=(i)=>{
    if(i===0) return {icon:'🥇',cls:'gold'};
    if(i===1) return {icon:'🥈',cls:'silver'};
    if(i===2) return {icon:'🥉',cls:'bronze'};
    return {icon:String(i+1),cls:''};
  };

  return(
    <div className="page scroll-page pb-nav">
      <div className="lb-header">
        <div className="lb-title">🏆 المتصدرون</div>
        <div style={{fontSize:11,color:'var(--wd)',textAlign:'center',marginTop:4}}>أفضل لاعبي المملكة</div>
      </div>
      <div className="divider"/>
      {loading?(
        <div className="center" style={{padding:40}}><div className="spinner"/></div>
      ):(
        players.map((p,i)=>{
          const {icon,cls}=rankIcon(i);
          return(
            <div key={p.id} className="lb-row">
              <span className={`lb-rank${cls?' '+cls:''}`}>{icon}</span>
              <span className="lb-av">{p.avatar||'🧔'}</span>
              <div style={{flex:1,minWidth:0}}>
                <div className="lb-name">{p.name}</div>
                <div className="lb-city">{p.city}</div>
              </div>
              <span className="lb-win">{p.wins} ✓</span>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Store Screen ──────────────────────────────────────────────
function StoreScreen({profile,onUpdate}){
  const [toast,setToast]=useState(null);
  const toastKey=useRef(0);

  const items=[
    {id:'golden',    icon:'🎴', name:'طقم ذهبي',     price:'٤٩ ريال', tag:'الأكثر مبيعاً', tagC:'#E74C3C'},
    {id:'emerald',   icon:'🟩', name:'طاولة زمردية', price:'٢٩ ريال', tag:'جديد',          tagC:'#2ECC71'},
    {id:'vip',       icon:'👑', name:'VIP شهري',      price:'٩٩ ريال', tag:'الأفضل',        tagC:'#F0C040'},
    {id:'500coins',  icon:'🪙', name:'٥٠٠ عملة',      price:'١٠ ريال', tag:'',              tagC:''},
    {id:'expressions',icon:'🎭',name:'تعابير مميزة', price:'١٩ ريال', tag:'',              tagC:''},
    {id:'hero',      icon:'🏅', name:'إطار بطل',      price:'٣٩ ريال', tag:'نادر',          tagC:'#9B59B6'},
  ];

  const buy=(e,item)=>{
    const r=e.currentTarget.getBoundingClientRect();
    spawnParts(r.left+r.width/2,r.top+r.height/2,15);
    toastKey.current++;
    setToast({msg:`تم الشراء: ${item.name} 🎉`,key:toastKey.current});
  };

  return(
    <div className="page scroll-page pb-nav">
      {toast&&<Toast key={toast.key} msg={toast.msg} onDone={()=>setToast(null)}/>}
      <div className="store-header"><div className="store-title">🛍️ المتجر</div></div>
      <div className="coin-bar">
        <span className="text-dim text-sm">رصيدك</span>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span className="coin-bal">🪙 {profile.coins}</span>
          <button className="btn btn-gold btn-sm">شحن</button>
        </div>
      </div>
      <div className="store-grid">
        {items.map(item=>(
          <div key={item.id} className="store-item" onClick={e=>buy(e,item)}>
            {item.tag&&<span className="store-item-tag" style={{background:item.tagC,color:item.tagC==='#F0C040'?'#000':'#fff'}}>{item.tag}</span>}
            <span className="store-item-icon">{item.icon}</span>
            <span className="store-item-name">{item.name}</span>
            <span className="store-item-price">{item.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Friends Screen ───────────────────────────────────────────
function FriendsScreen({profile}){
  const [search,setSearch]=useState('');
  const friends=[
    {name:'محمد الغامدي',  avatar:'👲', city:'جدة',    status:'متصل'},
    {name:'سعد العتيبي',   avatar:'🤴', city:'الدمام', status:'في لعبة'},
    {name:'فهد القحطاني',  avatar:'🧙', city:'مكة',    status:'غير متصل'},
    {name:'خالد الزهراني', avatar:'🦸', city:'تبوك',   status:'متصل'},
  ];
  const filtered=friends.filter(f=>f.name.includes(search)||search==='');
  const statusColor=(s)=>s==='متصل'?'#2ECC71':s==='في لعبة'?'#F0C040':'#666';

  return(
    <div className="page scroll-page pb-nav">
      <div style={{padding:'14px 14px 8px'}}>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'var(--gold)',textAlign:'center',marginBottom:10}}>
          👥 أصدقاء
        </div>
        <input className="input-field" placeholder="🔍 ابحث عن صديق..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div className="divider"/>
      {filtered.map((f,i)=>(
        <div key={i} className="lb-row">
          <span style={{fontSize:28}}>{f.avatar}</span>
          <div style={{flex:1,minWidth:0}}>
            <div className="lb-name">{f.name}</div>
            <div style={{fontSize:10,color:statusColor(f.status)}}>{f.status}</div>
          </div>
          {f.status==='متصل'&&<button className="btn btn-green btn-sm">دعوة</button>}
        </div>
      ))}
    </div>
  );
}

// ─── Profile Screen ───────────────────────────────────────────
function ProfileScreen({profile,onUpdate,onLogout}){
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState(profile.name);
  const [av,setAv]=useState(profile.avatar);
  const [city,setCity]=useState(profile.city);

  const save=async()=>{
    try{
      await updateDoc(doc(db,'users',profile.uid),{name,avatar:av,city});
      onUpdate({...profile,name,avatar:av,city});
      setEditing(false);
    }catch(e){alert('خطأ: '+e.message);}
  };

  return(
    <div className="page scroll-page pb-nav">
      <div className="profile-hero">
        <div className="profile-av">{profile.avatar}</div>
        <div className="profile-name">{profile.name}</div>
        <div className="profile-city">📍 {profile.city}</div>
        <div className="profile-stats">
          <div className="profile-stat"><span className="profile-stat-num">{profile.wins||0}</span><span className="profile-stat-lbl">انتصار</span></div>
          <div className="profile-stat"><span className="profile-stat-num">{profile.losses||0}</span><span className="profile-stat-lbl">هزيمة</span></div>
          <div className="profile-stat"><span className="profile-stat-num">🪙 {profile.coins||0}</span><span className="profile-stat-lbl">عملة</span></div>
        </div>
      </div>

      {editing?(
        <div style={{padding:'0 14px'}}>
          <div style={{marginBottom:10}}>
            <div className="input-label">الاسم</div>
            <input className="input-field" value={name} onChange={e=>setName(e.target.value)} maxLength={20}/>
          </div>
          <div style={{marginBottom:10}}>
            <div className="input-label">المدينة</div>
            <select className="input-field" value={city} onChange={e=>setCity(e.target.value)}>
              {CITIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{marginBottom:16}}>
            <div className="input-label" style={{marginBottom:6}}>الرمز</div>
            <div className="avatar-grid">{AVATARS.map(a=><div key={a} className={`av-option${av===a?' sel':''}`} onClick={()=>setAv(a)}>{a}</div>)}</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setEditing(false)}>إلغاء</button>
            <button className="btn btn-gold" style={{flex:1}} onClick={save}>حفظ</button>
          </div>
        </div>
      ):(
        <div className="profile-section">
          <div className="profile-item" onClick={()=>setEditing(true)}>
            <span className="profile-item-icon">✏️</span>
            <div className="profile-item-text"><div className="profile-item-label">تعديل الملف</div><div className="profile-item-sub">الاسم، الرمز، المدينة</div></div>
            <span className="profile-item-arrow">›</span>
          </div>
          <div className="profile-item">
            <span className="profile-item-icon">📊</span>
            <div className="profile-item-text"><div className="profile-item-label">إحصائياتي</div><div className="profile-item-sub">نسبة الفوز وتفاصيل اللعب</div></div>
            <span className="profile-item-arrow">›</span>
          </div>
          <div className="profile-item">
            <span className="profile-item-icon">🔔</span>
            <div className="profile-item-text"><div className="profile-item-label">الإشعارات</div><div className="profile-item-sub">تحكم في التنبيهات</div></div>
            <span className="profile-item-arrow">›</span>
          </div>
          <div className="profile-item" onClick={onLogout}>
            <span className="profile-item-icon">🚪</span>
            <div className="profile-item-text"><div className="profile-item-label" style={{color:'var(--red)'}}>تسجيل الخروج</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────
export default function App(){
  const [profile,setProfile]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [navTab,setNavTab]=useState('home');
  const [gameMode,setGameMode]=useState(null); // null | 'create' | 'join' | 'quick' | 'bot'
  const [inGame,setInGame]=useState(false);
  const [roomCode,setRoomCode]=useState(null);
  const [roomData,setRoomData]=useState(null);

  // Inject CSS
  useEffect(()=>{
    const style=document.createElement('style');
    style.textContent=CSS;
    document.head.appendChild(style);
    return()=>document.head.removeChild(style);
  },[]);

  // Auth listener — async IIFE to safely use await
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,(user)=>{
      (async()=>{
        if(user){
          try{
            const snap=await getDoc(doc(db,'users',user.uid));
            if(snap.exists()) setProfile({uid:user.uid,...snap.data()});
            else setProfile(null);
          }catch{ setProfile(null); }
        } else { setProfile(null); }
        setAuthLoading(false);
      })();
    });
    return()=>unsub();
  },[]);

  const handleMode=(mode)=>{
    if(mode==='bot'||mode==='quick'){
      setInGame(true); setRoomCode(null);
      setRoomData({players:[
        {uid:profile.uid,name:profile.name,avatar:profile.avatar,team:1},
        {uid:'bot1',name:'روبوت ١',avatar:'🤖',team:2},
        {uid:'bot2',name:'روبوت ٢',avatar:'🤖',team:1},
        {uid:'bot3',name:'روبوت ٣',avatar:'🤖',team:2},
      ]});
    } else {
      setGameMode(mode);
    }
  };

  const handleRoomStart=(code,data)=>{
    setRoomCode(code); setRoomData(data);
    setGameMode(null); setInGame(true);
  };

  const handleExit=()=>{ setInGame(false); setRoomCode(null); setRoomData(null); setNavTab('home'); };
  const handleLogout=async()=>{ try{ await signOut(auth); }catch{} setProfile(null); };

  if(authLoading) return(
    <div style={{height:'100dvh',background:'#07090A',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{fontFamily:"'Scheherazade New',serif",fontSize:36,color:'#F0C040',textShadow:'0 0 20px rgba(240,192,64,.4)'}}>بلوت</div>
      <div className="spinner"/>
    </div>
  );

  if(!profile) return <AuthScreen onDone={setProfile}/>;

  // Full-screen game — no nav bar
  if(inGame) return(
    <div style={{height:'100dvh',background:'#07090A'}}>
      <style>{CSS}</style>
      <GameScreen
        profile={profile}
        roomCode={roomCode}
        roomData={roomData}
        onExit={handleExit}
      />
    </div>
  );

  // Room setup — no nav bar
  if(gameMode==='create'||gameMode==='join') return(
    <div style={{height:'100dvh',background:'#07090A'}}>
      <style>{CSS}</style>
      <RoomScreen
        profile={profile}
        mode={gameMode}
        onStart={handleRoomStart}
        onBack={()=>setGameMode(null)}
      />
    </div>
  );

  // Main tabbed app
  return(
    <div className="app-shell">
      <style>{CSS}</style>
      <div className="app-content">
        {navTab==='home'    && <HomeScreen    profile={profile} onMode={handleMode}/>}
        {navTab==='board'   && <LeaderboardScreen/>}
        {navTab==='store'   && <StoreScreen   profile={profile} onUpdate={setProfile}/>}
        {navTab==='friends' && <FriendsScreen profile={profile}/>}
        {navTab==='profile' && <ProfileScreen profile={profile} onUpdate={setProfile} onLogout={handleLogout}/>}
      </div>
      <BottomNav tab={navTab} onChange={setNavTab}/>
    </div>
  );
}
