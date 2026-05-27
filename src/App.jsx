import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase';
import {
  doc, setDoc, onSnapshot, updateDoc, getDoc,
  collection, query, orderBy, limit, getDocs,
  addDoc, serverTimestamp, increment
} from 'firebase/firestore';

// ── Design Tokens ─────────────────────────────────────────
const T = {
  gold:'#C9A84C', goldL:'#F0C060', goldD:'#8B6914',
  green:'#006C35', greenL:'#1a8a4a', greenD:'#004D26',
  night:'#07070F', felt:'#0D4A2A', feltL:'#1a5c35',
  bg2:'#0D0D1A', bg3:'#121225',
  cream:'#F0EEE8', red:'#C0392B', redL:'#E74C3C',
  blue:'#1A4A8A', blueL:'#2E86C1', smoke:'#888',
  border:'#C9A84C33', muted:'rgba(240,238,232,0.4)',
};

// ── Game Data ──────────────────────────────────────────────
const SUITS = [
  { symbol:'♠', name:'بستوني', color:T.night, isRed:false },
  { symbol:'♥', name:'كبة',    color:T.red,   isRed:true  },
  { symbol:'♦', name:'ديناري', color:T.red,   isRed:true  },
  { symbol:'♣', name:'جاروني', color:T.night, isRed:false },
];
const RANKS = [
  { symbol:'A',  nameAr:'إيس',  hokumPlain:11, hokumTrump:11, sun:11 },
  { symbol:'K',  nameAr:'كينق', hokumPlain:4,  hokumTrump:4,  sun:4  },
  { symbol:'Q',  nameAr:'بنت',  hokumPlain:3,  hokumTrump:3,  sun:3  },
  { symbol:'J',  nameAr:'جاك',  hokumPlain:2,  hokumTrump:20, sun:2  },
  { symbol:'10', nameAr:'١٠',   hokumPlain:10, hokumTrump:10, sun:10 },
  { symbol:'9',  nameAr:'٩',    hokumPlain:0,  hokumTrump:14, sun:0  },
  { symbol:'8',  nameAr:'٨',    hokumPlain:0,  hokumTrump:0,  sun:0  },
  { symbol:'7',  nameAr:'٧',    hokumPlain:0,  hokumTrump:0,  sun:0  },
];
const HOKUM_TRUMP_ORDER = ['J','9','A','10','K','Q','8','7'];
const PLAIN_ORDER       = ['A','10','K','Q','J','9','8','7'];
const TEAM_COLORS = [T.gold, T.blueL];
const AVATARS = ['🧔','👲','🧕','👳','🧑','👩','👨','👧'];
const CITIES = ['كل المدن','الرياض','جدة','الدمام','مكة','المدينة','أبها','تبوك'];
const REACTIONS = ['👏','🔥','😤','🤣','☕','🃏','👑','💪'];

// ── Card Deck Themes ───────────────────────────────────────
const DECK_THEMES = {
  classic:  { name:'كلاسيك',       bg:'#fff',     border:'#ddd',    cost:0,    owned:true  },
  heritage: { name:'التراث السعودي', bg:'#fff8e8',  border:'#C9A84C', cost:500,  owned:false },
  desert:   { name:'الصحراء الذهبية',bg:'#fffbe6',  border:'#8B6914', cost:800,  owned:false },
  ramadan:  { name:'رمضان كريم 🌙', bg:'#0a0620',  border:'#6040C0', cost:300,  owned:false },
  royal:    { name:'ملكي',          bg:'#0a0a1a',  border:'#4040C0', cost:1000, owned:false },
};

// ── Table Themes ───────────────────────────────────────────
const TABLE_THEMES = {
  classic:  { name:'الكلاسيك',     felt:'#0D4A2A', cost:0    },
  midnight: { name:'منتصف الليل',  felt:'#0a0a2a', cost:400  },
  ramadan:  { name:'رمضان 🌙',     felt:'#1a0a40', cost:300  },
  desert:   { name:'الصحراء',      felt:'#2a1a00', cost:600  },
  royal:    { name:'الملكي',       felt:'#1a0020', cost:800  },
};

// ── Store Items ────────────────────────────────────────────
const STORE_ITEMS = {
  decks: [
    { id:'heritage', name:'التراث السعودي', desc:'نقوش هندسية مستوحاة من التراث السعودي', cost:500, badge:'hot', emoji:'🕌' },
    { id:'desert',   name:'الصحراء الذهبية',desc:'ألوان الرمال الذهبية — حصري', cost:800, badge:'new', emoji:'🏜️' },
    { id:'ramadan',  name:'رمضان كريم 🌙',  desc:'ثيم رمضاني حصري — متوفر موسمياً', cost:300, badge:'seasonal', emoji:'🌙' },
    { id:'royal',    name:'الملكي الداكن',  desc:'تصميم ملكي فاخر بألوان الليل', cost:1000, badge:'vip', emoji:'👑' },
  ],
  tables: [
    { id:'midnight', name:'منتصف الليل',   desc:'طاولة داكنة فاخرة', cost:400, badge:'hot', emoji:'🌃' },
    { id:'ramadan',  name:'رمضان 🌙',       desc:'طاولة رمضانية بنجوم وهلال', cost:300, badge:'seasonal', emoji:'🌙' },
    { id:'desert',   name:'الصحراء',        desc:'طاولة بألوان الرمال الدافئة', cost:600, badge:'new', emoji:'🏜️' },
    { id:'royal',    name:'الملكي الأرجواني',desc:'أفخم طاولة في اللعبة', cost:800, badge:'vip', emoji:'💜' },
  ],
  reactions: [
    { id:'fire_pack',   name:'حزمة النار 🔥',   desc:'٥ ردود فعل نارية متحركة', cost:200, badge:'hot',  emoji:'🔥' },
    { id:'royal_pack',  name:'حزمة الملكية 👑',  desc:'ردود فعل ملكية فاخرة', cost:400, badge:'vip',  emoji:'👑' },
    { id:'ramadan_pack',name:'حزمة رمضان 🌙',   desc:'هلال وفانوس ونجوم', cost:200, badge:'seasonal', emoji:'🌙' },
    { id:'coffee_pack', name:'حزمة القهوة ☕',   desc:'ردود فعل القهوة العربية', cost:150, badge:'new',  emoji:'☕' },
  ],
  coins: [
    { id:'coins_500',  name:'حزمة ٥٠٠ رصيد',  desc:'رصيد للمتجر والبطولات', coins:500,  price:10, emoji:'🪙' },
    { id:'coins_1500', name:'حزمة ١٥٠٠ رصيد', desc:'قيمة أعلى — وفّر ٥ ريال', coins:1500, price:25, emoji:'💰' },
    { id:'coins_5000', name:'حزمة ٥٠٠٠ رصيد', desc:'للاعب الجاد — رصيد لأشهر', coins:5000, price:75, emoji:'🏆', best:true },
  ],
};

// ── Sound ─────────────────────────────────────────────────
function playTone(freq, vol=0.1, type='sine') {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const freqs = Array.isArray(freq) ? freq : [freq];
    freqs.forEach((f,i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = f;
      gain.gain.setValueAtTime(vol, ctx.currentTime+i*0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+i*0.12+0.15);
      osc.start(ctx.currentTime+i*0.12);
      osc.stop(ctx.currentTime+i*0.12+0.15);
    });
  } catch(e) {}
}
const sounds = {
  deal:  ()=>playTone(440,0.1,'triangle'),
  play:  ()=>playTone(520,0.08,'sine'),
  win:   ()=>playTone([523,659,784],0.15,'sine'),
  gahwa: ()=>playTone([784,659,523,659,784],0.2,'triangle'),
  tick:  ()=>playTone(880,0.05,'square'),
  buy:   ()=>playTone([523,659],0.1,'sine'),
};

// ── Game Logic ─────────────────────────────────────────────
function buildDeck() {
  const d=[];
  for(const suit of SUITS) for(const rank of RANKS)
    d.push({suit,rank,id:`${rank.symbol}${suit.symbol}`});
  return d;
}
function shuffle(deck) {
  const d=[...deck];
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}
function dealHands(deck) {
  return{h0:deck.slice(0,8),h1:deck.slice(8,16),h2:deck.slice(16,24),h3:deck.slice(24,32)};
}
function getHands(gd){return[gd.h0||[],gd.h1||[],gd.h2||[],gd.h3||[]];}
function cardValue(card,mode,trump){
  if(!card)return 0;if(mode==='sun')return card.rank.sun;
  return card.suit.symbol===trump?card.rank.hokumTrump:card.rank.hokumPlain;
}
function cardStrength(card,mode,trump){
  const isTrump=mode==='hokum'&&card.suit.symbol===trump;
  const order=isTrump?HOKUM_TRUMP_ORDER:PLAIN_ORDER;
  return isTrump?100+(order.length-order.indexOf(card.rank.symbol)):order.length-order.indexOf(card.rank.symbol);
}
function trickWinner(plays,mode,trump){
  const ledSuit=plays[0].card.suit.symbol;
  return plays.reduce((best,cur)=>{
    const bT=mode==='hokum'&&best.card.suit.symbol===trump;
    const cT=mode==='hokum'&&cur.card.suit.symbol===trump;
    if(cT&&!bT)return cur;if(bT&&!cT)return best;
    if(!cT&&cur.card.suit.symbol!==ledSuit)return best;
    if(!bT&&best.card.suit.symbol!==ledSuit)return cur;
    return cardStrength(cur.card,mode,trump)>cardStrength(best.card,mode,trump)?cur:best;
  });
}
function calcResult(roundScores,contract){
  const{type,bidTeam}=contract;
  const bidScore=roundScores[bidTeam],oppScore=roundScores[1-bidTeam],total=bidScore+oppScore;
  const isGahwa=oppScore===0;
  if(type==='sun'){const made=bidScore>oppScore;return{made,isGahwa,bidTeamFinal:made?total*2:0,oppTeamFinal:made?0:total*2,reason:made?(isGahwa?'☕ صن + قهوة!':'☀️ صن نجح!'):'☀️ صن فشل!'};}
  if(isGahwa)return{made:true,isGahwa:true,bidTeamFinal:total*2,oppTeamFinal:0,reason:'☕ قهوة! ضعف النقاط!'};
  const made=bidScore>=82;
  return{made,isGahwa:false,bidTeamFinal:made?bidScore:0,oppTeamFinal:made?oppScore:total,reason:made?`✅ حكم نجح! (${bidScore}≥82)`:`❌ حكم فشل!`};
}
function botPickCard(hand,trickPlays,mode,trump){
  const ledSuit=trickPlays.length>0?trickPlays[0].card.suit.symbol:null;
  if(ledSuit){
    const following=hand.filter(c=>c.suit.symbol===ledSuit);
    if(following.length>0)return following.sort((a,b)=>cardStrength(b,mode,trump)-cardStrength(a,mode,trump))[0];
    const trumpCards=hand.filter(c=>c.suit.symbol===trump&&mode==='hokum');
    if(trumpCards.length>0)return trumpCards.sort((a,b)=>cardStrength(b,mode,trump)-cardStrength(a,mode,trump))[0];
  }
  return[...hand].sort((a,b)=>cardValue(a,mode,trump)-cardValue(b,mode,trump))[0];
}
function botBid(hand,passCount){
  let bestSuit=null,bestScore=0;
  for(const suit of SUITS){
    const sc=hand.filter(c=>c.suit.symbol===suit.symbol).reduce((s,c)=>{
      if(c.rank.symbol==='J')return s+5;if(c.rank.symbol==='9')return s+4;if(c.rank.symbol==='A')return s+3;return s+1;
    },0);
    if(sc>bestScore){bestScore=sc;bestSuit=suit;}
  }
  if(bestScore>=6||passCount>=2)return{type:'hokum',trump:bestSuit.symbol,trumpName:bestSuit.name};
  return{type:'pass'};
}
function genCode(){return Math.floor(100000+Math.random()*900000).toString();}

// ── Card Component ─────────────────────────────────────────
function Card({card,mode,trump,highlight,winner,onClick,disabled,faceDown,small,deckTheme='classic'}){
  const theme=DECK_THEMES[deckTheme]||DECK_THEMES.classic;
  const isTrump=mode==='hokum'&&card?.suit?.symbol===trump;
  const val=card?cardValue(card,mode,trump):0;
  const isRed=card?.suit?.isRed;
  const w=small?44:56;const h=small?64:80;
  if(faceDown)return(
    <div style={{width:w,height:h,borderRadius:10,margin:3,
      background:`linear-gradient(135deg,${T.green},${T.greenD})`,
      border:`2px solid ${T.gold}`,display:'flex',alignItems:'center',
      justifyContent:'center',boxShadow:`0 4px 12px #00000066`,
      position:'relative',overflow:'hidden',flexShrink:0}}>
      <div style={{position:'absolute',inset:4,border:`1px solid ${T.gold}44`,borderRadius:6,
        backgroundImage:`repeating-linear-gradient(45deg,${T.gold}11 0px,${T.gold}11 1px,transparent 1px,transparent 8px)`}}/>
      <div style={{fontSize:small?14:18,zIndex:1}}>🃏</div>
    </div>
  );
  return(
    <div onClick={!disabled?()=>{sounds.play();onClick&&onClick();}:undefined} style={{
      width:w,height:h,
      background:winner?'linear-gradient(135deg,#fffbe6,#fff9d6)':highlight?'linear-gradient(135deg,#f0fff4,#e8fef0)':theme.bg,
      border:`2px solid ${winner?T.gold:highlight?T.greenL:isTrump?theme.border:'#ddd'}`,
      borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'space-between',padding:'4px 3px',
      boxShadow:winner?`0 0 20px ${T.gold}88,0 6px 16px #0004`:highlight?`0 0 12px ${T.greenL}66`:'0 3px 8px #0002',
      cursor:disabled?'default':'pointer',
      transform:winner?'scale(1.15) translateY(-6px)':highlight?'translateY(-8px) scale(1.03)':'none',
      transition:'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      margin:3,position:'relative',flexShrink:0}}>
      <div style={{fontSize:small?9:11,fontWeight:900,color:isRed?T.red:T.night,alignSelf:'flex-start',paddingLeft:3,lineHeight:1}}>{card.rank.symbol}</div>
      <div style={{fontSize:small?18:24,color:isRed?T.red:T.night,lineHeight:1}}>{card.suit.symbol}</div>
      <div style={{fontSize:small?8:10,color:isRed?T.red:T.night,fontWeight:700}}>{card.rank.nameAr}</div>
      {val>0&&<div style={{position:'absolute',top:-7,right:-7,background:isTrump?`linear-gradient(135deg,${T.gold},${T.goldL})`:`linear-gradient(135deg,${T.green},${T.greenL})`,color:isTrump?T.night:'#fff',borderRadius:'50%',width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,fontWeight:900,border:'2px solid white'}}>{val}</div>}
      {isTrump&&<div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',fontSize:10}}>👑</div>}
      {winner&&<div style={{position:'absolute',bottom:-14,left:'50%',transform:'translateX(-50%)',fontSize:12}}>🏆</div>}
      {highlight&&<div style={{position:'absolute',inset:-2,borderRadius:11,border:`2px solid ${T.greenL}`,animation:'pulse-border 1s infinite',pointerEvents:'none'}}/>}
    </div>
  );
}

// ── Player Badge ───────────────────────────────────────────
function PlayerBadge({name,avatar,teamColor,isActive,isMe,cardCount,timer}){
  return(
    <div style={{display:'inline-flex',alignItems:'center',gap:6,
      background:isActive?`${teamColor}22`:'#0a1a0a',
      border:`2px solid ${isActive?teamColor:'#1a2a1a'}`,
      borderRadius:24,padding:'5px 12px',transition:'all 0.3s',
      boxShadow:isActive?`0 0 16px ${teamColor}44`:'none'}}>
      <span style={{fontSize:18}}>{avatar||'🧔'}</span>
      <div>
        <div style={{color:isActive?teamColor:T.smoke,fontWeight:700,fontSize:12,lineHeight:1.2}}>
          {name}{isMe&&<span style={{color:T.gold,fontSize:9}}> ✦</span>}
        </div>
        <div style={{color:'#555',fontSize:9}}>{cardCount!==undefined?`${cardCount} ورقة`:''}</div>
      </div>
      {isActive&&isMe&&timer>0&&(
        <div style={{background:timer<=3?T.redL:timer<=6?'#F39C12':T.greenL,color:'#fff',borderRadius:'50%',width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,animation:timer<=3?'pulse 0.5s infinite':'none'}}>{timer}</div>
      )}
    </div>
  );
}

// ── Badge Helper ───────────────────────────────────────────
function ItemBadge({badge}){
  const styles={
    hot:      {bg:'rgba(255,80,0,0.2)',   color:'#ff9060', border:'rgba(255,80,0,0.3)',   label:'🔥 رائج'},
    new:      {bg:'rgba(0,200,100,0.15)', color:'#60e8a0', border:'rgba(0,200,100,0.3)', label:'✨ جديد'},
    seasonal: {bg:'rgba(100,180,255,0.15)',color:'#7EC8E3',border:'rgba(100,180,255,0.3)',label:'🌙 موسمي'},
    vip:      {bg:'rgba(201,168,76,0.2)', color:T.gold,    border:'rgba(201,168,76,0.4)',label:'👑 VIP'},
    free:     {bg:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.5)',border:'transparent',label:'مجاني'},
  };
  const s=styles[badge]||styles.free;
  return(
    <div style={{position:'absolute',top:10,right:10,fontSize:9,fontWeight:700,letterSpacing:1,
      padding:'3px 8px',borderRadius:8,background:s.bg,color:s.color,border:`1px solid ${s.border}`,zIndex:2}}>
      {s.label}
    </div>
  );
}

// ── Store Screen ───────────────────────────────────────────
function StoreScreen({profile,onUpdateProfile}){
  const [tab,setTab]=useState('decks');
  const [owned,setOwned]=useState(profile?.owned||{decks:['classic'],tables:['classic'],reactions:[]});
  const [coins,setCoins]=useState(profile?.coins||0);
  const [toast,setToast]=useState(null);
  const [activeDeck,setActiveDeck]=useState(profile?.activeDeck||'classic');
  const [activeTable,setActiveTable]=useState(profile?.activeTable||'classic');

  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(null),2500);};

  const buyItem=async(category,itemId,cost)=>{
    if(coins<cost){showToast('❌ رصيد غير كافٍ');return;}
    const newCoins=coins-cost;
    const newOwned={...owned,[category]:[...(owned[category]||[]),itemId]};
    setCoins(newCoins);setOwned(newOwned);
    sounds.buy();
    showToast('🎉 تم الشراء بنجاح!');
    if(profile?.uid){
      try{
        await updateDoc(doc(db,'users',profile.uid),{
          coins:newCoins,owned:newOwned
        });
      }catch(e){}
    }
    onUpdateProfile&&onUpdateProfile({coins:newCoins,owned:newOwned});
  };

  const equipItem=async(category,itemId)=>{
    if(category==='decks'){
      setActiveDeck(itemId);
      if(profile?.uid)try{await updateDoc(doc(db,'users',profile.uid),{activeDeck:itemId});}catch(e){}
      onUpdateProfile&&onUpdateProfile({activeDeck:itemId});
    }else if(category==='tables'){
      setActiveTable(itemId);
      if(profile?.uid)try{await updateDoc(doc(db,'users',profile.uid),{activeTable:itemId});}catch(e){}
      onUpdateProfile&&onUpdateProfile({activeTable:itemId});
    }
    showToast('✅ تم التفعيل!');
  };

  const tabs=[
    {id:'decks',label:'🃏 سكنات الورق'},
    {id:'tables',label:'🎮 الطاولات'},
    {id:'reactions',label:'😤 ردود الفعل'},
    {id:'vip',label:'👑 VIP'},
    {id:'coins',label:'🪙 الرصيد'},
  ];

  return(
    <div style={{minHeight:'100vh',background:T.night,fontFamily:'Segoe UI,Tahoma,Arial,sans-serif',color:T.cream,position:'relative',overflow:'hidden'}}>
      {/* Particles */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        {Array.from({length:20},(_,i)=>(
          <div key={i} style={{position:'absolute',width:2,height:2,background:T.gold,borderRadius:'50%',
            left:`${Math.random()*100}%`,animation:`drift ${6+Math.random()*10}s ${Math.random()*8}s linear infinite`,
            opacity:0.3}}/>
        ))}
      </div>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'16px 20px',borderBottom:`1px solid ${T.border}`,
        background:'rgba(7,7,15,0.9)',backdropFilter:'blur(12px)',
        position:'sticky',top:0,zIndex:100}}>
        <div style={{fontFamily:'serif',fontSize:20,color:T.goldL,letterSpacing:1}}>🛍️ متجر بلوت المملكة</div>
        <div style={{display:'flex',alignItems:'center',gap:8,
          background:'rgba(201,168,76,0.15)',border:`1px solid ${T.border}`,
          padding:'8px 16px',borderRadius:20,fontSize:13,color:T.gold,fontWeight:700}}>
          🪙 {coins} رصيد
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,justifyContent:'center',padding:'16px 16px 0',flexWrap:'wrap',position:'relative',zIndex:1}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'8px 16px',borderRadius:20,
            border:`1px solid ${tab===t.id?T.gold:'rgba(255,255,255,0.1)'}`,
            background:tab===t.id?'rgba(201,168,76,0.15)':'transparent',
            color:tab===t.id?T.gold:T.muted,
            fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',
            boxShadow:tab===t.id?`0 0 15px rgba(201,168,76,0.15)`:'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{maxWidth:800,margin:'0 auto',padding:'24px 16px',position:'relative',zIndex:1}}>

        {/* Decks */}
        {tab==='decks'&&(
          <div>
            <div style={{fontFamily:'serif',fontSize:22,color:T.goldL,marginBottom:4}}>سكنات الورق</div>
            <div style={{color:T.muted,fontSize:13,marginBottom:24}}>غيّر مظهر أوراقك — تظهر لك أنت فقط</div>
            <div style={{display:'grid',gap:16,gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
              {STORE_ITEMS.decks.map(item=>{
                const isOwned=(owned.decks||[]).includes(item.id)||item.id==='classic';
                const isActive=activeDeck===item.id;
                const theme=DECK_THEMES[item.id];
                return(
                  <div key={item.id} style={{background:T.bg2,border:`1px solid ${isActive?T.gold:'rgba(255,255,255,0.07)'}`,
                    borderRadius:16,overflow:'hidden',transition:'all 0.3s',position:'relative',
                    boxShadow:isActive?`0 0 20px ${T.gold}33`:'none'}}>
                    <ItemBadge badge={item.badge}/>
                    {/* Preview */}
                    <div style={{height:120,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                      background:`linear-gradient(135deg,${theme.bg}22,${theme.bg}44)`,padding:12}}>
                      {['A♠','K♥','Q♦'].map(c=>(
                        <div key={c} style={{width:44,height:64,borderRadius:8,background:theme.bg,
                          border:`2px solid ${theme.border}`,display:'flex',flexDirection:'column',
                          alignItems:'center',justifyContent:'center',fontSize:20,
                          color:c.includes('♥')||c.includes('♦')?T.red:T.night,
                          boxShadow:`0 4px 12px #00000066`}}>
                          <div style={{fontSize:10,fontWeight:900,alignSelf:'flex-start',paddingLeft:4}}>{c[0]}</div>
                          <div>{c.slice(1)}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{padding:16}}>
                      <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{item.emoji} {item.name}</div>
                      <div style={{fontSize:11,color:T.muted,marginBottom:14,lineHeight:1.5}}>{item.desc}</div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{fontSize:17,fontWeight:900,color:T.goldL}}>
                          {isOwned?'':'🪙 '}{isOwned?'مملوك':item.cost}
                        </div>
                        {isOwned?(
                          <button onClick={()=>equipItem('decks',item.id)} style={{
                            background:isActive?`linear-gradient(135deg,${T.gold},${T.goldL})`:'rgba(255,255,255,0.08)',
                            color:isActive?T.night:T.muted,fontWeight:700,fontSize:12,
                            padding:'8px 16px',borderRadius:16,border:isActive?'none':`1px solid rgba(255,255,255,0.1)`,
                            cursor:'pointer',fontFamily:'inherit'}}>
                            {isActive?'✓ مفعّل':'تفعيل'}
                          </button>
                        ):(
                          <button onClick={()=>buyItem('decks',item.id,item.cost)} style={{
                            background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
                            color:'#1a1200',fontWeight:900,fontSize:12,
                            padding:'8px 16px',borderRadius:16,border:'none',
                            cursor:'pointer',fontFamily:'inherit'}}>شراء</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tables */}
        {tab==='tables'&&(
          <div>
            <div style={{fontFamily:'serif',fontSize:22,color:T.goldL,marginBottom:4}}>طاولات اللعب</div>
            <div style={{color:T.muted,fontSize:13,marginBottom:24}}>غيّر لون الطاولة — يظهر للجميع في الغرفة</div>
            <div style={{display:'grid',gap:16,gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
              {STORE_ITEMS.tables.map(item=>{
                const isOwned=(owned.tables||[]).includes(item.id)||item.id==='classic';
                const isActive=activeTable===item.id;
                const theme=TABLE_THEMES[item.id];
                return(
                  <div key={item.id} style={{background:T.bg2,border:`1px solid ${isActive?T.gold:'rgba(255,255,255,0.07)'}`,
                    borderRadius:16,overflow:'hidden',transition:'all 0.3s',position:'relative',
                    boxShadow:isActive?`0 0 20px ${T.gold}33`:'none'}}>
                    <ItemBadge badge={item.badge}/>
                    <div style={{height:100,background:theme.felt,display:'flex',alignItems:'center',
                      justifyContent:'center',position:'relative',overflow:'hidden'}}>
                      <div style={{width:80,height:60,borderRadius:8,border:`2px solid ${T.gold}44`,
                        background:'#00000022',display:'flex',alignItems:'center',
                        justifyContent:'center',fontSize:24}}>🃏</div>
                    </div>
                    <div style={{padding:16}}>
                      <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{item.emoji} {item.name}</div>
                      <div style={{fontSize:11,color:T.muted,marginBottom:14}}>{item.desc}</div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{fontSize:17,fontWeight:900,color:T.goldL}}>
                          {isOwned?'مملوك':`🪙 ${item.cost}`}
                        </div>
                        {isOwned?(
                          <button onClick={()=>equipItem('tables',item.id)} style={{
                            background:isActive?`linear-gradient(135deg,${T.gold},${T.goldL})`:'rgba(255,255,255,0.08)',
                            color:isActive?T.night:T.muted,fontWeight:700,fontSize:12,
                            padding:'8px 16px',borderRadius:16,border:isActive?'none':`1px solid rgba(255,255,255,0.1)`,
                            cursor:'pointer',fontFamily:'inherit'}}>
                            {isActive?'✓ مفعّل':'تفعيل'}
                          </button>
                        ):(
                          <button onClick={()=>buyItem('tables',item.id,item.cost)} style={{
                            background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
                            color:'#1a1200',fontWeight:900,fontSize:12,
                            padding:'8px 16px',borderRadius:16,border:'none',
                            cursor:'pointer',fontFamily:'inherit'}}>شراء</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reactions */}
        {tab==='reactions'&&(
          <div>
            <div style={{fontFamily:'serif',fontSize:22,color:T.goldL,marginBottom:4}}>حزم ردود الفعل</div>
            <div style={{color:T.muted,fontSize:13,marginBottom:24}}>ردود فعل متحركة حصرية أثناء اللعب</div>
            <div style={{display:'grid',gap:16,gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
              {STORE_ITEMS.reactions.map(item=>{
                const isOwned=(owned.reactions||[]).includes(item.id);
                return(
                  <div key={item.id} style={{background:T.bg2,border:`1px solid rgba(255,255,255,0.07)`,
                    borderRadius:16,overflow:'hidden',position:'relative'}}>
                    <ItemBadge badge={item.badge}/>
                    <div style={{height:100,display:'flex',alignItems:'center',justifyContent:'center',
                      background:'linear-gradient(135deg,#0a1020,#162040)',gap:8}}>
                      {[item.emoji,item.emoji,item.emoji].map((e,i)=>(
                        <div key={i} style={{fontSize:28,animation:`float ${1+i*0.3}s ease-in-out infinite`,animationDelay:`${i*0.2}s`}}>{e}</div>
                      ))}
                    </div>
                    <div style={{padding:16}}>
                      <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{item.name}</div>
                      <div style={{fontSize:11,color:T.muted,marginBottom:14}}>{item.desc}</div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{fontSize:17,fontWeight:900,color:T.goldL}}>
                          {isOwned?'مملوك':`🪙 ${item.cost}`}
                        </div>
                        {isOwned?(
                          <div style={{color:T.greenL,fontWeight:700,fontSize:12}}>✓ مملوك</div>
                        ):(
                          <button onClick={()=>buyItem('reactions',item.id,item.cost)} style={{
                            background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
                            color:'#1a1200',fontWeight:900,fontSize:12,
                            padding:'8px 16px',borderRadius:16,border:'none',
                            cursor:'pointer',fontFamily:'inherit'}}>شراء</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIP */}
        {tab==='vip'&&(
          <div>
            <div style={{fontFamily:'serif',fontSize:22,color:T.goldL,marginBottom:4}}>عضوية VIP 👑</div>
            <div style={{color:T.muted,fontSize:13,marginBottom:24}}>أفضل قيمة — احصل على كل شيء بسعر واحد</div>
            <div style={{background:`linear-gradient(135deg,#120d00,#1e1500)`,
              border:`2px solid ${T.gold}`,borderRadius:20,padding:28,
              boxShadow:`0 0 60px ${T.gold}22`,marginBottom:24}}>
              <div style={{textAlign:'center',marginBottom:20}}>
                <div style={{fontSize:48}}>👑</div>
                <div style={{fontFamily:'serif',fontSize:22,color:T.goldL,marginTop:8}}>عضوية VIP — بلوت المملكة</div>
                <div style={{color:T.muted,fontSize:13,marginTop:4}}>اشترك مرة واحدة — استمتع بكل شيء</div>
              </div>
              <div style={{display:'grid',gap:8,marginBottom:24}}>
                {['وصول فوري لجميع سكنات الورق الحالية والجديدة',
                  'جميع طاولات اللعب — بما فيها الموسمية',
                  'ردود الفعل المتحركة الكاملة (٣٠+ رد)',
                  'إطار ذهبي VIP حصري على ملفك الشخصي',
                  'لقب "عضو VIP" باللون الذهبي',
                  'دخول بطولة شهرية مجاني',
                  '٥٠٠ رصيد مجاني عند الاشتراك + ١٠٠ شهرياً',
                  'خبرة بدون إعلانات نهائياً',
                ].map(perk=>(
                  <div key={perk} style={{display:'flex',alignItems:'center',gap:10,
                    background:'rgba(201,168,76,0.08)',borderRadius:10,padding:'8px 12px'}}>
                    <div style={{color:T.gold,fontSize:14}}>✦</div>
                    <div style={{fontSize:13,color:T.cream}}>{perk}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
                {[
                  {name:'شهري',price:'١٩',cycle:'كل شهر'},
                  {name:'٣ أشهر',price:'٤٩',cycle:'كل ٣ أشهر',save:'وفّر ٨ ريال',best:true},
                  {name:'سنوي 🔥',price:'١٤٩',cycle:'كل سنة',save:'وفّر ٧٩ ريال'},
                ].map(plan=>(
                  <div key={plan.name} style={{background:plan.best?'rgba(201,168,76,0.15)':'rgba(255,255,255,0.05)',
                    border:`1px solid ${plan.best?T.gold:'rgba(255,255,255,0.1)'}`,
                    borderRadius:14,padding:14,textAlign:'center',cursor:'pointer',
                    boxShadow:plan.best?`0 0 20px ${T.gold}22`:'none'}}>
                    <div style={{fontSize:12,color:T.muted,marginBottom:4}}>{plan.name}</div>
                    <div style={{fontSize:26,fontWeight:900,color:T.goldL}}>{plan.price}<small style={{fontSize:12}}> ر</small></div>
                    <div style={{fontSize:10,color:T.muted,marginTop:2}}>{plan.cycle}</div>
                    {plan.save&&<div style={{fontSize:10,color:T.greenL,marginTop:4,fontWeight:700}}>{plan.save}</div>}
                  </div>
                ))}
              </div>
              <button onClick={()=>showToast('قريباً — جاري تفعيل الدفع 🔜')} style={{
                background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
                color:'#1a1200',border:'none',borderRadius:14,padding:'14px',
                fontWeight:900,cursor:'pointer',fontSize:16,width:'100%',
                fontFamily:'inherit',boxShadow:`0 4px 20px ${T.gold}44`}}>
                اشترك الآن
              </button>
            </div>
          </div>
        )}

        {/* Coins */}
        {tab==='coins'&&(
          <div>
            <div style={{fontFamily:'serif',fontSize:22,color:T.goldL,marginBottom:4}}>شراء الرصيد 🪙</div>
            <div style={{color:T.muted,fontSize:13,marginBottom:24}}>استخدم الرصيد للشراء من المتجر والانضمام للبطولات</div>
            <div style={{background:`linear-gradient(135deg,#0a1a0a,#071f10)`,
              border:`1px solid ${T.border}`,borderRadius:16,padding:16,marginBottom:20,
              display:'flex',alignItems:'center',gap:12}}>
              <div style={{fontSize:36}}>🪙</div>
              <div>
                <div style={{color:T.smoke,fontSize:12}}>رصيدك الحالي</div>
                <div style={{color:T.goldL,fontSize:28,fontWeight:900}}>{coins}</div>
              </div>
              <div style={{marginRight:'auto',color:T.smoke,fontSize:11}}>
                تكسب ٥٠ رصيد لكل انتصار 🏆
              </div>
            </div>
            <div style={{display:'grid',gap:16,gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
              {STORE_ITEMS.coins.map(item=>(
                <div key={item.id} style={{background:item.best?'linear-gradient(135deg,#120d00,#1e1500)':T.bg2,
                  border:`1px solid ${item.best?T.gold:'rgba(255,255,255,0.07)'}`,
                  borderRadius:16,overflow:'hidden',position:'relative',
                  boxShadow:item.best?`0 0 20px ${T.gold}22`:'none'}}>
                  {item.best&&<div style={{position:'absolute',top:10,right:10,fontSize:9,fontWeight:700,
                    padding:'3px 8px',borderRadius:8,background:'rgba(255,80,0,0.2)',color:'#ff9060',
                    border:'1px solid rgba(255,80,0,0.3)'}}>أفضل قيمة</div>}
                  <div style={{height:100,display:'flex',flexDirection:'column',alignItems:'center',
                    justifyContent:'center',gap:4,background:'linear-gradient(135deg,#0a1020,#162040)'}}>
                    <div style={{fontSize:32}}>{item.emoji}</div>
                    <div style={{fontSize:22,fontWeight:900,color:T.goldL}}>{item.coins.toLocaleString()} 🪙</div>
                  </div>
                  <div style={{padding:16}}>
                    <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{item.name}</div>
                    <div style={{fontSize:11,color:T.muted,marginBottom:14}}>{item.desc}</div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div style={{fontSize:20,fontWeight:900,color:T.goldL}}>{item.price} <span style={{fontSize:12,color:T.muted}}>ريال</span></div>
                      <button onClick={()=>showToast('قريباً — جاري تفعيل الدفع 🔜')} style={{
                        background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
                        color:'#1a1200',fontWeight:900,fontSize:12,
                        padding:'9px 18px',borderRadius:16,border:'none',
                        cursor:'pointer',fontFamily:'inherit'}}>شراء</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',
          background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
          color:'#1a1200',fontWeight:900,fontSize:14,
          padding:'12px 24px',borderRadius:24,zIndex:9999,
          boxShadow:`0 8px 30px ${T.gold}44`,whiteSpace:'nowrap',
          animation:'bounce 0.3s ease'}}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes drift{0%{opacity:0;transform:translateY(100vh) scale(0);}10%{opacity:0.6;}90%{opacity:0.2;}100%{opacity:0;transform:translateY(-10vh) scale(1.5);}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes bounce{0%{transform:translateX(-50%) scale(0.8)}70%{transform:translateX(-50%) scale(1.05)}100%{transform:translateX(-50%) scale(1)}}
      `}</style>
    </div>
  );
}

// ── Leaderboard ────────────────────────────────────────────
function LeaderboardScreen({onClose,currentUserId}){
  const[players,setPlayers]=useState([]);
  const[city,setCity]=useState('كل المدن');
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    const fetch=async()=>{
      setLoading(true);
      try{
        const q=query(collection(db,'users'),orderBy('wins','desc'),limit(50));
        const snap=await getDocs(q);
        setPlayers(snap.docs.map(d=>({id:d.id,...d.data()})));
      }catch(e){console.error(e);}
      setLoading(false);
    };fetch();
  },[]);
  const filtered=city==='كل المدن'?players:players.filter(p=>p.city===city);
  return(
    <div style={{position:'fixed',inset:0,background:'#000e',display:'flex',flexDirection:'column',zIndex:300,backdropFilter:'blur(6px)'}}>
      <div style={{background:`linear-gradient(135deg,#071f10,#0a2a0a)`,border:`2px solid ${T.gold}`,borderRadius:'0 0 20px 20px',padding:'16px 20px',boxShadow:`0 4px 20px #00000088`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{color:T.gold,fontSize:20,fontWeight:900}}>🏆 لوحة المتصدرين</div><div style={{color:T.smoke,fontSize:12}}>أفضل اللاعبين</div></div>
          <button onClick={onClose} style={{background:'transparent',color:T.smoke,border:`1px solid #333`,borderRadius:10,padding:'8px 14px',cursor:'pointer',fontSize:13}}>✕ إغلاق</button>
        </div>
        <div style={{display:'flex',gap:6,marginTop:12,overflowX:'auto',paddingBottom:4}}>
          {CITIES.map(c=>(<button key={c} onClick={()=>setCity(c)} style={{background:city===c?`linear-gradient(135deg,${T.gold},${T.goldL})`:'#0a1a0a',color:city===c?T.night:T.smoke,border:`1px solid ${city===c?T.gold:'#333'}`,borderRadius:20,padding:'5px 14px',fontWeight:city===c?700:400,cursor:'pointer',fontSize:12,whiteSpace:'nowrap'}}>{c}</button>))}
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
        {loading?<div style={{textAlign:'center',color:T.smoke,padding:40}}>جاري التحميل...</div>
        :filtered.length===0?<div style={{textAlign:'center',color:T.smoke,padding:40}}>لا يوجد لاعبون بعد</div>
        :filtered.map((p,i)=>{
          const total=(p.wins||0)+(p.losses||0);
          const wr=total>0?Math.round(((p.wins||0)/total)*100):0;
          const isMe=p.id===currentUserId;
          return(
            <div key={p.id} style={{background:isMe?`${T.gold}11`:'#071f10',border:`1.5px solid ${isMe?T.gold:i<3?TEAM_COLORS[0]+'44':'#1a2a1a'}`,borderRadius:14,padding:'12px 16px',marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:i===0?`linear-gradient(135deg,${T.gold},${T.goldL})`:i===1?'linear-gradient(135deg,#aaa,#ccc)':i===2?'linear-gradient(135deg,#cd7f32,#e8a050)':'#1a2a1a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:i<3?16:13,fontWeight:900,color:i<3?T.night:T.smoke}}>{i<3?['🥇','🥈','🥉'][i]:i+1}</div>
              <div style={{fontSize:24}}>{p.avatar||'🧔'}</div>
              <div style={{flex:1}}>
                <div style={{color:isMe?T.gold:T.cream,fontWeight:700,fontSize:14}}>{p.name||'لاعب'}{isMe&&<span style={{color:T.gold,fontSize:10}}> (أنت)</span>}</div>
                <div style={{color:T.smoke,fontSize:11}}>{p.city||'—'} · {total} مباراة</div>
              </div>
              <div style={{textAlign:'center'}}><div style={{color:T.greenL,fontSize:18,fontWeight:900}}>{p.wins||0}</div><div style={{color:T.smoke,fontSize:9}}>انتصار</div></div>
              <div style={{textAlign:'center'}}><div style={{color:T.gold,fontSize:16,fontWeight:900}}>{wr}%</div><div style={{color:T.smoke,fontSize:9}}>فوز</div></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Profile Screen ─────────────────────────────────────────
function ProfileScreen({user,profile,onClose,onSignOut}){
  const wins=profile?.wins||0,losses=profile?.losses||0,total=wins+losses;
  const winRate=total>0?Math.round((wins/total)*100):0;
  return(
    <div style={{position:'fixed',inset:0,background:'#000c',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16,backdropFilter:'blur(6px)'}}>
      <div style={{background:`linear-gradient(135deg,#0D2A1A,#071f10)`,border:`2px solid ${T.gold}`,borderRadius:20,padding:28,maxWidth:340,width:'100%',boxShadow:`0 0 60px ${T.gold}22`}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:56,marginBottom:8}}>{profile?.avatar||'🧔'}</div>
          <div style={{color:T.gold,fontSize:20,fontWeight:900}}>{profile?.name||user?.displayName||'لاعب'}</div>
          <div style={{color:T.smoke,fontSize:12,marginTop:4}}>{user?.email}</div>
          {profile?.city&&<div style={{color:T.greenL,fontSize:12,marginTop:2}}>📍 {profile.city}</div>}
          {profile?.coins!==undefined&&<div style={{color:T.goldL,fontSize:14,marginTop:6,fontWeight:700}}>🪙 {profile.coins} رصيد</div>}
          {profile?.isVip&&<div style={{color:T.gold,fontSize:12,marginTop:4,background:`${T.gold}22`,borderRadius:8,padding:'3px 10px',display:'inline-block'}}>👑 عضو VIP</div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
          {[{label:'انتصارات',value:wins,color:T.greenL},{label:'هزائم',value:losses,color:T.redL},{label:'نسبة الفوز',value:`${winRate}%`,color:T.gold}].map(s=>(
            <div key={s.label} style={{background:'#071f10',border:`1px solid ${s.color}33`,borderRadius:12,padding:'10px',textAlign:'center'}}>
              <div style={{color:s.color,fontSize:22,fontWeight:900}}>{s.value}</div>
              <div style={{color:T.smoke,fontSize:10}}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,background:`linear-gradient(135deg,${T.green},${T.greenL})`,color:'#fff',border:'none',borderRadius:12,padding:'12px',fontWeight:700,cursor:'pointer',fontSize:14}}>إغلاق</button>
          <button onClick={onSignOut} style={{background:'#3a0a0a',color:T.redL,border:`1px solid ${T.red}44`,borderRadius:12,padding:'12px 16px',fontWeight:700,cursor:'pointer',fontSize:13}}>خروج</button>
        </div>
      </div>
    </div>
  );
}

// ── Bidding Modal ──────────────────────────────────────────
function BiddingModal({playerIndex,onBid,canSun,passCount,playerName,avatar}){
  const[step,setStep]=useState('choose');
  return(
    <div style={{position:'fixed',inset:0,background:'linear-gradient(135deg,#000c,#001a0acc)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:16,backdropFilter:'blur(4px)'}}>
      <div style={{background:`linear-gradient(135deg,#0D2A1A,#071f10)`,border:`2px solid ${T.gold}`,borderRadius:20,padding:28,maxWidth:320,width:'100%',boxShadow:`0 0 60px ${T.gold}33`}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:6}}>{avatar||AVATARS[playerIndex%8]}</div>
          <div style={{color:T.gold,fontWeight:900,fontSize:18}}>{playerName||`اللاعب ${playerIndex+1}`}</div>
          <div style={{color:T.gold,fontSize:13,marginTop:2}}>دورك للمزايدة</div>
          {passCount>0&&<div style={{color:T.smoke,fontSize:11,marginTop:4,background:'#ffffff11',borderRadius:8,padding:'3px 10px',display:'inline-block'}}>{passCount} پاس قبلك</div>}
        </div>
        {step==='choose'?(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <button onClick={()=>setStep('pickSuit')} style={{background:`linear-gradient(135deg,${T.green},${T.greenL})`,color:'#fff',border:`2px solid ${T.greenL}`,borderRadius:14,padding:'15px',fontWeight:800,cursor:'pointer',fontSize:16}}>🎯 حكم — اختر الأتو</button>
            {canSun&&<button onClick={()=>onBid({type:'sun'})} style={{background:`linear-gradient(135deg,#6B4A00,#8B6400)`,color:T.goldL,border:`2px solid ${T.gold}`,borderRadius:14,padding:'15px',fontWeight:800,cursor:'pointer',fontSize:16}}>☀️ صن — بدون أتو (2×)</button>}
            <button onClick={()=>onBid({type:'pass'})} style={{background:'transparent',color:T.smoke,border:'1.5px solid #333',borderRadius:14,padding:'12px',fontWeight:700,cursor:'pointer',fontSize:14}}>⏭ پاس</button>
          </div>
        ):(
          <div>
            <div style={{color:T.goldL,fontWeight:700,marginBottom:14,textAlign:'center',fontSize:15}}>اختر لون الأتو 👑</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {SUITS.map(s=>(<button key={s.symbol} onClick={()=>onBid({type:'hokum',trump:s.symbol,trumpName:s.name})} style={{background:s.isRed?'#3a0a0a':'#0a0a1a',color:s.isRed?'#ff7070':'#aad4ff',border:`2px solid ${s.isRed?T.red:T.blue}`,borderRadius:14,padding:'16px 10px',fontWeight:800,cursor:'pointer',fontSize:28,textAlign:'center'}}>{s.symbol}<div style={{fontSize:12,marginTop:4}}>{s.name}</div></button>))}
            </div>
            <button onClick={()=>setStep('choose')} style={{marginTop:12,background:'transparent',color:T.smoke,border:'1px solid #333',borderRadius:10,padding:'10px',cursor:'pointer',fontSize:12,width:'100%'}}>← رجوع</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Round End ──────────────────────────────────────────────
function RoundEndScreen({result,contract,roundScores,gameScore,onNext,matchWinner}){
  useEffect(()=>{if(result.isGahwa)sounds.gahwa();else if(result.made)sounds.win();},[]);
  return(
    <div style={{position:'fixed',inset:0,background:'linear-gradient(135deg,#000e,#001a0acc)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16,backdropFilter:'blur(6px)'}}>
      <div style={{background:`linear-gradient(135deg,#0D2A1A,#071f10)`,border:`2px solid ${result.isGahwa?T.gold:result.made?T.greenL:T.redL}`,borderRadius:20,padding:28,maxWidth:360,width:'100%',boxShadow:`0 0 60px ${result.isGahwa?T.gold:result.made?T.greenL:T.redL}44`}}>
        <div style={{textAlign:'center',fontSize:56,marginBottom:8,animation:'bounce 0.5s ease'}}>{result.isGahwa?'☕':result.made?'🎉':'😔'}</div>
        <div style={{textAlign:'center',color:result.isGahwa?T.gold:result.made?T.greenL:T.redL,fontWeight:900,fontSize:18,marginBottom:20,textShadow:'0 0 20px currentColor'}}>{result.reason}</div>
        <div style={{display:'flex',gap:12,marginBottom:16}}>
          {[0,1].map(t=>(<div key={t} style={{flex:1,background:contract.bidTeam===t?'#0a2a0a':'#071010',border:`1.5px solid ${contract.bidTeam===t?T.greenL+'44':'#1a2a1a'}`,borderRadius:14,padding:'12px',textAlign:'center'}}><div style={{color:TEAM_COLORS[t],fontWeight:700,fontSize:12}}>Team {t===0?'A':'B'}{contract.bidTeam===t&&<span style={{color:T.gold}}> 📋</span>}</div><div style={{color:T.smoke,fontSize:11,marginBottom:4}}>جولة: {roundScores[t]}</div><div style={{color:T.gold,fontSize:26,fontWeight:900}}>+{contract.bidTeam===t?result.bidTeamFinal:result.oppTeamFinal}</div></div>))}
        </div>
        <div style={{background:'#071f10',borderRadius:14,padding:14,marginBottom:16,border:`1px solid ${T.border}`}}>
          <div style={{color:T.gold,fontSize:12,fontWeight:700,marginBottom:10,textAlign:'center'}}>🏆 المباراة — أول فريق يصل 152</div>
          {[0,1].map(t=>(<div key={t} style={{marginBottom:10}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}><span style={{color:TEAM_COLORS[t],fontWeight:700}}>Team {t===0?'A':'B'}</span><span style={{color:T.gold,fontWeight:700}}>{gameScore[t]} / 152</span></div><div style={{height:8,background:'#1a2a1a',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',borderRadius:4,width:`${Math.min((gameScore[t]/152)*100,100)}%`,background:`linear-gradient(to right,${TEAM_COLORS[t]},${TEAM_COLORS[t]}cc)`,transition:'width 0.8s ease'}}/></div></div>))}
        </div>
        {matchWinner!==null?(<div style={{textAlign:'center'}}><div style={{color:T.gold,fontWeight:900,fontSize:22,marginBottom:14}}>🏆 Team {matchWinner===0?'A':'B'} فازت!</div><button onClick={onNext} style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,border:'none',borderRadius:14,padding:'14px 32px',fontWeight:900,cursor:'pointer',fontSize:17,width:'100%'}}>🔄 مباراة جديدة</button></div>):(<button onClick={onNext} style={{background:`linear-gradient(135deg,${T.green},${T.greenL})`,color:'#fff',border:'none',borderRadius:14,padding:'14px',fontWeight:800,cursor:'pointer',fontSize:16,width:'100%'}}>▶ جولة جديدة</button>)}
      </div>
    </div>
  );
}

// ── Lobby ──────────────────────────────────────────────────
function LobbyScreen({roomCode,players,isHost,onStart,myIndex,shareLink}){
  const[copied,setCopied]=useState(false);
  const safePlayers=players||[];
  const copy=()=>{navigator.clipboard?.writeText(shareLink).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});};
  return(
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at 50% 0%,${T.greenL}44,${T.felt} 60%,${T.night})`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,fontFamily:'Segoe UI,Tahoma,Arial,sans-serif'}}>
      <div style={{textAlign:'center',marginBottom:28}}>
        <div style={{fontSize:56,marginBottom:4}}>🃏</div>
        <h1 style={{color:T.gold,fontSize:32,fontWeight:900,margin:'0 0 4px',textShadow:`0 0 30px ${T.gold}44`,letterSpacing:2}}>بلوت المملكة</h1>
        <p style={{color:T.smoke,fontSize:13,margin:0}}>{isHost?'أنت المضيف — شارك الكود':'انتظر المضيف'}</p>
      </div>
      <div style={{background:`linear-gradient(135deg,#071f10,#0a2a0a)`,border:`2px solid ${T.gold}`,borderRadius:20,padding:'20px 40px',marginBottom:16,textAlign:'center',boxShadow:`0 0 40px ${T.gold}22`}}>
        <div style={{color:T.smoke,fontSize:11,marginBottom:6,letterSpacing:2}}>كود الغرفة</div>
        <div style={{color:T.gold,fontSize:48,fontWeight:900,letterSpacing:10}}>{roomCode}</div>
      </div>
      <div style={{width:'100%',maxWidth:320,display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
        <button onClick={copy} style={{background:copied?`linear-gradient(135deg,${T.green},${T.greenL})`:'#0a1a0a',color:copied?'#fff':T.smoke,border:`1.5px solid ${copied?T.greenL:'#333'}`,borderRadius:12,padding:'11px 20px',fontWeight:700,cursor:'pointer',fontSize:14}}>{copied?'✅ تم النسخ!':'📋 انسخ رابط الدعوة'}</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`تحداني في بلوت المملكة! 🃏\nكود: ${roomCode}\n${shareLink}`)}`} target="_blank" rel="noreferrer" style={{background:'linear-gradient(135deg,#075e54,#128c7e)',color:'#fff',borderRadius:12,padding:'11px 20px',fontWeight:700,fontSize:14,textDecoration:'none',display:'block',textAlign:'center'}}>📱 شارك عبر واتساب</a>
      </div>
      <div style={{width:'100%',maxWidth:320,marginBottom:20}}>
        <div style={{color:T.smoke,fontSize:11,marginBottom:10,textAlign:'center'}}>اللاعبون ({safePlayers.filter(p=>p).length} / 4)</div>
        {[0,1,2,3].map(i=>(<div key={i} style={{background:safePlayers[i]?'#0a2a0a':'#071010',border:`1.5px solid ${safePlayers[i]?TEAM_COLORS[i%2]+'44':'#1a2a1a'}`,borderRadius:14,padding:'12px 16px',marginBottom:8,display:'flex',alignItems:'center',gap:12}}><div style={{width:36,height:36,borderRadius:'50%',background:safePlayers[i]?`${TEAM_COLORS[i%2]}22`:'#1a2a1a',border:`2px solid ${safePlayers[i]?TEAM_COLORS[i%2]:'#333'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{safePlayers[i]?AVATARS[i%8]:'⬜'}</div><div style={{flex:1}}><div style={{color:safePlayers[i]?TEAM_COLORS[i%2]:'#444',fontWeight:700,fontSize:14}}>{safePlayers[i]||`اللاعب ${i+1}`}{i===myIndex&&<span style={{color:T.gold,fontSize:9,background:`${T.gold}22`,borderRadius:6,padding:'1px 6px',marginRight:6}}> أنت</span>}</div><div style={{color:'#555',fontSize:10}}>Team {i%2===0?'A':'B'}</div></div>{safePlayers[i]&&<div style={{background:`${T.greenL}22`,color:T.greenL,borderRadius:10,padding:'3px 10px',fontSize:10,fontWeight:700}}>متصل ✓</div>}</div>))}
      </div>
      {isHost&&safePlayers.filter(p=>p).length>=2?(<button onClick={onStart} style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,border:'none',borderRadius:16,padding:'16px 48px',fontWeight:900,cursor:'pointer',fontSize:20,width:'100%',maxWidth:320}}>🎮 ابدأ اللعبة!</button>):isHost?(<div style={{color:T.smoke,fontSize:13,textAlign:'center',padding:'12px 20px'}}>انتظر لاعب واحد على الأقل...</div>):null}
    </div>
  );
}

// ── Chat ───────────────────────────────────────────────────
function ChatPanel({roomCode,userName,avatar}){
  const[messages,setMessages]=useState([]);
  const[input,setInput]=useState('');
  const[open,setOpen]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{
    if(!roomCode)return;
    const unsub=onSnapshot(query(collection(db,'rooms',roomCode,'messages'),orderBy('ts','asc'),limit(50)),snap=>{
      setMessages(snap.docs.map(d=>({id:d.id,...d.data()})));
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),100);
    });
    return unsub;
  },[roomCode]);
  const send=async()=>{
    if(!input.trim()||!roomCode)return;
    await addDoc(collection(db,'rooms',roomCode,'messages'),{text:input.trim(),name:userName,avatar,ts:serverTimestamp()});
    setInput('');
  };
  return(
    <div style={{position:'fixed',bottom:70,right:12,zIndex:400}}>
      <button onClick={()=>setOpen(o=>!o)} style={{background:`linear-gradient(135deg,${T.green},${T.greenL})`,color:'#fff',border:`2px solid ${T.gold}`,borderRadius:'50%',width:48,height:48,cursor:'pointer',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 4px 16px ${T.green}88`}}>💬</button>
      {open&&(
        <div style={{position:'absolute',bottom:56,right:0,width:280,background:`linear-gradient(135deg,#0D2A1A,#071f10)`,border:`2px solid ${T.gold}44`,borderRadius:16,overflow:'hidden',boxShadow:`0 8px 32px #00000088`}}>
          <div style={{background:'#071f10',padding:'10px 14px',borderBottom:`1px solid ${T.border}`,color:T.gold,fontWeight:700,fontSize:13}}>💬 الدردشة</div>
          <div style={{height:200,overflowY:'auto',padding:10}}>
            {messages.map(m=>(<div key={m.id} style={{marginBottom:8}}><span style={{color:T.gold,fontSize:11,fontWeight:700}}>{m.avatar} {m.name}:</span><span style={{color:T.cream,fontSize:12,marginRight:6}}>{m.text}</span></div>))}
            <div ref={bottomRef}/>
          </div>
          <div style={{display:'flex',gap:6,padding:8,borderTop:`1px solid ${T.border}`}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="اكتب رسالة..." style={{flex:1,background:'#0a2a0a',border:`1px solid ${T.greenL}`,borderRadius:8,padding:'6px 10px',color:'#fff',fontSize:12,outline:'none',direction:'rtl'}}/>
            <button onClick={send} style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontWeight:700,fontSize:12}}>إرسال</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bottom Navigation ──────────────────────────────────────
function BottomNav({active,onChange}){
  const tabs=[
    {id:'home',  icon:'🏠', label:'الرئيسية'},
    {id:'store', icon:'🛍️', label:'المتجر'},
    {id:'board', icon:'🏆', label:'المتصدرون'},
    {id:'profile',icon:'👤',label:'ملفي'},
  ];
  return(
    <div style={{position:'fixed',bottom:0,left:0,right:0,
      background:'rgba(7,7,15,0.95)',backdropFilter:'blur(12px)',
      borderTop:`1px solid ${T.border}`,zIndex:200,
      display:'flex',justifyContent:'space-around',padding:'8px 0 12px'}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>onChange(t.id)} style={{
          background:'transparent',border:'none',cursor:'pointer',
          display:'flex',flexDirection:'column',alignItems:'center',gap:3,
          padding:'4px 12px',borderRadius:12,
          transition:'all 0.2s',
          opacity:active===t.id?1:0.5}}>
          <div style={{fontSize:20,filter:active===t.id?`drop-shadow(0 0 8px ${T.gold})`:'none'}}>{t.icon}</div>
          <div style={{fontSize:9,fontWeight:700,color:active===t.id?T.gold:T.smoke,letterSpacing:0.5}}>{t.label}</div>
          {active===t.id&&<div style={{width:4,height:4,borderRadius:'50%',background:T.gold,marginTop:1}}/>}
        </button>
      ))}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function App(){
  const[navTab,setNavTab]=useState('home');
  const[screen,setScreen]=useState('home'); // home|lobby|game
  const[user,setUser]=useState(null);
  const[profile,setProfile]=useState(null);
  const[authLoading,setAuthLoading]=useState(true);
  const[playerName,setPlayerName]=useState('');
  const[playerAvatar,setPlayerAvatar]=useState(AVATARS[0]);
  const[playerCity,setPlayerCity]=useState('الرياض');
  const[joinCode,setJoinCode]=useState('');
  const[roomCode,setRoomCode]=useState('');
  const[myIndex,setMyIndex]=useState(0);
  const[isHost,setIsHost]=useState(false);
  const[error,setError]=useState('');
  const[gameData,setGameData]=useState(null);
  const[timer,setTimer]=useState(10);
  const[reactions,setReactions]=useState([]);
  const[showProfile,setShowProfile]=useState(false);
  const[showLeaderboard,setShowLeaderboard]=useState(false);
  const[showAvatarPicker,setShowAvatarPicker]=useState(false);

  const unsubRef=useRef(null);
  const botRef=useRef(null);
  const timerRef=useRef(null);
  const roomCodeRef=useRef('');
  const myIndexRef=useRef(0);
  const isHostRef=useRef(false);
  const gameDataRef=useRef(null);

  useEffect(()=>{roomCodeRef.current=roomCode;},[roomCode]);
  useEffect(()=>{myIndexRef.current=myIndex;},[myIndex]);
  useEffect(()=>{isHostRef.current=isHost;},[isHost]);
  useEffect(()=>{gameDataRef.current=gameData;},[gameData]);

  const shareLink=typeof window!=='undefined'?`${window.location.origin}?room=${roomCode}`:'';

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const room=params.get('room');
    if(room)setJoinCode(room);
  },[]);

  // Auth
  useEffect(()=>{
    let unsub=()=>{};
    const initAuth=async()=>{
      try{
        const{getAuth,onAuthStateChanged}=await import('firebase/auth');
        const auth=getAuth();
        unsub=onAuthStateChanged(auth,async(u)=>{
          setUser(u);setAuthLoading(false);
          if(u){
            const profileRef=doc(db,'users',u.uid);
            const snap=await getDoc(profileRef);
            if(snap.exists()){
              const data=snap.data();
              setProfile(data);
              setPlayerName(data.name||u.displayName||'');
              setPlayerAvatar(data.avatar||AVATARS[0]);
              setPlayerCity(data.city||'الرياض');
            }else{
              const newProfile={name:u.displayName||'لاعب',avatar:AVATARS[0],city:'الرياض',wins:0,losses:0,coins:100,owned:{decks:['classic'],tables:['classic'],reactions:[]},activeDeck:'classic',activeTable:'classic',createdAt:Date.now()};
              await setDoc(doc(db,'users',u.uid),newProfile);
              setProfile(newProfile);setPlayerName(u.displayName||'');
            }
          }
        });
      }catch(e){console.error('Auth:',e);setAuthLoading(false);}
    };
    initAuth();
    return()=>unsub();
  },[]);

  const signInWithGoogle=async()=>{
    try{
      const{getAuth,GoogleAuthProvider,signInWithPopup}=await import('firebase/auth');
      const auth=getAuth();
      const provider=new GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      await signInWithPopup(auth,provider);
    }catch(e){setError('فشل تسجيل الدخول');}
  };

  const signOutUser=async()=>{
    try{
      const{getAuth,signOut}=await import('firebase/auth');
      await signOut(getAuth());
      setUser(null);setProfile(null);setShowProfile(false);
    }catch(e){}
  };

  const saveProfile=async()=>{
    if(!user)return;
    const data={name:playerName,avatar:playerAvatar,city:playerCity};
    try{await updateDoc(doc(db,'users',user.uid),data);setProfile(p=>({...p,...data}));}catch(e){}
  };

  const updateStats=async(won)=>{
    if(!user)return;
    try{
      await updateDoc(doc(db,'users',user.uid),{
        wins:increment(won?1:0),losses:increment(won?0:1),
        coins:increment(won?50:10),
      });
      const snap=await getDoc(doc(db,'users',user.uid));
      if(snap.exists())setProfile(snap.data());
    }catch(e){}
  };

  const subscribeRoom=useCallback((code)=>{
    if(unsubRef.current)unsubRef.current();
    unsubRef.current=onSnapshot(doc(db,'rooms',code),(snap)=>{
      if(snap.exists()){
        const data=snap.data();setGameData(data);
        if(['bidding','playing','roundEnd'].includes(data.phase))setScreen('game');
        else if(data.phase==='lobby')setScreen('lobby');
      }
    },err=>console.error(err));
  },[]);

  useEffect(()=>()=>{if(unsubRef.current)unsubRef.current();},[]);

  const addReaction=(emoji)=>{
    const id=Date.now();
    setReactions(r=>[...r,{id,emoji,x:Math.random()*80+10}]);
    setTimeout(()=>setReactions(r=>r.filter(x=>x.id!==id)),2000);
  };

  const createRoom=async()=>{
    if(!playerName.trim()){setError('أدخل اسمك أولاً');return;}
    setError('');
    try{
      await saveProfile();
      const code=genCode();
      await setDoc(doc(db,'rooms',code),{phase:'lobby',players:[playerName.trim(),null,null,null],avatars:[playerAvatar,null,null,null],h0:[],h1:[],h2:[],h3:[],bids:[],contract:null,biddingTurn:0,trickPlays:[],leader:0,roundScores:[0,0],gameScore:[0,0],trickResult:null,roundResult:null,matchWinner:null,hostIndex:0,createdAt:Date.now()});
      setRoomCode(code);roomCodeRef.current=code;
      setMyIndex(0);myIndexRef.current=0;
 