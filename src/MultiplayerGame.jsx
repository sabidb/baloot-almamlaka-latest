import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDocs, updateDoc, deleteDoc, onSnapshot, runTransaction, collection, query, where, limit, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { SUITS as CARD_SUITS, buildDeck, shuffle, dealHands, getHands, cardValue, trickWinner, calcResult, botPickCard, botBid, genCode, sounds, haptics, getThemeStyles } from './GameLogic';
import { ReactionBar, spawnReaction, spawnCoins } from './Reactions';
import { settleMultiplayerGame } from './functions';
import { useLang } from './i18n';

const RANKAR = {A:'أ',K:'ك',Q:'ق',J:'ج','10':'١٠','9':'٩','8':'٨','7':'٧'};
const BOT_NAMES = [{name:'محمد',avatar:'👲'},{name:'عبدالله',avatar:'🧔'},{name:'سعد',avatar:'🤴'},{name:'فهد',avatar:'🧙'}];
// Trick-pile placement keyed by RELATIVE seat (0=me/bottom,1=left,2=top,3=right)
const REL_POS = {0:{top:76,left:37,rot:-4},1:{top:40,left:4,rot:9},2:{top:2,left:37,rot:-7},3:{top:40,left:66,rot:6}};

const S={
  gold:{color:'#F0C040'},
  dim:{color:'rgba(240,237,229,.6)'},
  card:{width:54,height:78,borderRadius:10,background:'linear-gradient(145deg,#FEFDF8,#F0EBE0)',border:'1px solid rgba(0,0,0,.1)',boxShadow:'0 6px 20px rgba(0,0,0,.65)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'3px',position:'absolute',cursor:'pointer',touchAction:'manipulation'},
  btn:{padding:'11px 20px',borderRadius:11,border:'none',cursor:'pointer',fontFamily:'Changa,sans-serif',fontWeight:700,touchAction:'manipulation'},
  input:{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.12)',borderRadius:10,padding:'11px 13px',fontFamily:'Changa,sans-serif',fontSize:14,color:'#F0EDE5',width:'100%',outline:'none'},
  panel:{background:'linear-gradient(180deg,rgba(16,26,18,.97),rgba(8,12,10,.97))',border:'1px solid rgba(240,192,64,.25)',borderRadius:20,padding:'20px 18px',boxShadow:'0 20px 60px rgba(0,0,0,.6)'},
  page:{width:'100%',height:'100%',background:'radial-gradient(ellipse 90% 70% at 50% 50%,#0F2A14,#07090A)',position:'relative',overflow:'hidden',fontFamily:'Changa,sans-serif',direction:'rtl',color:'#F0EDE5'},
};

function CardFace({card,style,onClick,theme}){
  const sc=theme?theme.suitColor(card.suit):card.suit.color;
  const bg=theme?{background:theme.cardBg}:null;
  return(
    <div onClick={onClick} style={{...S.card,...bg,...style}}>
      <span style={{fontFamily:"Changa,sans-serif",fontSize:15,fontWeight:700,color:sc,alignSelf:'flex-start',lineHeight:1}}>{RANKAR[card.rank.symbol]}</span>
      <span style={{fontSize:20,color:sc,lineHeight:1}}>{card.suit.symbol}</span>
      <span style={{fontFamily:"Changa,sans-serif",fontSize:15,fontWeight:700,color:sc,alignSelf:'flex-end',transform:'rotate(180deg)',lineHeight:1}}>{RANKAR[card.rank.symbol]}</span>
    </div>
  );
}

function freshDeal(dealer){
  const {h0,h1,h2,h3}=dealHands(shuffle(buildDeck()));
  return{
    phase:'bidding',dealer,currentBidder:(dealer+1)%4,passCount:0,contract:null,
    h0,h1,h2,h3,trickPlays:[],tricksWon:0,roundScores:[0,0],
    scores:{a:0,b:0},roundResult:null,history:[],rev:0,
  };
}
const seatTeam=s=>s%2;

// ── Entry / Lobby ─────────────────────────────────────────
export default function MultiplayerScreen({profile,mode,onExit,onProfileUpdate}){
  const {t,dir}=useLang();
  const [stage,setStage]=useState('entry'); // entry|lobby|game
  const [roomCode,setRoomCode]=useState('');
  const [joinInput,setJoinInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  const startedRef=useRef(false);

  const me=()=>({uid:profile.uid,name:profile.name,avatar:profile.avatar,isBot:false,joinedAt:Date.now()});

  const createRoom=async(isPublic)=>{
    setBusy(true);setErr('');
    try{
      const code=genCode();
      await setDoc(doc(db,'rooms',code),{
        code,status:'waiting',public:isPublic,hostUid:profile.uid,
        players:[{...me(),seat:0}],createdAt:serverTimestamp(),gd:null,reaction:null,
      });
      setRoomCode(code);setStage('lobby');
    }catch(e){setErr(t('mp_createFail')+': '+(e.code||e.message));}
    setBusy(false);
  };

  const joinRoom=async(code)=>{
    setBusy(true);setErr('');
    try{
      await runTransaction(db,async tx=>{
        const ref=doc(db,'rooms',code);
        const snap=await tx.get(ref);
        if(!snap.exists())throw new Error(t('mp_roomNotFound'));
        const r=snap.data();
        if(r.players.some(p=>p.uid===profile.uid))return; // already in
        if(r.status!=='waiting')throw new Error(t('mp_gameStarted'));
        if(r.players.length>=4)throw new Error(t('mp_roomFull'));
        const used=r.players.map(p=>p.seat);
        const seat=[0,1,2,3].find(s=>!used.includes(s));
        tx.update(ref,{players:[...r.players,{...me(),seat}]});
      });
      setRoomCode(code);setStage('lobby');
    }catch(e){setErr(e.message||t('mp_joinFail'));}
    setBusy(false);
  };

  const quickMatch=async()=>{
    setBusy(true);setErr('');
    try{
      const q=query(collection(db,'rooms'),where('status','==','waiting'),where('public','==',true),limit(5));
      const snap=await getDocs(q);
      const open=snap.docs.map(d=>d.data()).find(r=>r.players.length<4&&!r.players.some(p=>p.uid===profile.uid));
      if(open){await joinRoom(open.code);return;}
      await createRoom(true);
    }catch(e){setErr(t('mp_searchFail')+': '+(e.code||e.message));setBusy(false);}
  };

  useEffect(()=>{
    // Guard must be set inside the callback: StrictMode's simulated remount
    // preserves refs but clears the first timer — a guard set in the effect
    // body would block the kickoff from ever running.
    const t=setTimeout(()=>{
      if(startedRef.current)return;
      startedRef.current=true;
      if(mode==='create')createRoom(false);
      else if(mode==='quick')quickMatch();
    },0);
    return()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  if(stage==='lobby')return <Lobby profile={profile} code={roomCode} onExit={onExit} onStart={()=>setStage('game')}/>;
  if(stage==='game')return <MPGame profile={profile} code={roomCode} onExit={onExit} onProfileUpdate={onProfileUpdate}/>;

  // entry (join by code / errors / spinners)
  return(
    <div style={{...S.page,direction:dir,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{...S.panel,width:'100%',maxWidth:340,textAlign:'center',animation:'popIn .3s ease both'}}>
        {mode==='join'?(
          <>
            <div style={{fontSize:34,marginBottom:6}}>🔑</div>
            <div style={{fontSize:16,fontWeight:800,color:'#F0C040',marginBottom:14}}>{t('mp_joinRoom')}</div>
            <input style={{...S.input,textAlign:'center',fontSize:22,letterSpacing:6,direction:'ltr'}} maxLength={6} inputMode="numeric" placeholder="000000" value={joinInput} onChange={e=>setJoinInput(e.target.value.replace(/\D/g,''))}/>
            {err&&<div style={{color:'#E74C3C',fontSize:12,marginTop:10}}>{err}</div>}
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button onClick={onExit} style={{...S.btn,flex:1,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)'}}>{t('back')}</button>
              <button disabled={busy||joinInput.length!==6} onClick={()=>joinRoom(joinInput)} style={{...S.btn,flex:2,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',opacity:joinInput.length===6?1:.5}}>{busy?'...':t('mp_joinBtn')+' ▶'}</button>
            </div>
          </>
        ):(
          <>
            <div style={{fontSize:34,marginBottom:6}}>{mode==='quick'?'⚡':'👥'}</div>
            <div style={{fontSize:15,fontWeight:700,color:'#F0C040',marginBottom:10}}>{err?t('mp_error'):mode==='quick'?t('mp_searching'):t('mp_creating')}</div>
            {err?(
              <>
                <div style={{color:'#E74C3C',fontSize:12,marginBottom:14}}>{err}</div>
                <button onClick={onExit} style={{...S.btn,width:'100%',background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)'}}>{t('back')}</button>
              </>
            ):(
              <div style={{display:'flex',justifyContent:'center'}}><div style={{width:30,height:30,border:'3px solid rgba(240,192,64,.2)',borderTopColor:'#F0C040',borderRadius:'50%',animation:'spin .8s linear infinite'}}/></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Lobby({profile,code,onExit,onStart}){
  const {t,dir}=useLang();
  const [room,setRoom]=useState(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,'rooms',code),snap=>{
      if(!snap.exists()){onExit();return;}
      const r=snap.data();
      setRoom(r);
      if(r.status==='playing')onStart();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[code]);

  const isHost=room?.hostUid===profile.uid;

  const startGame=async()=>{
    if(busy)return;setBusy(true);
    try{
      await runTransaction(db,async tx=>{
        const ref=doc(db,'rooms',code);
        const snap=await tx.get(ref);
        const r=snap.data();
        if(r.status!=='waiting')return;
        const used=r.players.map(p=>p.seat);
        const bots=[0,1,2,3].filter(s=>!used.includes(s)).map((s,i)=>({uid:'bot-'+s,...BOT_NAMES[i],isBot:true,seat:s,joinedAt:Date.now()}));
        tx.update(ref,{status:'playing',players:[...r.players,...bots],gd:freshDeal(3),startedAt:Date.now()});
      });
    }catch(e){console.error(e);}
    setBusy(false);
  };

  // Public rooms auto-start when full (host client triggers). Deferred to a
  // microtask so the transaction isn't kicked off synchronously in render.
  useEffect(()=>{
    if(!room||!isHost||room.status!=='waiting')return;
    if(room.public&&room.players.length===4){
      const t=setTimeout(startGame,0);
      return()=>clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[room?.players?.length,room?.status]);

  const leave=async()=>{
    try{
      if(isHost){await deleteDoc(doc(db,'rooms',code));}
      else{
        await runTransaction(db,async tx=>{
          const ref=doc(db,'rooms',code);
          const snap=await tx.get(ref);
          if(!snap.exists())return;
          tx.update(ref,{players:snap.data().players.filter(p=>p.uid!==profile.uid)});
        });
      }
    }catch{/* leaving best-effort */}
    onExit();
  };

  const share=()=>{
    const text=`🃏 ${t('appName')}\n${t('mp_shareCode')}: ${code}\nbaloot-almamlaka-latest.vercel.app`;
    if(navigator.share)navigator.share({title:t('appName'),text}).catch(()=>{});
    else navigator.clipboard?.writeText(text);
  };

  const players=room?.players||[];
  return(
    <div style={{...S.page,direction:dir,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,gap:16}}>
      <div style={{fontFamily:"Changa,sans-serif",fontSize:30,color:'#F0C040'}}>{t('mp_room')}</div>
      <div onClick={share} style={{display:'flex',alignItems:'center',gap:10,background:'rgba(240,192,64,.1)',border:'1px dashed rgba(240,192,64,.4)',borderRadius:14,padding:'10px 22px',cursor:'pointer'}}>
        <span style={{fontSize:26,fontWeight:800,letterSpacing:8,color:'#F0C040',direction:'ltr'}}>{code}</span>
        <span style={{fontSize:18}}>📋</span>
      </div>
      <div style={{...S.dim,fontSize:11}}>{t('mp_shareCode')} — {room?.public?t('mp_publicRoom'):t('mp_privateRoom')}</div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,width:'100%',maxWidth:320}}>
        {[0,1,2,3].map(seat=>{
          const p=players.find(x=>x.seat===seat);
          return(
            <div key={seat} style={{...S.panel,padding:'14px 10px',textAlign:'center',border:p?'1px solid rgba(46,204,113,.4)':'1px dashed rgba(255,255,255,.15)',animation:p?'popIn .3s ease both':'none'}}>
              <div style={{fontSize:30,marginBottom:4}}>{p?p.avatar:'💺'}</div>
              <div style={{fontSize:12,fontWeight:700,color:p?'#F0EDE5':'rgba(240,237,229,.35)'}}>{p?p.name:t('mp_emptySeat')}</div>
              <div style={{fontSize:9,color:'rgba(240,237,229,.5)',marginTop:2}}>{t('mp_teamLabel')} {seat%2===0?t('teamA'):t('teamB')}{p?.uid===room?.hostUid?' · '+t('mp_host')+' 👑':''}</div>
            </div>
          );
        })}
      </div>

      <div style={{display:'flex',gap:8,width:'100%',maxWidth:320}}>
        <button onClick={leave} style={{...S.btn,flex:1,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)'}}>{t('exit')}</button>
        {isHost&&<button onClick={startGame} disabled={busy} style={{...S.btn,flex:2,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A'}}>{players.length<4?t('mp_startBots'):t('mp_start')}</button>}
        {!isHost&&<div style={{flex:2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'rgba(240,237,229,.5)'}}>{t('mp_waitingHost')}</div>}
      </div>
    </div>
  );
}

// ── Live game ─────────────────────────────────────────────
function MPGame({profile,code,onExit,onProfileUpdate}){
  const {t:tt,dir}=useLang();
  const [room,setRoom]=useState(null);
  const [sel,setSel]=useState(null);
  const [pendingTrumpPick,setPendingTrumpPick]=useState(false);
  const [toast,setToast]=useState(null);
  const tn=useRef(0);
  const lastReactionRef=useRef(null);
  const settledRef=useRef(false);
  const botTimerRef=useRef(null);
  const showT=msg=>{tn.current++;setToast({msg,k:tn.current});setTimeout(()=>setToast(null),2400);};

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,'rooms',code),snap=>{
      if(!snap.exists()){onExit();return;}
      setRoom(snap.data());
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[code]);

  // Remote reactions
  useEffect(()=>{
    const r=room?.reaction;
    if(!r||r.n===lastReactionRef.current)return;
    lastReactionRef.current=r.n;
    if(r.uid!==profile.uid)spawnReaction(r.emoji,window.innerWidth/2-17,window.innerHeight/3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[room?.reaction?.n]);

  const gd=room?.gd;
  const players=room?.players||[];
  const mySeat=players.find(p=>p.uid===profile.uid)?.seat??0;
  const isHost=room?.hostUid===profile.uid;
  const rel=seat=>(seat-mySeat+4)%4;
  const bySeat=seat=>players.find(p=>p.seat===seat);
  const hands=gd?getHands(gd):[[],[],[],[]];
  const myHand=hands[mySeat]||[];

  // Guarded transactional game mutation: expect() re-checks state inside the
  // transaction so concurrent host/player writes can't double-apply.
  const txMove=async(expect,apply)=>{
    try{
      await runTransaction(db,async tx=>{
        const ref=doc(db,'rooms',code);
        const snap=await tx.get(ref);
        if(!snap.exists())return;
        const cur=snap.data().gd;
        if(!cur||!expect(cur))return;
        tx.update(ref,{gd:{...cur,...apply(cur),rev:(cur.rev||0)+1}});
      });
    }catch(e){console.error('txMove',e);}
  };

  const applyBid=(cur,seat,bid)=>{
    if(bid.type==='pass'){
      const np=(cur.passCount||0)+1;
      if(np>=4)return{...freshDeal((cur.dealer+1)%4),scores:cur.scores,history:cur.history};
      return{passCount:np,currentBidder:(seat+1)%4};
    }
    return{contract:{type:bid.type,trump:bid.trump||null,bidTeam:seatTeam(seat),bidderSeat:seat},phase:'playing',currentPlayer:(cur.dealer+1)%4};
  };

  const applyPlay=(cur,seat,card)=>{
    const hkey='h'+seat;
    return{[hkey]:cur[hkey].filter(c=>c.id!==card.id),trickPlays:[...cur.trickPlays,{seat,card}],currentPlayer:(seat+1)%4};
  };

  const resolveTrick=cur=>{
    const winnerPlay=trickWinner(cur.trickPlays,cur.contract.type,cur.contract.trump);
    const value=cur.trickPlays.reduce((s,p)=>s+cardValue(p.card,cur.contract.type,cur.contract.trump),0);
    const wTeam=seatTeam(winnerPlay.seat);
    const roundScores=[...cur.roundScores];roundScores[wTeam]+=value;
    const nt=cur.tricksWon+1;
    if(nt>=8){
      const result=calcResult(roundScores,cur.contract);
      const scores={...cur.scores};
      const bidKey=cur.contract.bidTeam===0?'a':'b',oppKey=cur.contract.bidTeam===0?'b':'a';
      scores[bidKey]+=result.bidTeamFinal;scores[oppKey]+=result.oppTeamFinal;
      const history=[...(cur.history||[]),{contract:cur.contract,roundScores,result:{made:result.made,isGahwa:result.isGahwa}}];
      const over=scores.a>=152||scores.b>=152;
      return{trickPlays:[],tricksWon:nt,roundScores,scores,roundResult:{...result,reason:result.reason},phase:over?'gameOver':'roundEnd',history,lastWinner:{seat:winnerPlay.seat,value}};
    }
    return{trickPlays:[],tricksWon:nt,roundScores,currentPlayer:winnerPlay.seat,lastWinner:{seat:winnerPlay.seat,value}};
  };

  // ── HOST engine: bots bid/play + trick resolution + redeal ──
  useEffect(()=>{
    if(!isHost||!gd)return;
    clearTimeout(botTimerRef.current);
    const rev=gd.rev;

    if(gd.phase==='bidding'){
      const seat=gd.currentBidder;
      if(bySeat(seat)?.isBot){
        botTimerRef.current=setTimeout(()=>{
          const bid=botBid(hands[seat],gd.passCount||0);
          txMove(c=>c.rev===rev&&c.phase==='bidding'&&c.currentBidder===seat,c=>applyBid(c,seat,bid));
        },900);
      }
    }else if(gd.phase==='playing'){
      if(gd.trickPlays.length>=4){
        botTimerRef.current=setTimeout(()=>{
          txMove(c=>c.rev===rev&&c.phase==='playing'&&c.trickPlays.length>=4,c=>resolveTrick(c));
        },1100);
      }else{
        const seat=gd.currentPlayer;
        if(bySeat(seat)?.isBot){
          botTimerRef.current=setTimeout(()=>{
            const card=botPickCard(hands[seat],gd.trickPlays,gd.contract.type,gd.contract.trump);
            txMove(c=>c.rev===rev&&c.phase==='playing'&&c.currentPlayer===seat&&c.trickPlays.length<4,c=>applyPlay(c,seat,card));
          },850);
        }
      }
    }
    return()=>clearTimeout(botTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isHost,gd?.rev,gd?.phase]);

  // Trick winner toast + sounds for everyone
  const lastWinnerRef=useRef(null);
  useEffect(()=>{
    const lw=gd?.lastWinner;
    if(!lw)return;
    const k=gd.rev;
    if(lastWinnerRef.current===k)return;
    lastWinnerRef.current=k;
    if(gd.trickPlays.length===0&&gd.phase!=='bidding'){
      showT(`${bySeat(lw.seat)?.name||''} ${tt('tookTrick')} (+${lw.value}) 🏆`);
      sounds.win();
      if(seatTeam(lw.seat)===seatTeam(mySeat))haptics.win();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[gd?.rev]);

  // Settlement: the server referee credits every player from the
  // authoritative room state (idempotent, so all clients may call it).
  // The host additionally writes the match telemetry doc.
  useEffect(()=>{
    if(gd?.phase!=='gameOver'||settledRef.current)return;
    settledRef.current=true;
    const myTeamWon=(gd.scores.a>=gd.scores.b?0:1)===seatTeam(mySeat);
    const coinDelta=myTeamWon?50:10;
    if(myTeamWon){haptics.win();setTimeout(()=>spawnCoins(window.innerWidth/2,window.innerHeight*0.4),300);setTimeout(()=>spawnCoins(window.innerWidth/2,window.innerHeight*0.4,12),700);}
    (async()=>{
      try{await settleMultiplayerGame(code);}catch{/* referee unreachable — server reconciles later */}
    })();
    // Optimistic local update; refreshed from Firestore on next profile read.
    onProfileUpdate&&onProfileUpdate({wins:(profile.wins||0)+(myTeamWon?1:0),losses:(profile.losses||0)+(myTeamWon?0:1),coins:(profile.coins||0)+coinDelta});
    if(isHost){
      (async()=>{
        try{
          await addDoc(collection(db,'matches'),{
            mode:'multiplayer',roomCode:code,
            players:players.map(p=>({uid:p.uid,seat:p.seat,isBot:!!p.isBot,name:p.name})),
            scores:gd.scores,history:gd.history||[],
            startedAt:room.startedAt||null,endedAt:Date.now(),createdAt:serverTimestamp(),
          });
        }catch{/* telemetry best-effort */}
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[gd?.phase]);

  // ── Human actions ──
  const humanBid=type=>{
    if(type==='hokum'){setPendingTrumpPick(true);return;}
    setPendingTrumpPick(false);
    txMove(c=>c.phase==='bidding'&&c.currentBidder===mySeat,c=>applyBid(c,mySeat,{type}));
  };
  const pickTrump=suit=>{
    setPendingTrumpPick(false);
    txMove(c=>c.phase==='bidding'&&c.currentBidder===mySeat,c=>applyBid(c,mySeat,{type:'hokum',trump:suit.symbol}));
  };

  const ledSuit=gd?.trickPlays?.length?gd.trickPlays[0].card.suit.symbol:null;
  const hasLed=ledSuit?myHand.some(c=>c.suit.symbol===ledSuit):false;
  const isPlayable=card=>gd?.phase==='playing'&&gd.currentPlayer===mySeat&&gd.trickPlays.length<4&&(!ledSuit||!hasLed||card.suit.symbol===ledSuit);

  const onCardClick=(e,card,idx)=>{
    if(!isPlayable(card))return;
    if(sel!==idx){setSel(idx);return;}
    setSel(null);
    haptics.slam();sounds.play();
    txMove(c=>c.phase==='playing'&&c.currentPlayer===mySeat&&c.trickPlays.length<4,c=>applyPlay(c,mySeat,card));
  };

  const continueRound=()=>{
    txMove(c=>c.phase==='roundEnd',c=>({...freshDeal((c.dealer+1)%4),scores:c.scores,history:c.history}));
  };

  const sendReaction=emoji=>{
    updateDoc(doc(db,'rooms',code),{reaction:{uid:profile.uid,emoji,n:Date.now()}}).catch(()=>{});
  };

  if(!room||!gd)return(
    <div style={{...S.page,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:30,height:30,border:'3px solid rgba(240,192,64,.2)',borderTopColor:'#F0C040',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
    </div>
  );

  const theme=getThemeStyles(profile);
  const trumpInfo=gd.contract?.trump?CARD_SUITS.find(s=>s.symbol===gd.contract.trump):null;
  const myTeamKey=seatTeam(mySeat)===0?'a':'b';
  const winnerTeam=gd.scores.a>=gd.scores.b?0:1;
  const active=seat=>(gd.phase==='bidding'&&gd.currentBidder===seat)||(gd.phase==='playing'&&gd.currentPlayer===seat&&gd.trickPlays.length<4);

  return(
    <div style={{...S.page,background:theme.feltGrad,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(94vw,380px)',height:'min(94vw,380px)',borderRadius:'50%',border:`2px solid ${theme.rail}55`,boxShadow:`inset 0 0 60px ${theme.rail}22,0 0 40px ${theme.rail}18`,pointerEvents:'none',zIndex:0}}/>
      {toast&&<div key={toast.k} style={{position:'fixed',top:'calc(env(safe-area-inset-top,0px) + 12px)',left:'50%',transform:'translateX(-50%)',background:'rgba(8,12,10,.95)',border:'1px solid #7A5B1A',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:700,color:'#F0C040',whiteSpace:'nowrap',zIndex:9000,pointerEvents:'none',animation:'fadeUp .35s ease both'}}>{toast.msg}</div>}

      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(82vw,320px)',height:'min(82vw,320px)',borderRadius:'50%',border:'1px solid rgba(240,192,64,.15)',pointerEvents:'none',zIndex:1,animation:'spin 60s linear infinite'}}/>

      {/* Header */}
      <div style={{position:'absolute',top:'calc(env(safe-area-inset-top,0px) + 8px)',left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 10px',zIndex:20}}>
        <button onClick={onExit} style={{...S.btn,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)',fontSize:11,padding:'5px 10px'}}>{tt('exit')}</button>
        <div style={{padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:700,border:'1.5px solid rgba(240,192,64,.3)',background:'rgba(240,192,64,.08)',color:'#F0C040'}}>
          {gd.phase==='bidding'?'🗣️ '+tt('bidding'):gd.contract?.type==='sun'?'☀️ '+tt('sun'):trumpInfo?`${tt('hokum')} ${trumpInfo.symbol}`:'—'}
          <span style={{marginInlineStart:8,opacity:.6,fontSize:10}}>{tt('tourn_room')} {code}</span>
        </div>
        <div style={{background:'rgba(10,14,12,.8)',border:'1px solid rgba(240,192,64,.18)',borderRadius:10,padding:'4px 10px',fontSize:13,fontWeight:800}}>
          <span style={S.gold}>{gd.scores[myTeamKey]}</span><span style={S.dim}> — </span><span style={S.gold}>{gd.scores[myTeamKey==='a'?'b':'a']}</span>
        </div>
      </div>

      {/* Other players (relative seats 1=left,2=top,3=right) */}
      {[1,2,3].map(r=>{
        const seat=(mySeat+r)%4;
        const p=bySeat(seat);
        const pos=r===2?{top:'calc(env(safe-area-inset-top,0px) + 54px)',left:'50%',transform:'translateX(-50%)'}:r===1?{left:8,top:'50%',transform:'translateY(-50%)'}:{right:8,top:'50%',transform:'translateY(-50%)'};
        const a=active(seat);
        return(
          <div key={r} style={{position:'absolute',...pos,display:'flex',flexDirection:'column',alignItems:'center',gap:3,zIndex:10}}>
            <div style={{width:38,height:38,borderRadius:'50%',border:`2px solid ${a?'#F0C040':'#7A5B1A'}`,background:'rgba(16,26,18,.9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,animation:a?'turnGlow 1.1s ease-in-out infinite':'none'}}>{p?.avatar||'🧔'}</div>
            <span style={{color:a?'#F0C040':'rgba(240,237,229,.6)',fontSize:10,fontWeight:700}}>{p?.name||'…'}{p?.isBot?' 🤖':''}</span>
            {a&&<span style={{color:'rgba(240,192,64,.7)',fontSize:9}}>{gd.phase==='bidding'?tt('bidding_ing'):tt('thinking')}</span>}
            {gd.phase==='playing'&&!a&&<div style={{fontSize:9,color:'rgba(240,237,229,.35)'}}>🂠×{hands[seat]?.length||0}</div>}
          </div>
        );
      })}

      {/* Trump badge */}
      <div style={{position:'absolute',top:'calc(env(safe-area-inset-top,0px) + 58px)',right:8,zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'rgba(10,14,12,.7)',border:'1px solid rgba(240,192,64,.18)',borderRadius:10,padding:'6px 8px'}}>
        <span style={{fontSize:9,color:'rgba(240,237,229,.5)',fontWeight:700}}>{tt('trump')}</span>
        <span style={{fontSize:26,filter:'drop-shadow(0 0 8px rgba(240,192,64,.5))',color:trumpInfo?(trumpInfo.isRed?'#E74C3C':'#F0EDE5'):'rgba(240,237,229,.3)'}}>{gd.contract?.type==='sun'?'☀️':trumpInfo?trumpInfo.symbol:'?'}</span>
      </div>

      {/* Trick pile */}
      {gd.phase==='playing'&&(
        <div style={{position:'relative',width:190,height:150,zIndex:20}}>
          {gd.trickPlays.map((p,i)=>{
            const pos=REL_POS[rel(p.seat)];
            return <CardFace key={p.card.id} card={p.card} theme={theme} style={{top:pos.top,left:pos.left+'%',transform:`rotate(${pos.rot}deg)`,zIndex:i+1,animation:'popIn .3s ease both',cursor:'default'}}/>;
          })}
          {gd.trickPlays.length===0&&<div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',color:'rgba(240,237,229,.35)',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{gd.currentPlayer===mySeat?tt('yourTurn'):`${tt('turnOf')} ${bySeat(gd.currentPlayer)?.name||''}`}</div>}
        </div>
      )}

      {/* Bid panel */}
      {gd.phase==='bidding'&&gd.currentBidder===mySeat&&(
        <div style={{...S.panel,position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px) + 124px)',width:'min(88vw,320px)',zIndex:40,animation:'popIn .3s ease both'}}>
          {!pendingTrumpPick?(
            <>
              <div style={{textAlign:'center',fontSize:13,fontWeight:800,color:'#F0C040',marginBottom:12}}>{tt('yourBidTurn')} 🗣️</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>humanBid('hokum')} style={{...S.btn,flex:1,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',fontSize:13,padding:'11px 6px'}}>{tt('hokum')}</button>
                <button onClick={()=>humanBid('sun')} style={{...S.btn,flex:1,background:'linear-gradient(135deg,#B8860B,#FFD166)',color:'#07090A',fontSize:13,padding:'11px 6px'}}>☀️ {tt('sun')}</button>
                <button onClick={()=>humanBid('pass')} style={{...S.btn,flex:1,background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',border:'1px solid rgba(255,255,255,.1)',fontSize:13,padding:'11px 6px'}}>{tt('pass')}</button>
              </div>
            </>
          ):(
            <>
              <div style={{textAlign:'center',fontSize:13,fontWeight:800,color:'#F0C040',marginBottom:12}}>{tt('chooseTrump')}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {CARD_SUITS.map(s=>(
                  <button key={s.symbol} onClick={()=>pickTrump(s)} style={{...S.btn,display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:'rgba(255,255,255,.06)',border:`1.5px solid ${s.isRed?'#c0392b':'#666'}`,color:s.isRed?'#E74C3C':'#F0EDE5',fontSize:13,padding:'11px 6px'}}>
                    <span style={{fontSize:20}}>{s.symbol}</span>{s.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* My hand */}
      <div style={{position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px) + 8px)',left:0,right:0,height:106,zIndex:30,display:'flex',justifyContent:'center',alignItems:'flex-end'}}>
        {myHand.map((card,i)=>{
          const n=myHand.length,sp=Math.min(27,200/Math.max(n,1)),off=(i-(n-1)/2)*sp,rot=(i-(n-1)/2)*3.5,lft=Math.abs(i-(n-1)/2)*1.5,iS=sel===i,playable=isPlayable(card);
          return(
            <CardFace key={card.id} card={card} theme={theme} onClick={e=>onCardClick(e,card,i)} style={{left:`calc(50% + ${off}px - 27px)`,transform:`rotate(${rot}deg) translateY(${iS?-26:lft}px) scale(${iS?1.07:1})`,zIndex:iS?90:i+1,border:`1px solid ${iS?'#2ECC71':'rgba(0,0,0,.12)'}`,boxShadow:iS?'0 0 0 2px rgba(46,204,113,.35),0 8px 22px rgba(0,0,0,.7)':'0 8px 22px rgba(0,0,0,.65)',opacity:gd.phase==='playing'&&!playable?.4:1,filter:gd.phase==='playing'&&!playable?'grayscale(.5)':'none',cursor:gd.phase==='playing'&&!playable?'default':'pointer',transition:'transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,opacity .2s',animation:`dealIn .4s ${i*0.05}s ease both`}}/>
          );
        })}
      </div>

      {/* Round end */}
      {gd.phase==='roundEnd'&&gd.roundResult&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}}>
          <div style={{...S.panel,textAlign:'center',width:'100%',maxWidth:320,animation:'popIn .4s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{fontSize:48,marginBottom:6}}>{gd.roundResult.isGahwa?'☕':gd.roundResult.made?'✅':'❌'}</div>
            <div style={{fontFamily:"Changa,sans-serif",fontSize:22,color:'#F0C040',marginBottom:10}}>{gd.roundResult.reason}</div>
            <div style={{display:'flex',justifyContent:'center',gap:28,margin:'12px 0 18px'}}>
              {[[tt('teamA'),gd.scores.a],[tt('teamB'),gd.scores.b]].map(([lbl,v])=>(
                <div key={lbl} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <span style={{fontSize:30,fontWeight:800,color:'#F0C040',lineHeight:1}}>{v}</span>
                  <span style={{color:'rgba(240,237,229,.6)',fontSize:11}}>{tt('mp_teamLabel')} {lbl}</span>
                </div>
              ))}
            </div>
            {isHost?(
              <button onClick={continueRound} style={{...S.btn,width:'100%',padding:13,fontSize:15,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A'}}>{tt('nextRound')} ▶</button>
            ):(
              <div style={{fontSize:12,color:'rgba(240,237,229,.5)'}}>{tt('mp_waitingHost')}</div>
            )}
          </div>
        </div>
      )}

      {/* Game over */}
      {gd.phase==='gameOver'&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}}>
          <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #F0C040',borderRadius:22,padding:'34px 26px',textAlign:'center',boxShadow:'0 0 40px rgba(240,192,64,.25)',width:'100%',maxWidth:320,animation:'popIn .5s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{fontSize:58}}>{winnerTeam===seatTeam(mySeat)?'🏆':'💔'}</div>
            <div style={{fontFamily:"Changa,sans-serif",fontSize:28,color:'#F0C040',margin:'10px 0 5px'}}>{winnerTeam===seatTeam(mySeat)?tt('mp_yourTeamWins'):tt('mp_yourTeamLost')}</div>
            <div style={{display:'flex',justifyContent:'center',gap:28,margin:'18px 0'}}>
              {[[tt('teamA'),gd.scores.a,winnerTeam===0],[tt('teamB'),gd.scores.b,winnerTeam===1]].map(([lbl,v,w])=>(
                <div key={lbl} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <span style={{fontSize:34,fontWeight:800,color:w?'#F0C040':'rgba(240,237,229,.4)',lineHeight:1}}>{v}</span>
                  <span style={{color:'rgba(240,237,229,.6)',fontSize:11}}>{tt('mp_teamLabel')} {lbl}</span>
                </div>
              ))}
            </div>
            <button onClick={onExit} style={{...S.btn,width:'100%',padding:13,fontSize:15,background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A'}}>{tt('nav_home')}</button>
          </div>
        </div>
      )}

      <ReactionBar onSend={sendReaction}/>
    </div>
  );
}
