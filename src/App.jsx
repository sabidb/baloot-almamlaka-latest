import { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, orderBy, limit, getDocs, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const fbApp  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db     = getFirestore(fbApp);
const auth   = getAuth(fbApp);
const gProv  = new GoogleAuthProvider();

const AVATARS = ['🧔','👲','🧕','👨‍💼','👩‍💼','🤴','👸','🧙','🦸','🎩'];
const CITIES  = ['الرياض','جدة','مكة','المدينة','الدمام','الخبر','أبها','تبوك','حائل','القصيم'];
const SUITS   = {spade:'♠',heart:'♥',diamond:'♦',club:'♣'};
const SCOLOR  = {spade:'#111',heart:'#c0392b',diamond:'#c0392b',club:'#111'};
const RANKSAR = {A:'أ',K:'ك',Q:'ق',J:'ج','10':'١٠','9':'٩','8':'٨','7':'٧'};

function mkDeck(){
  const d=[];
  ['spade','heart','diamond','club'].forEach(s=>
    ['A','K','Q','J','10','9','8','7'].forEach(r=>d.push({r,s}))
  );
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
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
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('home');
  const [inGame,setInGame]=useState(false);

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
      select option{background:#0C1410}
    `;
    document.head.appendChild(style);
    return()=>document.head.removeChild(style);
  },[]);

  useEffect(()=>{
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

  if(inGame)return(
    <div style={{height:'100dvh',overflow:'hidden'}}>
      <GameScreen profile={profile} onExit={()=>{setInGame(false);setTab('home');}}/>
    </div>
  );

  const NAV=[{id:'home',i:'🏠',l:'الرئيسية'},{id:'board',i:'🏆',l:'المتصدرون'},{id:'store',i:'🛍️',l:'المتجر'},{id:'friends',i:'👥',l:'أصدقاء'},{id:'profile',i:'👤',l:'ملفي'}];

  return(
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#07090A',fontFamily:'Tajawal,sans-serif',color:'#F0EDE5',direction:'rtl',overflow:'hidden'}}>
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        {tab==='home'    &&<HomeScreen    profile={profile} onGame={()=>setInGame(true)}/>}
        {tab==='board'   &&<LeaderScreen/>}
        {tab==='store'   &&<StoreScreen   profile={profile}/>}
        {tab==='friends' &&<FriendScreen/>}
        {tab==='profile' &&<ProfileScreen profile={profile} onUpdate={setProfile} onLogout={async()=>{try{await signOut(auth);}catch{}setProfile(null);}}/>}
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
    setBusy(true);setErr('');
    try{
      const res=await signInWithPopup(auth,gProv);
      const snap=await getDoc(doc(db,'users',res.user.uid));
      if(snap.exists()){onDone({uid:res.user.uid,...snap.data()});}
      else{setPending(res.user);setStep('setup');setBusy(false);}
    }catch(e){setErr('تعذر تسجيل الدخول');setBusy(false);}
  };

  const finish=async()=>{
    if(!pending)return;
    setBusy(true);
    try{
      const p={uid:pending.uid,name:pending.displayName||'لاعب',avatar:av,city,wins:0,losses:0,coins:500,createdAt:serverTimestamp()};
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
        <div style={{color:'rgba(240,237,229,.6)',fontSize:10,textAlign:'center',marginTop:12}}>بالمتابعة توافق على شروط الاستخدام</div>
      </div>
    </div>
  );
}

function HomeScreen({profile,onGame}){
  const modes=[
    {id:'bot',   icon:'🤖',title:'مع الروبوت',  sub:'تدرب بدون انتظار',        color:'#9B59B6'},
    {id:'create',icon:'👥',title:'مع الأصدقاء', sub:'أنشئ غرفة وشارك الكود',  color:'#F0C040'},
    {id:'join',  icon:'🔑',title:'انضم لغرفة',  sub:'أدخل كود الغرفة',         color:'#3498DB'},
    {id:'quick', icon:'⚡',title:'لعبة سريعة',  sub:'العب مع لاعبين عشوائيين',color:'#2ECC71'},
  ];
  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      <div style={{textAlign:'center',padding:'18px 14px 0'}}>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:'clamp(28px,9vw,44px)',background:'linear-gradient(135deg,#7A5B1A,#F0C040,#FFE08A,#F0C040,#7A5B1A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',lineHeight:1.1,marginBottom:4}}>بلوت المملكة</div>
        <div style={{color:'rgba(240,237,229,.6)',fontSize:11,letterSpacing:2,marginBottom:8}}>العب · تنافس · افوز</div>
        <div style={{width:60,height:1,margin:'0 auto 16px',background:'linear-gradient(90deg,transparent,#7A5B1A,transparent)'}}/>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 14px',marginBottom:12}}>
        <span style={{fontSize:28}}>{profile.avatar}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:14}}>{profile.name}</div>
          <div style={{color:'rgba(240,237,229,.6)',fontSize:11}}>{profile.city} · {profile.wins||0} انتصار</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(240,192,64,.1)',border:'1px solid rgba(240,192,64,.2)',borderRadius:20,padding:'5px 10px'}}>
          <span>🪙</span><span style={{fontSize:13,fontWeight:900,color:'#F0C040'}}>{profile.coins||500}</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'0 12px',marginBottom:12}}>
        {modes.map(m=>(
          <div key={m.id} onClick={m.id==='bot'||m.id==='quick'?onGame:undefined}
            style={{background:'rgba(13,20,16,.8)',border:'1px solid rgba(255,255,255,.07)',borderRadius:16,padding:'16px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer',touchAction:'manipulation'}}>
            <span style={{fontSize:26}}>{m.icon}</span>
            <span style={{fontSize:13,fontWeight:700,color:m.color+'CC'}}>{m.title}</span>
            <span style={{color:'rgba(240,237,229,.6)',fontSize:10,textAlign:'center',lineHeight:1.3}}>{m.sub}</span>
          </div>
        ))}
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

function GameScreen({profile,onExit}){
  const [hand,setHand]=useState(()=>mkDeck().slice(0,8));
  const [trick,setTrick]=useState([]);
  const [sel,setSel]=useState(null);
  const [scores,setScores]=useState({a:0,b:0});
  const [mode,setMode]=useState('hokum');
  const [win,setWin]=useState(false);
  const [toast,setToast]=useState(null);
  const tn=useRef(0);
  const showT=msg=>{tn.current++;setToast({msg,k:tn.current});setTimeout(()=>setToast(null),2400);};

  const play=(e,card,idx)=>{
    if(sel!==idx){setSel(idx);return;}
    const r=e.currentTarget.getBoundingClientRect();
    spawnParticles(r.left+28,r.top+40);
    setHand(h=>h.filter((_,i)=>i!==idx));
    setTrick(t=>[...t,card]);
    setSel(null);showT('أحسنت! 🎯');
  };

  const take=()=>{
    setScores(s=>({...s,a:s.a+10}));
    setTrick([]);showT('فزت بالضربة! ✨');
    if(scores.a+10>=152)setTimeout(()=>setWin(true),400);
  };

  const players=[{name:profile.name,avatar:profile.avatar},{name:'محمد',avatar:'👲'},{name:'عبدالله',avatar:'🧔'},{name:'سعد',avatar:'🤴'}];

  return(
    <div style={{width:'100%',height:'100%',background:'radial-gradient(ellipse 90% 70% at 50% 50%,#0F2A14,#07090A)',position:'relative',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Tajawal,sans-serif',direction:'rtl'}}>
      {toast&&<div key={toast.k} style={{position:'fixed',top:'calc(env(safe-area-inset-top,0px)+12px)',left:'50%',transform:'translateX(-50%)',background:'rgba(8,12,10,.95)',border:'1px solid #7A5B1A',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:700,color:'#F0C040',whiteSpace:'nowrap',zIndex:9000,pointerEvents:'none',animation:'fadeUp .35s ease both'}}>{toast.msg}</div>}

      {/* Rings */}
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(82vw,320px)',height:'min(82vw,320px)',borderRadius:'50%',border:'1px solid rgba(240,192,64,.15)',pointerEvents:'none',zIndex:1,animation:'spin 60s linear infinite'}}/>
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(65vw,260px)',height:'min(65vw,260px)',borderRadius:'50%',border:'1px dashed rgba(240,192,64,.08)',pointerEvents:'none',zIndex:1,animation:'spin 40s linear infinite reverse'}}/>

      {/* Header */}
      <div style={{position:'absolute',top:'calc(env(safe-area-inset-top,0px)+8px)',left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 10px',zIndex:20}}>
        <button onClick={onExit} style={{...G.btn,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)',fontSize:11,padding:'5px 10px'}}>خروج</button>
        <div style={{display:'flex',gap:6}}>
          {['hokum','sun'].map(m=>(
            <div key={m} onClick={()=>setMode(m)} style={{padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',border:`1.5px solid ${mode===m?'#F0C040':'rgba(240,192,64,.25)'}`,background:mode===m?'rgba(240,192,64,.12)':'transparent',color:mode===m?'#F0C040':'rgba(240,192,64,.4)',touchAction:'manipulation'}}>
              {m==='hokum'?'حكم':'صن'}
            </div>
          ))}
        </div>
        <div style={{background:'rgba(10,14,12,.8)',border:'1px solid rgba(240,192,64,.18)',borderRadius:10,padding:'4px 10px',fontSize:13,fontWeight:900}}>
          <span style={G.gold}>{scores.a}</span><span style={G.dim}> — </span><span style={G.gold}>{scores.b}</span>
        </div>
      </div>

      {/* Top player */}
      <div style={{position:'absolute',top:'calc(env(safe-area-inset-top,0px)+54px)',left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:3,zIndex:10}}>
        <div style={{width:38,height:38,borderRadius:'50%',border:'2px solid #7A5B1A',background:'rgba(16,26,18,.9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{players[2].avatar}</div>
        <span style={{color:'rgba(240,237,229,.6)',fontSize:10,fontWeight:700}}>{players[2].name}</span>
        <div style={{display:'flex'}}>{[0,1,2,3].map(i=><div key={i} style={{width:16,height:24,borderRadius:3,background:'linear-gradient(135deg,#0D5C2A,#1A3D20)',border:'1px solid rgba(240,192,64,.2)',marginRight:-6,transform:`rotate(${(i-1.5)*5}deg)`}}/>)}</div>
      </div>

      {/* Left player */}
      <div style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:3,zIndex:10}}>
        <div style={{width:38,height:38,borderRadius:'50%',border:'2px solid #7A5B1A',background:'rgba(16,26,18,.9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{players[1].avatar}</div>
        <span style={{color:'rgba(240,237,229,.6)',fontSize:10,fontWeight:700}}>{players[1].name}</span>
      </div>

      {/* Right player */}
      <div style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:3,zIndex:10}}>
        <div style={{width:38,height:38,borderRadius:'50%',border:'2px solid #7A5B1A',background:'rgba(16,26,18,.9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{players[3].avatar}</div>
        <span style={{color:'rgba(240,237,229,.6)',fontSize:10,fontWeight:700}}>{players[3].name}</span>
      </div>

      {/* Trump */}
      <div style={{position:'absolute',top:'50%',right:10,transform:'translateY(-50%)',zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'rgba(10,14,12,.7)',border:'1px solid rgba(240,192,64,.18)',borderRadius:10,padding:'6px 8px'}}>
        <span style={{fontSize:9,color:'rgba(240,237,229,.5)',fontWeight:700}}>الكوز</span>
        <span style={{fontSize:26,filter:'drop-shadow(0 0 8px rgba(240,192,64,.5))'}}>♠</span>
      </div>

      {/* Trick center */}
      <div style={{position:'relative',width:190,height:150,zIndex:20}}>
        {trick.map((c,i)=>(
          <div key={i} style={{...G.card,top:[18,42,10,36][i%4],left:[34,16,54,30][i%4]+'%',transform:`rotate(${[-8,5,-3,10][i%4]}deg)`,zIndex:i+1}}>
            <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:SCOLOR[c.s],alignSelf:'flex-start',lineHeight:1}}>{RANKSAR[c.r]}</span>
            <span style={{fontSize:20,color:SCOLOR[c.s],lineHeight:1}}>{SUITS[c.s]}</span>
            <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:SCOLOR[c.s],alignSelf:'flex-end',transform:'rotate(180deg)',lineHeight:1}}>{RANKSAR[c.r]}</span>
          </div>
        ))}
        {trick.length===0&&<div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',color:'rgba(240,237,229,.35)',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>دورك أنت</div>}
        {trick.length>=4&&<button onClick={take} style={{...G.btn,position:'absolute',bottom:-42,left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',fontSize:12,padding:'7px 14px',whiteSpace:'nowrap',zIndex:30}}>خذ الضربة 🏆</button>}
      </div>

      {/* Action bar */}
      <div style={{position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px)+116px)',left:0,right:0,display:'flex',justifyContent:'center',gap:8,zIndex:35,padding:'0 10px'}}>
        <button onClick={()=>{setHand(mkDeck().slice(0,8));setTrick([]);setSel(null);showT('توزيع جديد 🃏');}} style={{...G.btn,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)',fontSize:12,padding:'7px 13px'}}>توزيع 🃏</button>
        <button onClick={()=>setWin(true)} style={{...G.btn,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',fontSize:12,padding:'7px 13px'}}>نهاية 🏆</button>
      </div>

      {/* Hand */}
      <div style={{position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px)+8px)',left:0,right:0,height:106,zIndex:30,display:'flex',justifyContent:'center',alignItems:'flex-end'}}>
        {hand.map((card,i)=>{
          const n=hand.length,sp=Math.min(27,200/Math.max(n,1)),off=(i-(n-1)/2)*sp,rot=(i-(n-1)/2)*3.5,lft=Math.abs(i-(n-1)/2)*1.5,iS=sel===i;
          return(
            <div key={i} onClick={e=>play(e,card,i)} style={{...G.card,left:`calc(50% + ${off}px - 27px)`,transform:`rotate(${rot}deg) translateY(${iS?-26:lft}px) scale(${iS?1.07:1})`,zIndex:iS?90:i+1,border:`1px solid ${iS?'#2ECC71':'rgba(0,0,0,.12)'}`,boxShadow:iS?'0 0 0 2px rgba(46,204,113,.35),0 8px 22px rgba(0,0,0,.7)':'0 8px 22px rgba(0,0,0,.65)',transition:'transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,border-color .2s'}}>
              <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:SCOLOR[card.s],alignSelf:'flex-start',lineHeight:1}}>{RANKSAR[card.r]}</span>
              <span style={{fontSize:20,color:SCOLOR[card.s],lineHeight:1}}>{SUITS[card.s]}</span>
              <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:SCOLOR[card.s],alignSelf:'flex-end',transform:'rotate(180deg)',lineHeight:1}}>{RANKSAR[card.r]}</span>
            </div>
          );
        })}
      </div>

      {/* Win overlay */}
      {win&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}}>
          <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #F0C040',borderRadius:22,padding:'34px 26px',textAlign:'center',boxShadow:'0 0 40px rgba(240,192,64,.25),0 50px 100px rgba(0,0,0,.9)',width:'100%',maxWidth:320,animation:'popIn .5s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{fontSize:58}}>🏆</div>
            <div style={{fontFamily:"'Scheherazade New',serif",fontSize:28,color:'#F0C040',margin:'10px 0 5px'}}>الفريق أ يفوز!</div>
            <div style={{color:'rgba(240,237,229,.6)',fontSize:13}}>وصلتم إلى ١٥٢ نقطة</div>
            <div style={{display:'flex',justifyContent:'center',gap:28,margin:'18px 0'}}>
              {[['أ',scores.a,'#F0C040'],['ب',scores.b,'rgba(240,237,229,.4)']].map(([t,v,c])=>(
                <div key={t} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <span style={{fontSize:34,fontWeight:900,color:c,lineHeight:1}}>{v}</span>
                  <span style={{color:'rgba(240,237,229,.6)',fontSize:11}}>الفريق {t}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>{setWin(false);onExit();}} style={{...G.btn,width:'100%',padding:13,fontSize:15,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A'}}>العب مجدداً</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderScreen(){
  const [players,setPlayers]=useState([{id:'1',name:'أبو عبدالله',avatar:'🧔',city:'الرياض',wins:247},{id:'2',name:'محمد الغامدي',avatar:'👲',city:'جدة',wins:198},{id:'3',name:'سعد العتيبي',avatar:'🤴',city:'الدمام',wins:187},{id:'4',name:'فهد القحطاني',avatar:'🧙',city:'مكة',wins:156},{id:'5',name:'عبدالرحمن',avatar:'👨‍💼',city:'المدينة',wins:143}]);
  useEffect(()=>{(async()=>{try{const q=query(collection(db,'users'),orderBy('wins','desc'),limit(20));const s=await getDocs(q);if(s.docs.length)setPlayers(s.docs.map(d=>({id:d.id,...d.data()})));}catch{}})();},[]);
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

function StoreScreen({profile}){
  const items=[{i:'🎴',n:'طقم ذهبي',p:'٤٩ ريال',t:'الأكثر مبيعاً',tc:'#E74C3C'},{i:'🟩',n:'طاولة زمردية',p:'٢٩ ريال',t:'جديد',tc:'#2ECC71'},{i:'👑',n:'VIP شهري',p:'٩٩ ريال',t:'الأفضل',tc:'#F0C040'},{i:'🪙',n:'٥٠٠ عملة',p:'١٠ ريال',t:'',tc:''},{i:'🎭',n:'تعابير مميزة',p:'١٩ ريال',t:'',tc:''},{i:'🏅',n:'إطار بطل',p:'٣٩ ريال',t:'نادر',tc:'#9B59B6'}];
  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      <div style={{padding:'16px 14px 8px',textAlign:'center'}}><div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'#F0C040'}}>🛍️ المتجر</div></div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(13,20,16,.8)',border:'1px solid #7A5B1A',borderRadius:12,margin:'0 12px 12px',padding:'10px 14px'}}>
        <span style={{color:'rgba(240,237,229,.6)'}}>رصيدك</span>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:16,fontWeight:900,color:'#F0C040'}}>🪙 {profile.coins||500}</span>
          <button style={{...G.btn,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',padding:'6px 14px',fontSize:12}}>شحن</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'0 12px 16px'}}>
        {items.map((item,idx)=>(
          <div key={idx} style={{background:'rgba(13,20,16,.8)',border:'1px solid rgba(255,255,255,.07)',borderRadius:16,padding:'16px 12px',display:'flex',flexDirection:'column',alignItems:'center',gap:7,cursor:'pointer',position:'relative',touchAction:'manipulation'}}>
            {item.t&&<span style={{position:'absolute',top:8,right:8,background:item.tc,color:item.tc==='#F0C040'?'#000':'#fff',fontSize:8,fontWeight:700,padding:'2px 5px',borderRadius:5}}>{item.t}</span>}
            <span style={{fontSize:30}}>{item.i}</span>
            <span style={{fontSize:12,fontWeight:700,textAlign:'center'}}>{item.n}</span>
            <span style={{fontSize:13,fontWeight:900,color:'#F0C040',background:'rgba(240,192,64,.1)',padding:'3px 10px',borderRadius:20,border:'1px solid rgba(240,192,64,.2)'}}>{item.p}</span>
          </div>
        ))}
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
  const save=async()=>{try{await updateDoc(doc(db,'users',profile.uid),{name,avatar:av,city});onUpdate({...profile,name,avatar:av,city});setEditing(false);}catch(e){alert(e.message);}};
  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      <div style={{textAlign:'center',padding:'22px 14px 16px',background:'linear-gradient(180deg,rgba(26,61,32,.5),transparent)'}}>
        <div style={{fontSize:58,marginBottom:8}}>{profile.avatar}</div>
        <div style={{fontSize:20,fontWeight:900,marginBottom:2}}>{profile.name}</div>
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
          <div style={{marginBottom:16}}><div style={{color:'rgba(240,237,229,.6)',fontSize:11,fontWeight:700,marginBottom:8}}>الرمز</div><div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>{AVATARS.map(a=><div key={a} onClick={()=>setAv(a)} style={{width:44,height:44,borderRadius:'50%',background:'rgba(16,26,18,.9)',border:`2px solid ${av===a?'#F0C040':'rgba(255,255,255,.08)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,cursor:'pointer',transform:av===a?'scale(1.1)':'none',transition:'all .2s'}}>{a}</div>)}</div></div>
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
