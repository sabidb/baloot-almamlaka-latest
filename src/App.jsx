import { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc, collection, orderBy, limit, getDocs, query, serverTimestamp } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

// ── Firebase init (safe — won't double-init) ──────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);
const auth        = getAuth(firebaseApp);
const gProvider   = new GoogleAuthProvider();

// ── Helpers ───────────────────────────────────────────────────
const AVATARS = ['🧔','👲','🧕','👨‍💼','👩‍💼','🤴','👸','🧙','🦸','🎩'];
const CITIES  = ['الرياض','جدة','مكة','المدينة','الدمام','الخبر','أبها','تبوك','حائل','القصيم'];
const SUITS   = { spade:'♠', heart:'♥', diamond:'♦', club:'♣' };
const SCOLOR  = { spade:'#1a1a1a', heart:'#C0392B', diamond:'#C0392B', club:'#1a1a1a' };
const RANKS_AR= { A:'أ', K:'ك', Q:'ق', J:'ج', '10':'١٠', '9':'٩', '8':'٨', '7':'٧' };

function mkDeck() {
  const d = [];
  ['spade','heart','diamond','club'].forEach(s =>
    ['A','K','Q','J','10','9','8','7'].forEach(r => d.push({r,s}))
  );
  for (let i = d.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [d[i],d[j]] = [d[j],d[i]];
  }
  return d;
}

function spawnParticles(x, y) {
  const colors = ['#F0C040','#FFE08A','#2ECC71','#fff'];
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('div');
    const a  = (Math.PI*2/18)*i;
    const d  = 60 + Math.random()*100;
    const sz = 4 + Math.random()*7;
    Object.assign(el.style, {
      position:'fixed', left:x+'px', top:y+'px',
      width:sz+'px', height:sz+'px', borderRadius:'50%',
      background: colors[i%colors.length],
      pointerEvents:'none', zIndex:'9999',
      animation: `pfly ${0.5+Math.random()*0.7}s ease-out forwards`,
      '--tx': Math.cos(a)*d+'px', '--ty': Math.sin(a)*d+'px',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
}

// ── Inline styles (no external CSS file needed) ───────────────
const S = {
  // Layout
  app:     { height:'100dvh', display:'flex', flexDirection:'column', background:'#07090A', fontFamily:"'Tajawal',sans-serif", color:'#F0EDE5', direction:'rtl', overflow:'hidden' },
  content: { flex:1, overflow:'hidden', position:'relative' },
  page:    { position:'absolute', inset:0, overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch' },

  // Nav
  nav:     { flexShrink:0, height:'calc(60px + env(safe-area-inset-bottom))', paddingBottom:'env(safe-area-inset-bottom)', background:'rgba(10,14,12,.97)', borderTop:'1px solid rgba(240,192,64,.13)', display:'flex' },
  navItem: (active) => ({ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, cursor:'pointer', padding:'6px 2px', position:'relative', WebkitTapHighlightColor:'transparent' }),
  navIcon: { fontSize:20, lineHeight:1 },
  navLbl:  (active) => ({ fontSize:9, fontWeight:700, color: active ? '#F0C040' : 'rgba(240,237,229,.55)', whiteSpace:'nowrap' }),
  navDot:  { position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:28, height:2, borderRadius:2, background:'#F0C040', boxShadow:'0 0 8px rgba(240,192,64,.5)' },

  // Cards
  card: (color) => ({
    width:56, height:80, borderRadius:12,
    background:'linear-gradient(145deg,#FEFDF8,#F5F0E8)',
    border:'1px solid rgba(0,0,0,.12)',
    boxShadow:'0 8px 24px rgba(0,0,0,.7)',
    display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'space-between',
    padding:'4px 3px', position:'absolute',
    cursor:'pointer', userSelect:'none',
    WebkitTapHighlightColor:'transparent',
  }),
  rankTop:    (c) => ({ fontFamily:"'Scheherazade New',serif", fontSize:16, fontWeight:700, color:SCOLOR[c], alignSelf:'flex-start', lineHeight:1 }),
  suit:       (c) => ({ fontSize:22, lineHeight:1, color:SCOLOR[c] }),
  rankBot:    (c) => ({ fontFamily:"'Scheherazade New',serif", fontSize:16, fontWeight:700, color:SCOLOR[c], alignSelf:'flex-end', transform:'rotate(180deg)', lineHeight:1 }),
  cardBack:   { width:'100%', height:'100%', borderRadius:11, background:'linear-gradient(135deg,#0D5C2A,#1A3D20)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' },

  // Buttons
  btnGold:  { padding:'12px 20px', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#8B6914,#D4A820,#F0C040)', color:'#07090A', fontFamily:"'Tajawal',sans-serif", fontSize:14, fontWeight:700, boxShadow:'0 4px 16px rgba(240,192,64,.35)', WebkitTapHighlightColor:'transparent', touchAction:'manipulation' },
  btnGhost: { padding:'10px 18px', borderRadius:12, border:'1px solid rgba(255,255,255,.12)', cursor:'pointer', background:'rgba(255,255,255,.08)', color:'rgba(240,237,229,.7)', fontFamily:"'Tajawal',sans-serif", fontSize:13, fontWeight:700, WebkitTapHighlightColor:'transparent' },
  btnGreen: { padding:'10px 18px', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#1A5C28,#2ECC71)', color:'#fff', fontFamily:"'Tajawal',sans-serif", fontSize:13, fontWeight:700, WebkitTapHighlightColor:'transparent' },

  // Input
  input: { background:'rgba(16,26,18,.9)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'12px 14px', fontFamily:"'Tajawal',sans-serif", fontSize:14, color:'#F0EDE5', width:'100%', outline:'none' },
  label: { fontSize:11, fontWeight:700, color:'rgba(240,237,229,.55)', marginBottom:4 },
  select: { background:'rgba(16,26,18,.9)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'12px 14px', fontFamily:"'Tajawal',sans-serif", fontSize:14, color:'#F0EDE5', width:'100%', outline:'none' },

  // Misc
  gold:   { color:'#F0C040' },
  dim:    { color:'rgba(240,237,229,.55)' },
  title:  { fontFamily:"'Scheherazade New',serif", color:'#F0C040' },
  surface:{ background:'rgba(16,26,18,.85)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16 },
  divider:{ height:1, background:'rgba(255,255,255,.07)', margin:'0 14px' },
};

// ── Particle keyframes (injected once) ────────────────────────
if (!document.getElementById('blt-kf')) {
  const style = document.createElement('style');
  style.id = 'blt-kf';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;700&family=Tajawal:wght@400;700;900&display=swap');
    @keyframes pfly { 0%{opacity:1;transform:translate(0,0) scale(1)} 100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)} }
    @keyframes spin  { to{transform:rotate(360deg)} }
    @keyframes fadeUp{ from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes popIn { from{opacity:0;transform:scale(.7)} to{opacity:1;transform:scale(1)} }
    @keyframes pulse { 0%,100%{box-shadow:0 0 0 3px rgba(240,192,64,.25)} 50%{box-shadow:0 0 0 5px rgba(240,192,64,.5),0 0 30px rgba(240,192,64,.3)} }
    * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
    html,body,#root { height:100%; overflow:hidden; }
    ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#7A5B1A;border-radius:3px}
    select option { background:#0C1410; }
  `;
  document.head.appendChild(style);
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position:'fixed', top:'calc(env(safe-area-inset-top) + 14px)', left:'50%', transform:'translateX(-50%)', background:'rgba(8,12,10,.95)', border:'1px solid #7A5B1A', borderRadius:10, padding:'10px 20px', fontSize:13, fontWeight:700, color:'#F0C040', whiteSpace:'nowrap', zIndex:9000, pointerEvents:'none', boxShadow:'0 8px 24px rgba(0,0,0,.6)', animation:'fadeUp .35s ease both' }}>
      {msg}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────
function Spinner({ size=32 }) {
  return <div style={{ width:size, height:size, border:`3px solid rgba(240,192,64,.2)`, borderTopColor:'#F0C040', borderRadius:'50%', animation:'spin .8s linear infinite', flexShrink:0 }}/>;
}

// ── Bottom Nav ────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:'home',    icon:'🏠', label:'الرئيسية' },
  { id:'board',   icon:'🏆', label:'المتصدرون' },
  { id:'store',   icon:'🛍️', label:'المتجر' },
  { id:'friends', icon:'👥', label:'أصدقاء' },
  { id:'profile', icon:'👤', label:'ملفي' },
];
function BottomNav({ tab, onChange }) {
  return (
    <nav style={S.nav}>
      {NAV_ITEMS.map(item => {
        const active = tab === item.id;
        return (
          <div key={item.id} style={S.navItem(active)} onClick={() => onChange(item.id)}>
            <span style={{ ...S.navIcon, transform: active ? 'translateY(-3px) scale(1.15)' : 'none', transition:'transform .25s' }}>{item.icon}</span>
            <span style={S.navLbl(active)}>{item.label}</span>
            {active && <div style={S.navDot}/>}
          </div>
        );
      })}
    </nav>
  );
}

// ── Auth Screen ───────────────────────────────────────────────
function AuthScreen({ onDone }) {
  const [step, setStep]           = useState('signin');
  const [pendingUser, setPending] = useState(null);
  const [av, setAv]               = useState(AVATARS[0]);
  const [city, setCity]           = useState('الرياض');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const saveUser = async (user, avatar, city) => {
    const profile = { uid:user.uid, name:user.displayName||'لاعب', avatar, city, wins:0, losses:0, coins:500, createdAt:serverTimestamp() };
    await setDoc(doc(db,'users',user.uid), profile, { merge:true });
    return profile;
  };

  const handleUser = async (user) => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db,'users',user.uid));
      if (snap.exists()) {
        onDone({ uid:user.uid, ...snap.data() });
      } else {
        setPending(user);
        setStep('setup');
        setLoading(false);
      }
    } catch(e) { setError(e.message); setLoading(false); }
  };

  const signInGoogle = async () => {
    setLoading(true); setError('');
    try {
      const result = await signInWithPopup(auth, gProvider);
      await handleUser(result.user);
    } catch(e) {
      setError('تعذر تسجيل الدخول. حاول مجدداً');
      setLoading(false);
    }
  };

  const finishSetup = async () => {
    if (!pendingUser) return;
    setLoading(true);
    try {
      const profile = await saveUser(pendingUser, av, city);
      onDone(profile);
    } catch(e) { setError(e.message); setLoading(false); }
  };

  const wrap = { minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'30px 20px', background:'radial-gradient(ellipse 80% 60% at 50% 40%,#0F2A14,#07090A)' };
  const card = { width:'100%', maxWidth:360, background:'rgba(12,20,16,.9)', border:'1px solid rgba(240,192,64,.15)', borderRadius:20, padding:'24px 20px' };

  if (step === 'setup') return (
    <div style={wrap}>
      <div style={{ fontFamily:"'Scheherazade New',serif", fontSize:44, color:'#F0C040', textShadow:'0 0 24px rgba(240,192,64,.4)', marginBottom:6 }}>بلوت</div>
      <div style={{ ...S.dim, fontSize:12, letterSpacing:2, marginBottom:28 }}>أكمل ملفك</div>
      <div style={card}>
        <div style={{ fontSize:16, fontWeight:900, textAlign:'center', marginBottom:18 }}>مرحباً {pendingUser?.displayName?.split(' ')[0]} 👋</div>
        <div style={{ marginBottom:14 }}>
          <div style={S.label}>مدينتك</div>
          <select style={S.select} value={city} onChange={e=>setCity(e.target.value)}>
            {CITIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ ...S.label, marginBottom:8 }}>اختر رمزك</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
            {AVATARS.map(a => (
              <div key={a} onClick={()=>setAv(a)} style={{ width:46, height:46, borderRadius:'50%', background:'rgba(16,26,18,.9)', border:`2px solid ${av===a?'#F0C040':'rgba(255,255,255,.08)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, cursor:'pointer', boxShadow: av===a?'0 0 0 3px rgba(240,192,64,.3)':'none', transform: av===a?'scale(1.1)':'none', transition:'all .2s' }}>{a}</div>
            ))}
          </div>
        </div>
        {error && <div style={{ color:'#E74C3C', fontSize:12, textAlign:'center', marginBottom:10 }}>{error}</div>}
        <button style={{ ...S.btnGold, width:'100%', padding:14, fontSize:15 }} onClick={finishSetup} disabled={loading}>
          {loading ? <Spinner size={20}/> : 'ابدأ اللعب 🃏'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ fontFamily:"'Scheherazade New',serif", fontSize:52, color:'#F0C040', textShadow:'0 0 30px rgba(240,192,64,.45)', marginBottom:6 }}>بلوت</div>
      <div style={{ ...S.dim, fontSize:12, letterSpacing:2, marginBottom:32 }}>المملكة العربية السعودية</div>
      <div style={card}>
        <div style={{ fontSize:17, fontWeight:900, textAlign:'center', marginBottom:8 }}>سجّل دخولك</div>
        <div style={{ ...S.dim, fontSize:12, textAlign:'center', lineHeight:1.6, marginBottom:20 }}>سجّل باستخدام Google للحفاظ على تقدمك وترتيبك</div>
        {error && <div style={{ color:'#E74C3C', fontSize:12, textAlign:'center', background:'rgba(231,76,60,.1)', borderRadius:8, padding:'8px', marginBottom:12 }}>{error}</div>}
        <button
          onClick={signInGoogle} disabled={loading}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:14, borderRadius:12, background:'#fff', color:'#1a1a1a', border:'none', cursor:'pointer', fontFamily:"'Tajawal',sans-serif", fontSize:15, fontWeight:700, boxShadow:'0 4px 20px rgba(0,0,0,.4)', opacity:loading?0.7:1, touchAction:'manipulation' }}
        >
          {loading ? <Spinner size={22}/> : (
            <>
              <svg width="22" height="22" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              تسجيل الدخول بـ Google
            </>
          )}
        </button>
        <div style={{ ...S.dim, fontSize:10, textAlign:'center', marginTop:12, lineHeight:1.5 }}>بالمتابعة توافق على شروط الاستخدام</div>
      </div>
    </div>
  );
}

// ── Home Screen ───────────────────────────────────────────────
function HomeScreen({ profile, onMode }) {
  const modes = [
    { id:'bot',    icon:'🤖', title:'مع الروبوت',   sub:'تدرب بدون انتظار',         color:'#9B59B6' },
    { id:'create', icon:'👥', title:'مع الأصدقاء',  sub:'أنشئ غرفة وشارك الكود',   color:'#F0C040' },
    { id:'join',   icon:'🔑', title:'انضم لغرفة',   sub:'أدخل كود الغرفة',          color:'#3498DB' },
    { id:'quick',  icon:'⚡', title:'لعبة سريعة',   sub:'العب مع لاعبين عشوائيين', color:'#2ECC71' },
  ];
  return (
    <div style={{ ...S.page, paddingBottom:'calc(60px + env(safe-area-inset-bottom) + 12px)', paddingTop:'env(safe-area-inset-top)' }}>
      {/* Hero */}
      <div style={{ textAlign:'center', padding:'20px 16px 0' }}>
        <div style={{ fontFamily:"'Scheherazade New',serif", fontSize:'clamp(30px,9vw,46px)', background:'linear-gradient(135deg,#7A5B1A,#F0C040,#FFE08A,#F0C040,#7A5B1A)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter:'drop-shadow(0 0 14px rgba(240,192,64,.3))', lineHeight:1.1, marginBottom:4 }}>بلوت المملكة</div>
        <div style={{ ...S.dim, fontSize:11, letterSpacing:2, marginBottom:8 }}>العب · تنافس · افوز</div>
        <div style={{ width:70, height:1, margin:'0 auto 18px', background:'linear-gradient(90deg,transparent,#7A5B1A,transparent)' }}/>
      </div>

      {/* Profile strip */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 14px', marginBottom:14 }}>
        <span style={{ fontSize:30 }}>{profile.avatar}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:900, fontSize:14 }}>{profile.name}</div>
          <div style={{ ...S.dim, fontSize:11 }}>{profile.city} · {profile.wins||0} انتصار</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(240,192,64,.1)', border:'1px solid rgba(240,192,64,.2)', borderRadius:20, padding:'5px 10px' }}>
          <span>🪙</span>
          <span style={{ fontSize:13, fontWeight:900, color:'#F0C040' }}>{profile.coins||500}</span>
        </div>
      </div>

      {/* Mode grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'0 12px', marginBottom:14 }}>
        {modes.map(m => (
          <div key={m.id} onClick={() => onMode(m.id)}
            style={{ ...S.surface, padding:'18px 12px', display:'flex', flexDirection:'column', alignItems:'center', gap:7, cursor:'pointer', touchAction:'manipulation', transition:'transform .2s', active:'scale(.95)' }}
          >
            <span style={{ fontSize:28 }}>{m.icon}</span>
            <span style={{ fontSize:13, fontWeight:700, color:m.color+'CC' }}>{m.title}</span>
            <span style={{ ...S.dim, fontSize:10, textAlign:'center', lineHeight:1.3 }}>{m.sub}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display:'flex', background:'rgba(13,20,16,.75)', border:'1px solid rgba(240,192,64,.1)', borderRadius:14, margin:'0 12px', overflow:'hidden' }}>
        {[['٦.٢م','لاعب'],['٩٨٤','مباراة الآن'],['٤.٨','التقييم']].map(([n,l],i) => (
          <div key={i} style={{ flex:1, textAlign:'center', padding:'10px 4px', borderRight: i<2?'1px solid rgba(255,255,255,.06)':'none' }}>
            <div style={{ fontSize:16, fontWeight:900, color:'#F0C040' }}>{n}</div>
            <div style={{ ...S.dim, fontSize:9, marginTop:1 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Game Screen ───────────────────────────────────────────────
function GameScreen({ profile, onExit }) {
  const [hand, setHand]         = useState(() => mkDeck().slice(0,8));
  const [trick, setTrick]       = useState([]);
  const [selected, setSelected] = useState(null);
  const [scores, setScores]     = useState({ a:0, b:0 });
  const [mode, setMode]         = useState('hokum');
  const [showWin, setShowWin]   = useState(false);
  const [toast, setToast]       = useState(null);
  const toastN = useRef(0);

  const players = [
    { name:profile.name, avatar:profile.avatar },
    { name:'محمد',    avatar:'👲' },
    { name:'عبدالله', avatar:'🧔' },
    { name:'سعد',     avatar:'🤴' },
  ];

  const showT = (msg) => { toastN.current++; setToast({ msg, k:toastN.current }); };

  const playCard = (e, card, idx) => {
    if (selected !== idx) { setSelected(idx); return; }
    const r = e.currentTarget.getBoundingClientRect();
    spawnParticles(r.left+28, r.top+40);
    setHand(h => h.filter((_,i) => i !== idx));
    setTrick(t => [...t, card]);
    setSelected(null);
    showT('أحسنت! 🎯');
  };

  const takeTrick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    spawnParticles(r.left+r.width/2, r.top+r.height/2);
    setScores(s => ({ ...s, a: s.a+10 }));
    setTrick([]);
    showT('فزت بالضربة! ✨');
    if (scores.a+10 >= 152) setTimeout(() => setShowWin(true), 400);
  };

  const dealNew = () => {
    setHand(mkDeck().slice(0,8));
    setTrick([]);
    setSelected(null);
    showT('تم التوزيع 🃏');
  };

  const tableStyle = {
    width:'100%', height:'100%',
    background:'radial-gradient(ellipse 90% 70% at 50% 50%,#0F2A14,#07090A)',
    position:'relative', overflow:'hidden',
    display:'flex', alignItems:'center', justifyContent:'center',
  };

  return (
    <div style={tableStyle}>
      {toast && <Toast key={toast.k} msg={toast.msg} onDone={() => setToast(null)}/>}

      {/* Grid texture overlay */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.012) 3px,rgba(255,255,255,.012) 4px),repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(255,255,255,.012) 3px,rgba(255,255,255,.012) 4px)', pointerEvents:'none', zIndex:0 }}/>
      {/* Vignette */}
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 100% 100% at 50% 50%,transparent 30%,rgba(0,0,0,.65) 100%)', pointerEvents:'none', zIndex:0 }}/>

      {/* Ornament rings */}
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'min(82vw,320px)', height:'min(82vw,320px)', borderRadius:'50%', border:'1px solid rgba(240,192,64,.15)', pointerEvents:'none', zIndex:1, animation:'spin 60s linear infinite' }}/>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'min(65vw,260px)', height:'min(65vw,260px)', borderRadius:'50%', border:'1px dashed rgba(240,192,64,.08)', pointerEvents:'none', zIndex:1, animation:'spin 40s linear infinite reverse' }}/>

      {/* Exit + Mode chips */}
      <div style={{ position:'absolute', top:'calc(env(safe-area-inset-top) + 8px)', left:0, right:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 10px', zIndex:20 }}>
        <button style={{ ...S.btnGhost, fontSize:11, padding:'5px 10px' }} onClick={onExit}>خروج</button>
        <div style={{ display:'flex', gap:6 }}>
          {['hokum','sun'].map(m => (
            <div key={m} onClick={() => setMode(m)} style={{ padding:'4px 14px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', border:`1.5px solid ${mode===m?'#F0C040':'rgba(240,192,64,.3)'}`, background: mode===m?'rgba(240,192,64,.15)':'transparent', color: mode===m?'#F0C040':'rgba(240,192,64,.5)', touchAction:'manipulation' }}>
              {m==='hokum'?'حكم':'صن'}
            </div>
          ))}
        </div>
        <div style={{ background:'rgba(10,14,12,.8)', border:'1px solid rgba(240,192,64,.2)', borderRadius:10, padding:'4px 10px', fontSize:13, fontWeight:900 }}>
          <span style={S.gold}>{scores.a}</span><span style={S.dim}> — </span><span style={S.gold}>{scores.b}</span>
        </div>
      </div>

      {/* Trump */}
      <div style={{ position:'absolute', top:'50%', right:10, transform:'translateY(-50%)', zIndex:20, display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'rgba(10,14,12,.7)', border:'1px solid rgba(240,192,64,.18)', borderRadius:10, padding:'6px 8px' }}>
        <span style={{ fontSize:9, color:'rgba(240,237,229,.5)', fontWeight:700 }}>الكوز</span>
        <span style={{ fontSize:26, filter:'drop-shadow(0 0 8px rgba(240,192,64,.5))' }}>♠</span>
      </div>

      {/* Top player */}
      <div style={{ position:'absolute', top:'calc(env(safe-area-inset-top) + 54px)', left:'50%', transform:'translateX(-50%)', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'2px solid #7A5B1A', background:'rgba(16,26,18,.9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{players[2].avatar}</div>
        <span style={{ ...S.dim, fontSize:10, fontWeight:700 }}>{players[2].name}</span>
        <div style={{ display:'flex' }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width:18, height:28, borderRadius:4, background:'linear-gradient(135deg,#0D5C2A,#1A3D20)', border:'1px solid rgba(240,192,64,.25)', marginRight:-7, transform:`rotate(${(i-1.5)*5}deg)`, boxShadow:'0 2px 6px rgba(0,0,0,.5)' }}/>)}
        </div>
      </div>

      {/* Left player */}
      <div style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'2px solid #7A5B1A', background:'rgba(16,26,18,.9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{players[1].avatar}</div>
        <span style={{ ...S.dim, fontSize:10, fontWeight:700 }}>{players[1].name}</span>
      </div>

      {/* Right player */}
      <div style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'2px solid #7A5B1A', background:'rgba(16,26,18,.9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{players[3].avatar}</div>
        <span style={{ ...S.dim, fontSize:10, fontWeight:700 }}>{players[3].name}</span>
      </div>

      {/* Trick area center */}
      <div style={{ position:'relative', width:200, height:160, zIndex:20 }}>
        {trick.map((c,i) => (
          <div key={i} style={{ ...S.card(c.s), top:[20,45,12,38][i%4], left:[36,18,56,32][i%4]+'%', transform:`rotate(${[-8,5,-3,10][i%4]}deg)`, zIndex:i+1 }}>
            <span style={S.rankTop(c.s)}>{RANKS_AR[c.r]}</span>
            <span style={S.suit(c.s)}>{SUITS[c.s]}</span>
            <span style={S.rankBot(c.s)}>{RANKS_AR[c.r]}</span>
          </div>
        ))}
        {trick.length === 0 && (
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', ...S.dim, fontSize:11, fontWeight:600, whiteSpace:'nowrap', opacity:.5 }}>دورك أنت</div>
        )}
        {trick.length >= 4 && (
          <button onClick={takeTrick} style={{ ...S.btnGold, position:'absolute', bottom:-44, left:'50%', transform:'translateX(-50%)', fontSize:12, padding:'8px 16px', whiteSpace:'nowrap' }}>
            خذ الضربة 🏆
          </button>
        )}
      </div>

      {/* Action buttons — above hand */}
      <div style={{ position:'absolute', bottom:'calc(118px + env(safe-area-inset-bottom))', left:0, right:0, display:'flex', justifyContent:'center', gap:8, zIndex:35, padding:'0 10px' }}>
        <button style={{ ...S.btnGhost, fontSize:12, padding:'8px 14px' }} onClick={dealNew}>توزيع 🃏</button>
        <button style={{ ...S.btnGold, fontSize:12, padding:'8px 14px' }} onClick={() => setShowWin(true)}>نهاية 🏆</button>
      </div>

      {/* Player hand */}
      <div style={{ position:'absolute', bottom:'calc(8px + env(safe-area-inset-bottom))', left:0, right:0, height:110, zIndex:30, display:'flex', justifyContent:'center', alignItems:'flex-end' }}>
        {hand.map((card, i) => {
          const total = hand.length;
          const spread = Math.min(28, 210/Math.max(total,1));
          const offset = (i-(total-1)/2)*spread;
          const rot    = (i-(total-1)/2)*3.5;
          const lift   = Math.abs(i-(total-1)/2)*1.5;
          const isSel  = selected === i;
          return (
            <div key={i} onClick={e => playCard(e,card,i)}
              style={{ ...S.card(card.s), left:`calc(50% + ${offset}px - 28px)`, transform:`rotate(${rot}deg) translateY(${isSel?-28:lift}px) scale(${isSel?1.08:1})`, zIndex: isSel?90:i+1, border:`1px solid ${isSel?'#2ECC71':'rgba(0,0,0,.12)'}`, boxShadow: isSel?'0 0 0 2px rgba(46,204,113,.4),0 8px 24px rgba(0,0,0,.7)':'0 8px 24px rgba(0,0,0,.7)', transition:'transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .2s, border-color .2s' }}
            >
              <span style={S.rankTop(card.s)}>{RANKS_AR[card.r]}</span>
              <span style={S.suit(card.s)}>{SUITS[card.s]}</span>
              <span style={S.rankBot(card.s)}>{RANKS_AR[card.r]}</span>
            </div>
          );
        })}
      </div>

      {/* Win overlay */}
      {showWin && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20, animation:'fadeUp .3s ease' }}>
          <div style={{ background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)', border:'1px solid #F0C040', borderRadius:22, padding:'36px 28px', textAlign:'center', boxShadow:'0 0 40px rgba(240,192,64,.25),0 50px 100px rgba(0,0,0,.9)', width:'100%', maxWidth:320, animation:'popIn .5s cubic-bezier(.34,1.56,.64,1)' }}>
            <div style={{ fontSize:60, animation:'popIn .6s cubic-bezier(.34,1.56,.64,1) .2s both' }}>🏆</div>
            <div style={{ fontFamily:"'Scheherazade New',serif", fontSize:30, color:'#F0C040', margin:'12px 0 6px', textShadow:'0 0 20px rgba(240,192,64,.4)' }}>الفريق أ يفوز!</div>
            <div style={{ ...S.dim, fontSize:13 }}>وصلتم إلى ١٥٢ نقطة أولاً</div>
            <div style={{ display:'flex', justifyContent:'center', gap:30, margin:'20px 0' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <span style={{ fontSize:36, fontWeight:900, color:'#F0C040', lineHeight:1 }}>{scores.a}</span>
                <span style={{ ...S.dim, fontSize:11 }}>الفريق أ</span>
              </div>
              <span style={{ ...S.dim, fontSize:24, alignSelf:'center' }}>—</span>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <span style={{ fontSize:36, fontWeight:900, color:'rgba(240,237,229,.4)', lineHeight:1 }}>{scores.b}</span>
                <span style={{ ...S.dim, fontSize:11 }}>الفريق ب</span>
              </div>
            </div>
            <button style={{ ...S.btnGold, width:'100%', padding:14, fontSize:15 }} onClick={() => { setShowWin(false); onExit(); }}>العب مجدداً</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────
function LeaderboardScreen() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db,'users'), orderBy('wins','desc'), limit(20));
        const snap = await getDocs(q);
        setPlayers(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      } catch {
        setPlayers([
          {id:'1',name:'أبو عبدالله',avatar:'🧔',city:'الرياض',wins:247},
          {id:'2',name:'محمد الغامدي',avatar:'👲',city:'جدة',wins:198},
          {id:'3',name:'سعد العتيبي',avatar:'🤴',city:'الدمام',wins:187},
          {id:'4',name:'فهد القحطاني',avatar:'🧙',city:'مكة',wins:156},
          {id:'5',name:'عبدالرحمن',avatar:'👨‍💼',city:'المدينة',wins:143},
          {id:'6',name:'خالد الزهراني',avatar:'🦸',city:'تبوك',wins:132},
          {id:'7',name:'نايف الشمري',avatar:'🧔',city:'حائل',wins:121},
          {id:'8',name:'بدر المطيري',avatar:'👲',city:'أبها',wins:118},
        ]);
      }
      setLoading(false);
    })();
  }, []);

  const rankIcon = i => i===0?'🥇':i===1?'🥈':i===2?'🥉':String(i+1);
  const rankColor= i => i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'rgba(240,237,229,.55)';

  return (
    <div style={{ ...S.page, paddingBottom:'calc(60px + env(safe-area-inset-bottom) + 12px)', paddingTop:'env(safe-area-inset-top)' }}>
      <div style={{ padding:'16px 14px 8px', textAlign:'center' }}>
        <div style={{ ...S.title, fontSize:22 }}>🏆 المتصدرون</div>
        <div style={{ ...S.dim, fontSize:11, marginTop:4 }}>أفضل لاعبي المملكة</div>
      </div>
      <div style={S.divider}/>
      {loading ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner/></div> : (
        players.map((p,i) => (
          <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
            <span style={{ fontSize: i<3?18:13, fontWeight:900, color:rankColor(i), width:24, textAlign:'center', flexShrink:0 }}>{rankIcon(i)}</span>
            <span style={{ fontSize:26, flexShrink:0 }}>{p.avatar||'🧔'}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
              <div style={{ ...S.dim, fontSize:10 }}>{p.city}</div>
            </div>
            <span style={{ fontSize:13, fontWeight:900, color:'#F0C040', flexShrink:0 }}>{p.wins} ✓</span>
          </div>
        ))
      )}
    </div>
  );
}

// ── Store Screen ──────────────────────────────────────────────
function StoreScreen({ profile }) {
  const [toast, setToast] = useState(null);
  const tn = useRef(0);
  const items = [
    { icon:'🎴', name:'طقم ذهبي',     price:'٤٩ ريال', tag:'الأكثر مبيعاً', tc:'#E74C3C' },
    { icon:'🟩', name:'طاولة زمردية', price:'٢٩ ريال', tag:'جديد',          tc:'#2ECC71' },
    { icon:'👑', name:'VIP شهري',      price:'٩٩ ريال', tag:'الأفضل',        tc:'#F0C040' },
    { icon:'🪙', name:'٥٠٠ عملة',      price:'١٠ ريال', tag:'',              tc:'' },
    { icon:'🎭', name:'تعابير مميزة', price:'١٩ ريال', tag:'',              tc:'' },
    { icon:'🏅', name:'إطار بطل',      price:'٣٩ ريال', tag:'نادر',          tc:'#9B59B6' },
  ];
  const buy = (e, item) => {
    const r = e.currentTarget.getBoundingClientRect();
    spawnParticles(r.left+r.width/2, r.top+r.height/2);
    tn.current++;
    setToast({ msg:`تم الشراء: ${item.name} 🎉`, k:tn.current });
  };
  return (
    <div style={{ ...S.page, paddingBottom:'calc(60px + env(safe-area-inset-bottom) + 12px)', paddingTop:'env(safe-area-inset-top)' }}>
      {toast && <Toast key={toast.k} msg={toast.msg} onDone={() => setToast(null)}/>}
      <div style={{ padding:'16px 14px 8px', textAlign:'center' }}>
        <div style={{ ...S.title, fontSize:22 }}>🛍️ المتجر</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(13,20,16,.8)', border:'1px solid #7A5B1A', borderRadius:12, margin:'0 12px 12px', padding:'10px 14px' }}>
        <span style={S.dim}>رصيدك</span>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16, fontWeight:900, color:'#F0C040' }}>🪙 {profile.coins||500}</span>
          <button style={{ ...S.btnGold, padding:'6px 14px', fontSize:12 }}>شحن</button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'0 12px 16px' }}>
        {items.map((item,i) => (
          <div key={i} onClick={e=>buy(e,item)}
            style={{ ...S.surface, padding:'16px 12px', display:'flex', flexDirection:'column', alignItems:'center', gap:7, cursor:'pointer', position:'relative', touchAction:'manipulation' }}
          >
            {item.tag && <span style={{ position:'absolute', top:8, right:8, background:item.tc, color:item.tc==='#F0C040'?'#000':'#fff', fontSize:8, fontWeight:700, padding:'2px 5px', borderRadius:5, lineHeight:1.4 }}>{item.tag}</span>}
            <span style={{ fontSize:30 }}>{item.icon}</span>
            <span style={{ fontSize:12, fontWeight:700, textAlign:'center' }}>{item.name}</span>
            <span style={{ fontSize:13, fontWeight:900, color:'#F0C040', background:'rgba(240,192,64,.1)', padding:'3px 10px', borderRadius:20, border:'1px solid rgba(240,192,64,.2)' }}>{item.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Friends Screen ────────────────────────────────────────────
function FriendsScreen() {
  const friends = [
    { name:'محمد الغامدي',  avatar:'👲', city:'جدة',    status:'متصل',     sc:'#2ECC71' },
    { name:'سعد العتيبي',   avatar:'🤴', city:'الدمام', status:'في لعبة',  sc:'#F0C040' },
    { name:'فهد القحطاني',  avatar:'🧙', city:'مكة',    status:'غير متصل', sc:'#666' },
    { name:'خالد الزهراني', avatar:'🦸', city:'تبوك',   status:'متصل',     sc:'#2ECC71' },
  ];
  return (
    <div style={{ ...S.page, paddingBottom:'calc(60px + env(safe-area-inset-bottom) + 12px)', paddingTop:'env(safe-area-inset-top)' }}>
      <div style={{ padding:'16px 14px 8px', textAlign:'center' }}>
        <div style={{ ...S.title, fontSize:22 }}>👥 أصدقاء</div>
      </div>
      <div style={{ padding:'0 12px 12px' }}>
        <input style={S.input} placeholder="🔍 ابحث عن صديق..."/>
      </div>
      <div style={S.divider}/>
      {friends.map((f,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
          <span style={{ fontSize:28 }}>{f.avatar}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700 }}>{f.name}</div>
            <div style={{ fontSize:10, color:f.sc }}>{f.status}</div>
          </div>
          {f.status==='متصل' && <button style={{ ...S.btnGreen, padding:'7px 14px', fontSize:12 }}>دعوة</button>}
        </div>
      ))}
    </div>
  );
}

// ── Profile Screen ────────────────────────────────────────────
function ProfileScreen({ profile, onUpdate, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(profile.name);
  const [av, setAv]           = useState(profile.avatar);
  const [city, setCity]       = useState(profile.city);

  const save = async () => {
    try {
      await updateDoc(doc(db,'users',profile.uid), { name, avatar:av, city });
      onUpdate({ ...profile, name, avatar:av, city });
      setEditing(false);
    } catch(e) { alert(e.message); }
  };

  return (
    <div style={{ ...S.page, paddingBottom:'calc(60px + env(safe-area-inset-bottom) + 12px)', paddingTop:'env(safe-area-inset-top)' }}>
      <div style={{ textAlign:'center', padding:'24px 16px 16px', background:'linear-gradient(180deg,rgba(26,61,32,.5),transparent)' }}>
        <div style={{ fontSize:60, marginBottom:8 }}>{profile.avatar}</div>
        <div style={{ fontSize:20, fontWeight:900, marginBottom:2 }}>{profile.name}</div>
        <div style={{ ...S.dim, fontSize:12, marginBottom:14 }}>📍 {profile.city}</div>
        <div style={{ display:'flex', justifyContent:'center', gap:24 }}>
          {[['انتصار',profile.wins||0],['هزيمة',profile.losses||0],['🪙 عملة',profile.coins||500]].map(([l,v]) => (
            <div key={l} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
              <span style={{ fontSize:22, fontWeight:900, color:'#F0C040' }}>{v}</span>
              <span style={{ ...S.dim, fontSize:10 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {editing ? (
        <div style={{ padding:'0 14px' }}>
          <div style={{ marginBottom:10 }}>
            <div style={S.label}>الاسم</div>
            <input style={S.input} value={name} onChange={e=>setName(e.target.value)} maxLength={20}/>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={S.label}>المدينة</div>
            <select style={S.select} value={city} onChange={e=>setCity(e.target.value)}>
              {CITIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ ...S.label, marginBottom:8 }}>الرمز</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
              {AVATARS.map(a => <div key={a} onClick={()=>setAv(a)} style={{ width:46, height:46, borderRadius:'50%', background:'rgba(16,26,18,.9)', border:`2px solid ${av===a?'#F0C040':'rgba(255,255,255,.08)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, cursor:'pointer', transform:av===a?'scale(1.1)':'none', transition:'all .2s' }}>{a}</div>)}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={{ ...S.btnGhost, flex:1 }} onClick={()=>setEditing(false)}>إلغاء</button>
            <button style={{ ...S.btnGold, flex:1 }} onClick={save}>حفظ</button>
          </div>
        </div>
      ) : (
        <div style={{ padding:'0 14px', marginTop:8 }}>
          {[
            { icon:'✏️', title:'تعديل الملف', sub:'الاسم، الرمز، المدينة', action:()=>setEditing(true) },
            { icon:'📊', title:'إحصائياتي',   sub:'نسبة الفوز وتفاصيل اللعب', action:()=>{} },
            { icon:'🔔', title:'الإشعارات',   sub:'تحكم في التنبيهات', action:()=>{} },
            { icon:'🚪', title:'تسجيل الخروج', sub:'', action:onLogout, red:true },
          ].map((item,i) => (
            <div key={i} onClick={item.action}
              style={{ display:'flex', alignItems:'center', gap:10, padding:12, background:'rgba(16,26,18,.85)', border:'1px solid rgba(255,255,255,.07)', borderRadius:12, marginBottom:8, cursor:'pointer', touchAction:'manipulation' }}
            >
              <span style={{ fontSize:20, flexShrink:0 }}>{item.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color: item.red?'#E74C3C':undefined }}>{item.title}</div>
                {item.sub && <div style={{ ...S.dim, fontSize:11 }}>{item.sub}</div>}
              </div>
              {!item.red && <span style={S.dim}>›</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('home');
  const [inGame, setInGame]     = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      (async () => {
        if (user) {
          try {
            const snap = await getDoc(doc(db,'users',user.uid));
            if (snap.exists()) setProfile({ uid:user.uid, ...snap.data() });
            else setProfile(null);
          } catch { setProfile(null); }
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try { await signOut(auth); } catch {}
    setProfile(null);
  };

  const handleMode = (mode) => {
    if (mode === 'bot' || mode === 'quick') {
      setInGame(true);
    }
  };

  // Loading
  if (loading) return (
    <div style={{ height:'100dvh', background:'#07090A', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, fontFamily:"'Tajawal',sans-serif" }}>
      <div style={{ fontFamily:"'Scheherazade New',serif", fontSize:40, color:'#F0C040', textShadow:'0 0 24px rgba(240,192,64,.4)' }}>بلوت</div>
      <Spinner/>
    </div>
  );

  // Not signed in
  if (!profile) return <AuthScreen onDone={setProfile}/>;

  // Full screen game
  if (inGame) return (
    <div style={{ height:'100dvh', background:'#07090A', overflow:'hidden' }}>
      <GameScreen profile={profile} onExit={() => { setInGame(false); setTab('home'); }}/>
    </div>
  );

  // Main tabbed app
  return (
    <div style={S.app}>
      <div style={S.content}>
        {tab === 'home'    && <HomeScreen    profile={profile} onMode={handleMode}/>}
        {tab === 'board'   && <LeaderboardScreen/>}
        {tab === 'store'   && <StoreScreen   profile={profile}/>}
        {tab === 'friends' && <FriendsScreen/>}
        {tab === 'profile' && <ProfileScreen profile={profile} onUpdate={setProfile} onLogout={handleLogout}/>}
      </div>
      <BottomNav tab={tab} onChange={setTab}/>
    </div>
  );
}
