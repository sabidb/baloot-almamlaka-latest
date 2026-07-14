import { useEffect, useRef, useState } from 'react';
import { SUITS, botBid, botChoose, legalPlays, sortHand } from './GameLogic';
import { gameReducer, initGame, RANKSAR } from './balootEngine';
import { openRoom, genRoomCode, ONLINE_MODE, now } from './online';
import { applyGameResult } from './progress';

const TURN_MS = 22000, HOST_MS = 30000;
const SUIT_NAME = sy => (SUITS.find(s=>s.symbol===sy)||{}).name || '';
const SUIT_COLOR = sy => (SUITS.find(s=>s.symbol===sy)||{}).color || '#111';

function clientId(profile){
  if(profile?.uid && profile.uid!=='guest') return profile.uid;
  let id=sessionStorage.getItem('ludoGuestId');
  if(!id){ id='g'+Math.random().toString(36).slice(2,8); sessionStorage.setItem('ludoGuestId',id); }
  return id;
}
// Card face.
function Card({card,onClick,style,dim}){
  return (
    <div onClick={onClick} style={{width:52,height:74,borderRadius:9,background:'linear-gradient(145deg,#FEFDF8,#F0EBE0)',boxShadow:'0 5px 16px rgba(0,0,0,.55)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'3px',opacity:dim?0.45:1,cursor:onClick?'pointer':'default',...style}}>
      <span style={{fontFamily:"'Scheherazade New',serif",fontSize:14,fontWeight:700,color:card.suit.color,alignSelf:'flex-start',lineHeight:1}}>{RANKSAR[card.rank.symbol]}</span>
      <span style={{fontSize:19,color:card.suit.color,lineHeight:1}}>{card.suit.symbol}</span>
      <span style={{fontFamily:"'Scheherazade New',serif",fontSize:14,fontWeight:700,color:card.suit.color,alignSelf:'flex-end',transform:'rotate(180deg)',lineHeight:1}}>{RANKSAR[card.rank.symbol]}</span>
    </div>
  );
}
function Backs({n}){ return <div style={{display:'flex'}}>{Array.from({length:Math.min(n,8)}).map((_,i)=><div key={i} style={{width:15,height:22,borderRadius:3,background:'linear-gradient(135deg,#0D5C2A,#1A3D20)',border:'1px solid rgba(240,192,64,.2)',marginRight:-8}}/>)}</div>; }

export default function BalootOnline({ profile, onExit, onUpdate, persist }){
  const myUid=clientId(profile);
  const myName=profile?.name||'لاعب';
  const myAvatar=profile?.avatar||'🃏';

  const [room,setRoom]=useState(null);
  const [joinCode,setJoinCode]=useState('');
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const [sel,setSel]=useState(null);
  const chan=useRef(null), roomRef=useRef(null), actedEvt=useRef(-1), unsub=useRef(null), rewarded=useRef(false);

  useEffect(()=>()=>{ if(unsub.current) unsub.current(); },[]);
  const setRoomBoth=r=>{ roomRef.current=r; setRoom(r); };
  const subscribe=ch=>{ if(unsub.current) unsub.current(); unsub.current=ch.subscribe(r=>{ if(r) setRoomBoth(r); }); };
  const writeRoom=async patch=>{ const base=roomRef.current; if(!base||!chan.current) return; const next={...base,...patch,ts:now()}; setRoomBoth(next); await chan.current.set(next); };

  const create=async()=>{
    setBusy(true); setErr('');
    const c=genRoomCode();
    const r={ code:c, host:myUid, active:[0,1,2,3], players:{0:{uid:myUid,name:myName,avatar:myAvatar}}, status:'waiting', state:null, ts:now() };
    chan.current=openRoom(c); roomRef.current=r;
    try{ await chan.current.set(r); setRoomBoth(r); subscribe(chan.current); }catch{ setErr('تعذّر الإنشاء'); }
    setBusy(false);
  };
  const join=async()=>{
    const c=joinCode.trim(); if(c.length<4){ setErr('كود غير صحيح'); return; }
    setBusy(true); setErr('');
    const ch=openRoom(c);
    try{
      const r=await ch.get();
      if(!r){ setErr('الغرفة غير موجودة'); setBusy(false); return; }
      if(r.status!=='waiting'){ setErr('اللعبة بدأت'); setBusy(false); return; }
      const taken=new Set(Object.keys(r.players||{}).map(Number));
      if([...taken].some(s=>r.players[s].uid===myUid)){ chan.current=ch; setRoomBoth(r); subscribe(ch); setBusy(false); return; }
      const free=[0,1,2,3].find(s=>!taken.has(s));
      if(free==null){ setErr('الغرفة ممتلئة'); setBusy(false); return; }
      const next={ ...r, players:{...r.players,[free]:{uid:myUid,name:myName,avatar:myAvatar}}, ts:now() };
      chan.current=ch; roomRef.current=next; await ch.set(next); setRoomBoth(next); subscribe(ch);
    }catch{ setErr('تعذّر الدخول'); }
    setBusy(false);
  };
  const leave=async()=>{
    try{ const r=roomRef.current;
      if(r&&r.status==='waiting'&&chan.current){ const players={...r.players};
        for(const s of Object.keys(players)) if(players[s].uid===myUid) delete players[s];
        await chan.current.set({...r,players,ts:now()}); }
    }catch{ /* ignore */ }
    if(unsub.current) unsub.current(); setRoomBoth(null); onExit();
  };

  // derived
  const st=room?.state||null;
  const players=room?.players||{};
  const isHost=room?.host===myUid;
  const seatOf=uid=>{ for(const s of Object.keys(players)) if(players[s].uid===uid) return Number(s); return -1; };
  const mySeat=seatOf(myUid);
  const botSeat=seat=>!players[seat];

  const advance=action=>{ const cur=roomRef.current?.state; if(!cur) return; if(actedEvt.current===cur.evt) return; actedEvt.current=cur.evt;
    const next=gameReducer(cur,action); writeRoom({ state:next, status: next.phase==='gameOver'?'over':'playing' }); };

  const humanBid=bid=>{ if(st&&st.phase==='bidding'&&st.bidTurn===mySeat) advance({type:'BID',payload:bid}); };
  const humanPlay=card=>{ if(!st||st.phase!=='playing'||st.turn!==mySeat) return;
    const legal=legalPlays(st.hands[mySeat],st.trick,st.contract.type,st.contract.trump);
    if(!legal.some(c=>c.id===card.id)) return;
    if(sel!==card.id){ setSel(card.id); return; }
    setSel(null); advance({type:'PLAY',payload:card}); };

  // turn engine
  useEffect(()=>{
    if(!st || st.phase==='gameOver' || room?.status!=='playing') return;
    const timers=[];
    if(st.phase==='bidding'){
      const seat=st.bidTurn;
      if(botSeat(seat)){ if(isHost) timers.push(setTimeout(()=>{ const b=botBid(st.hands[seat],st.passCount); advance({type:'BID',payload:b.type==='pass'?{type:'pass'}:{type:b.type,trump:b.trump,trumpName:b.trumpName}}); },900)); }
      else if(seat===mySeat) timers.push(setTimeout(()=>advance({type:'BID',payload:{type:'pass'}}),TURN_MS));
      else if(isHost) timers.push(setTimeout(()=>advance({type:'BID',payload:{type:'pass'}}),HOST_MS));
    } else if(st.phase==='playing'){
      if(st.trick.length===4){ if(isHost) timers.push(setTimeout(()=>advance({type:'RESOLVE'}),1150)); }
      else {
        const seat=st.turn;
        const botPlay=()=>advance({type:'PLAY',payload:botChoose(st.hands[seat],st.trick,st.contract.type,st.contract.trump,seat)});
        if(botSeat(seat)){ if(isHost) timers.push(setTimeout(botPlay,820)); }
        else if(seat===mySeat) timers.push(setTimeout(()=>{ const legal=legalPlays(st.hands[mySeat],st.trick,st.contract.type,st.contract.trump); if(legal.length) advance({type:'PLAY',payload:legal[0]}); },TURN_MS));
        else if(isHost) timers.push(setTimeout(botPlay,HOST_MS));
      }
    } else if(st.phase==='roundOver'){ if(isHost) timers.push(setTimeout(()=>advance({type:'NEXT_ROUND'}),3600)); }
    return ()=>timers.forEach(clearTimeout);
  },[room?.state?.evt, room?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // reward once on game over
  useEffect(()=>{
    if(!st) return;
    if(st.phase!=='gameOver'){ rewarded.current=false; return; }
    if(rewarded.current || mySeat<0) return; rewarded.current=true;
    const won = st.matchScores[mySeat%2] > st.matchScores[1-(mySeat%2)];
    const { patch }=applyGameResult(profile,{game:'baloot',won});
    if(onUpdate) onUpdate(p=>({...p,...patch})); if(persist) persist(patch);
  },[room?.state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const panel={fontFamily:'Tajawal,sans-serif',direction:'rtl',color:'#F0EDE5'};
  const btn=(bg,fg)=>({padding:'12px',borderRadius:12,border:'none',background:bg,color:fg,fontFamily:'Tajawal,sans-serif',fontWeight:900,fontSize:15,cursor:'pointer'});

  // ── MENU ──
  if(!room){
    return (
      <div style={{...panel,height:'100%',background:'radial-gradient(ellipse 80% 60% at 50% 35%,#0F2A14,#07090A)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:24}}>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:30,color:'#F0C040'}}>بلوت أونلاين</div>
        <div style={{fontSize:12,color:'rgba(240,237,229,.55)',textAlign:'center'}}>{ONLINE_MODE==='firestore'?'٤ لاعبين · فريقان · على أي جهاز 🌐':'⚠️ وضع محلي (نفس المتصفح) — أضف Firebase للعب عبر الأجهزة'}</div>
        <div style={{background:'rgba(13,20,16,.85)',border:'1px solid rgba(240,192,64,.2)',borderRadius:18,padding:20,width:'100%',maxWidth:340,display:'flex',flexDirection:'column',gap:14}}>
          <button onClick={create} disabled={busy} style={{...btn('linear-gradient(135deg,#8B6914,#F0C040)','#07090A'),width:'100%'}}>إنشاء غرفة (٤ لاعبين)</button>
          <div style={{height:1,background:'rgba(255,255,255,.1)'}}/>
          <div style={{display:'flex',gap:8}}>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" placeholder="١٢٣٤" style={{flex:1,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.14)',borderRadius:10,padding:'11px',color:'#F0EDE5',fontSize:18,textAlign:'center',letterSpacing:4,fontFamily:'Tajawal,sans-serif',outline:'none'}}/>
            <button onClick={join} disabled={busy} style={{...btn('rgba(52,152,219,.2)','#5DADE2'),border:'1px solid rgba(52,152,219,.4)'}}>دخول</button>
          </div>
          {err&&<div style={{color:'#E74C3C',fontSize:12,textAlign:'center'}}>{err}</div>}
        </div>
        <button onClick={onExit} style={{...btn('rgba(255,255,255,.08)','rgba(240,237,229,.7)'),border:'1px solid rgba(255,255,255,.12)',fontWeight:700,fontSize:13}}>رجوع</button>
      </div>
    );
  }

  // ── LOBBY ──
  if(room.status==='waiting'){
    const humans=Object.keys(players).length;
    return (
      <div style={{...panel,height:'100%',background:'radial-gradient(ellipse 80% 60% at 50% 35%,#0F2A14,#07090A)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:24}}>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:24,color:'#F0C040'}}>غرفة البلوت</div>
        <div style={{background:'rgba(240,192,64,.1)',border:'1px solid rgba(240,192,64,.35)',borderRadius:14,padding:'10px 26px',fontSize:34,fontWeight:900,color:'#F0C040',letterSpacing:8}}>{room.code}</div>
        <div style={{fontSize:11,color:'rgba(240,237,229,.55)'}}>شارك الكود — فريقان (أنت وشريكك ضد الآخرين)</div>
        <div style={{width:'100%',maxWidth:320,display:'flex',flexDirection:'column',gap:8,margin:'6px 0'}}>
          {[0,1,2,3].map(seat=>{ const pl=players[seat]; const team=seat%2;
            return <div key={seat} style={{display:'flex',alignItems:'center',gap:10,background:'rgba(13,20,16,.8)',border:`1px solid ${team===0?'rgba(240,192,64,.25)':'rgba(52,152,219,.25)'}`,borderRadius:10,padding:'9px 12px'}}>
              <span style={{fontSize:18}}>{pl?pl.avatar:'🪑'}</span>
              <span style={{flex:1,fontSize:13,fontWeight:700}}>{pl?pl.name:'بانتظار لاعب…'}</span>
              <span style={{fontSize:10,color:team===0?'#F0C040':'#5DADE2'}}>الفريق {team===0?'أ':'ب'}</span>
              {pl?<span style={{fontSize:11,color:pl.uid===myUid?'#F0C040':'#2ECC71'}}>{pl.uid===myUid?'أنت':'جاهز'}</span>:<span style={{fontSize:11,color:'rgba(240,237,229,.4)'}}>🤖</span>}
            </div>;
          })}
        </div>
        {isHost
          ? <button onClick={()=>writeRoom({status:'playing',state:initGame()})} style={{...btn('linear-gradient(135deg,#8B6914,#F0C040)','#07090A'),width:'100%',maxWidth:320}}>ابدأ اللعب ▶ {humans<4?`(${4-humans} روبوت)`:''}</button>
          : <div style={{color:'rgba(240,237,229,.6)',fontSize:13}}>بانتظار أن يبدأ المضيف…</div>}
        <button onClick={leave} style={{...btn('rgba(255,255,255,.08)','rgba(240,237,229,.7)'),border:'1px solid rgba(255,255,255,.12)',fontWeight:700,fontSize:13,maxWidth:320,width:'100%'}}>مغادرة</button>
      </div>
    );
  }

  // ── TABLE ──
  const mode=st?.contract?.type||'sun';
  const trump=st?.contract?.trump||null;
  const myTurn=st&&st.phase==='playing'&&st.turn===mySeat;
  const myBid=st&&st.phase==='bidding'&&st.bidTurn===mySeat;
  const legalSet=myTurn?new Set(legalPlays(st.hands[mySeat],st.trick,mode,trump).map(c=>c.id)):null;
  const myHand=st?sortHand(st.hands[mySeat]||[],mode,trump):[];
  const rel=seat=>(seat-mySeat+4)%4; // 0 me(bottom),1 right,2 partner(top),3 left
  const seatName=seat=>players[seat]?players[seat].name:`روبوت ${['أ','ب','ج','د'][seat]}`;
  const myTeam=mySeat%2;
  const relPos={ 1:{right:8,top:'46%',transform:'translateY(-50%)'}, 2:{top:56,left:'50%',transform:'translateX(-50%)'}, 3:{left:8,top:'46%',transform:'translateY(-50%)'} };
  const trickPos={ 0:{bottom:4,left:'50%',transform:'translateX(-50%)'}, 1:{right:6,top:'50%',transform:'translateY(-50%)'}, 2:{top:4,left:'50%',transform:'translateX(-50%)'}, 3:{left:6,top:'50%',transform:'translateY(-50%)'} };

  return (
    <div style={{...panel,width:'100%',height:'100%',background:'radial-gradient(ellipse 90% 70% at 50% 50%,#0F2A14,#07090A)',position:'relative',overflow:'hidden'}}>
      {/* Header */}
      <div style={{position:'absolute',top:10,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 10px',zIndex:20}}>
        <button onClick={leave} style={{...btn('rgba(255,255,255,.08)','rgba(240,237,229,.7)'),padding:'5px 10px',fontSize:11,fontWeight:700,border:'1px solid rgba(255,255,255,.1)'}}>خروج</button>
        <div style={{padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700,border:'1.5px solid rgba(240,192,64,.4)',background:'rgba(240,192,64,.1)',color:'#F0C040'}}>{st?.contract?(st.contract.type==='sun'?'صن ☀️':`حكم ${st.contract.trump}`):'المزايدة'} · {room.code}</div>
        <div style={{background:'rgba(10,14,12,.8)',border:'1px solid rgba(240,192,64,.18)',borderRadius:10,padding:'4px 10px',fontSize:13,fontWeight:900}}>
          <span style={{color:'#F0C040'}}>لنا {st?.matchScores[myTeam]??0}</span><span style={{color:'rgba(240,237,229,.4)'}}> — </span><span style={{color:'rgba(240,237,229,.6)'}}>لهم {st?.matchScores[1-myTeam]??0}</span>
        </div>
      </div>

      {/* Opponents / partner */}
      {[1,2,3].map(rp=>{ const seat=(mySeat+rp)%4; const active=(st?.phase==='playing'&&st.turn===seat)||(st?.phase==='bidding'&&st.bidTurn===seat);
        return <div key={rp} style={{position:'absolute',...relPos[rp],zIndex:10,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
          <div style={{width:38,height:38,borderRadius:'50%',border:`2px solid ${active?'#2ECC71':(seat%2===myTeam?'#F0C040':'#7A5B1A')}`,background:'rgba(16,26,18,.9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,boxShadow:active?'0 0 12px rgba(46,204,113,.5)':'none'}}>{players[seat]?players[seat].avatar:'🤖'}</div>
          <span style={{color:active?'#2ECC71':'rgba(240,237,229,.6)',fontSize:10,fontWeight:700}}>{rp===2?`${seatName(seat)} (شريكك)`:seatName(seat)}</span>
          {st&&<Backs n={st.hands[seat].length}/>}
        </div>;
      })}

      {/* Trump */}
      {st?.contract?.type==='hokum'&&<div style={{position:'absolute',top:'50%',right:10,transform:'translateY(-50%)',zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'rgba(10,14,12,.7)',border:'1px solid rgba(240,192,64,.18)',borderRadius:10,padding:'6px 8px'}}>
        <span style={{fontSize:9,color:'rgba(240,237,229,.5)',fontWeight:700}}>الكوز</span>
        <span style={{fontSize:24,color:SUIT_COLOR(st.contract.trump)}}>{st.contract.trump}</span>
      </div>}

      {/* Trick */}
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:200,height:160,zIndex:15}}>
        {st?.trick.map(p=><Card key={p.card.id} card={p.card} style={{position:'absolute',...trickPos[rel(p.player)]}}/>) }
        {st?.phase==='bidding'&&<div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',color:'rgba(240,237,229,.4)',fontSize:12,whiteSpace:'nowrap'}}>{myBid?'دورك للمزايدة':`مزايدة ${seatName(st.bidTurn)}…`}</div>}
        {myTurn&&<div style={{position:'absolute',bottom:-6,left:'50%',transform:'translateX(-50%)',color:'#2ECC71',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>دورك 🎯</div>}
      </div>

      {/* Bidding panel */}
      {myBid&&<div style={{position:'absolute',bottom:118,left:0,right:0,display:'flex',flexWrap:'wrap',justifyContent:'center',gap:7,zIndex:40,padding:'0 12px'}}>
        <button onClick={()=>humanBid({type:'sun'})} style={{...btn('linear-gradient(135deg,#8B6914,#F0C040)','#07090A'),fontSize:12,padding:'8px 14px'}}>صن ☀️</button>
        {['♠','♥','♦','♣'].map(sy=><button key={sy} onClick={()=>humanBid({type:'hokum',trump:sy,trumpName:SUIT_NAME(sy)})} style={{...btn('rgba(16,26,18,.95)',SUIT_COLOR(sy)),border:'1.5px solid rgba(240,192,64,.35)',fontSize:16,padding:'6px 12px'}}>{sy}</button>)}
        <button onClick={()=>humanBid({type:'pass'})} style={{...btn('rgba(255,255,255,.08)','rgba(240,237,229,.7)'),border:'1px solid rgba(255,255,255,.12)',fontSize:12,padding:'8px 14px'}}>بس</button>
      </div>}

      {/* My hand */}
      <div style={{position:'absolute',bottom:10,left:0,right:0,height:100,zIndex:30,display:'flex',justifyContent:'center',alignItems:'flex-end'}}>
        {myHand.map((card,i)=>{ const n=myHand.length,sp=Math.min(30,220/Math.max(n,1)),off=(i-(n-1)/2)*sp,rot=(i-(n-1)/2)*3,lft=Math.abs(i-(n-1)/2)*1.4;
          const iS=sel===card.id, playable=!myTurn||legalSet.has(card.id);
          return <div key={card.id} onClick={()=>humanPlay(card)} style={{position:'absolute',left:`calc(50% + ${off}px - 26px)`,transform:`rotate(${rot}deg) translateY(${iS?-24:lft}px)`,zIndex:iS?90:i,transition:'transform .2s',opacity:playable?1:0.4}}>
            <Card card={card} style={{border:iS?'1px solid #2ECC71':undefined,boxShadow:iS?'0 0 0 2px rgba(46,204,113,.4),0 8px 20px rgba(0,0,0,.6)':undefined}}/>
          </div>;
        })}
      </div>

      {/* Round over */}
      {st?.phase==='roundOver'&&st.roundResult&&<div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:400}}>
        <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #7A5B1A',borderRadius:20,padding:'22px 26px',textAlign:'center',maxWidth:300}}>
          <div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'#F0C040',marginBottom:8}}>{st.roundResult.reason}</div>
          <div style={{color:'rgba(240,237,229,.6)',fontSize:13}}>لنا {st.matchScores[myTeam]} — لهم {st.matchScores[1-myTeam]}</div>
          <div style={{color:'rgba(240,237,229,.4)',fontSize:11,marginTop:10}}>الجولة القادمة تبدأ…</div>
        </div>
      </div>}

      {/* Game over */}
      {st?.phase==='gameOver'&&<div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:400,padding:20}}>
        <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #F0C040',borderRadius:22,padding:'32px 26px',textAlign:'center',maxWidth:320,width:'100%'}}>
          <div style={{fontSize:56}}>{st.matchScores[myTeam]>st.matchScores[1-myTeam]?'🏆':'💔'}</div>
          <div style={{fontFamily:"'Scheherazade New',serif",fontSize:26,color:'#F0C040',margin:'8px 0'}}>{st.matchScores[myTeam]>st.matchScores[1-myTeam]?'فاز فريقك!':'فاز الخصم'}</div>
          <div style={{color:'rgba(240,237,229,.6)',fontSize:13,marginBottom:16}}>لنا {st.matchScores[myTeam]} — لهم {st.matchScores[1-myTeam]}</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={leave} style={{...btn('rgba(255,255,255,.08)','rgba(240,237,229,.75)'),flex:1,border:'1px solid rgba(255,255,255,.12)',fontWeight:700}}>خروج</button>
            {isHost&&<button onClick={()=>{actedEvt.current=-1;rewarded.current=false;writeRoom({status:'playing',state:initGame()});}} style={{...btn('linear-gradient(135deg,#8B6914,#F0C040)','#07090A'),flex:1.4}}>مجدداً 🔄</button>}
          </div>
        </div>
      </div>}
    </div>
  );
}
