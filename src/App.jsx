import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase';
import {
  doc, setDoc, onSnapshot, updateDoc, getDoc
} from 'firebase/firestore';

// ── Data ──────────────────────────────────────────────────
const SUITS = [
  { symbol: '♠', name: 'بستوني', color: '#1a1a2e' },
  { symbol: '♥', name: 'كبة',    color: '#c0392b' },
  { symbol: '♦', name: 'ديناري', color: '#c0392b' },
  { symbol: '♣', name: 'جاروني', color: '#1a1a2e' },
];
const RANKS = [
  { symbol: 'A',  nameAr: 'إيس',  hokumPlain:11, hokumTrump:11, sun:11 },
  { symbol: 'K',  nameAr: 'كينق', hokumPlain:4,  hokumTrump:4,  sun:4  },
  { symbol: 'Q',  nameAr: 'بنت',  hokumPlain:3,  hokumTrump:3,  sun:3  },
  { symbol: 'J',  nameAr: 'جاك',  hokumPlain:2,  hokumTrump:20, sun:2  },
  { symbol: '10', nameAr: '١٠',   hokumPlain:10, hokumTrump:10, sun:10 },
  { symbol: '9',  nameAr: '٩',    hokumPlain:0,  hokumTrump:14, sun:0  },
  { symbol: '8',  nameAr: '٨',    hokumPlain:0,  hokumTrump:0,  sun:0  },
  { symbol: '7',  nameAr: '٧',    hokumPlain:0,  hokumTrump:0,  sun:0  },
];
const HOKUM_TRUMP_ORDER = ['J','9','A','10','K','Q','8','7'];
const PLAIN_ORDER       = ['A','10','K','Q','J','9','8','7'];
const TEAM_COLORS = ['#4ADE80','#60A5FA'];
const AVATARS = ['🧑','👩','👨','👧'];

// ── Core Functions ────────────────────────────────────────
function buildDeck() {
  const d = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      d.push({ suit, rank, id:`${rank.symbol}${suit.symbol}` });
  return d;
}
function shuffle(deck) {
  const d = [...deck];
  for (let i=d.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [d[i],d[j]]=[d[j],d[i]];
  }
  return d;
}
function deal(deck) {
  return [deck.slice(0,8),deck.slice(8,16),deck.slice(16,24),deck.slice(24,32)];
}
function cardValue(card,mode,trump) {
  if(!card) return 0;
  if(mode==='sun') return card.rank.sun;
  return card.suit.symbol===trump?card.rank.hokumTrump:card.rank.hokumPlain;
}
function cardStrength(card,mode,trump) {
  const isTrump=mode==='hokum'&&card.suit.symbol===trump;
  const order=isTrump?HOKUM_TRUMP_ORDER:PLAIN_ORDER;
  return isTrump?100+(order.length-order.indexOf(card.rank.symbol))
    :order.length-order.indexOf(card.rank.symbol);
}
function trickWinner(plays,mode,trump) {
  const ledSuit=plays[0].card.suit.symbol;
  return plays.reduce((best,cur)=>{
    const bT=mode==='hokum'&&best.card.suit.symbol===trump;
    const cT=mode==='hokum'&&cur.card.suit.symbol===trump;
    if(cT&&!bT) return cur;
    if(bT&&!cT) return best;
    if(!cT&&cur.card.suit.symbol!==ledSuit) return best;
    if(!bT&&best.card.suit.symbol!==ledSuit) return cur;
    return cardStrength(cur.card,mode,trump)>cardStrength(best.card,mode,trump)?cur:best;
  });
}
function calculateRoundResult(roundScores,contract) {
  const {type,bidTeam}=contract;
  const bidScore=roundScores[bidTeam];
  const oppScore=roundScores[1-bidTeam];
  const total=bidScore+oppScore;
  const isGahwa=oppScore===0;
  if(type==='sun') {
    const made=bidScore>oppScore;
    return {
      made,isGahwa,
      bidTeamFinal:made?total*2:0,
      oppTeamFinal:made?0:total*2,
      reason:made?(isGahwa?'☕ صن + قهوة!':'☀️ صن نجح!'):'☀️ صن فشل!',
    };
  }
  if(isGahwa) return {
    made:true,isGahwa:true,
    bidTeamFinal:total*2,oppTeamFinal:0,
    reason:'☕ قهوة! ضعف النقاط!',
  };
  const made=bidScore>=82;
  return {
    made,isGahwa:false,
    bidTeamFinal:made?bidScore:0,
    oppTeamFinal:made?oppScore:total,
    reason:made?`✅ حكم نجح! (${bidScore}≥82)`:`❌ حكم فشل!`,
  };
}

// ── Bot Logic ─────────────────────────────────────────────
function botPickCard(hand,trickPlays,mode,trump) {
  const ledSuit=trickPlays.length>0?trickPlays[0].card.suit.symbol:null;
  if(ledSuit) {
    const following=hand.filter(c=>c.suit.symbol===ledSuit);
    if(following.length>0)
      return following.sort((a,b)=>cardStrength(b,mode,trump)-cardStrength(a,mode,trump))[0];
    const trumpCards=hand.filter(c=>c.suit.symbol===trump&&mode==='hokum');
    if(trumpCards.length>0)
      return trumpCards.sort((a,b)=>cardStrength(b,mode,trump)-cardStrength(a,mode,trump))[0];
  }
  return [...hand].sort((a,b)=>cardValue(a,mode,trump)-cardValue(b,mode,trump))[0];
}
function botBid(hand,passCount) {
  let bestSuit=null,bestScore=0;
  for(const suit of SUITS) {
    const sc=hand.filter(c=>c.suit.symbol===suit.symbol).reduce((s,c)=>{
      if(c.rank.symbol==='J') return s+5;
      if(c.rank.symbol==='9') return s+4;
      if(c.rank.symbol==='A') return s+3;
      return s+1;
    },0);
    if(sc>bestScore){bestScore=sc;bestSuit=suit;}
  }
  if(bestScore>=6||passCount>=2) return{type:'hokum',trump:bestSuit.symbol,trumpName:bestSuit.name};
  return{type:'pass'};
}
function generateRoomCode() {
  return Math.floor(100000+Math.random()*900000).toString();
}

// ── Card Component ────────────────────────────────────────
function Card({card,mode,trump,highlight,winner,onClick,disabled,faceDown,small}) {
  const isTrump=mode==='hokum'&&card?.suit?.symbol===trump;
  const val=card?cardValue(card,mode,trump):0;
  const isRed=card?.suit?.color==='#c0392b';
  const w=small?42:54; const h=small?62:78;
  if(faceDown) return(
    <div style={{width:w,height:h,borderRadius:8,margin:3,
      background:'linear-gradient(135deg,#006C35,#004D26)',
      border:'2px solid #C9A84C44',display:'flex',
      alignItems:'center',justifyContent:'center',fontSize:16}}>🃏</div>
  );
  return(
    <div onClick={!disabled?onClick:undefined} style={{
      width:w,height:h,
      background:winner?'#fffbe6':highlight?'#f0fff4':'#fff',
      border:`2px solid ${winner?'#C9A84C':highlight?'#2ECC71':isTrump?'#C9A84C88':'#ddd'}`,
      borderRadius:9,display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'space-between',
      padding:'3px 2px',
      boxShadow:winner?'0 0 14px #C9A84C':highlight?'0 0 8px #2ECC7188':'0 2px 6px #0002',
      cursor:disabled?'default':'pointer',
      transform:winner?'scale(1.12) translateY(-4px)':highlight?'translateY(-6px)':'none',
      transition:'all 0.2s ease',margin:3,position:'relative',flexShrink:0,
    }}>
      <div style={{fontSize:small?9:10,fontWeight:900,
        color:isRed?'#c0392b':'#1a1a2e',alignSelf:'flex-start',paddingLeft:2}}>
        {card.rank.symbol}
      </div>
      <div style={{fontSize:small?16:20,color:isRed?'#c0392b':'#1a1a2e',lineHeight:1}}>
        {card.suit.symbol}
      </div>
      <div style={{fontSize:small?8:9,color:isRed?'#c0392b':'#1a1a2e',fontWeight:700}}>
        {card.rank.nameAr}
      </div>
      {val>0&&(
        <div style={{position:'absolute',top:-6,right:-6,
          background:isTrump?'#C9A84C':'#1B6B3A',color:'#fff',
          borderRadius:'50%',width:15,height:15,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:7,fontWeight:900,border:'1.5px solid white'}}>{val}</div>
      )}
      {isTrump&&<div style={{position:'absolute',top:-9,left:'50%',
        transform:'translateX(-50%)',fontSize:9}}>👑</div>}
      {winner&&<div style={{position:'absolute',bottom:-12,left:'50%',
        transform:'translateX(-50%)',fontSize:12}}>🏆</div>}
    </div>
  );
}

// ── Bidding Modal ─────────────────────────────────────────
function BiddingModal({playerIndex,onBid,canSun,passCount,playerName}) {
  const [step,setStep]=useState('choose');
  return(
    <div style={{position:'fixed',inset:0,background:'#000b',
      display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:100,padding:16}}>
      <div style={{background:'#0D2A1A',border:'2px solid #C9A84C',
        borderRadius:16,padding:24,maxWidth:320,width:'100%',
        boxShadow:'0 0 40px #C9A84C44'}}>
        <div style={{textAlign:'center',marginBottom:16}}>
          <div style={{fontSize:28}}>{AVATARS[playerIndex%4]}</div>
          <div style={{color:'#C9A84C',fontWeight:900,fontSize:17,marginTop:4}}>
            {playerName||`اللاعب ${playerIndex+1}`} — دورك للمزايدة
          </div>
          <div style={{color:'#888',fontSize:11,marginTop:3}}>
            {passCount>0?`${passCount} پاس قبلك`:'أنت أول من يزايد'}
          </div>
        </div>
        {step==='choose'?(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <button onClick={()=>setStep('pickSuit')} style={{
              background:'#1B6B3A',color:'#fff',border:'2px solid #2ECC71',
              borderRadius:10,padding:'13px',fontWeight:800,cursor:'pointer',fontSize:15}}>
              🎯 حكم — اختر الأتو
            </button>
            {canSun&&(
              <button onClick={()=>onBid({type:'sun'})} style={{
                background:'#6B4A00',color:'#FFD166',border:'2px solid #C9A84C',
                borderRadius:10,padding:'13px',fontWeight:800,cursor:'pointer',fontSize:15}}>
                ☀️ صن — بدون أتو (2×)
              </button>
            )}
            <button onClick={()=>onBid({type:'pass'})} style={{
              background:'transparent',color:'#888',border:'1.5px solid #555',
              borderRadius:10,padding:'11px',fontWeight:700,cursor:'pointer',fontSize:13}}>
              ⏭ پاس
            </button>
          </div>
        ):(
          <div>
            <div style={{color:'#4ADE80',fontWeight:700,marginBottom:12,
              textAlign:'center',fontSize:14}}>اختر لون الأتو 👑</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {SUITS.map(s=>(
                <button key={s.symbol}
                  onClick={()=>onBid({type:'hokum',trump:s.symbol,trumpName:s.name})}
                  style={{
                    background:s.color==='#c0392b'?'#3a0a0a':'#0a0a2a',
                    color:s.color==='#c0392b'?'#ff6b6b':'#aad4ff',
                    border:`2px solid ${s.color==='#c0392b'?'#c0392b':'#2a2a6e'}`,
                    borderRadius:10,padding:'14px 10px',
                    fontWeight:800,cursor:'pointer',fontSize:22,textAlign:'center'}}>
                  {s.symbol}
                  <div style={{fontSize:11,marginTop:4}}>{s.name}</div>
                </button>
              ))}
            </div>
            <button onClick={()=>setStep('choose')} style={{
              marginTop:10,background:'transparent',color:'#888',
              border:'1px solid #555',borderRadius:8,padding:'8px',
              cursor:'pointer',fontSize:11,width:'100%'}}>← رجوع</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Round End Screen ──────────────────────────────────────
function RoundEndScreen({result,contract,roundScores,gameScore,onNext,matchWinner}) {
  return(
    <div style={{position:'fixed',inset:0,background:'#000c',
      display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:200,padding:16}}>
      <div style={{background:'#0D2A1A',
        border:`2px solid ${result.isGahwa?'#C9A84C':result.made?'#2ECC71':'#EF476F'}`,
        borderRadius:16,padding:24,maxWidth:340,width:'100%'}}>
        <div style={{textAlign:'center',fontSize:48,marginBottom:8}}>
          {result.isGahwa?'☕':result.made?'🎉':'😔'}
        </div>
        <div style={{textAlign:'center',
          color:result.isGahwa?'#C9A84C':result.made?'#4ADE80':'#EF476F',
          fontWeight:900,fontSize:16,marginBottom:16}}>{result.reason}</div>
        <div style={{display:'flex',gap:10,marginBottom:14}}>
          {[0,1].map(t=>(
            <div key={t} style={{flex:1,background:'#071f10',borderRadius:10,
              padding:'10px',textAlign:'center',
              border:`1px solid ${contract.bidTeam===t?'#2ECC7133':'#1a2a1a'}`}}>
              <div style={{color:TEAM_COLORS[t],fontWeight:700,fontSize:11}}>
                Team {t===0?'A':'B'}
                {contract.bidTeam===t&&<span style={{color:'#C9A84C'}}> 📋</span>}
              </div>
              <div style={{color:'#888',fontSize:10,marginBottom:2}}>
                جولة: {roundScores[t]}
              </div>
              <div style={{color:'#C9A84C',fontSize:22,fontWeight:900}}>
                +{contract.bidTeam===t?result.bidTeamFinal:result.oppTeamFinal}
              </div>
            </div>
          ))}
        </div>
        <div style={{background:'#071f10',borderRadius:10,padding:12,marginBottom:16}}>
          <div style={{color:'#C9A84C',fontSize:11,fontWeight:700,
            marginBottom:8,textAlign:'center'}}>
            🏆 المباراة — أول فريق يصل 152
          </div>
          {[0,1].map(t=>(
            <div key={t} style={{marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',
                fontSize:11,marginBottom:3}}>
                <span style={{color:TEAM_COLORS[t],fontWeight:700}}>
                  Team {t===0?'A':'B'}
                </span>
                <span style={{color:'#C9A84C'}}>{gameScore[t]} / 152</span>
              </div>
              <div style={{height:6,background:'#1a2a1a',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:3,
                  width:`${Math.min((gameScore[t]/152)*100,100)}%`,
                  background:TEAM_COLORS[t],transition:'width 0.6s ease'}}/>
              </div>
            </div>
          ))}
        </div>
        {matchWinner!==null?(
          <div style={{textAlign:'center'}}>
            <div style={{color:'#C9A84C',fontWeight:900,fontSize:20,marginBottom:12}}>
              🏆 Team {matchWinner===0?'A':'B'} فازت!
            </div>
            <button onClick={onNext} style={{
              background:'#C9A84C',color:'#000',border:'none',
              borderRadius:10,padding:'12px 32px',
              fontWeight:900,cursor:'pointer',fontSize:16,width:'100%'}}>
              🔄 مباراة جديدة
            </button>
          </div>
        ):(
          <button onClick={onNext} style={{
            background:'#1B6B3A',color:'#fff',border:'none',
            borderRadius:10,padding:'12px',fontWeight:800,
            cursor:'pointer',fontSize:15,width:'100%'}}>
            ▶ جولة جديدة
          </button>
        )}
      </div>
    </div>
  );
}

// ── Lobby Screen ──────────────────────────────────────────
function LobbyScreen({roomCode,players,isHost,onStart,myIndex,shareLink}) {
  const [copied,setCopied]=useState(false);
  const safePlayers=players||[];
  const copy=()=>{
    navigator.clipboard?.writeText(shareLink).then(()=>{
      setCopied(true);
      setTimeout(()=>setCopied(false),2000);
    });
  };
  return(
    <div style={{minHeight:'100vh',background:'#0D4A2A',
      display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',padding:20,
      fontFamily:'Segoe UI,Tahoma,sans-serif'}}>
      <h1 style={{color:'#C9A84C',fontSize:28,fontWeight:900,margin:'0 0 4px'}}>
        🃏 بلوت المملكة
      </h1>
      <p style={{color:'#888',fontSize:13,margin:'0 0 24px'}}>
        {isHost?'أنت المضيف — شارك الكود':'انتظر المضيف'}
      </p>
      <div style={{background:'#071f10',border:'2px solid #C9A84C',
        borderRadius:16,padding:'20px 32px',marginBottom:20,textAlign:'center'}}>
        <div style={{color:'#888',fontSize:11,marginBottom:6}}>كود الغرفة</div>
        <div style={{color:'#C9A84C',fontSize:44,fontWeight:900,letterSpacing:8}}>
          {roomCode}
        </div>
      </div>
      <button onClick={copy} style={{
        background:copied?'#1B6B3A':'#0a3a1e',
        color:copied?'#4ADE80':'#888',
        border:`1.5px solid ${copied?'#4ADE80':'#555'}`,
        borderRadius:10,padding:'10px 20px',
        fontWeight:700,cursor:'pointer',fontSize:13,
        marginBottom:12,width:'100%',maxWidth:320}}>
        {copied?'✅ تم النسخ!':'📋 انسخ رابط الدعوة'}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(`تحداني في بلوت المملكة! 🃏\nكود: ${roomCode}\n${shareLink}`)}`}
        target="_blank" rel="noreferrer"
        style={{background:'#25D366',color:'#fff',borderRadius:10,
          padding:'10px 20px',fontWeight:700,fontSize:13,
          textDecoration:'none',display:'block',textAlign:'center',
          marginBottom:20,width:'100%',maxWidth:316,boxSizing:'border-box'}}>
        📱 شارك عبر واتساب
      </a>
      <div style={{width:'100%',maxWidth:320,marginBottom:20}}>
        <div style={{color:'#888',fontSize:11,marginBottom:8,textAlign:'center'}}>
          اللاعبون ({safePlayers.filter(p=>p).length}/4)
        </div>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{
            background:safePlayers[i]?'#0a2a0a':'#071f10',
            border:`1px solid ${safePlayers[i]?TEAM_COLORS[i%2]+'44':'#1a2a1a'}`,
            borderRadius:10,padding:'10px 14px',marginBottom:6,
            display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>{safePlayers[i]?AVATARS[i%4]:'⬜'}</span>
            <div>
              <div style={{color:safePlayers[i]?TEAM_COLORS[i%2]:'#444',
                fontWeight:700,fontSize:13}}>
                {safePlayers[i]||`اللاعب ${i+1}`}
                {i===myIndex&&<span style={{color:'#C9A84C',fontSize:10}}> (أنت)</span>}
              </div>
              <div style={{color:'#555',fontSize:10}}>Team {i%2===0?'A':'B'}</div>
            </div>
            {safePlayers[i]&&(
              <div style={{marginRight:'auto',background:'#2ECC7133',
                color:'#4ADE80',borderRadius:10,padding:'2px 8px',
                fontSize:9,fontWeight:700}}>متصل ✓</div>
            )}
          </div>
        ))}
      </div>
      {isHost&&safePlayers.filter(p=>p).length>=2?(
        <button onClick={onStart} style={{
          background:'linear-gradient(135deg,#C9A84C,#F0C060)',
          color:'#000',border:'none',borderRadius:14,
          padding:'14px 40px',fontWeight:900,
          cursor:'pointer',fontSize:18,width:'100%',maxWidth:320,
          boxShadow:'0 4px 20px #C9A84C44'}}>
          🎮 ابدأ اللعبة!
        </button>
      ):isHost?(
        <div style={{color:'#888',fontSize:12,textAlign:'center'}}>
          انتظر لاعب واحد على الأقل...
        </div>
      ):null}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState('home');
  const [playerName,setPlayerName]=useState('');
  const [joinCode,setJoinCode]=useState('');
  const [roomCode,setRoomCode]=useState('');
  const [myIndex,setMyIndex]=useState(0);
  const [isHost,setIsHost]=useState(false);
  const [error,setError]=useState('');
  const [gameData,setGameData]=useState(null);
  const [timer,setTimer]=useState(10);
  const unsubRef=useRef(null);
  const botRef=useRef(null);
  const timerRef=useRef(null);
  const roomCodeRef=useRef('');
  const myIndexRef=useRef(0);
  const isHostRef=useRef(false);
  const gameDataRef=useRef(null);

  // Keep refs in sync
  useEffect(()=>{roomCodeRef.current=roomCode;},[roomCode]);
  useEffect(()=>{myIndexRef.current=myIndex;},[myIndex]);
  useEffect(()=>{isHostRef.current=isHost;},[isHost]);
  useEffect(()=>{gameDataRef.current=gameData;},[gameData]);

  const shareLink=typeof window!=='undefined'
    ?`${window.location.origin}?room=${roomCode}`:'';

  // Check URL params on load
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const room=params.get('room');
    if(room){setJoinCode(room);}
  },[]);

  // Subscribe to Firestore room
  const subscribeRoom=useCallback((code)=>{
    if(unsubRef.current) unsubRef.current();
    unsubRef.current=onSnapshot(
      doc(db,'rooms',code),
      (snap)=>{
        if(snap.exists()){
          const data=snap.data();
          setGameData(data);
          // Auto switch screens based on phase
          if(['bidding','playing','roundEnd'].includes(data.phase)){
            setScreen('game');
          } else if(data.phase==='lobby'){
            setScreen('lobby');
          }
        }
      },
      (err)=>{console.error('Firestore error:',err);}
    );
  },[]);

  useEffect(()=>()=>{
    if(unsubRef.current) unsubRef.current();
  },[]);

  // Create room
  const createRoom=async()=>{
    if(!playerName.trim()){setError('أدخل اسمك أولاً');return;}
    setError('');
    try {
      const code=generateRoomCode();
      await setDoc(doc(db,'rooms',code),{
        phase:'lobby',
        players:[playerName.trim(),null,null,null],
        hands:[[],[],[],[]],
        bids:[],
        contract:null,
        biddingTurn:0,
        trickPlays:[],
        leader:0,
        roundScores:[0,0],
        gameScore:[0,0],
        trickResult:null,
        roundResult:null,
        matchWinner:null,
        hostIndex:0,
        createdAt:Date.now(),
      });
      setRoomCode(code);
      roomCodeRef.current=code;
      setMyIndex(0);
      myIndexRef.current=0;
      setIsHost(true);
      isHostRef.current=true;
      subscribeRoom(code);
      // setScreen handled by onSnapshot
    } catch(e){
      setError('فشل الاتصال: '+e.message);
    }
  };

  // Join room
  const joinRoom=async()=>{
    if(!playerName.trim()){setError('أدخل اسمك أولاً');return;}
    if(!joinCode.trim()){setError('أدخل كود الغرفة');return;}
    setError('');
    try {
      const code=joinCode.trim();
      const snap=await getDoc(doc(db,'rooms',code));
      if(!snap.exists()){setError('الغرفة غير موجودة!');return;}
      const data=snap.data();
      const emptySlot=data.players.findIndex(p=>!p);
      if(emptySlot===-1){setError('الغرفة ممتلئة!');return;}
      const newPlayers=[...data.players];
      newPlayers[emptySlot]=playerName.trim();
      await updateDoc(doc(db,'rooms',code),{players:newPlayers});
      setRoomCode(code);
      roomCodeRef.current=code;
      setMyIndex(emptySlot);
      myIndexRef.current=emptySlot;
      setIsHost(false);
      isHostRef.current=false;
      subscribeRoom(code);
      // setScreen handled by onSnapshot
    } catch(e){
      setError('فشل الاتصال: '+e.message);
    }
  };

  // Start game
  const startGame=async()=>{
    const code=roomCodeRef.current;
    if(!code) return;
    const shuffled=shuffle(buildDeck());
    const hands=deal(shuffled);
    await updateDoc(doc(db,'rooms',code),{
      phase:'bidding',hands,bids:[],
      contract:null,biddingTurn:0,
      trickPlays:[],leader:0,
      roundScores:[0,0],trickResult:null,
      roundResult:null,matchWinner:null,
    });
  };

  // Handle bid
  const handleBid=async(bid)=>{
    const gd=gameDataRef.current;
    const code=roomCodeRef.current;
    if(!gd||!code) return;
    const newBids=[...gd.bids,{playerIndex:gd.biddingTurn,...bid}];
    if(bid.type==='pass') {
      if(newBids.filter(b=>b.type==='pass').length===4) {
        const shuffled=shuffle(buildDeck());
        await updateDoc(doc(db,'rooms',code),{
          hands:deal(shuffled),bids:[],biddingTurn:0});
        return;
      }
      await updateDoc(doc(db,'rooms',code),{
        bids:newBids,biddingTurn:(gd.biddingTurn+1)%4});
    } else {
      await updateDoc(doc(db,'rooms',code),{
        bids:newBids,
        contract:{type:bid.type,trump:bid.trump||null,
          trumpName:bid.trumpName||null,
          bidder:gd.biddingTurn,bidTeam:gd.biddingTurn%2},
        phase:'playing',
      });
    }
  };

  // Play card
  const playCard=async(card)=>{
    const gd=gameDataRef.current;
    const code=roomCodeRef.current;
    const mi=myIndexRef.current;
    if(!gd||!code||!gd.contract) return;
    const {trickPlays,leader,contract,roundScores,hands}=gd;
    const newPlays=[...trickPlays,{playerIndex:mi,card}];
    const newHands=hands.map((h,i)=>
      i===mi?h.filter(c=>c.id!==card.id):h);
    if(newPlays.length===4) {
      const mode=contract.type,trump=contract.trump;
      const winner=trickWinner(newPlays,mode,trump);
      let pts=newPlays.reduce((s,p)=>s+cardValue(p.card,mode,trump),0);
      if(mode==='sun') pts*=2;
      const winTeam=winner.playerIndex%2;
      const newRS=[...roundScores];
      newRS[winTeam]+=pts;
      const trickResult={winner,pts,winTeam};
      if(newHands[0].length===0) {
        const result=calculateRoundResult(newRS,contract);
        const newGS=[...gd.gameScore];
        newGS[contract.bidTeam]+=result.bidTeamFinal;
        newGS[1-contract.bidTeam]+=result.oppTeamFinal;
        const mw=newGS[0]>=152?0:newGS[1]>=152?1:null;
        await updateDoc(doc(db,'rooms',code),{
          trickPlays:newPlays,hands:newHands,
          roundScores:newRS,trickResult,
          gameScore:newGS,roundResult:result,
          matchWinner:mw,phase:'roundEnd'});
      } else {
        await updateDoc(doc(db,'rooms',code),{
          trickPlays:newPlays,hands:newHands,
          roundScores:newRS,trickResult});
      }
    } else {
      await updateDoc(doc(db,'rooms',code),{
        trickPlays:newPlays,hands:newHands});
    }
  };

  // Next trick
  const nextTrick=async()=>{
    const gd=gameDataRef.current;
    const code=roomCodeRef.current;
    if(!gd?.trickResult||!code) return;
    await updateDoc(doc(db,'rooms',code),{
      leader:gd.trickResult.winner.playerIndex,
      trickPlays:[],trickResult:null});
  };

  // New round
  const newRound=async(resetMatch=false)=>{
    const gd=gameDataRef.current;
    const code=roomCodeRef.current;
    if(!code) return;
    const shuffled=shuffle(buildDeck());
    await updateDoc(doc(db,'rooms',code),{
      phase:'bidding',hands:deal(shuffled),bids:[],
      contract:null,biddingTurn:0,trickPlays:[],
      leader:0,roundScores:[0,0],trickResult:null,
      roundResult:null,matchWinner:null,
      gameScore:resetMatch?[0,0]:gd?.gameScore||[0,0]});
  };

  // Bot bidding (host only)
  useEffect(()=>{
    const gd=gameData;
    if(!gd||gd.phase!=='bidding'||!isHostRef.current) return;
    const bt=gd.biddingTurn;
    if(gd.players[bt]) return;
    clearTimeout(botRef.current);
    botRef.current=setTimeout(async()=>{
      const gd2=gameDataRef.current;
      const code=roomCodeRef.current;
      if(!gd2||!code) return;
      const hand=gd2.hands[bt];
      if(!hand?.length) return;
      const bid=botBid(hand,gd2.bids.filter(b=>b.type==='pass').length);
      const newBids=[...gd2.bids,{playerIndex:bt,...bid}];
      if(bid.type==='pass') {
        if(newBids.filter(b=>b.type==='pass').length===4) {
          await updateDoc(doc(db,'rooms',code),{
            hands:deal(shuffle(buildDeck())),bids:[],biddingTurn:0});
          return;
        }
        await updateDoc(doc(db,'rooms',code),{
          bids:newBids,biddingTurn:(bt+1)%4});
      } else {
        await updateDoc(doc(db,'rooms',code),{
          bids:newBids,
          contract:{type:bid.type,trump:bid.trump||null,
            trumpName:bid.trumpName||null,bidder:bt,bidTeam:bt%2},
          phase:'playing'});
      }
    },1500);
  },[gameData?.biddingTurn,gameData?.phase]);

  // Bot playing (host only)
  useEffect(()=>{
    const gd=gameData;
    if(!gd||gd.phase!=='playing'||gd.trickResult||!isHostRef.current) return;
    const {leader,trickPlays,contract,hands,players}=gd;
    const activePIdx=(leader+trickPlays.length)%4;
    if(players[activePIdx]) return;
    clearTimeout(botRef.current);
    botRef.current=setTimeout(async()=>{
      const gd2=gameDataRef.current;
      const code=roomCodeRef.current;
      if(!gd2||!code||!gd2.contract) return;
      const hand=gd2.hands[activePIdx];
      if(!hand?.length) return;
      const card=botPickCard(hand,gd2.trickPlays,
        gd2.contract.type,gd2.contract.trump);
      if(!card) return;
      const newPlays=[...gd2.trickPlays,{playerIndex:activePIdx,card}];
      const newHands=gd2.hands.map((h,i)=>
        i===activePIdx?h.filter(c=>c.id!==card.id):h);
      if(newPlays.length===4) {
        const mode=gd2.contract.type,trump=gd2.contract.trump;
        const winner=trickWinner(newPlays,mode,trump);
        let pts=newPlays.reduce((s,p)=>s+cardValue(p.card,mode,trump),0);
        if(mode==='sun') pts*=2;
        const winTeam=winner.playerIndex%2;
        const newRS=[...gd2.roundScores];
        newRS[winTeam]+=pts;
        if(newHands[0].length===0) {
          const result=calculateRoundResult(newRS,gd2.contract);
          const newGS=[...gd2.gameScore];
          newGS[gd2.contract.bidTeam]+=result.bidTeamFinal;
          newGS[1-gd2.contract.bidTeam]+=result.oppTeamFinal;
          const mw=newGS[0]>=152?0:newGS[1]>=152?1:null;
          await updateDoc(doc(db,'rooms',code),{
            trickPlays:newPlays,hands:newHands,
            roundScores:newRS,trickResult:{winner,pts,winTeam},
            gameScore:newGS,roundResult:result,
            matchWinner:mw,phase:'roundEnd'});
        } else {
          await updateDoc(doc(db,'rooms',code),{
            trickPlays:newPlays,hands:newHands,
            roundScores:newRS,trickResult:{winner,pts,winTeam}});
        }
      } else {
        await updateDoc(doc(db,'rooms',code),{
          trickPlays:newPlays,hands:newHands});
      }
    },3000);
  },[gameData?.trickPlays?.length,gameData?.phase,gameData?.trickResult]);

  // Timer
  useEffect(()=>{
    clearInterval(timerRef.current);
    const gd=gameData;
    if(!gd||gd.phase!=='playing'||gd.trickResult) return;
    const mi=myIndexRef.current;
    const activePIdx=(gd.leader+gd.trickPlays.length)%4;
    if(activePIdx!==mi) return;
    setTimer(10);
    timerRef.current=setInterval(()=>{
      setTimer(t=>{
        if(t<=1) {
          clearInterval(timerRef.current);
          const gd2=gameDataRef.current;
          const hand=gd2?.hands?.[mi];
          if(hand?.length>0) {
            const card=[...hand].sort((a,b)=>
              cardValue(a,gd2.contract.type,gd2.contract.trump)-
              cardValue(b,gd2.contract.type,gd2.contract.trump))[0];
            playCard(card);
          }
          return 0;
        }
        return t-1;
      });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[gameData?.trickPlays?.length,gameData?.phase,gameData?.trickResult]);

  // ── Render ─────────────────────────────────────────────
  const gd=gameData;

  // HOME
  if(screen==='home') return(
    <div style={{minHeight:'100vh',
      background:'radial-gradient(ellipse at center,#1a5c35,#0D4A2A 50%,#071f10)',
      display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',padding:20,
      fontFamily:'Segoe UI,Tahoma,sans-serif'}}>
      <div style={{fontSize:64,marginBottom:8}}>🃏</div>
      <h1 style={{color:'#C9A84C',fontSize:32,fontWeight:900,margin:'0 0 4px'}}>
        بلوت المملكة
      </h1>
      <p style={{color:'#888',fontSize:14,margin:'0 0 32px'}}>
        اللعبة الأصيلة — العب مع أصدقائك
      </p>
      <div style={{width:'100%',maxWidth:300,
        display:'flex',flexDirection:'column',gap:12}}>
        <input
          value={playerName}
          onChange={e=>setPlayerName(e.target.value)}
          placeholder="اسمك..."
          style={{background:'#0a2a0a',border:'1.5px solid #2ECC71',
            borderRadius:10,padding:'12px 16px',color:'#fff',
            fontSize:15,textAlign:'center',outline:'none',
            fontFamily:'inherit',direction:'rtl'}}
        />
        {error&&(
          <div style={{color:'#EF476F',fontSize:12,
            textAlign:'center',padding:'8px',
            background:'#3a0a0a',borderRadius:8}}>
            {error}
          </div>
        )}
        <button
          onClick={createRoom}
          style={{
            background:'linear-gradient(135deg,#C9A84C,#F0C060)',
            color:'#000',border:'none',borderRadius:12,
            padding:'14px',fontWeight:900,cursor:'pointer',fontSize:16}}>
          🏠 إنشاء غرفة جديدة
        </button>
        <div style={{color:'#555',textAlign:'center',fontSize:12}}>أو</div>
        <input
          value={joinCode}
          onChange={e=>setJoinCode(e.target.value)}
          placeholder="كود الغرفة..."
          maxLength={6}
          style={{background:'#0a1a2a',border:'1.5px solid #60A5FA',
            borderRadius:10,padding:'12px 16px',color:'#fff',
            fontSize:18,textAlign:'center',letterSpacing:6,
            outline:'none',fontFamily:'inherit'}}
        />
        <button
          onClick={joinRoom}
          style={{
            background:'#1a3a6b',color:'#60A5FA',
            border:'1.5px solid #60A5FA',borderRadius:12,
            padding:'14px',fontWeight:800,cursor:'pointer',fontSize:16}}>
          🚪 انضم لغرفة
        </button>
      </div>
    </div>
  );

  // LOBBY
  if(screen==='lobby') return(
    <LobbyScreen
      roomCode={roomCode}
      players={gd?.players||[playerName,null,null,null]}
      isHost={isHost}
      onStart={startGame}
      myIndex={myIndex}
      shareLink={shareLink}
    />
  );

  // GAME
  if(screen==='game'&&gd) {
    const contract=gd.contract;
    const hands=gd.hands||[[],[],[],[]];
    const myHand=hands[myIndex]||[];
    const activePIdx=gd.phase==='playing'&&!gd.trickResult
      ?(gd.leader+gd.trickPlays.length)%4:-1;
    const isMyTurn=activePIdx===myIndex;
    const isBiddingTurn=gd.phase==='bidding'&&gd.biddingTurn===myIndex;

    return(
      <div style={{minHeight:'100vh',
        background:'radial-gradient(ellipse at center,#1a5c35,#0D4A2A 50%,#071f10)',
        fontFamily:'Segoe UI,Tahoma,sans-serif',
        color:'#E8E0D0',padding:'12px 10px',userSelect:'none'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
          <div>
            <h1 style={{color:'#C9A84C',fontSize:18,margin:0,fontWeight:900}}>
              🃏 بلوت المملكة
            </h1>
            {contract&&(
              <div style={{fontSize:10,color:'#888',marginTop:1}}>
                {contract.type==='hokum'
                  ?`أتو: ${contract.trumpName} ${contract.trump} 👑`
                  :'☀️ صن'}
                {' · '}{roomCode}
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:6}}>
            {[0,1].map(t=>(
              <div key={t} style={{background:'#071f10',
                border:`1.5px solid ${TEAM_COLORS[t]}44`,
                borderRadius:20,padding:'4px 12px',textAlign:'center'}}>
                <div style={{color:TEAM_COLORS[t],fontSize:9,fontWeight:700}}>
                  Team {t===0?'A':'B'}
                </div>
                <div style={{color:'#C9A84C',fontSize:16,fontWeight:900,lineHeight:1}}>
                  {gd.gameScore?.[t]||0}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bidding */}
        {gd.phase==='bidding'&&(
          <>
            <div style={{background:'#071f10',borderRadius:10,
              padding:10,marginBottom:10,border:'1px solid #C9A84C33'}}>
              <div style={{color:'#C9A84C',fontWeight:700,fontSize:11,marginBottom:6}}>
                🃏 يدك
              </div>
              <div style={{display:'flex',flexWrap:'wrap'}}>
                {myHand.map(card=>(
                  <Card key={card.id} card={card} mode='hokum' trump='' disabled/>
                ))}
              </div>
            </div>
            {isBiddingTurn?(
              <BiddingModal
                playerIndex={myIndex}
                playerName={gd.players?.[myIndex]||'أنت'}
                onBid={handleBid}
                canSun={gd.bids?.length>=1}
                passCount={gd.bids?.filter(b=>b.type==='pass').length||0}
              />
            ):(
              <div style={{position:'fixed',inset:0,background:'#000b',
                display:'flex',alignItems:'center',justifyContent:'center',
                zIndex:100}}>
                <div style={{background:'#0D2A1A',border:'2px solid #1B6B3A',
                  borderRadius:16,padding:24,textAlign:'center'}}>
                  <div style={{fontSize:32}}>{AVATARS[gd.biddingTurn%4]}</div>
                  <div style={{color:'#4ADE80',fontSize:16,fontWeight:700,marginTop:8}}>
                    {gd.players?.[gd.biddingTurn]||`اللاعب ${gd.biddingTurn+1}`} يفكر...
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Playing */}
        {(gd.phase==='playing'||gd.phase==='roundEnd')&&contract&&(
          <div>
            <div style={{
              background:contract.type==='sun'?'#3a2a00':'#0a2a0a',
              border:`1.5px solid ${contract.type==='sun'?'#C9A84C':'#2ECC71'}`,
              borderRadius:10,padding:'7px 14px',marginBottom:10,
              display:'flex',gap:10,alignItems:'center'}}>
              <div style={{fontSize:16}}>
                {contract.type==='sun'?'☀️':'🎯'}
              </div>
              <div>
                <div style={{color:contract.type==='sun'?'#C9A84C':'#4ADE80',
                  fontWeight:800,fontSize:13}}>
                  {contract.type==='hokum'
                    ?`حكم — أتو: ${contract.trumpName} ${contract.trump} 👑`
                    :'صن ☀️ (2×)'}
                </div>
                <div style={{color:'#888',fontSize:10}}>
                  {gd.players?.[contract.bidder]||`P${contract.bidder+1}`}
                  {' · '}Team {contract.bidTeam===0?'A':'B'}
                </div>
              </div>
            </div>

            <div style={{display:'flex',gap:8,marginBottom:10}}>
              {[0,1].map(t=>(
                <div key={t} style={{flex:1,background:'#071f10',
                  border:`1px solid ${TEAM_COLORS[t]}33`,
                  borderRadius:10,padding:'6px 10px',
                  display:'flex',justifyContent:'space-between',
                  alignItems:'center'}}>
                  <div style={{color:TEAM_COLORS[t],fontWeight:700,fontSize:11}}>
                    Team {t===0?'A':'B'}
                    {contract.bidTeam===t&&
                      <span style={{color:'#C9A84C',fontSize:9}}> 📋</span>}
                  </div>
                  <div style={{color:'#C9A84C',fontSize:18,fontWeight:900}}>
                    {gd.roundScores?.[t]||0}
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={{
              background:'radial-gradient(ellipse,#1a5c35,#0D4A2A)',
              border:'3px solid #C9A84C44',borderRadius:20,padding:12,
              marginBottom:10,minHeight:260,
              boxShadow:'inset 0 0 40px #00000044'}}>

              {/* Top */}
              <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
                {(()=>{
                  const pIdx=(myIndex+2)%4;
                  const isActive=activePIdx===pIdx;
                  return(
                    <div style={{textAlign:'center'}}>
                      <div style={{display:'inline-flex',alignItems:'center',gap:4,
                        background:isActive?`${TEAM_COLORS[pIdx%2]}22`:'#0a1a0a',
                        border:`1.5px solid ${isActive?TEAM_COLORS[pIdx%2]:'#1a2a1a'}`,
                        borderRadius:20,padding:'3px 10px',marginBottom:4}}>
                        <span>{AVATARS[pIdx%4]}</span>
                        <span style={{color:isActive?TEAM_COLORS[pIdx%2]:'#888',
                          fontSize:11,fontWeight:700}}>
                          {gd.players?.[pIdx]||`P${pIdx+1}`}
                        </span>
                      </div>
                      <div style={{display:'flex',flexWrap:'wrap',
                        justifyContent:'center',maxWidth:200}}>
                        {(hands[pIdx]||[]).map((_,j)=>(
                          <Card key={j} faceDown small
                            card={{suit:{symbol:'',color:''},rank:{symbol:'',nameAr:''}}}
                            mode='' trump=''/>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Middle */}
              <div style={{display:'flex',alignItems:'center',
                justifyContent:'space-between',marginBottom:8}}>

                {/* Left */}
                {(()=>{
                  const pIdx=(myIndex+1)%4;
                  const isActive=activePIdx===pIdx;
                  return(
                    <div style={{textAlign:'center'}}>
                      <div style={{display:'inline-flex',alignItems:'center',gap:4,
                        background:isActive?`${TEAM_COLORS[pIdx%2]}22`:'#0a1a0a',
                        border:`1.5px solid ${isActive?TEAM_COLORS[pIdx%2]:'#1a2a1a'}`,
                        borderRadius:20,padding:'3px 8px',marginBottom:4}}>
                        <span>{AVATARS[pIdx%4]}</span>
                        <span style={{color:isActive?TEAM_COLORS[pIdx%2]:'#888',
                          fontSize:10,fontWeight:700}}>
                          {gd.players?.[pIdx]||`P${pIdx+1}`}
                        </span>
                      </div>
                      <div style={{display:'flex',flexDirection:'column'}}>
                        {(hands[pIdx]||[]).map((_,j)=>(
                          <Card key={j} faceDown small
                            card={{suit:{symbol:'',color:''},rank:{symbol:'',nameAr:''}}}
                            mode='' trump=''/>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Center trick */}
                <div style={{flex:1,display:'flex',flexDirection:'column',
                  alignItems:'center',justifyContent:'center',gap:4}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,
                    padding:8,background:'#00000022',borderRadius:12,
                    border:'1px solid #C9A84C22',minWidth:120,minHeight:90}}>
                    {[2,1,3,0].map(relIdx=>{
                      const pIdx=(myIndex+relIdx)%4;
                      const play=gd.trickPlays?.find(p=>p.playerIndex===pIdx);
                      return(
                        <div key={pIdx} style={{display:'flex',
                          flexDirection:'column',alignItems:'center',
                          justifyContent:'center',minHeight:48}}>
                          {play?(
                            <>
                              <div style={{color:'#888',fontSize:8,marginBottom:1}}>
                                {gd.players?.[pIdx]||`P${pIdx+1}`}
                              </div>
                              <Card card={play.card}
                                mode={contract.type} trump={contract.trump}
                                winner={gd.trickResult?.winner.playerIndex===pIdx}
                                disabled small/>
                            </>
                          ):(
                            <div style={{width:34,height:50,borderRadius:6,
                              border:'1px dashed #C9A84C33',
                              display:'flex',alignItems:'center',
                              justifyContent:'center',
                              color:'#C9A84C22',fontSize:16}}>•</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {gd.trickResult&&(
                    <div style={{textAlign:'center'}}>
                      <div style={{color:'#C9A84C',fontSize:11,fontWeight:700}}>
                        🏆 {gd.players?.[gd.trickResult.winner.playerIndex]||
                          `P${gd.trickResult.winner.playerIndex+1}`}
                        {' '}+{gd.trickResult.pts}
                      </div>
                      {gd.phase==='playing'&&(
                        <button onClick={nextTrick} style={{
                          marginTop:4,background:'#C9A84C',color:'#000',
                          border:'none',borderRadius:8,padding:'5px 14px',
                          fontWeight:800,cursor:'pointer',fontSize:11}}>
                          التالي ▶
                        </button>
                      )}
                    </div>
                  )}

                  {!gd.trickResult&&activePIdx>=0&&(
                    <div style={{color:isMyTurn?'#4ADE80':'#888',
                      fontSize:10,textAlign:'center'}}>
                      {isMyTurn?'🟢 دورك!':
                        `⏳ ${gd.players?.[activePIdx]||`P${activePIdx+1}`}...`}
                    </div>
                  )}
                </div>

                {/* Right */}
                {(()=>{
                  const pIdx=(myIndex+3)%4;
                  const isActive=activePIdx===pIdx;
                  return(
                    <div style={{textAlign:'center'}}>
                      <div style={{display:'inline-flex',alignItems:'center',gap:4,
                        background:isActive?`${TEAM_COLORS[pIdx%2]}22`:'#0a1a0a',
                        border:`1.5px solid ${isActive?TEAM_COLORS[pIdx%2]:'#1a2a1a'}`,
                        borderRadius:20,padding:'3px 8px',marginBottom:4}}>
                        <span>{AVATARS[pIdx%4]}</span>
                        <span style={{color:isActive?TEAM_COLORS[pIdx%2]:'#888',
                          fontSize:10,fontWeight:700}}>
                          {gd.players?.[pIdx]||`P${pIdx+1}`}
                        </span>
                      </div>
                      <div style={{display:'flex',flexDirection:'column'}}>
                        {(hands[pIdx]||[]).map((_,j)=>(
                          <Card key={j} faceDown small
                            card={{suit:{symbol:'',color:''},rank:{symbol:'',nameAr:''}}}
                            mode='' trump=''/>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* My hand */}
              <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                  <span style={{fontSize:16}}>{AVATARS[myIndex%4]}</span>
                  <span style={{color:isMyTurn?'#4ADE80':'#888',
                    fontWeight:700,fontSize:12}}>
                    {gd.players?.[myIndex]||'أنت'}
                    {isMyTurn&&(
                      <span style={{background:'#4ADE80',color:'#000',
                        fontSize:9,padding:'1px 7px',
                        borderRadius:10,fontWeight:800,marginRight:6}}>
                        دورك ▶
                      </span>
                    )}
                  </span>
                  {isMyTurn&&timer>0&&(
                    <div style={{
                      background:timer<=3?'#EF476F':timer<=6?'#F39C12':'#2ECC71',
                      color:'#fff',borderRadius:'50%',width:22,height:22,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:11,fontWeight:900}}>{timer}</div>
                  )}
                </div>
                {isMyTurn&&(
                  <div style={{height:3,width:180,background:'#1a2a1a',
                    borderRadius:2,margin:'0 auto 6px',overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:2,
                      width:`${(timer/10)*100}%`,
                      background:timer<=3?'#EF476F':timer<=6?'#F39C12':'#2ECC71',
                      transition:'width 0.9s linear'}}/>
                  </div>
                )}
                <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center'}}>
                  {myHand.map(card=>(
                    <Card key={card.id} card={card}
                      mode={contract.type} trump={contract.trump}
                      highlight={isMyTurn}
                      onClick={()=>isMyTurn&&!gd.trickResult&&playCard(card)}
                      disabled={!isMyTurn||!!gd.trickResult}/>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Round End */}
        {gd.phase==='roundEnd'&&gd.roundResult&&(
          <RoundEndScreen
            result={gd.roundResult}
            contract={gd.contract}
            roundScores={gd.roundScores||[0,0]}
            gameScore={gd.gameScore||[0,0]}
            matchWinner={gd.matchWinner}
            onNext={()=>newRound(gd.matchWinner!==null)}
          />
        )}
      </div>
    );
  }

  // Loading
  return(
    <div style={{minHeight:'100vh',background:'#0D4A2A',
      display:'flex',alignItems:'center',justifyContent:'center',
      fontFamily:'Segoe UI,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:12}}>🃏</div>
        <div style={{color:'#C9A84C',fontSize:18,fontWeight:700}}>
          جاري التحميل...
        </div>
      </div>
    </div>
  );
}
