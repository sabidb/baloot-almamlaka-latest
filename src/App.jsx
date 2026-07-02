import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, orderBy, where, limit, getDocs, query, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { listenAuth, signInGoogle, signOutUser, getRedirect } from './auth';
import { SUITS as CARD_SUITS, STORE_ITEMS, buildDeck, shuffle, dealHands, cardValue, trickWinner, calcResult, botPickCard, botBid, sounds, haptics, getThemeStyles } from './GameLogic';
import { ReactionBar } from './Reactions';
import { settleBotGame } from './functions';
import OnboardingTutorial, { ShareScoreCard } from './Onboarding';
import { FriendSystem, NotificationCenter, DailyRewardPopup } from './Social';
import TournamentScreen from './Tournament';
import AdminPanel from './AdminPanel';
import MultiplayerScreen from './MultiplayerGame';

const AVATARS = ['🧔','👲','🧕','👨‍💼','👩‍💼','🤴','👸','🧙','🦸','🎩'];
const CITIES  = ['الرياض','جدة','مكة','المدينة','الدمام','الخبر','أبها','تبوك','حائل','القصيم'];
const RANKAR  = {A:'أ',K:'ك',Q:'ق',J:'ج','10':'١٠','9':'٩','8':'٨','7':'٧'};
const SEAT_POS = {0:{top:76,left:37,rot:-4},1:{top:40,left:4,rot:9},2:{top:2,left:37,rot:-7},3:{top:40,left:66,rot:6}};

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
  panel:{background:'linear-gradient(180deg,rgba(16,26,18,.97),rgba(8,12,10,.97))',border:'1px solid rgba(240,192,64,.25)',borderRadius:20,padding:'20px 18px',boxShadow:'0 20px 60px rgba(0,0,0,.6)'},
};

function Spin(){return <div style={{width:30,height:30,border:'3px solid rgba(240,192,64,.2)',borderTopColor:'#F0C040',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>;}

export default function App(){
  const [profile,setProfile]=useState(null);
  const [authUser,setAuthUser]=useState(null);
  const [authErr,setAuthErr]=useState('');
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('home');
  const [inGame,setInGame]=useState(false);
  const [mpMode,setMpMode]=useState(null); // 'create'|'join'|'quick'
  const [inTournament,setInTournament]=useState(false);
  const [showOnboarding,setShowOnboarding]=useState(false);
  const [showAdmin,setShowAdmin]=useState(false);
  const [showDaily,setShowDaily]=useState(false);

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
      @keyframes dealIn{from{opacity:0;transform:translateY(60px) scale(.6) rotate(0deg)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes turnGlow{0%,100%{box-shadow:0 0 0 0 rgba(240,192,64,.55)}50%{box-shadow:0 0 16px 5px rgba(240,192,64,.55)}}
      @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
      @keyframes flyToCenter{from{opacity:1}to{opacity:0;transform:translate(var(--wx),var(--wy)) scale(.5)}}
      @keyframes ellipsis{0%{content:'.'}33%{content:'..'}66%{content:'...'}}
      @keyframes reactFloat{0%{opacity:0;transform:translateY(0) scale(.5)}15%{opacity:1;transform:translateY(-20px) scale(1.3)}100%{opacity:0;transform:translateY(-130px) scale(1)}}
      select option{background:#0C1410}
    `;
    document.head.appendChild(style);
    return()=>document.head.removeChild(style);
  },[]);

  useEffect(()=>{
    // Surface any error from a mobile redirect sign-in.
    getRedirect().catch(e=>{if(e?.code!=='auth/no-auth-event')setAuthErr('تعذر تسجيل الدخول');});
    const unsub=listenAuth((user)=>{
      (async()=>{
        setAuthUser(user||null);
        if(user){
          try{
            const snap=await getDoc(doc(db,'users',user.uid));
            setProfile(snap.exists()?{uid:user.uid,...snap.data()}:null);
            // Heartbeat for the rank-decay agent (fire-and-forget).
            if(snap.exists())updateDoc(doc(db,'users',user.uid),{lastActive:Date.now()}).catch(()=>{});
          }catch{setProfile(null);}
        }else{setProfile(null);}
        setLoading(false);
      })();
    });
    return()=>unsub();
  },[]);

  useEffect(()=>{
    if(!profile||showOnboarding)return;
    if(sessionStorage.getItem('baloot_daily_shown'))return;
    sessionStorage.setItem('baloot_daily_shown','1');
    const t=setTimeout(()=>setShowDaily(true),700);
    return()=>clearTimeout(t);
  },[profile,showOnboarding]);

  if(loading)return(
    <div style={{height:'100dvh',background:'#07090A',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,fontFamily:'Tajawal,sans-serif'}}>
      <div style={{fontFamily:"'Scheherazade New',serif",fontSize:44,color:'#F0C040',textShadow:'0 0 24px rgba(240,192,64,.4)'}}>بلوت</div>
      <Spin/>
    </div>
  );

  if(!profile)return <AuthScreen authUser={authUser} authErr={authErr} onDone={p=>{const isNew=p._new;const clean={...p};delete clean._new;setProfile(clean);if(isNew)setShowOnboarding(true);}}/>;

  if(showOnboarding)return <OnboardingTutorial onComplete={()=>setShowOnboarding(false)}/>;

  if(showAdmin)return(
    <div style={{height:'100dvh',overflowY:'auto',position:'relative'}}>
      <button onClick={()=>setShowAdmin(false)} style={{position:'fixed',top:12,left:12,zIndex:2000,...G.btn,background:'rgba(0,0,0,.6)',color:'#F0EDE5',border:'1px solid rgba(240,192,64,.3)',fontSize:12,padding:'6px 12px'}}>✕ رجوع</button>
      <AdminPanel/>
    </div>
  );

  if(inTournament)return(
    <div style={{height:'100dvh',overflowY:'auto',position:'relative'}}>
      <button onClick={()=>setInTournament(false)} style={{position:'fixed',top:'calc(env(safe-area-inset-top,0px) + 12px)',left:12,zIndex:2000,...G.btn,background:'rgba(0,0,0,.6)',color:'#F0EDE5',border:'1px solid rgba(240,192,64,.3)',fontSize:12,padding:'6px 12px'}}>✕ رجوع</button>
      <TournamentScreen userId={profile.uid} userProfile={profile} onUpdateProfile={patch=>setProfile(p=>({...p,...patch}))}/>
    </div>
  );

  if(mpMode)return(
    <div style={{height:'100dvh',overflow:'hidden'}}>
      <MultiplayerScreen profile={profile} mode={mpMode} onExit={()=>{setMpMode(null);setTab('home');}} onProfileUpdate={patch=>setProfile(p=>({...p,...patch}))}/>
    </div>
  );

  if(inGame)return(
    <div style={{height:'100dvh',overflow:'hidden'}}>
      <GameScreen profile={profile} onExit={()=>{setInGame(false);setTab('home');}} onProfileUpdate={patch=>setProfile(p=>({...p,...patch}))}/>
    </div>
  );

  const NAV=[{id:'home',i:'🏠',l:'الرئيسية'},{id:'board',i:'🏆',l:'المتصدرون'},{id:'store',i:'🛍️',l:'المتجر'},{id:'friends',i:'👥',l:'أصدقاء'},{id:'profile',i:'👤',l:'ملفي'}];

  return(
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#07090A',fontFamily:'Tajawal,sans-serif',color:'#F0EDE5',direction:'rtl',overflow:'hidden'}}>
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        {tab==='home'    &&<HomeScreen    profile={profile} onGame={()=>setInGame(true)} onMultiplayer={setMpMode} onTournament={()=>setInTournament(true)} onAdmin={()=>setShowAdmin(true)}/>}
        {tab==='board'   &&<LeaderScreen/>}
        {tab==='store'   &&<StoreScreen   profile={profile} onUpdate={setProfile}/>}
        {tab==='friends' &&(
          <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px))'}}>
            <FriendSystem userId={profile.uid} userProfile={profile} currentRoomCode={null}/>
          </div>
        )}
        {tab==='profile' &&<ProfileScreen profile={profile} onUpdate={setProfile} onLogout={async()=>{try{await signOutUser();}catch{/* ignore */}setProfile(null);}}/>}
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
      {showDaily&&<DailyRewardPopup userId={profile.uid} profile={profile} onClaim={patch=>setProfile(p=>({...p,...patch}))} onClose={()=>setShowDaily(false)}/>}
    </div>
  );
}

function AuthScreen({authUser,authErr,onDone}){
  // If we already have a signed-in Firebase user (e.g. returned from a
  // mobile redirect) but no Firestore profile yet, go straight to setup.
  const step=authUser?'setup':'login';
  const [av,setAv]=useState(AVATARS[0]);
  const [city,setCity]=useState('الرياض');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState(authErr||'');

  const doGoogle=async()=>{
    setBusy(true);setErr('');
    try{
      // On success the app-level auth listener takes over (loads profile or
      // shows this setup step). On mobile this navigates away entirely.
      await signInGoogle();
    }catch{setErr('تعذر تسجيل الدخول');setBusy(false);}
  };

  const finish=async()=>{
    if(!authUser)return;
    setBusy(true);
    try{
      const p={uid:authUser.uid,name:authUser.displayName||'لاعب',avatar:av,city,wins:0,losses:0,coins:500,createdAt:serverTimestamp()};
      await setDoc(doc(db,'users',authUser.uid),p,{merge:true});
      onDone({...p,_new:true});
    }catch(e){setErr(e.message);setBusy(false);}
  };

  const bg={minHeight:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'28px 20px',background:'radial-gradient(ellipse 80% 60% at 50% 40%,#0F2A14,#07090A)',fontFamily:'Tajawal,sans-serif',direction:'rtl'};
  const box={width:'100%',maxWidth:360,background:'rgba(12,20,16,.92)',border:'1px solid rgba(240,192,64,.14)',borderRadius:20,padding:'22px 18px'};

  if(step==='setup')return(
    <div style={bg}>
      <div style={{fontFamily:"'Scheherazade New',serif",fontSize:46,color:'#F0C040',textShadow:'0 0 24px rgba(240,192,64,.4)',marginBottom:6}}>بلوت</div>
      <div style={{color:'rgba(240,237,229,.6)',fontSize:12,letterSpacing:2,marginBottom:26}}>أكمل ملفك</div>
      <div style={box}>
        <div style={{fontSize:16,fontWeight:900,textAlign:'center',marginBottom:18}}>مرحباً {authUser?.displayName?.split(' ')[0]||'لاعب'} 👋</div>
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

function HomeScreen({profile,onGame,onMultiplayer,onTournament,onAdmin}){
  const tapRef=useRef({n:0,t:0});
  const modes=[
    {id:'bot',   icon:'🤖',title:'مع الروبوت',  sub:'تدرب بدون انتظار',        color:'#9B59B6'},
    {id:'create',icon:'👥',title:'مع الأصدقاء', sub:'أنشئ غرفة وشارك الكود',  color:'#F0C040'},
    {id:'join',  icon:'🔑',title:'انضم لغرفة',  sub:'أدخل كود الغرفة',         color:'#3498DB'},
    {id:'quick', icon:'⚡',title:'لعبة سريعة',  sub:'العب مع لاعبين عشوائيين',color:'#2ECC71'},
  ];

  const onLogoTap=()=>{
    const now=Date.now();
    const r=tapRef.current;
    if(now-r.t>2500)r.n=0;
    r.n++;r.t=now;
    if(r.n>=7){r.n=0;onAdmin();}
  };

  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      <div style={{textAlign:'center',padding:'18px 14px 0'}}>
        <div onClick={onLogoTap} style={{fontFamily:"'Scheherazade New',serif",fontSize:'clamp(28px,9vw,44px)',background:'linear-gradient(135deg,#7A5B1A,#F0C040,#FFE08A,#F0C040,#7A5B1A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',lineHeight:1.1,marginBottom:4,userSelect:'none'}}>بلوت المملكة</div>
        <div style={{color:'rgba(240,237,229,.6)',fontSize:11,letterSpacing:2,marginBottom:8}}>العب · تنافس · افوز</div>
        <div style={{width:60,height:1,margin:'0 auto 16px',background:'linear-gradient(90deg,transparent,#7A5B1A,transparent)'}}/>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 14px',marginBottom:12}}>
        <span style={{fontSize:28}}>{profile.avatar}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:14}}>{profile.name}</div>
          <div style={{color:'rgba(240,237,229,.6)',fontSize:11}}>{profile.city} · {profile.wins||0} انتصار</div>
        </div>
        <NotificationCenter userId={profile.uid}/>
        <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(240,192,64,.1)',border:'1px solid rgba(240,192,64,.2)',borderRadius:20,padding:'5px 10px'}}>
          <span>🪙</span><span style={{fontSize:13,fontWeight:900,color:'#F0C040'}}>{profile.coins||500}</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'0 12px',marginBottom:12}}>
        {modes.map(m=>(
          <div key={m.id} onClick={m.id==='bot'?onGame:()=>onMultiplayer(m.id)}
            style={{background:'rgba(13,20,16,.8)',border:'1px solid rgba(255,255,255,.07)',borderRadius:16,padding:'16px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer',touchAction:'manipulation'}}>
            <span style={{fontSize:26}}>{m.icon}</span>
            <span style={{fontSize:13,fontWeight:700,color:m.color+'CC'}}>{m.title}</span>
            <span style={{color:'rgba(240,237,229,.6)',fontSize:10,textAlign:'center',lineHeight:1.3}}>{m.sub}</span>
          </div>
        ))}
      </div>
      <div onClick={onTournament} style={{margin:'0 12px 12px',borderRadius:16,padding:'16px 18px',cursor:'pointer',touchAction:'manipulation',position:'relative',overflow:'hidden',border:'1px solid rgba(240,192,64,.3)',background:'linear-gradient(120deg,#1a0f00 0%,#2a1a00 25%,#3a2400 50%,#2a1a00 75%,#1a0f00 100%)',backgroundSize:'200% 100%',animation:'shimmer 5s linear infinite',display:'flex',alignItems:'center',gap:12}}>
        <span style={{fontSize:30}}>🏆</span>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:900,color:'#F0C040'}}>البطولات</div>
          <div style={{color:'rgba(240,237,229,.65)',fontSize:11,marginTop:2}}>تنافس واربح جوائز نقدية وعملات</div>
        </div>
        <span style={{color:'#F0C040',fontSize:18}}>‹</span>
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

const seatTeam=s=>s%2;
const TEAM_KEY=['a','b'];

function GameScreen({profile,onExit,onProfileUpdate}){
  const players=[{name:profile.name,avatar:profile.avatar},{name:'محمد',avatar:'👲'},{name:'عبدالله',avatar:'🧔'},{name:'سعد',avatar:'🤴'}];

  const [dealer,setDealer]=useState(3);
  const [dealtNonce,setDealtNonce]=useState(0);
  const [phase,setPhase]=useState('bidding');
  const [hands,setHands]=useState(()=>{const{h0,h1,h2,h3}=dealHands(shuffle(buildDeck()));return[h0,h1,h2,h3];});
  const [trickPlays,setTrickPlays]=useState([]);
  const [tricksWon,setTricksWon]=useState(0);
  const [roundScores,setRoundScores]=useState([0,0]);
  const [contract,setContract]=useState(null);
  const [currentBidder,setCurrentBidder]=useState(0);
  const [passCount,setPassCount]=useState(0);
  const [currentPlayer,setCurrentPlayer]=useState(0);
  const [pendingTrumpPick,setPendingTrumpPick]=useState(false);
  const [sel,setSel]=useState(null);
  const [scores,setScores]=useState({a:0,b:0});
  const [toast,setToast]=useState(null);
  const [roundResult,setRoundResult]=useState(null);
  const [showShare,setShowShare]=useState(false);
  const tn=useRef(0);
  const gameOverAppliedRef=useRef(false);
  const roundsHistoryRef=useRef([]);
  const startedAtRef=useRef(null);
  useEffect(()=>{startedAtRef.current=Date.now();},[]);
  const showT=msg=>{tn.current++;setToast({msg,k:tn.current});setTimeout(()=>setToast(null),2400);};

  const newHand=(dlr)=>{
    const {h0,h1,h2,h3}=dealHands(shuffle(buildDeck()));
    setHands([h0,h1,h2,h3]);
    setDealtNonce(n=>n+1);
    setTrickPlays([]);
    setTricksWon(0);
    setRoundScores([0,0]);
    setContract(null);
    setPassCount(0);
    setPendingTrumpPick(false);
    setSel(null);
    setCurrentBidder((dlr+1)%4);
    setPhase('bidding');
    sounds.deal();
  };

  const handleBid=(seat,bid)=>{
    if(bid.type==='pass'){
      showT(`${players[seat].name}: پاس`);
      const np=passCount+1;
      if(np>=4){showT('الكل مرر — توزيع جديد 🃏');const nd=(dealer+1)%4;setDealer(nd);newHand(nd);return;}
      setPassCount(np);
      setCurrentBidder((seat+1)%4);
    }else{
      const bidTeam=seatTeam(seat);
      setContract({type:bid.type,trump:bid.trump||null,bidTeam,bidderSeat:seat});
      const suitInfo=bid.trump?CARD_SUITS.find(s=>s.symbol===bid.trump):null;
      showT(bid.type==='sun'?`${players[seat].name}: صن ☀️`:`${players[seat].name}: حكم ${suitInfo?.symbol||''}`);
      setCurrentPlayer((dealer+1)%4);
      setPhase('playing');
    }
  };

  useEffect(()=>{
    if(phase!=='bidding'||currentBidder===0||pendingTrumpPick)return;
    const t=setTimeout(()=>{handleBid(currentBidder,botBid(hands[currentBidder],passCount));},900);
    return()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase,currentBidder,passCount,pendingTrumpPick]);

  const playCard=(seat,card,rect)=>{
    if(rect){spawnParticles(rect.left+27,rect.top+39);haptics.slam();}
    setHands(hs=>hs.map((h,i)=>i===seat?h.filter(c=>c.id!==card.id):h));
    setTrickPlays(tp=>[...tp,{seat,card}]);
    setCurrentPlayer((seat+1)%4);
    setSel(null);
    sounds.play();
  };

  useEffect(()=>{
    if(phase!=='playing'||currentPlayer===0||trickPlays.length>=4)return;
    const t=setTimeout(()=>{
      const hand=hands[currentPlayer];
      const card=botPickCard(hand,trickPlays,contract.type,contract.trump);
      playCard(currentPlayer,card,null);
    },850);
    return()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase,currentPlayer,trickPlays]);

  useEffect(()=>{
    if(phase!=='playing'||trickPlays.length<4)return;
    const t=setTimeout(()=>{
      const winnerPlay=trickWinner(trickPlays,contract.type,contract.trump);
      const trickValue=trickPlays.reduce((s,p)=>s+cardValue(p.card,contract.type,contract.trump),0);
      const wTeam=seatTeam(winnerPlay.seat);
      const newRoundScores=[...roundScores];newRoundScores[wTeam]+=trickValue;
      setRoundScores(newRoundScores);
      showT(`${players[winnerPlay.seat].name} أخذ الضربة (+${trickValue}) 🏆`);
      sounds.win();if(wTeam===0)haptics.win();
      const nt=tricksWon+1;
      setTricksWon(nt);
      setTrickPlays([]);
      if(nt>=8){
        const result=calcResult(newRoundScores,contract);
        roundsHistoryRef.current.push({contract,roundScores:newRoundScores,result:{made:result.made,isGahwa:result.isGahwa}});
        setScores(s=>{
          const bidKey=TEAM_KEY[contract.bidTeam],oppKey=TEAM_KEY[1-contract.bidTeam];
          return {...s,[bidKey]:s[bidKey]+result.bidTeamFinal,[oppKey]:s[oppKey]+result.oppTeamFinal};
        });
        setRoundResult(result);
        if(result.isGahwa){sounds.gahwa();haptics.gahwa();}
        setPhase('roundEnd');
      }else{
        setCurrentPlayer(winnerPlay.seat);
      }
    },1100);
    return()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[trickPlays,phase]);

  useEffect(()=>{
    if(phase!=='gameOver'||gameOverAppliedRef.current)return;
    gameOverAppliedRef.current=true;
    const humanWon=scores.a>=scores.b;
    const coinDelta=humanWon?50:10;
    // Route through the server referee (rate-limited) — clients can't mint.
    (async()=>{try{await settleBotGame(humanWon);}catch{/* rate-limited or offline */}})();
    onProfileUpdate&&onProfileUpdate({wins:(profile.wins||0)+(humanWon?1:0),losses:(profile.losses||0)+(humanWon?0:1),coins:(profile.coins||0)+coinDelta});
    // Match telemetry — the raw data source for the anti-collusion agent
    (async()=>{try{
      await addDoc(collection(db,'matches'),{
        mode:'bot',players:[{uid:profile.uid,seat:0,isBot:false,name:profile.name}],
        scores,history:roundsHistoryRef.current,
        startedAt:startedAtRef.current,endedAt:Date.now(),createdAt:serverTimestamp(),
      });
    }catch{/* telemetry best-effort */}})();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase]);

  const continueRound=()=>{
    setRoundResult(null);
    if(scores.a>=152||scores.b>=152){setPhase('gameOver');return;}
    const nd=(dealer+1)%4;setDealer(nd);newHand(nd);
  };

  const onCardClick=(e,card,idx)=>{
    if(phase!=='playing'||currentPlayer!==0||trickPlays.length>=4)return;
    const ledSuit=trickPlays.length?trickPlays[0].card.suit.symbol:null;
    const hasLed=ledSuit?hands[0].some(c=>c.suit.symbol===ledSuit):false;
    if(ledSuit&&hasLed&&card.suit.symbol!==ledSuit)return;
    if(sel!==idx){setSel(idx);return;}
    const r=e.currentTarget.getBoundingClientRect();
    playCard(0,card,r);
  };

  const humanBid=type=>{
    if(type==='hokum'){setPendingTrumpPick(true);return;}
    handleBid(0,{type});
  };
  const pickTrump=suit=>{setPendingTrumpPick(false);handleBid(0,{type:'hokum',trump:suit.symbol,trumpName:suit.name});};

  const hand=hands[0]||[];
  const ledSuit=trickPlays.length?trickPlays[0].card.suit.symbol:null;
  const hasLed=ledSuit?hand.some(c=>c.suit.symbol===ledSuit):false;
  const isPlayable=card=>phase==='playing'&&currentPlayer===0&&trickPlays.length<4&&(!ledSuit||!hasLed||card.suit.symbol===ledSuit);

  const trumpInfo=contract?.trump?CARD_SUITS.find(s=>s.symbol===contract.trump):null;
  const winnerLabel=scores.a>=scores.b?'أ':'ب';
  const theme=getThemeStyles(profile);

  return(
    <div style={{width:'100%',height:'100%',background:`radial-gradient(ellipse 90% 70% at 50% 50%,${theme.felt},#07090A)`,position:'relative',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Tajawal,sans-serif',direction:'rtl'}}>
      {toast&&<div key={toast.k} style={{position:'fixed',top:'calc(env(safe-area-inset-top,0px) + 12px)',left:'50%',transform:'translateX(-50%)',background:'rgba(8,12,10,.95)',border:'1px solid #7A5B1A',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:700,color:'#F0C040',whiteSpace:'nowrap',zIndex:9000,pointerEvents:'none',animation:'fadeUp .35s ease both'}}>{toast.msg}</div>}

      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(82vw,320px)',height:'min(82vw,320px)',borderRadius:'50%',border:'1px solid rgba(240,192,64,.15)',pointerEvents:'none',zIndex:1,animation:'spin 60s linear infinite'}}/>
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(65vw,260px)',height:'min(65vw,260px)',borderRadius:'50%',border:'1px dashed rgba(240,192,64,.08)',pointerEvents:'none',zIndex:1,animation:'spin 40s linear infinite reverse'}}/>

      <div style={{position:'absolute',top:'calc(env(safe-area-inset-top,0px) + 8px)',left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 10px',zIndex:20}}>
        <button onClick={onExit} style={{...G.btn,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)',fontSize:11,padding:'5px 10px'}}>خروج</button>
        <div style={{padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:700,border:'1.5px solid rgba(240,192,64,.3)',background:'rgba(240,192,64,.08)',color:'#F0C040',display:'flex',alignItems:'center',gap:6}}>
          {phase==='bidding'?<span style={{animation:'fadeUp .3s'}}>🗣️ مزايدة</span>:
           contract?.type==='sun'?<span>☀️ صن</span>:
           contract?trumpInfo&&<span style={{color:trumpInfo.color==='#0A0F0A'?'#F0C040':'#e08'}}>حكم {trumpInfo.symbol}</span>:
           <span>—</span>}
        </div>
        <div style={{background:'rgba(10,14,12,.8)',border:'1px solid rgba(240,192,64,.18)',borderRadius:10,padding:'4px 10px',fontSize:13,fontWeight:900}}>
          <span style={G.gold}>{scores.a}</span><span style={G.dim}> — </span><span style={G.gold}>{scores.b}</span>
        </div>
      </div>

      {[2,1,3].map(seat=>{
        const pos=seat===2?{top:'calc(env(safe-area-inset-top,0px) + 54px)',left:'50%',transform:'translateX(-50%)'}:seat===1?{left:8,top:'50%',transform:'translateY(-50%)'}:{right:8,top:'50%',transform:'translateY(-50%)'};
        const active=(phase==='bidding'&&currentBidder===seat)||(phase==='playing'&&currentPlayer===seat);
        return(
          <div key={seat} style={{position:'absolute',...pos,display:'flex',flexDirection:'column',alignItems:'center',gap:3,zIndex:10}}>
            <div style={{width:38,height:38,borderRadius:'50%',border:`2px solid ${active?'#F0C040':'#7A5B1A'}`,background:'rgba(16,26,18,.9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,animation:active?'turnGlow 1.1s ease-in-out infinite':'none'}}>{players[seat].avatar}</div>
            <span style={{color:active?'#F0C040':'rgba(240,237,229,.6)',fontSize:10,fontWeight:700}}>{players[seat].name}</span>
            {active&&<span style={{color:'rgba(240,192,64,.7)',fontSize:9}}>{phase==='bidding'?'يزايد…':'يفكر…'}</span>}
            {phase==='playing'&&!active&&<div style={{fontSize:9,color:'rgba(240,237,229,.35)'}}>🂠×{hands[seat]?.length||0}</div>}
          </div>
        );
      })}

      <div style={{position:'absolute',top:'calc(env(safe-area-inset-top,0px) + 58px)',right:8,zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'rgba(10,14,12,.7)',border:'1px solid rgba(240,192,64,.18)',borderRadius:10,padding:'6px 8px'}}>
        <span style={{fontSize:9,color:'rgba(240,237,229,.5)',fontWeight:700}}>الكوز</span>
        <span style={{fontSize:26,filter:'drop-shadow(0 0 8px rgba(240,192,64,.5))',color:trumpInfo?(trumpInfo.isRed?'#E74C3C':'#F0EDE5'):'rgba(240,237,229,.3)'}}>{contract?.type==='sun'?'☀️':trumpInfo?trumpInfo.symbol:'?'}</span>
      </div>

      {phase==='playing'&&(
        <div style={{position:'relative',width:190,height:150,zIndex:20}}>
          {trickPlays.map((p,i)=>{
            const pos=SEAT_POS[p.seat];
            const sc=theme.suitColor(p.card.suit);
            return(
              <div key={p.card.id} style={{...G.card,background:theme.cardBg,top:pos.top,left:pos.left+'%',transform:`rotate(${pos.rot}deg)`,zIndex:i+1,animation:'popIn .3s ease both'}}>
                <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:sc,alignSelf:'flex-start',lineHeight:1}}>{RANKAR[p.card.rank.symbol]}</span>
                <span style={{fontSize:20,color:sc,lineHeight:1}}>{p.card.suit.symbol}</span>
                <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:sc,alignSelf:'flex-end',transform:'rotate(180deg)',lineHeight:1}}>{RANKAR[p.card.rank.symbol]}</span>
              </div>
            );
          })}
          {trickPlays.length===0&&<div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',color:'rgba(240,237,229,.35)',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{currentPlayer===0?'دورك أنت':`دور ${players[currentPlayer].name}`}</div>}
        </div>
      )}

      {phase==='bidding'&&currentBidder===0&&(
        <div style={{...G.panel,position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px) + 124px)',width:'min(88vw,320px)',zIndex:40,animation:'popIn .3s ease both'}}>
          {!pendingTrumpPick?(
            <>
              <div style={{textAlign:'center',fontSize:13,fontWeight:900,color:'#F0C040',marginBottom:12}}>دورك للمزايدة 🗣️</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>humanBid('hokum')} style={{...G.btn,flex:1,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',fontSize:13,padding:'11px 6px'}}>حكم</button>
                <button onClick={()=>humanBid('sun')} style={{...G.btn,flex:1,background:'linear-gradient(135deg,#B8860B,#FFD166)',color:'#07090A',fontSize:13,padding:'11px 6px'}}>☀️ صن</button>
                <button onClick={()=>humanBid('pass')} style={{...G.btn,flex:1,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)',fontSize:13,padding:'11px 6px'}}>پاس</button>
              </div>
            </>
          ):(
            <>
              <div style={{textAlign:'center',fontSize:13,fontWeight:900,color:'#F0C040',marginBottom:12}}>اختر لون الحكم</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {CARD_SUITS.map(s=>(
                  <button key={s.symbol} onClick={()=>pickTrump(s)} style={{...G.btn,display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:'rgba(255,255,255,.06)',border:`1.5px solid ${s.isRed?'#c0392b':'#666'}`,color:s.isRed?'#E74C3C':'#F0EDE5',fontSize:13,padding:'11px 6px'}}>
                    <span style={{fontSize:20}}>{s.symbol}</span>{s.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div key={dealtNonce} style={{position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px) + 8px)',left:0,right:0,height:106,zIndex:30,display:'flex',justifyContent:'center',alignItems:'flex-end'}}>
        {hand.map((card,i)=>{
          const n=hand.length,sp=Math.min(27,200/Math.max(n,1)),off=(i-(n-1)/2)*sp,rot=(i-(n-1)/2)*3.5,lft=Math.abs(i-(n-1)/2)*1.5,iS=sel===i,playable=isPlayable(card);
          const sc=theme.suitColor(card.suit);
          return(
            <div key={card.id} onClick={e=>onCardClick(e,card,i)} style={{...G.card,background:theme.cardBg,left:`calc(50% + ${off}px - 27px)`,transform:`rotate(${rot}deg) translateY(${iS?-26:lft}px) scale(${iS?1.07:1})`,zIndex:iS?90:i+1,border:`1px solid ${iS?'#2ECC71':theme.cardBorder}`,boxShadow:iS?'0 0 0 2px rgba(46,204,113,.35),0 8px 22px rgba(0,0,0,.7)':'0 8px 22px rgba(0,0,0,.65)',opacity:phase==='playing'&&!playable?.4:1,filter:phase==='playing'&&!playable?'grayscale(.5)':'none',cursor:phase==='playing'&&!playable?'default':'pointer',transition:'transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,border-color .2s,opacity .2s',animation:`dealIn .4s ${i*0.05}s ease both`}}>
              <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:sc,alignSelf:'flex-start',lineHeight:1}}>{RANKAR[card.rank.symbol]}</span>
              <span style={{fontSize:20,color:sc,lineHeight:1}}>{card.suit.symbol}</span>
              <span style={{fontFamily:"'Scheherazade New',serif",fontSize:15,fontWeight:700,color:sc,alignSelf:'flex-end',transform:'rotate(180deg)',lineHeight:1}}>{RANKAR[card.rank.symbol]}</span>
            </div>
          );
        })}
      </div>

      {phase==='roundEnd'&&roundResult&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}}>
          <div style={{...G.panel,textAlign:'center',width:'100%',maxWidth:320,animation:'popIn .4s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{fontSize:48,marginBottom:6}}>{roundResult.isGahwa?'☕':roundResult.made?'✅':'❌'}</div>
            <div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'#F0C040',marginBottom:10}}>{roundResult.reason}</div>
            <div style={{display:'flex',justifyContent:'center',gap:28,margin:'12px 0 18px'}}>
              {[['أ',scores.a],['ب',scores.b]].map(([t,v])=>(
                <div key={t} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <span style={{fontSize:30,fontWeight:900,color:'#F0C040',lineHeight:1}}>{v}</span>
                  <span style={{color:'rgba(240,237,229,.6)',fontSize:11}}>الفريق {t}</span>
                </div>
              ))}
            </div>
            <button onClick={continueRound} style={{...G.btn,width:'100%',padding:13,fontSize:15,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A'}}>{scores.a>=152||scores.b>=152?'عرض النتيجة 🏆':'الجولة التالية ▶'}</button>
          </div>
        </div>
      )}

      {phase==='gameOver'&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}}>
          <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #F0C040',borderRadius:22,padding:'34px 26px',textAlign:'center',boxShadow:'0 0 40px rgba(240,192,64,.25),0 50px 100px rgba(0,0,0,.9)',width:'100%',maxWidth:320,animation:'popIn .5s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{fontSize:58}}>🏆</div>
            <div style={{fontFamily:"'Scheherazade New',serif",fontSize:28,color:'#F0C040',margin:'10px 0 5px'}}>الفريق {winnerLabel} يفوز!</div>
            <div style={{color:'rgba(240,237,229,.6)',fontSize:13}}>وصلتم إلى ١٥٢ نقطة</div>
            <div style={{display:'flex',justifyContent:'center',gap:28,margin:'18px 0'}}>
              {[['أ',scores.a,'#F0C040'],['ب',scores.b,'rgba(240,237,229,.4)']].map(([t,v,c])=>(
                <div key={t} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <span style={{fontSize:34,fontWeight:900,color:c,lineHeight:1}}>{v}</span>
                  <span style={{color:'rgba(240,237,229,.6)',fontSize:11}}>الفريق {t}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowShare(true)} style={{...G.btn,flex:1,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.8)',border:'1px solid rgba(255,255,255,.12)',fontSize:13}}>مشاركة 📱</button>
              <button onClick={onExit} style={{...G.btn,flex:2,padding:13,fontSize:15,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A'}}>العب مجدداً</button>
            </div>
          </div>
        </div>
      )}

      <ReactionBar/>

      {showShare&&<ShareScoreCard winner={winnerLabel==='أ'?0:1} loser={winnerLabel==='أ'?1:0} winnerScore={Math.max(scores.a,scores.b)} loserScore={Math.min(scores.a,scores.b)} isGahwa={roundResult?.isGahwa} onClose={()=>setShowShare(false)}/>}
    </div>
  );
}

function LeaderScreen(){
  const FALLBACK=[{id:'1',name:'أبو عبدالله',avatar:'🧔',city:'الرياض',wins:247},{id:'2',name:'محمد الغامدي',avatar:'👲',city:'جدة',wins:198},{id:'3',name:'سعد العتيبي',avatar:'🤴',city:'الدمام',wins:187},{id:'4',name:'فهد القحطاني',avatar:'🧙',city:'مكة',wins:156},{id:'5',name:'عبدالرحمن',avatar:'👨‍💼',city:'المدينة',wins:143}];
  const [players,setPlayers]=useState(FALLBACK);
  const [region,setRegion]=useState('الكل');
  useEffect(()=>{(async()=>{try{
    const base=collection(db,'users');
    const q=region==='الكل'
      ?query(base,orderBy('wins','desc'),limit(20))
      :query(base,where('city','==',region),orderBy('wins','desc'),limit(20));
    const s=await getDocs(q);
    setPlayers(s.docs.length?s.docs.map(d=>({id:d.id,...d.data()})):(region==='الكل'?FALLBACK:[]));
  }catch{/* offline — keep current list */}})();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[region]);
  const ri=i=>i===0?'🥇':i===1?'🥈':i===2?'🥉':String(i+1);
  const rc=i=>i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'rgba(240,237,229,.55)';
  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      <div style={{padding:'16px 14px 8px',textAlign:'center'}}>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'#F0C040'}}>🏆 المتصدرون</div>
        <div style={{color:'rgba(240,237,229,.6)',fontSize:11,marginTop:4}}>أفضل لاعبي المملكة</div>
      </div>
      <div style={{display:'flex',gap:6,overflowX:'auto',WebkitOverflowScrolling:'touch',padding:'6px 14px 10px',scrollbarWidth:'none'}}>
        {['الكل',...CITIES].map(c=>(
          <div key={c} onClick={()=>setRegion(c)} style={{flexShrink:0,padding:'5px 14px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',border:`1px solid ${region===c?'#F0C040':'rgba(255,255,255,.12)'}`,background:region===c?'rgba(240,192,64,.12)':'transparent',color:region===c?'#F0C040':'rgba(240,237,229,.55)',touchAction:'manipulation',transition:'all .2s'}}>{c}</div>
        ))}
      </div>
      <div style={{height:1,background:'rgba(255,255,255,.07)',margin:'0 14px'}}/>
      {players.length===0&&<div style={{textAlign:'center',color:'rgba(240,237,229,.4)',fontSize:12,padding:30}}>لا يوجد لاعبون في {region} بعد</div>}
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

function StoreScreen({profile,onUpdate}){
  const [tab,setTab]=useState('decks');
  const [toast,setToast]=useState(null);
  const [busy,setBusy]=useState(null);
  const showT=msg=>{setToast(msg);setTimeout(()=>setToast(null),2200);};
  const owned=profile.owned||{decks:['classic'],tables:['classic'],reactions:[]};
  const coins=profile.coins||0;
  const BADGE={hot:{l:'الأكثر طلباً',c:'#E74C3C'},new:{l:'جديد',c:'#2ECC71'},seasonal:{l:'موسمي',c:'#9B59B6'},vip:{l:'VIP',c:'#F0C040'}};

  const buy=async(kind,item)=>{
    if(busy)return;
    const list=owned[kind]||[];
    if(list.includes(item.id))return;
    if(coins<item.cost){showT('رصيد غير كافٍ 🪙');return;}
    setBusy(item.id);
    try{
      const newOwned={...owned,[kind]:[...list,item.id]};
      await updateDoc(doc(db,'users',profile.uid),{coins:increment(-item.cost),owned:newOwned});
      onUpdate({...profile,coins:coins-item.cost,owned:newOwned});
      sounds.buy();haptics.buy();
      showT(`تم شراء ${item.name} ✅`);
    }catch{showT('فشل الشراء');}
    setBusy(null);
  };

  const activate=async(kind,id)=>{
    const field=kind==='decks'?'activeDeck':'activeTable';
    try{
      await updateDoc(doc(db,'users',profile.uid),{[field]:id});
      onUpdate({...profile,[field]:id});
      showT('تم التفعيل ✨');
    }catch{showT('فشل');}
  };

  const renderItems=(kind,items)=>{
    const activeField=kind==='decks'?'activeDeck':'activeTable';
    const activeId=profile[activeField]||'classic';
    const all=kind==='reactions'?items:[{id:'classic',name:kind==='decks'?'كلاسيك':'الكلاسيك',desc:'التصميم الأساسي',cost:0,emoji:kind==='decks'?'🃏':'🟩'},...items];
    return(
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'0 12px 16px'}}>
        {all.map(item=>{
          const isOwned=item.cost===0||(owned[kind]||[]).includes(item.id);
          const isActive=kind!=='reactions'&&activeId===item.id;
          return(
            <div key={item.id} onClick={()=>isOwned?(kind!=='reactions'&&!isActive&&activate(kind,item.id)):buy(kind,item)}
              style={{background:'rgba(13,20,16,.8)',border:`1px solid ${isActive?'#F0C040':'rgba(255,255,255,.07)'}`,borderRadius:16,padding:'16px 12px',display:'flex',flexDirection:'column',alignItems:'center',gap:7,cursor:'pointer',position:'relative',touchAction:'manipulation',opacity:busy===item.id?.6:1}}>
              {item.badge&&BADGE[item.badge]&&<span style={{position:'absolute',top:8,right:8,background:BADGE[item.badge].c,color:BADGE[item.badge].c==='#F0C040'?'#000':'#fff',fontSize:8,fontWeight:700,padding:'2px 5px',borderRadius:5}}>{BADGE[item.badge].l}</span>}
              {isActive&&<span style={{position:'absolute',top:8,left:8,fontSize:12}}>✅</span>}
              <span style={{fontSize:30}}>{item.emoji}</span>
              <span style={{fontSize:12,fontWeight:700,textAlign:'center'}}>{item.name}</span>
              <span style={{color:'rgba(240,237,229,.5)',fontSize:9,textAlign:'center',lineHeight:1.4,minHeight:24}}>{item.desc}</span>
              <span style={{fontSize:12,fontWeight:900,color:isOwned?'#2ECC71':'#F0C040',background:isOwned?'rgba(46,204,113,.1)':'rgba(240,192,64,.1)',padding:'3px 12px',borderRadius:20,border:`1px solid ${isOwned?'rgba(46,204,113,.25)':'rgba(240,192,64,.2)'}`}}>
                {isActive?'مفعّل':isOwned?(kind==='reactions'?'مملوك':'فعّل'):`🪙 ${item.cost}`}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return(
    <div style={{position:'absolute',inset:0,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 12px)',paddingTop:'env(safe-area-inset-top,0px)'}}>
      <div style={{padding:'16px 14px 8px',textAlign:'center'}}><div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'#F0C040'}}>🛍️ المتجر</div></div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(13,20,16,.8)',border:'1px solid #7A5B1A',borderRadius:12,margin:'0 12px 12px',padding:'10px 14px'}}>
        <span style={{color:'rgba(240,237,229,.6)'}}>رصيدك</span>
        <span style={{fontSize:16,fontWeight:900,color:'#F0C040'}}>🪙 {coins}</span>
      </div>
      <div style={{display:'flex',gap:6,padding:'0 12px 12px'}}>
        {[{id:'decks',l:'🎴 سكنات'},{id:'tables',l:'🟩 طاولات'},{id:'coins',l:'🪙 رصيد'}].map(t=>(
          <div key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,textAlign:'center',padding:'8px 4px',borderRadius:12,fontSize:12,fontWeight:700,cursor:'pointer',border:`1px solid ${tab===t.id?'#F0C040':'rgba(255,255,255,.1)'}`,background:tab===t.id?'rgba(240,192,64,.12)':'transparent',color:tab===t.id?'#F0C040':'rgba(240,237,229,.55)',touchAction:'manipulation'}}>{t.l}</div>
        ))}
      </div>
      {tab==='decks'&&renderItems('decks',STORE_ITEMS.decks)}
      {tab==='tables'&&renderItems('tables',STORE_ITEMS.tables)}
      {tab==='coins'&&(
        <div style={{display:'flex',flexDirection:'column',gap:10,padding:'0 12px 16px'}}>
          {STORE_ITEMS.coins.map(pack=>(
            <div key={pack.id} onClick={()=>showT('الدفع متوفر قريباً — Apple Pay & مدى 💳')} style={{display:'flex',alignItems:'center',gap:12,background:'rgba(13,20,16,.8)',border:`1px solid ${pack.best?'rgba(240,192,64,.4)':'rgba(255,255,255,.07)'}`,borderRadius:16,padding:'14px 16px',cursor:'pointer',touchAction:'manipulation',position:'relative'}}>
              {pack.best&&<span style={{position:'absolute',top:-8,right:14,background:'#F0C040',color:'#000',fontSize:9,fontWeight:900,padding:'2px 8px',borderRadius:8}}>الأفضل قيمة</span>}
              <span style={{fontSize:28}}>{pack.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700}}>{pack.name}</div>
                <div style={{color:'rgba(240,237,229,.5)',fontSize:10,marginTop:2}}>{pack.desc}</div>
              </div>
              <span style={{fontSize:14,fontWeight:900,color:'#2ECC71',whiteSpace:'nowrap'}}>{pack.price} ر.س</span>
            </div>
          ))}
          <div style={{textAlign:'center',color:'rgba(240,237,229,.4)',fontSize:10,marginTop:4}}>💳 Apple Pay ومدى — قريباً</div>
        </div>
      )}
      {toast&&<div style={{position:'fixed',bottom:'calc(70px + env(safe-area-inset-bottom,0px))',left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',fontWeight:900,fontSize:13,padding:'10px 22px',borderRadius:24,zIndex:9999,whiteSpace:'nowrap',animation:'fadeUp .3s ease both'}}>{toast}</div>}
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
