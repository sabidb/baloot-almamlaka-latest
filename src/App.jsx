import { useState, useEffect, useRef, useReducer } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, orderBy, limit, getDocs, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  buildDeck, shuffle, dealHands, botBid, botChoose, legalPlays,
  trickWinner, trickPoints, calcResult, sortHand,
  TABLE_THEMES, AVATAR_CATALOG, FREE_AVATARS, FRAMES, NAMEPLATES, CHAT_BUBBLES,
  REACTIONS, defaultInventory, applyAchievements,
  sounds, setMuted, startAmbience, stopAmbience,
} from './GameLogic';
import LudoScreen from './Ludo';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase defensively — if it's unavailable (missing config,
// registration race, offline), the app still runs in guest/offline mode
// instead of white-screening.
let db=null, auth=null, gProv=null;
try{
  const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db    = getFirestore(fbApp);
  auth  = getAuth(fbApp);
  gProv = new GoogleAuthProvider();
}catch(e){
  console.warn('Firebase unavailable — running in offline/guest mode:', e?.message||e);
}

const AVATARS = FREE_AVATARS; // onboarding shows free avatars; premium unlock via inventory
const CITIES  = ['الرياض','جدة','مكة','المدينة','الدمام','الخبر','أبها','تبوك','حائل','القصيم'];
const RANKSAR = {A:'أ',K:'ك',Q:'ق',J:'ج','10':'١٠','9':'٩','8':'٨','7':'٧'};

// Merge a patch into the profile locally (optimistic) and persist best-effort to Firestore.
async function persistProfile(uid, patch){
  try{ await updateDoc(doc(db,'users',uid), patch); }catch{ /* offline / no backend — keep local */ }
}
// Reusable playing-card face (works with GameLogic card model).
function CardFace({card,style}){
  return (
    <div style={style}>
      <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:card.suit.color,alignSelf:'flex-start',lineHeight:1}}>{RANKSAR[card.rank.symbol]}</span>
      <span style={{fontSize:20,color:card.suit.color,lineHeight:1}}>{card.suit.symbol}</span>
      <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:card.suit.color,alignSelf:'flex-end',transform:'rotate(180deg)',lineHeight:1}}>{RANKSAR[card.rank.symbol]}</span>
    </div>
  );
}

// Avatar with an equipped frame ring.
function AvatarBadge({emoji,frameId,size=44}){
  const ring=(FRAMES.find(f=>f.id===frameId)||FRAMES[0]).ring;
  const isGrad=String(ring).includes('gradient');
  return(
    <div style={{width:size,height:size,borderRadius:'50%',padding:isGrad?3:0,background:isGrad?ring:'transparent',border:isGrad?'none':`2.5px solid ${ring}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      <div style={{width:'100%',height:'100%',borderRadius:'50%',background:'rgba(16,26,18,.95)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.5}}>{emoji}</div>
    </div>
  );
}
// Player name with an equipped nameplate.
function NamePlate({name,plateId,size=14}){
  const p=NAMEPLATES.find(n=>n.id===plateId)||NAMEPLATES[0];
  if(p.id==='none') return <span style={{fontWeight:900,fontSize:size}}>{name}</span>;
  return <span style={{fontWeight:900,fontSize:size,padding:'2px 10px',borderRadius:20,background:p.bg,color:p.fg,display:'inline-block'}}>{name}</span>;
}

const CATALOG={
  tables:     Object.entries(TABLE_THEMES).map(([id,t])=>({id,...t})),
  avatars:    AVATAR_CATALOG.map(a=>({id:a.emoji,name:a.emoji,cost:a.cost,emoji:a.emoji})),
  frames:     FRAMES,
  nameplates: NAMEPLATES,
  bubbles:    CHAT_BUBBLES,
};
const EQUIP_FIELD={tables:'tableTheme',avatars:'avatar',frames:'frame',nameplates:'nameplate',bubbles:'bubble'};

function ownsItem(profile,category,id){
  const inv={...defaultInventory(),...(profile.inventory||{})};
  return (inv[category]||[]).includes(id);
}
function purchase(profile,onUpdate,category,id,cost){
  const inv={...defaultInventory(),...(profile.inventory||{})};
  if((inv[category]||[]).includes(id)) return {ok:false,msg:'تملكه بالفعل'};
  if((profile.coins||0)<cost) return {ok:false,msg:'رصيد غير كافٍ 🪙'};
  const nextInv={...inv,[category]:[...(inv[category]||[]),id]};
  const coins=(profile.coins||0)-cost;
  onUpdate(p=>({...p,coins,inventory:nextInv}));
  persistProfile(profile.uid,{coins,inventory:nextInv});
  return {ok:true,msg:'تم الشراء ✅'};
}
function equip(profile,onUpdate,category,id){
  const field=EQUIP_FIELD[category];
  onUpdate(p=>({...p,[field]:id}));
  persistProfile(profile.uid,{[field]:id});
}

function spawnParticles(x,y){
  const colors=['#F0C040','#FFE08A','#2ECC71','#fff'];
  for(let i=0;i<18;i++){
    const el=document.createElement('div');
    const a=(Math.PI*2/18)*i, d=60+Math.random()*100, sz=4+Math.random()*7;
    Object.assign(el.style,{position:'fixed',left:x+'px',top:y+'px',width:sz+'px',height:sz+'px',borderRadius:'50%',background:colors[i%colors.length],pointerEvents:'none',zIndex:'9999',animation:`pfly ${0.5+Math.random()*0.7}s ease-out forwards`,'--tx':Math.cos(a)*d+'px','--ty':Math.sin(a)*d+'px'});
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1300);
  }
}

const G={
  page:{fontFamily:'Tajawal,sans-serif',minHeight:'100dvh',background:'#07090A',color:'#F0EDE5',direction:'rtl'},
  center:{display:'flex',alignItems:'center',justifyContent:'center'},
  gold:{color:'#F0C040'},
  dim:{color:'rgba(240,237,229,.6)'},
  card:{width:54,height:78,borderRadius:10,background:'linear-gradient(145deg,#FEFDF8,#F0EBE0)',border:'1px solid rgba(0,0,0,.1)',boxShadow:'0 6px 20px rgba(0,0,0,.65)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'3px',position:'absolute',cursor:'pointer',touchAction:'manipulation'},
  btn:{padding:'11px 20px',borderRadius:11,border:'none',cursor:'pointer',fontFamily:'Tajawal,sans-serif',fontWeight:700,touchAction:'manipulation'},
  input:{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.12)',borderRadius:10,padding:'11px 13px',fontFamily:'Tajawal,sans-serif',fontSize:14,color:'#F0EDE5',width:'100%',outline:'none'},
};

function Spin(){return <div style={{width:30,height:30,border:'3px solid rgba(240,192,64,.2)',borderTopColor:'#F0C040',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>;}

export default function App(){
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(!!auth); // no backend → skip loading, go straight to guest/login
  const [tab,setTab]=useState('home');
  const [game,setGame]=useState(null); // null | 'baloot' | 'ludo'

  useEffect(()=>{
    const style=document.createElement('style');
    style.textContent=`
      @import url('https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;700&family=Tajawal:wght@400;700;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
      html,body,#root{height:100%;background:#07090A;overflow:hidden}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      @keyframes popIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
      @keyframes pfly{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)}}
      @keyframes pulse{0%,100%{transform:translate(-50%,-60%) scale(1)}50%{transform:translate(-50%,-60%) scale(1.14)}}
      select option{background:#0C1410}
    `;
    document.head.appendChild(style);
    return()=>document.head.removeChild(style);
  },[]);

  useEffect(()=>{
    if(!auth) return; // no backend — stay on login/guest screen
    const unsub=onAuthStateChanged(auth,(user)=>{
      (async()=>{
        if(user){
          try{
            const snap=await getDoc(doc(db,'users',user.uid));
            setProfile(snap.exists()?{uid:user.uid,...snap.data()}:null);
          }catch{setProfile(null);}
        }else{setProfile(null);}
        setLoading(false);
      })();
    });
    return()=>unsub();
  },[]);

  if(loading)return(
    <div style={{height:'100dvh',background:'#07090A',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,fontFamily:'Tajawal,sans-serif'}}>
      <div style={{fontFamily:"'Scheherazade New',serif",fontSize:44,color:'#F0C040',textShadow:'0 0 24px rgba(240,192,64,.4)'}}>بلوت</div>
      <Spin/>
    </div>
  );

  if(!profile)return <AuthScreen onDone={setProfile}/>;

  if(game==='baloot')return(
    <div style={{height:'100dvh',overflow:'hidden'}}>
      <GameScreen profile={profile} onUpdate={setProfile} onExit={()=>{setGame(null);setTab('home');}}/>
    </div>
  );
  if(game==='ludo')return(
    <div style={{height:'100dvh',overflow:'hidden'}}>
      <LudoScreen profile={profile} onExit={()=>{setGame(null);setTab('home');}}/>
    </div>
  );

  const NAV=[{id:'home',i:'🏠',l:'الرئيسية'},{id:'board',i:'🏆',l:'المتصدرون'},{id:'store',i:'🛍️',l:'المتجر'},{id:'friends',i:'👥',l:'أصدقاء'},{id:'profile',i:'👤',l:'ملفي'}];

  return(
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#07090A',fontFamily:'Tajawal,sans-serif',color:'#F0EDE5',direction:'rtl',overflow:'hidden'}}>
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        {tab==='home'    &&<HomeScreen    profile={profile} onGame={setGame}/>}
        {tab==='board'   &&<LeaderScreen/>}
        {tab==='store'   &&<StoreScreen   profile={profile} onUpdate={setProfile}/>}
        {tab==='friends' &&<FriendScreen/>}
        {tab==='profile' &&<ProfileScreen profile={profile} onUpdate={setProfile} onLogout={async()=>{try{await signOut(auth);}catch{/* ignore */}setProfile(null);}}/>}
      </div>
      <nav style={{flexShrink:0,height:'calc(60px + env(safe-area-inset-bottom,0px))',paddingBottom:'env(safe-area-inset-bottom,0px)',background:'rgba(8,12,10,.97)',borderTop:'1px solid rgba(240,192,64,.12)',display:'flex'}}>
        {NAV.map(n=>{const a=tab===n.id;return(
          <div key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',padding:'6px 0',position:'relative'}}>
            <span style={{fontSize:19,transform:a?'translateY(-3px) scale(1.15)':'none',transition:'transform .25s'}}>{n.i}</span>
            <span style={{fontSize:9,fontWeight:700,color:a?'#F0C040':'rgba(240,237,229,.5)'}}>{n.l}</span>
            {a&&<div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',width:26,height:2,borderRadius:2,background:'#F0C040'}}/>}
          </div>
        );})}
      </nav>
    </div>
  );
}

function AuthScreen({onDone}){
  const [step,setStep]=useState('login');
  const [pending,setPending]=useState(null);
  const [av,setAv]=useState(AVATARS[0]);
  const [city,setCity]=useState('الرياض');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');

  const doGoogle=async()=>{
    if(!auth){ setErr('تسجيل الدخول غير متاح حالياً — جرّب اللعب كضيف'); return; }
    setBusy(true);setErr('');
    try{
      const res=await signInWithPopup(auth,gProv);
      const snap=await getDoc(doc(db,'users',res.user.uid));
      if(snap.exists()){onDone({uid:res.user.uid,...snap.data()});}
      else{setPending(res.user);setStep('setup');setBusy(false);}
    }catch{setErr('تعذر تسجيل الدخول');setBusy(false);}
  };

  const finish=async()=>{
    if(!pending)return;
    setBusy(true);
    try{
      const p={uid:pending.uid,name:pending.displayName||'لاعب',avatar:av,city,wins:0,losses:0,coins:500,
        tableTheme:'classic',frame:'none',nameplate:'none',bubble:'none',inventory:defaultInventory(),
        createdAt:serverTimestamp()};
      await setDoc(doc(db,'users',pending.uid),p,{merge:true});
      onDone(p);
    }catch(e){setErr(e.message);setBusy(false);}
  };

  const bg={minHeight:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'28px 20px',background:'radial-gradient(ellipse 80% 60% at 50% 40%,#0F2A14,#07090A)',fontFamily:'Tajawal,sans-serif',direction:'rtl'};
  const box={width:'100%',maxWidth:360,background:'rgba(12,20,16,.92)',border:'1px solid rgba(240,192,64,.14)',borderRadius:20,padding:'22px 18px'};

  if(step==='setup')return(
    <div style={bg}>
      <div style={{fontFamily:"'Scheherazade New',serif",fontSize:46,color:'#F0C040',textShadow:'0 0 24px rgba(240,192,64,.4)',marginBottom:6}}>بلوت</div>
      <div style={{color:'rgba(240,237,229,.6)',fontSize:12,letterSpacing:2,marginBottom:26}}>أكمل ملفك</div>
      <div style={box}>
        <div style={{fontSize:16,fontWeight:900,textAlign:'center',marginBottom:18}}>مرحباً {pending?.displayName?.split(' ')[0]||'لاعب'} 👋</div>
        <div style={{marginBottom:12}}>
          <div style={{color:'rgba(240,237,229,.6)',fontSize:11,fontWeight:700,marginBottom:4}}>مدينتك</div>
          <select style={G.input} value={city} onChange={e=>setCity(e.target.value)}>{CITIES.map(c=><option key={c}>{c}</option>)}</select>
        </div>
        <div style={{marginBottom:18}}>
          <div style={{color:'rgba(240,237,229,.6)',fontSize:11,fontWeight:700,marginBottom:8}}>اختر رمزك</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>
            {AVATARS.map(a=><div key={a} onClick={()=>setAv(a)} style={{width:44,height:44,borderRadius:'50%',background:'rgba(16,26,18,.9)',border:`2px solid ${av===a?'#F0C040':'rgba(255,255,255,.08)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,cursor:'pointer',transform:av===a?'scale(1.1)':'none',transition:'all .2s'}}>{a}</div>)}
          </div>
        </div>
        {err&&<div style={{color:'#E74C3C',fontSize:12,textAlign:'center',marginBottom:10}}>{err}</div>}
        <button onClick={finish} disabled={busy} style={{...G.btn,width:'100%',padding:14,fontSize:15,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {busy?<Spin/>:'ابدأ اللعب 🃏'}
        </button>
      </div>
    </div>
  );

  return(
    <div style={bg}>
      <div style={{fontFamily:"'Scheherazade New',serif",fontSize:50,color:'#F0C040',textShadow:'0 0 28px rgba(240,192,64,.45)',marginBottom:6}}>بلوت</div>
      <div style={{color:'rgba(240,237,229,.6)',fontSize:12,letterSpacing:2,marginBottom:30}}>المملكة العربية السعودية</div>
      <div style={box}>
        <div style={{fontSize:17,fontWeight:900,textAlign:'center',marginBottom:8}}>سجّل دخولك</div>
        <div style={{color:'rgba(240,237,229,.6)',fontSize:12,textAlign:'center',lineHeight:1.6,marginBottom:20}}>سجّل باستخدام Google للحفاظ على تقدمك</div>
        {err&&<div style={{color:'#E74C3C',fontSize:12,textAlign:'center',background:'rgba(231,76,60,.1)',borderRadius:8,padding:8,marginBottom:12}}>{err}</div>}
        <button onClick={doGoogle} disabled={busy} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,width:'100%',padding:14,borderRadius:12,background:'#fff',color:'#1a1a1a',border:'none',cursor:'pointer',fontFamily:'Tajawal,sans-serif',fontSize:15,fontWeight:700,boxShadow:'0 4px 18px rgba(0,0,0,.4)',opacity:busy?.7:1,touchAction:'manipulation'}}>
          {busy?<Spin/>:(
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
        <button onClick={()=>onDone(guestProfile())} disabled={busy} style={{...G.btn,width:'100%',marginTop:10,padding:12,fontSize:14,background:'rgba(255,255,255,.06)',border:'1px solid rgba(240,192,64,.2)',color:'#F0C040'}}>العب كضيف 🎮</button>
        <div style={{color:'rgba(240,237,229,.6)',fontSize:10,textAlign:'center',marginTop:12}}>بالمتابعة توافق على شروط الاستخدام</div>
      </div>
    </div>
  );
}

// Local-only profile for guests (no backend). Progress lives in memory.
function guestProfile(){
  return {uid:'guest',name:'ضيف',avatar:FREE_AVATARS[0],city:'الرياض',wins:0,losses:0,coins:1200,
    tableTheme:'classic',frame:'none',nameplate:'none',bubble:'none',inventory:defaultInventory(),guest:true};
}

function HomeScreen({profile,onGame}){
  const [notice,setNotice]=useState(null);
  const noteN=useRef(0);
  const showNote=m=>{noteN.current++;const k=noteN.current;setNotice({m,k});setTimeout(()=>setNotice(n=>n&&n.k===k?null:n),2600);};
  const modes=[
    {id:'bot',   icon:'🤖',title:'مع الروبوت',  sub:'تدرب بدون انتظار',        color:'#9B59B6', online:false},
    {id:'create',icon:'👥',title:'مع الأصدقاء', sub:'أنشئ غرفة وشارك الكود',  color:'#F0C040', online:true},
    {id:'join',  icon:'🔑',title:'انضم لغرفة',  sub:'أدخل كود الغرفة',         color:'#3498DB', online:true},
    {id:'quick', icon:'⚡',title:'لعبة سريعة',  sub:'العب مع لاعبين عشوائيين',color:'#2ECC71', online:false},
  ];
  const pickMode=m=>{
    if(m.id==='bot'||m.id==='quick'){ onGame('baloot'); return; }
    showNote('🔒 اللعب أونلاين مع الأصدقاء — قريباً');
  };
  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      <div style={{textAlign:'center',padding:'18px 14px 0'}}>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:'clamp(28px,9vw,44px)',background:'linear-gradient(135deg,#7A5B1A,#F0C040,#FFE08A,#F0C040,#7A5B1A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',lineHeight:1.1,marginBottom:4}}>بلوت المملكة</div>
        <div style={{color:'rgba(240,237,229,.6)',fontSize:11,letterSpacing:2,marginBottom:8}}>العب · تنافس · افوز</div>
        <div style={{width:60,height:1,margin:'0 auto 16px',background:'linear-gradient(90deg,transparent,#7A5B1A,transparent)'}}/>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 14px',marginBottom:12}}>
        <AvatarBadge emoji={profile.avatar} frameId={profile.frame||'none'} size={44}/>
        <div style={{flex:1}}>
          <NamePlate name={profile.name} plateId={profile.nameplate||'none'} size={14}/>
          <div style={{color:'rgba(240,237,229,.6)',fontSize:11,marginTop:2}}>{profile.city} · {profile.wins||0} انتصار</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(240,192,64,.1)',border:'1px solid rgba(240,192,64,.2)',borderRadius:20,padding:'5px 10px'}}>
          <span>🪙</span><span style={{fontSize:13,fontWeight:900,color:'#F0C040'}}>{profile.coins||500}</span>
        </div>
      </div>
      {notice&&<div key={notice.k} style={{margin:'0 12px 10px',background:'rgba(240,192,64,.1)',border:'1px solid rgba(240,192,64,.3)',borderRadius:10,padding:'8px 12px',fontSize:12,fontWeight:700,color:'#F0C040',textAlign:'center',animation:'fadeUp .3s ease both'}}>{notice.m}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'0 12px',marginBottom:12}}>
        {modes.map(m=>(
          <div key={m.id} onClick={()=>pickMode(m)}
            style={{background:'rgba(13,20,16,.8)',border:'1px solid rgba(255,255,255,.07)',borderRadius:16,padding:'16px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer',touchAction:'manipulation',position:'relative',opacity:m.online?0.75:1}}>
            {m.online&&<span style={{position:'absolute',top:8,left:8,background:'rgba(240,192,64,.15)',color:'#F0C040',fontSize:8,fontWeight:700,padding:'2px 5px',borderRadius:5}}>قريباً</span>}
            <span style={{fontSize:26}}>{m.icon}</span>
            <span style={{fontSize:13,fontWeight:700,color:m.color+'CC'}}>{m.title}</span>
            <span style={{color:'rgba(240,237,229,.6)',fontSize:10,textAlign:'center',lineHeight:1.3}}>{m.sub}</span>
          </div>
        ))}
      </div>
      <div onClick={()=>onGame('ludo')} style={{margin:'0 12px 12px',display:'flex',alignItems:'center',gap:12,background:'linear-gradient(135deg,rgba(155,89,182,.25),rgba(52,152,219,.18))',border:'1px solid rgba(240,192,64,.25)',borderRadius:16,padding:'14px 16px',cursor:'pointer',touchAction:'manipulation'}}>
        <span style={{fontSize:34}}>🎲</span>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:900,color:'#F0C040'}}>لودو المملكة</div>
          <div style={{color:'rgba(240,237,229,.7)',fontSize:11,marginTop:2}}>لعبة اللودو الكلاسيكية · ضد الروبوت · بالوضع الأفقي</div>
        </div>
        <span style={{fontSize:20,color:'#F0C040'}}>‹</span>
      </div>
      <div style={{display:'flex',background:'rgba(13,20,16,.75)',border:'1px solid rgba(240,192,64,.1)',borderRadius:14,margin:'0 12px',overflow:'hidden'}}>
        {[['٦.٢م','لاعب'],['٩٨٤','مباراة الآن'],['٤.٨','التقييم']].map(([n,l],i)=>(
          <div key={i} style={{flex:1,textAlign:'center',padding:'10px 4px',borderRight:i<2?'1px solid rgba(255,255,255,.06)':'none'}}>
            <div style={{fontSize:15,fontWeight:900,color:'#F0C040'}}>{n}</div>
            <div style={{color:'rgba(240,237,229,.6)',fontSize:9,marginTop:1}}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Baloot round/match state machine (client-side, vs bots) ──
function freshRound(dealer){
  const {h0,h1,h2,h3}=dealHands(shuffle(buildDeck()));
  return {
    phase:'bidding', dealer, hands:[h0,h1,h2,h3],
    contract:null, bidTurn:(dealer+1)%4, passCount:0,
    turn:(dealer+1)%4, trick:[], roundScores:[0,0], tricksWon:[0,0],
    lastWinner:null, roundResult:null,
  };
}
function initGame(){
  return {...freshRound(Math.floor(Math.random()*4)), matchScores:[0,0], evt:0, banner:null};
}
const TARGET=152;
function gameReducer(s,a){
  switch(a.type){
    case 'BID':{
      const bid=a.payload;
      if(bid.type==='pass'){
        const pc=s.passCount+1;
        if(pc>=4) return {...freshRound(s.dealer), matchScores:s.matchScores, evt:s.evt+1, banner:'طوشة! توزيع جديد 🔄'};
        return {...s, passCount:pc, bidTurn:(s.bidTurn+1)%4};
      }
      const contract={type:bid.type, trump:bid.trump||null, trumpName:bid.trumpName||null, bidTeam:s.bidTurn%2};
      return {...s, contract, phase:'playing', turn:(s.dealer+1)%4, trick:[], evt:s.evt+1,
        banner: bid.type==='sun' ? 'صن ☀️ — بدأت الجولة' : `الحكم على ${bid.trumpName||''} ${bid.trump||''}`};
    }
    case 'PLAY':{
      const turn=s.turn, card=a.payload;
      const hands=s.hands.map((h,i)=> i===turn ? h.filter(c=>c!==card) : h);
      const trick=[...s.trick,{player:turn,card}];
      if(trick.length<4) return {...s, hands, trick, turn:(turn+1)%4};
      return {...s, hands, trick}; // trick full — effect triggers RESOLVE
    }
    case 'RESOLVE':{
      const mode=s.contract.type, trump=s.contract.trump;
      const w=trickWinner(s.trick,mode,trump), team=w.player%2;
      const isLast=s.hands.every(h=>h.length===0);
      let pts=trickPoints(s.trick,mode,trump); if(isLast) pts+=10; // آخر ديّة
      const roundScores=[...s.roundScores]; roundScores[team]+=pts;
      const tricksWon=[...s.tricksWon]; tricksWon[team]++;
      const base={...s, trick:[], roundScores, tricksWon, turn:w.player, lastWinner:w.player, evt:s.evt+1, banner:null};
      if(!isLast) return base;
      const res=calcResult(roundScores,s.contract);
      const matchScores=[...s.matchScores];
      matchScores[s.contract.bidTeam]   += res.bidTeamFinal;
      matchScores[1-s.contract.bidTeam] += res.oppTeamFinal;
      const over=Math.max(...matchScores)>=TARGET;
      return {...base, phase:over?'gameOver':'roundOver', roundResult:res, matchScores};
    }
    case 'NEXT_ROUND':
      return {...freshRound((s.dealer+1)%4), matchScores:s.matchScores, evt:s.evt+1, banner:null};
    case 'RESET':
      return initGame();
    default: return s;
  }
}

const SEAT_POS={
  0:{bottom:0,left:'50%',transform:'translateX(-50%)'},
  1:{left:0,top:'50%',transform:'translateY(-50%)'},
  2:{top:0,left:'50%',transform:'translateX(-50%)'},
  3:{right:0,top:'50%',transform:'translateY(-50%)'},
};
// Where a reaction bubble pops for each seat.
const REACT_POS={
  0:{bottom:'calc(env(safe-area-inset-bottom,0px)+124px)',left:'50%',transform:'translateX(-50%)'},
  1:{left:56,top:'42%'},
  2:{top:150,left:'50%',transform:'translateX(-50%)'},
  3:{right:56,top:'42%'},
};
function ReactionBubble({seat,emoji,bubbleId}){
  const b=CHAT_BUBBLES.find(x=>x.id===(seat===0?bubbleId:'none'))||CHAT_BUBBLES[0];
  return(
    <div style={{position:'absolute',...REACT_POS[seat],zIndex:60,background:b.bg,border:`1px solid ${b.border}`,color:b.fg,borderRadius:14,padding:'6px 12px',fontSize:20,fontWeight:700,boxShadow:'0 6px 18px rgba(0,0,0,.6)',animation:'popIn .3s cubic-bezier(.34,1.56,.64,1)',pointerEvents:'none'}}>{emoji}</div>
  );
}

function Seat({player,active,partner,backs}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
      <div style={{width:40,height:40,borderRadius:'50%',border:`2px solid ${active?'#2ECC71':partner?'#F0C040':'#7A5B1A'}`,background:'rgba(16,26,18,.9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,boxShadow:active?'0 0 12px rgba(46,204,113,.5)':'none',transition:'all .2s'}}>{player.avatar}</div>
      <span style={{color:active?'#2ECC71':'rgba(240,237,229,.6)',fontSize:10,fontWeight:700}}>{player.name}</span>
      {backs!=null&&<div style={{display:'flex'}}>{Array.from({length:Math.min(backs,8)}).map((_,i)=><div key={i} style={{width:13,height:19,borderRadius:3,background:'linear-gradient(135deg,#0D5C2A,#1A3D20)',border:'1px solid rgba(240,192,64,.2)',marginRight:-7}}/>)}</div>}
    </div>
  );
}

function GameScreen({profile,onExit,onUpdate}){
  const [state,dispatch]=useReducer(gameReducer,undefined,initGame);
  const [sel,setSel]=useState(null);
  const [toast,setToast]=useState(null);
  const tn=useRef(0); const awarded=useRef(false);
  const showT=msg=>{tn.current++;const k=tn.current;setToast({msg,k});setTimeout(()=>setToast(t=>t&&t.k===k?null:t),2200);};

  const [muted,setMutedState]=useState(!!profile.muted);
  const [reactions,setReactions]=useState([]);
  const [reactOpen,setReactOpen]=useState(false);
  const rn=useRef(0);
  const pushReaction=(seat,emoji)=>{rn.current++;const k=rn.current;setReactions(r=>[...r,{seat,emoji,k}]);setTimeout(()=>setReactions(r=>r.filter(x=>x.k!==k)),2200);};
  const ensureAudio=()=>{ if(!muted) startAmbience(); };
  const toggleMute=()=>{ const m=!muted; setMutedState(m); setMuted(m); if(m)stopAmbience(); else startAmbience(); onUpdate&&onUpdate(p=>({...p,muted:m})); persistProfile(profile.uid,{muted:m}); };

  // Audio lifecycle: ambience while in the game; foley cued by transitions.
  useEffect(()=>{ setMuted(!!profile.muted); if(!profile.muted){ startAmbience(); sounds.shuffle(); } return ()=>stopAmbience(); },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const felt=(TABLE_THEMES[profile.tableTheme]||TABLE_THEMES.classic).felt;
  const frameRing=(FRAMES.find(f=>f.id===(profile.frame||'none'))||FRAMES[0]).ring;

  const players=[
    {name:profile.name,avatar:profile.avatar},
    {name:'محمد',avatar:'👲'},
    {name:'عبدالله (شريكك)',avatar:'🧔'},
    {name:'سعد',avatar:'🤴'},
  ];

  // Drive bots: bidding, playing, and trick resolution.
  useEffect(()=>{
    const {phase,bidTurn,turn,trick,passCount,hands,contract}=state;
    if(phase==='bidding' && bidTurn!==0){
      const id=setTimeout(()=>{
        const b=botBid(hands[bidTurn],passCount);
        dispatch({type:'BID',payload:b.type==='pass'?{type:'pass'}:{type:b.type,trump:b.trump,trumpName:b.trumpName}});
      },850);
      return ()=>clearTimeout(id);
    }
    if(phase==='playing' && trick.length<4 && turn!==0){
      const id=setTimeout(()=>{
        const card=botChoose(hands[turn],trick,contract.type,contract.trump,turn);
        sounds.play();
        dispatch({type:'PLAY',payload:card});
      },720);
      return ()=>clearTimeout(id);
    }
    if(phase==='playing' && trick.length===4){
      const id=setTimeout(()=>dispatch({type:'RESOLVE'}),1050);
      return ()=>clearTimeout(id);
    }
  },[state]);

  // Transient banners.
  useEffect(()=>{ if(state.banner) showT(state.banner); },[state.evt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Settle the match once (wins/losses/coins/achievements).
  useEffect(()=>{
    if(state.phase!=='gameOver' || awarded.current) return;
    awarded.current=true;
    const humanWon=state.matchScores[0]>state.matchScores[1];
    if(humanWon){
      const wins=(profile.wins||0)+1, coins=(profile.coins||0)+50;
      const {inventory,earned}=applyAchievements(profile.inventory,wins);
      onUpdate&&onUpdate(p=>({...p,wins,coins,inventory}));
      persistProfile(profile.uid,{wins,coins,inventory});
      if(earned.length) setTimeout(()=>showT('🎁 فتحت مكافأة جديدة في المخزن!'),1000);
    }else{
      const losses=(profile.losses||0)+1;
      onUpdate&&onUpdate(p=>({...p,losses}));
      persistProfile(profile.uid,{losses});
    }
  },[state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foley on phase transitions (deal / round chime / gahwa / game win).
  const prevPhase=useRef(state.phase);
  useEffect(()=>{
    const prev=prevPhase.current;
    if(prev!==state.phase){
      if(state.phase==='playing'&&prev==='bidding') sounds.deal();
      if(state.phase==='roundOver'&&state.roundResult) (state.roundResult.isGahwa?sounds.gahwa:sounds.win)();
      if(state.phase==='gameOver') sounds.win();
      prevPhase.current=state.phase;
    }
  },[state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trick pickup chime + occasional bot reaction.
  const prevTricks=useRef(0);
  useEffect(()=>{
    const total=state.tricksWon[0]+state.tricksWon[1];
    if(total>prevTricks.current){
      prevTricks.current=total; sounds.trick();
      const w=state.lastWinner;
      if(w!=null&&w!==0&&Math.random()<0.35) pushReaction(w,REACTIONS[Math.floor(Math.random()*REACTIONS.length)]);
    }else if(total<prevTricks.current){ prevTricks.current=total; }
  },[state.tricksWon]); // eslint-disable-line react-hooks/exhaustive-deps

  const mode=state.contract?.type||'sun';
  const trump=state.contract?.trump||null;
  const myTurn=state.phase==='playing'&&state.turn===0;
  const legalSet=myTurn?new Set(legalPlays(state.hands[0],state.trick,mode,trump)):null;
  const myHand=sortHand(state.hands[0],mode,trump);
  const winCardId=(state.trick.length===4&&state.contract)?trickWinner(state.trick,mode,trump).card.id:null;

  const humanBid=bid=>{ ensureAudio(); if(state.phase==='bidding'&&state.bidTurn===0) dispatch({type:'BID',payload:bid}); };
  const humanPlay=(e,card)=>{
    ensureAudio();
    if(!myTurn) return;
    if(!legalSet.has(card)){ showT('يجب اتباع نفس النوع! 🚫'); return; }
    if(sel!==card){ setSel(card); return; }
    const r=e.currentTarget.getBoundingClientRect();
    spawnParticles(r.left+27,r.top+40); sounds.play();
    dispatch({type:'PLAY',payload:card}); setSel(null);
  };
  const react=emoji=>{ ensureAudio(); sounds.tick(); pushReaction(0,emoji); setReactOpen(false); };
  const playAgain=()=>{ awarded.current=false; prevPhase.current='bidding'; prevTricks.current=0; setReactions([]); dispatch({type:'RESET'}); };

  const teamName=t=>t===0?'أ':'ب';

  return(
    <div style={{width:'100%',height:'100%',background:`radial-gradient(ellipse 90% 70% at 50% 50%,${felt},#07090A)`,position:'relative',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Tajawal,sans-serif',direction:'rtl'}}>
      {toast&&<div key={toast.k} style={{position:'fixed',top:'calc(env(safe-area-inset-top,0px)+12px)',left:'50%',transform:'translateX(-50%)',background:'rgba(8,12,10,.95)',border:'1px solid #7A5B1A',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:700,color:'#F0C040',whiteSpace:'nowrap',zIndex:9000,pointerEvents:'none',animation:'fadeUp .35s ease both'}}>{toast.msg}</div>}

      {/* Rings */}
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(82vw,320px)',height:'min(82vw,320px)',borderRadius:'50%',border:'1px solid rgba(240,192,64,.15)',pointerEvents:'none',zIndex:1,animation:'spin 60s linear infinite'}}/>
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(65vw,260px)',height:'min(65vw,260px)',borderRadius:'50%',border:'1px dashed rgba(240,192,64,.08)',pointerEvents:'none',zIndex:1,animation:'spin 40s linear infinite reverse'}}/>

      {/* Header */}
      <div style={{position:'absolute',top:'calc(env(safe-area-inset-top,0px)+8px)',left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 10px',zIndex:20}}>
        <div style={{display:'flex',gap:6}}>
          <button onClick={onExit} style={{...G.btn,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)',fontSize:11,padding:'5px 10px'}}>خروج</button>
          <button onClick={toggleMute} aria-label="mute" style={{...G.btn,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)',fontSize:13,padding:'5px 9px'}}>{muted?'🔇':'🔊'}</button>
        </div>
        <div style={{padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700,border:'1.5px solid rgba(240,192,64,.4)',background:'rgba(240,192,64,.1)',color:'#F0C040'}}>
          {state.contract? (state.contract.type==='sun'?'صن ☀️':`حكم ${state.contract.trump}`) : 'المزايدة'}
        </div>
        <div style={{background:'rgba(10,14,12,.8)',border:'1px solid rgba(240,192,64,.18)',borderRadius:10,padding:'4px 10px',fontSize:13,fontWeight:900}}>
          <span style={G.gold}>{state.matchScores[0]}</span><span style={G.dim}> — </span><span style={G.gold}>{state.matchScores[1]}</span>
        </div>
      </div>

      {/* Opponents & partner */}
      <div style={{position:'absolute',top:'calc(env(safe-area-inset-top,0px)+54px)',left:'50%',transform:'translateX(-50%)',zIndex:10}}>
        <Seat player={players[2]} active={state.turn===2&&state.phase==='playing'} partner backs={state.hands[2].length}/>
      </div>
      <div style={{position:'absolute',left:8,top:'46%',transform:'translateY(-50%)',zIndex:10}}>
        <Seat player={players[1]} active={state.turn===1&&state.phase==='playing'} backs={state.hands[1].length}/>
      </div>
      <div style={{position:'absolute',right:8,top:'46%',transform:'translateY(-50%)',zIndex:10}}>
        <Seat player={players[3]} active={state.turn===3&&state.phase==='playing'} backs={state.hands[3].length}/>
      </div>

      {/* Trump indicator */}
      {state.contract&&state.contract.type==='hokum'&&(
        <div style={{position:'absolute',top:'50%',right:10,transform:'translateY(-50%)',zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'rgba(10,14,12,.7)',border:'1px solid rgba(240,192,64,.18)',borderRadius:10,padding:'6px 8px'}}>
          <span style={{fontSize:9,color:'rgba(240,237,229,.5)',fontWeight:700}}>الكوز</span>
          <span style={{fontSize:26,color:SUIT_COLOR(state.contract.trump),filter:'drop-shadow(0 0 8px rgba(240,192,64,.5))'}}>{state.contract.trump}</span>
        </div>
      )}

      {/* Trick center */}
      <div style={{position:'relative',width:200,height:170,zIndex:20}}>
        {state.trick.map((p,i)=>{
          const winning=p.card.id===winCardId;
          return(
            <CardFace key={p.card.id} card={p.card}
              style={{...G.card,position:'absolute',...SEAT_POS[p.player],zIndex:winning?9:i+1,
                boxShadow:winning?'0 0 0 2px #F0C040,0 0 18px rgba(240,192,64,.75)':'0 6px 20px rgba(0,0,0,.65)',
                transition:'box-shadow .25s'}}/>
          );
        })}
        {state.phase==='bidding'&&<div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',color:'rgba(240,237,229,.4)',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{state.bidTurn===0?'اختر: حكم / صن / بس':'المزايدة...'}</div>}
        {myTurn&&state.trick.length<4&&<div style={{position:'absolute',bottom:-4,left:'50%',transform:'translate(-50%,0)',color:'#2ECC71',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>دورك 🎯</div>}
      </div>

      {/* Bidding panel (human) */}
      {state.phase==='bidding'&&state.bidTurn===0&&(
        <div style={{position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px)+120px)',left:0,right:0,display:'flex',flexWrap:'wrap',justifyContent:'center',gap:7,zIndex:40,padding:'0 12px'}}>
          <button onClick={()=>humanBid({type:'sun'})} style={{...G.btn,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',fontSize:12,padding:'8px 14px'}}>صن ☀️</button>
          {['♠','♥','♦','♣'].map(sy=>(
            <button key={sy} onClick={()=>humanBid({type:'hokum',trump:sy,trumpName:SUIT_NAME(sy)})} style={{...G.btn,background:'rgba(16,26,18,.95)',border:'1.5px solid rgba(240,192,64,.35)',color:SUIT_COLOR(sy),fontSize:16,padding:'6px 12px'}}>{sy}</button>
          ))}
          <button onClick={()=>humanBid({type:'pass'})} style={{...G.btn,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.12)',fontSize:12,padding:'8px 14px'}}>بس</button>
        </div>
      )}

      {/* Human hand */}
      <div style={{position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px)+8px)',left:0,right:0,height:110,zIndex:30,display:'flex',justifyContent:'center',alignItems:'flex-end'}}>
        {myHand.map((card,i)=>{
          const n=myHand.length,sp=Math.min(30,220/Math.max(n,1)),off=(i-(n-1)/2)*sp,rot=(i-(n-1)/2)*3.2,lft=Math.abs(i-(n-1)/2)*1.4;
          const iS=sel===card;
          const playable=!myTurn||legalSet.has(card);
          return(
            <div key={card.id} onClick={e=>humanPlay(e,card)}
              style={{...G.card,left:`calc(50% + ${off}px - 27px)`,opacity:playable?1:0.42,
                transform:`rotate(${rot}deg) translateY(${iS?-26:lft}px) scale(${iS?1.07:1})`,
                zIndex:iS?90:i+1,
                border:`1px solid ${iS?'#2ECC71':(myTurn&&playable)?'rgba(46,204,113,.55)':'rgba(0,0,0,.12)'}`,
                boxShadow:iS?'0 0 0 2px rgba(46,204,113,.4),0 8px 22px rgba(0,0,0,.7)':'0 8px 22px rgba(0,0,0,.6)',
                transition:'transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,border-color .2s,opacity .2s'}}>
              <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:card.suit.color,alignSelf:'flex-start',lineHeight:1}}>{RANKSAR[card.rank.symbol]}</span>
              <span style={{fontSize:20,color:card.suit.color,lineHeight:1}}>{card.suit.symbol}</span>
              <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:card.suit.color,alignSelf:'flex-end',transform:'rotate(180deg)',lineHeight:1}}>{RANKSAR[card.rank.symbol]}</span>
            </div>
          );
        })}
      </div>

      {/* Round-over overlay */}
      {state.phase==='roundOver'&&state.roundResult&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.82)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}}>
          <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #7A5B1A',borderRadius:22,padding:'26px 22px',textAlign:'center',width:'100%',maxWidth:320,animation:'popIn .4s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'#F0C040',marginBottom:6}}>{state.roundResult.reason}</div>
            <div style={{color:'rgba(240,237,229,.55)',fontSize:12,marginBottom:16}}>نقاط الجولة — أ {state.roundScores[0]} · ب {state.roundScores[1]}</div>
            <div style={{display:'flex',justifyContent:'center',gap:28,margin:'6px 0 18px'}}>
              {[0,1].map(t=>(
                <div key={t} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <span style={{fontSize:30,fontWeight:900,color:t===0?'#F0C040':'rgba(240,237,229,.5)',lineHeight:1}}>{state.matchScores[t]}</span>
                  <span style={{color:'rgba(240,237,229,.6)',fontSize:11}}>الفريق {teamName(t)}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>dispatch({type:'NEXT_ROUND'})} style={{...G.btn,width:'100%',padding:12,fontSize:14,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A'}}>الجولة القادمة ▶</button>
          </div>
        </div>
      )}

      {/* Game-over overlay */}
      {state.phase==='gameOver'&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}}>
          <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #F0C040',borderRadius:22,padding:'34px 26px',textAlign:'center',boxShadow:'0 0 40px rgba(240,192,64,.25),0 50px 100px rgba(0,0,0,.9)',width:'100%',maxWidth:320,animation:'popIn .5s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{fontSize:58}}>{state.matchScores[0]>state.matchScores[1]?'🏆':'💔'}</div>
            <div style={{fontFamily:"'Scheherazade New',serif",fontSize:26,color:'#F0C040',margin:'10px 0 5px'}}>{state.matchScores[0]>state.matchScores[1]?'فريقك يفوز!':'فاز الخصم'}</div>
            <div style={{color:'rgba(240,237,229,.6)',fontSize:13}}>{state.matchScores[0]>state.matchScores[1]?'+٥٠ عملة 🪙':'حظاً أوفر في المرة القادمة'}</div>
            <div style={{display:'flex',justifyContent:'center',gap:28,margin:'18px 0'}}>
              {[0,1].map(t=>(
                <div key={t} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <span style={{fontSize:34,fontWeight:900,color:t===0?'#F0C040':'rgba(240,237,229,.4)',lineHeight:1}}>{state.matchScores[t]}</span>
                  <span style={{color:'rgba(240,237,229,.6)',fontSize:11}}>الفريق {teamName(t)}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={onExit} style={{...G.btn,flex:1,padding:13,fontSize:14,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.75)',border:'1px solid rgba(255,255,255,.12)'}}>خروج</button>
              <button onClick={playAgain} style={{...G.btn,flex:2,padding:13,fontSize:15,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A'}}>العب مجدداً 🔄</button>
            </div>
          </div>
        </div>
      )}
      {/* Reaction bubbles */}
      {reactions.map(r=><ReactionBubble key={r.k} seat={r.seat} emoji={r.emoji} bubbleId={profile.bubble||'none'}/>)}

      {/* Emote / reactions */}
      {reactOpen&&(
        <div style={{position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px)+124px)',left:10,display:'flex',flexWrap:'wrap',gap:6,maxWidth:200,background:'rgba(8,12,10,.95)',border:'1px solid #7A5B1A',borderRadius:14,padding:8,zIndex:45}}>
          {REACTIONS.map(em=><button key={em} onClick={()=>react(em)} style={{...G.btn,background:'rgba(255,255,255,.06)',border:'none',fontSize:20,padding:'4px 7px'}}>{em}</button>)}
        </div>
      )}
      <button onClick={()=>setReactOpen(o=>!o)} aria-label="react" style={{...G.btn,position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px)+124px)',right:10,background:'rgba(10,14,12,.85)',border:'1px solid rgba(240,192,64,.25)',color:'#F0C040',fontSize:18,padding:'6px 10px',zIndex:45}}>😄</button>

      {/* frame ring token (kept for potential avatar framing) */}
      <span style={{display:'none'}} data-frame={frameRing}/>
    </div>
  );
}

const SUIT_META={'♠':{n:'بستوني',c:'#0A0F0A'},'♥':{n:'كبة',c:'#C0392B'},'♦':{n:'ديناري',c:'#C0392B'},'♣':{n:'جاروني',c:'#0A0F0A'}};
function SUIT_NAME(sy){return (SUIT_META[sy]||{}).n||'';}
function SUIT_COLOR(sy){return (SUIT_META[sy]||{}).c||'#111';}

function LeaderScreen(){
  const [players,setPlayers]=useState([{id:'1',name:'أبو عبدالله',avatar:'🧔',city:'الرياض',wins:247},{id:'2',name:'محمد الغامدي',avatar:'👲',city:'جدة',wins:198},{id:'3',name:'سعد العتيبي',avatar:'🤴',city:'الدمام',wins:187},{id:'4',name:'فهد القحطاني',avatar:'🧙',city:'مكة',wins:156},{id:'5',name:'عبدالرحمن',avatar:'👨‍💼',city:'المدينة',wins:143}]);
  useEffect(()=>{(async()=>{try{const q=query(collection(db,'users'),orderBy('wins','desc'),limit(20));const s=await getDocs(q);if(s.docs.length)setPlayers(s.docs.map(d=>({id:d.id,...d.data()})));}catch{/* keep demo data */}})();},[]);
  const ri=i=>i===0?'🥇':i===1?'🥈':i===2?'🥉':String(i+1);
  const rc=i=>i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'rgba(240,237,229,.55)';
  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      <div style={{padding:'16px 14px 8px',textAlign:'center'}}>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'#F0C040'}}>🏆 المتصدرون</div>
        <div style={{color:'rgba(240,237,229,.6)',fontSize:11,marginTop:4}}>أفضل لاعبي المملكة</div>
      </div>
      <div style={{height:1,background:'rgba(255,255,255,.07)',margin:'0 14px'}}/>
      {players.map((p,i)=>(
        <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
          <span style={{fontSize:i<3?18:13,fontWeight:900,color:rc(i),width:24,textAlign:'center',flexShrink:0}}>{ri(i)}</span>
          <span style={{fontSize:26,flexShrink:0}}>{p.avatar||'🧔'}</span>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div><div style={{color:'rgba(240,237,229,.6)',fontSize:10}}>{p.city}</div></div>
          <span style={{fontSize:13,fontWeight:900,color:'#F0C040',flexShrink:0}}>{p.wins} ✓</span>
        </div>
      ))}
    </div>
  );
}

function ItemPreview({category,item}){
  if(category==='tables') return <div style={{width:46,height:32,borderRadius:8,background:`radial-gradient(ellipse at center,${item.felt},#07090A)`,border:'1px solid rgba(240,192,64,.3)'}}/>;
  if(category==='avatars') return <span style={{fontSize:30}}>{item.emoji}</span>;
  if(category==='frames'){const isGrad=String(item.ring).includes('gradient');return <div style={{width:40,height:40,borderRadius:'50%',padding:isGrad?3:0,background:isGrad?item.ring:'transparent',border:isGrad?'none':`2.5px solid ${item.ring}`,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:'100%',height:'100%',borderRadius:'50%',background:'rgba(16,26,18,.95)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🧔</div></div>;}
  if(category==='nameplates') return <span style={{fontSize:12,fontWeight:900,padding:'3px 12px',borderRadius:20,background:item.bg==='transparent'?'rgba(255,255,255,.06)':item.bg,color:item.fg}}>لاعب</span>;
  if(category==='bubbles') return <span style={{fontSize:11,fontWeight:700,padding:'5px 12px',borderRadius:12,background:item.bg,border:`1px solid ${item.border}`,color:item.fg}}>👏 أحسنت</span>;
  return null;
}

function StoreScreen({profile,onUpdate}){
  const [cat,setCat]=useState('tables');
  const [toast,setToast]=useState(null);
  const tn=useRef(0);
  const showT=m=>{tn.current++;const k=tn.current;setToast({m,k});setTimeout(()=>setToast(t=>t&&t.k===k?null:t),1800);};
  const tabs=[['tables','طاولات'],['avatars','أفتار'],['frames','إطارات'],['nameplates','لوحات'],['bubbles','فقاعات']];
  const items=CATALOG[cat];
  const equippedField=EQUIP_FIELD[cat];
  const equippedId=profile[equippedField]||(cat==='tables'?'classic':'none');

  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      {toast&&<div key={toast.k} style={{position:'fixed',top:'calc(env(safe-area-inset-top,0px)+12px)',left:'50%',transform:'translateX(-50%)',background:'rgba(8,12,10,.95)',border:'1px solid #7A5B1A',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:700,color:'#F0C040',whiteSpace:'nowrap',zIndex:9000,animation:'fadeUp .35s ease both'}}>{toast.m}</div>}
      <div style={{padding:'16px 14px 8px',textAlign:'center'}}><div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'#F0C040'}}>🛍️ المتجر والمخزن</div></div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(13,20,16,.8)',border:'1px solid #7A5B1A',borderRadius:12,margin:'0 12px 12px',padding:'10px 14px'}}>
        <span style={{color:'rgba(240,237,229,.6)',fontSize:13}}>رصيدك</span>
        <span style={{fontSize:16,fontWeight:900,color:'#F0C040'}}>🪙 {profile.coins||0}</span>
      </div>
      <div style={{display:'flex',gap:6,padding:'0 12px 12px',overflowX:'auto'}}>
        {tabs.map(([id,l])=>(
          <button key={id} onClick={()=>setCat(id)} style={{...G.btn,flexShrink:0,fontSize:12,padding:'7px 14px',border:`1.5px solid ${cat===id?'#F0C040':'rgba(240,192,64,.2)'}`,background:cat===id?'rgba(240,192,64,.12)':'transparent',color:cat===id?'#F0C040':'rgba(240,237,229,.55)'}}>{l}</button>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'0 12px 16px'}}>
        {items.map(item=>{
          const owned=ownsItem(profile,cat,item.id)||item.cost===0;
          const equipped=equippedId===item.id;
          const isReward=!!item.reward;
          return(
            <div key={item.id} style={{background:'rgba(13,20,16,.8)',border:`1px solid ${equipped?'#F0C040':'rgba(255,255,255,.07)'}`,borderRadius:16,padding:'14px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,position:'relative'}}>
              {isReward&&<span style={{position:'absolute',top:8,right:8,background:'#9B59B6',color:'#fff',fontSize:8,fontWeight:700,padding:'2px 5px',borderRadius:5}}>إنجاز</span>}
              <div style={{height:44,display:'flex',alignItems:'center'}}><ItemPreview category={cat} item={item}/></div>
              <span style={{fontSize:12,fontWeight:700,textAlign:'center'}}>{item.name}</span>
              {equipped
                ? <span style={{fontSize:11,fontWeight:900,color:'#2ECC71',padding:'5px 12px'}}>✓ مُجهّز</span>
                : owned
                  ? <button onClick={()=>{equip(profile,onUpdate,cat,item.id);showT('تم التجهيز ✅');}} style={{...G.btn,background:'rgba(46,204,113,.15)',border:'1px solid rgba(46,204,113,.4)',color:'#2ECC71',fontSize:11,padding:'5px 12px'}}>تجهيز</button>
                  : isReward
                    ? <span style={{fontSize:10,fontWeight:700,color:'rgba(240,237,229,.45)',padding:'5px'}}>🔒 يُفتح بالإنجاز</span>
                    : <button onClick={()=>{const r=purchase(profile,onUpdate,cat,item.id,item.cost);showT(r.msg);}} style={{...G.btn,background:'rgba(240,192,64,.1)',border:'1px solid rgba(240,192,64,.3)',color:'#F0C040',fontSize:11,padding:'5px 12px'}}>🪙 {item.cost}</button>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FriendScreen(){
  const friends=[{n:'محمد الغامدي',a:'👲',c:'جدة',s:'متصل',sc:'#2ECC71'},{n:'سعد العتيبي',a:'🤴',c:'الدمام',s:'في لعبة',sc:'#F0C040'},{n:'فهد القحطاني',a:'🧙',c:'مكة',s:'غير متصل',sc:'#666'},{n:'خالد الزهراني',a:'🦸',c:'تبوك',s:'متصل',sc:'#2ECC71'}];
  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      <div style={{padding:'16px 14px 8px',textAlign:'center'}}><div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'#F0C040'}}>👥 أصدقاء</div></div>
      <div style={{padding:'0 12px 12px'}}><input style={G.input} placeholder="🔍 ابحث عن صديق..."/></div>
      <div style={{height:1,background:'rgba(255,255,255,.07)',margin:'0 14px'}}/>
      {friends.map((f,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
          <span style={{fontSize:28}}>{f.a}</span>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700}}>{f.n}</div><div style={{fontSize:10,color:f.sc}}>{f.s}</div></div>
          {f.s==='متصل'&&<button style={{...G.btn,background:'linear-gradient(135deg,#1A5C28,#2ECC71)',color:'#fff',padding:'7px 14px',fontSize:12}}>دعوة</button>}
        </div>
      ))}
    </div>
  );
}

function ProfileScreen({profile,onUpdate,onLogout}){
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState(profile.name);
  const [av,setAv]=useState(profile.avatar);
  const [city,setCity]=useState(profile.city);
  const inv={...defaultInventory(),...(profile.inventory||{})};
  const ownedAvatars=[...new Set([...(inv.avatars||FREE_AVATARS),profile.avatar])];
  const save=async()=>{onUpdate({...profile,name,avatar:av,city});persistProfile(profile.uid,{name,avatar:av,city});setEditing(false);};
  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      <div style={{textAlign:'center',padding:'22px 14px 16px',background:'linear-gradient(180deg,rgba(26,61,32,.5),transparent)'}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:10}}><AvatarBadge emoji={profile.avatar} frameId={profile.frame||'none'} size={72}/></div>
        <div style={{marginBottom:4}}><NamePlate name={profile.name} plateId={profile.nameplate||'none'} size={18}/></div>
        <div style={{color:'rgba(240,237,229,.6)',fontSize:12,marginBottom:14}}>📍 {profile.city}</div>
        <div style={{display:'flex',justifyContent:'center',gap:22}}>
          {[['انتصار',profile.wins||0],['هزيمة',profile.losses||0],['🪙',profile.coins||500]].map(([l,v])=>(
            <div key={l} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <span style={{fontSize:22,fontWeight:900,color:'#F0C040'}}>{v}</span>
              <span style={{color:'rgba(240,237,229,.6)',fontSize:10}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      {editing?(
        <div style={{padding:'0 14px'}}>
          <div style={{marginBottom:10}}><div style={{color:'rgba(240,237,229,.6)',fontSize:11,fontWeight:700,marginBottom:4}}>الاسم</div><input style={G.input} value={name} onChange={e=>setName(e.target.value)} maxLength={20}/></div>
          <div style={{marginBottom:10}}><div style={{color:'rgba(240,237,229,.6)',fontSize:11,fontWeight:700,marginBottom:4}}>المدينة</div><select style={G.input} value={city} onChange={e=>setCity(e.target.value)}>{CITIES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div style={{marginBottom:16}}><div style={{color:'rgba(240,237,229,.6)',fontSize:11,fontWeight:700,marginBottom:8}}>الرمز <span style={{color:'rgba(240,237,229,.4)'}}>(المملوكة — افتح المزيد من المتجر)</span></div><div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>{ownedAvatars.map(a=><div key={a} onClick={()=>setAv(a)} style={{width:44,height:44,borderRadius:'50%',background:'rgba(16,26,18,.9)',border:`2px solid ${av===a?'#F0C040':'rgba(255,255,255,.08)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,cursor:'pointer',transform:av===a?'scale(1.1)':'none',transition:'all .2s'}}>{a}</div>)}</div></div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setEditing(false)} style={{...G.btn,flex:1,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)'}}>إلغاء</button>
            <button onClick={save} style={{...G.btn,flex:1,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A'}}>حفظ</button>
          </div>
        </div>
      ):(
        <div style={{padding:'0 14px',marginTop:8}}>
          {[{i:'✏️',t:'تعديل الملف',s:'الاسم، الرمز، المدينة',a:()=>setEditing(true)},{i:'📊',t:'إحصائياتي',s:'نسبة الفوز وتفاصيل اللعب',a:()=>{}},{i:'🔔',t:'الإشعارات',s:'تحكم في التنبيهات',a:()=>{}},{i:'🚪',t:'تسجيل الخروج',s:'',a:onLogout,red:true}].map((item,i)=>(
            <div key={i} onClick={item.a} style={{display:'flex',alignItems:'center',gap:10,padding:12,background:'rgba(16,26,18,.85)',border:'1px solid rgba(255,255,255,.07)',borderRadius:12,marginBottom:8,cursor:'pointer',touchAction:'manipulation'}}>
              <span style={{fontSize:20,flexShrink:0}}>{item.i}</span>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:item.red?'#E74C3C':undefined}}>{item.t}</div>{item.s&&<div style={{color:'rgba(240,237,229,.6)',fontSize:11}}>{item.s}</div>}</div>
              {!item.red&&<span style={{color:'rgba(240,237,229,.6)'}}>›</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
