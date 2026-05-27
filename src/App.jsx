import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase';
import {
  doc, setDoc, onSnapshot, updateDoc, getDoc,
  collection, query, orderBy, limit, getDocs,
  addDoc, serverTimestamp
} from 'firebase/firestore';
// Auth imports loaded dynamically

// ── Design Tokens ─────────────────────────────────────────
const T = {
  gold:'#C9A84C', goldL:'#F0C060', goldD:'#8B6914',
  green:'#006C35', greenL:'#1a8a4a', greenD:'#004D26',
  night:'#0A0F0A', felt:'#0D4A2A', feltL:'#1a5c35',
  cream:'#FDF6E3', red:'#C0392B', redL:'#E74C3C',
  blue:'#1A4A8A', blueL:'#2E86C1', smoke:'#888',
  border:'#C9A84C33',
};
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

// ── Auth (lazy init to avoid crashes) ────────────────────
let _auth = null;
let _googleProvider = null;
function getFirebaseAuth() {
  if (!_auth) {
    try {
      _auth = getAuth();
      _googleProvider = new GoogleAuthProvider();
      _googleProvider.setCustomParameters({ prompt: 'select_account' });
    } catch(e) { console.error('Auth init:', e); }
  }
  return { auth: _auth, googleProvider: _googleProvider };
}

// ── Sound ─────────────────────────────────────────────────
function playTone(freq, vol=0.1, type='sine') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const freqs = Array.isArray(freq) ? freq : [freq];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = f;
      gain.gain.setValueAtTime(vol, ctx.currentTime + i*0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.12 + 0.15);
      osc.start(ctx.currentTime + i*0.12);
      osc.stop(ctx.currentTime + i*0.12 + 0.15);
    });
  } catch(e) {}
}
const sounds = {
  deal: () => playTone(440, 0.1, 'triangle'),
  play: () => playTone(520, 0.08, 'sine'),
  win:  () => playTone([523,659,784], 0.15, 'sine'),
  gahwa:() => playTone([784,659,523,659,784], 0.2, 'triangle'),
  tick: () => playTone(880, 0.05, 'square'),
};

// ── Game Logic ────────────────────────────────────────────
function buildDeck() {
  const d = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      d.push({ suit, rank, id:`${rank.symbol}${suit.symbol}` });
  return d;
}
function shuffle(deck) {
  const d = [...deck];
  for (let i=d.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [d[i],d[j]] = [d[j],d[i]];
  }
  return d;
}
function dealHands(deck) {
  return { h0:deck.slice(0,8), h1:deck.slice(8,16), h2:deck.slice(16,24), h3:deck.slice(24,32) };
}
function getHands(gd) {
  return [gd.h0||[], gd.h1||[], gd.h2||[], gd.h3||[]];
}
function cardValue(card, mode, trump) {
  if (!card) return 0;
  if (mode === 'sun') return card.rank.sun;
  return card.suit.symbol === trump ? card.rank.hokumTrump : card.rank.hokumPlain;
}
function cardStrength(card, mode, trump) {
  const isTrump = mode === 'hokum' && card.suit.symbol === trump;
  const order = isTrump ? HOKUM_TRUMP_ORDER : PLAIN_ORDER;
  return isTrump ? 100 + (order.length - order.indexOf(card.rank.symbol))
    : order.length - order.indexOf(card.rank.symbol);
}
function trickWinner(plays, mode, trump) {
  const ledSuit = plays[0].card.suit.symbol;
  return plays.reduce((best, cur) => {
    const bT = mode==='hokum' && best.card.suit.symbol===trump;
    const cT = mode==='hokum' && cur.card.suit.symbol===trump;
    if (cT && !bT) return cur;
    if (bT && !cT) return best;
    if (!cT && cur.card.suit.symbol !== ledSuit) return best;
    if (!bT && best.card.suit.symbol !== ledSuit) return cur;
    return cardStrength(cur.card,mode,trump) > cardStrength(best.card,mode,trump) ? cur : best;
  });
}
function calcResult(roundScores, contract) {
  const { type, bidTeam } = contract;
  const bidScore = roundScores[bidTeam];
  const oppScore = roundScores[1-bidTeam];
  const total = bidScore + oppScore;
  const isGahwa = oppScore === 0;
  if (type === 'sun') {
    const made = bidScore > oppScore;
    return { made, isGahwa,
      bidTeamFinal: made ? total*2 : 0, oppTeamFinal: made ? 0 : total*2,
      reason: made ? (isGahwa ? '☕ صن + قهوة!' : '☀️ صن نجح!') : '☀️ صن فشل!' };
  }
  if (isGahwa) return { made:true, isGahwa:true,
    bidTeamFinal: total*2, oppTeamFinal: 0, reason: '☕ قهوة! ضعف النقاط!' };
  const made = bidScore >= 82;
  return { made, isGahwa: false,
    bidTeamFinal: made ? bidScore : 0, oppTeamFinal: made ? oppScore : total,
    reason: made ? `✅ حكم نجح! (${bidScore}≥82)` : `❌ حكم فشل!` };
}
function botPickCard(hand, trickPlays, mode, trump) {
  const ledSuit = trickPlays.length > 0 ? trickPlays[0].card.suit.symbol : null;
  if (ledSuit) {
    const following = hand.filter(c => c.suit.symbol === ledSuit);
    if (following.length > 0)
      return following.sort((a,b) => cardStrength(b,mode,trump) - cardStrength(a,mode,trump))[0];
    const trumpCards = hand.filter(c => c.suit.symbol === trump && mode === 'hokum');
    if (trumpCards.length > 0)
      return trumpCards.sort((a,b) => cardStrength(b,mode,trump) - cardStrength(a,mode,trump))[0];
  }
  return [...hand].sort((a,b) => cardValue(a,mode,trump) - cardValue(b,mode,trump))[0];
}
function botBid(hand, passCount) {
  let bestSuit = null, bestScore = 0;
  for (const suit of SUITS) {
    const sc = hand.filter(c => c.suit.symbol === suit.symbol).reduce((s,c) => {
      if (c.rank.symbol === 'J') return s+5;
      if (c.rank.symbol === '9') return s+4;
      if (c.rank.symbol === 'A') return s+3;
      return s+1;
    }, 0);
    if (sc > bestScore) { bestScore = sc; bestSuit = suit; }
  }
  if (bestScore >= 6 || passCount >= 2) return { type:'hokum', trump:bestSuit.symbol, trumpName:bestSuit.name };
  return { type: 'pass' };
}
function genCode() { return Math.floor(100000 + Math.random()*900000).toString(); }

// ── Card Component ────────────────────────────────────────
function Card({ card, mode, trump, highlight, winner, onClick, disabled, faceDown, small }) {
  const isTrump = mode === 'hokum' && card?.suit?.symbol === trump;
  const val = card ? cardValue(card, mode, trump) : 0;
  const isRed = card?.suit?.isRed;
  const w = small ? 44 : 56; const h = small ? 64 : 80;
  if (faceDown) return (
    <div style={{width:w, height:h, borderRadius:10, margin:3,
      background:`linear-gradient(135deg,${T.green},${T.greenD})`,
      border:`2px solid ${T.gold}`,
      display:'flex', alignItems:'center', justifyContent:'center',
      boxShadow:`0 4px 12px #00000066`, position:'relative', overflow:'hidden', flexShrink:0}}>
      <div style={{position:'absolute', inset:4, border:`1px solid ${T.gold}44`, borderRadius:6,
        backgroundImage:`repeating-linear-gradient(45deg,${T.gold}11 0px,${T.gold}11 1px,transparent 1px,transparent 8px)`}}/>
      <div style={{fontSize: small ? 14 : 18, zIndex:1}}>🃏</div>
    </div>
  );
  return (
    <div onClick={!disabled ? () => { sounds.play(); onClick && onClick(); } : undefined} style={{
      width:w, height:h,
      background: winner ? 'linear-gradient(135deg,#fffbe6,#fff9d6)'
        : highlight ? 'linear-gradient(135deg,#f0fff4,#e8fef0)'
        : 'linear-gradient(135deg,#ffffff,#f8f8f8)',
      border:`2px solid ${winner ? T.gold : highlight ? T.greenL : isTrump ? T.gold+'88' : '#ddd'}`,
      borderRadius:10, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'space-between', padding:'4px 3px',
      boxShadow: winner ? `0 0 20px ${T.gold}88,0 6px 16px #0004`
        : highlight ? `0 0 12px ${T.greenL}66,0 4px 10px #0003` : '0 3px 8px #0002',
      cursor: disabled ? 'default' : 'pointer',
      transform: winner ? 'scale(1.15) translateY(-6px)' : highlight ? 'translateY(-8px) scale(1.03)' : 'none',
      transition:'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      margin:3, position:'relative', flexShrink:0}}>
      <div style={{fontSize: small?9:11, fontWeight:900, color: isRed?T.red:T.night, alignSelf:'flex-start', paddingLeft:3, lineHeight:1}}>{card.rank.symbol}</div>
      <div style={{fontSize: small?18:24, color: isRed?T.red:T.night, lineHeight:1}}>{card.suit.symbol}</div>
      <div style={{fontSize: small?8:10, color: isRed?T.red:T.night, fontWeight:700}}>{card.rank.nameAr}</div>
      {val > 0 && (
        <div style={{position:'absolute', top:-7, right:-7,
          background: isTrump ? `linear-gradient(135deg,${T.gold},${T.goldL})` : `linear-gradient(135deg,${T.green},${T.greenL})`,
          color: isTrump ? T.night : '#fff', borderRadius:'50%', width:16, height:16,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:7, fontWeight:900, border:'2px solid white', boxShadow:'0 2px 4px #0003'}}>{val}</div>
      )}
      {isTrump && <div style={{position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', fontSize:10}}>👑</div>}
      {winner && <div style={{position:'absolute', bottom:-14, left:'50%', transform:'translateX(-50%)', fontSize:12}}>🏆</div>}
      {highlight && <div style={{position:'absolute', inset:-2, borderRadius:11, border:`2px solid ${T.greenL}`, animation:'pulse-border 1s infinite', pointerEvents:'none'}}/>}
    </div>
  );
}

// ── Player Badge ──────────────────────────────────────────
function PlayerBadge({ name, avatar, teamColor, isActive, isMe, cardCount, timer }) {
  return (
    <div style={{display:'inline-flex', alignItems:'center', gap:6,
      background: isActive ? `${teamColor}22` : '#0a1a0a',
      border:`2px solid ${isActive ? teamColor : '#1a2a1a'}`,
      borderRadius:24, padding:'5px 12px',
      transition:'all 0.3s ease',
      boxShadow: isActive ? `0 0 16px ${teamColor}44` : 'none'}}>
      <span style={{fontSize:18}}>{avatar || '🧔'}</span>
      <div>
        <div style={{color: isActive ? teamColor : T.smoke, fontWeight:700, fontSize:12, lineHeight:1.2}}>
          {name}{isMe && <span style={{color:T.gold, fontSize:9}}> ✦</span>}
        </div>
        <div style={{color:'#555', fontSize:9}}>{cardCount !== undefined ? `${cardCount} ورقة` : ''}</div>
      </div>
      {isActive && isMe && timer > 0 && (
        <div style={{background: timer<=3 ? T.redL : timer<=6 ? '#F39C12' : T.greenL,
          color:'#fff', borderRadius:'50%', width:24, height:24,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:11, fontWeight:900, animation: timer<=3 ? 'pulse 0.5s infinite' : 'none',
          boxShadow:`0 0 8px ${timer<=3 ? T.redL : T.greenL}88`}}>{timer}</div>
      )}
    </div>
  );
}

// ── Profile Screen ────────────────────────────────────────
function ProfileScreen({ user, profile, onClose }) {
  const wins = profile?.wins || 0;
  const losses = profile?.losses || 0;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins/total)*100) : 0;
  return (
    <div style={{position:'fixed', inset:0, background:'#000c',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:300, padding:16, backdropFilter:'blur(6px)'}}>
      <div style={{background:`linear-gradient(135deg,#0D2A1A,#071f10)`,
        border:`2px solid ${T.gold}`, borderRadius:20, padding:28,
        maxWidth:340, width:'100%', boxShadow:`0 0 60px ${T.gold}22`}}>
        <div style={{textAlign:'center', marginBottom:20}}>
          <div style={{fontSize:56, marginBottom:8}}>{profile?.avatar || '🧔'}</div>
          <div style={{color:T.gold, fontSize:20, fontWeight:900}}>{profile?.name || user?.displayName || 'لاعب'}</div>
          <div style={{color:T.smoke, fontSize:12, marginTop:4}}>{user?.email}</div>
          {profile?.city && <div style={{color:T.greenL, fontSize:12, marginTop:2}}>📍 {profile.city}</div>}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20}}>
          {[
            {label:'انتصارات', value:wins, color:T.greenL},
            {label:'هزائم', value:losses, color:T.redL},
            {label:'نسبة الفوز', value:`${winRate}%`, color:T.gold},
          ].map(s => (
            <div key={s.label} style={{background:'#071f10', border:`1px solid ${s.color}33`, borderRadius:12, padding:'10px', textAlign:'center'}}>
              <div style={{color:s.color, fontSize:22, fontWeight:900}}>{s.value}</div>
              <div style={{color:T.smoke, fontSize:10}}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{background:'#071f10', border:`1px solid ${T.border}`, borderRadius:12, padding:'10px', textAlign:'center', marginBottom:16}}>
          <div style={{color:T.cream, fontSize:16, fontWeight:700}}>{total} مباراة</div>
          <div style={{color:T.smoke, fontSize:11}}>إجمالي المباريات</div>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button onClick={onClose} style={{flex:1,
            background:`linear-gradient(135deg,${T.green},${T.greenL})`,
            color:'#fff', border:'none', borderRadius:12, padding:'12px',
            fontWeight:700, cursor:'pointer', fontSize:14}}>إغلاق</button>
          <button onClick={() => { const { auth } = getFirebaseAuth(); if(auth) signOut(auth); }} style={{
            background:'#3a0a0a', color:T.redL,
            border:`1px solid ${T.red}44`, borderRadius:12, padding:'12px 16px',
            fontWeight:700, cursor:'pointer', fontSize:13}}>خروج</button>
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────
function LeaderboardScreen({ onClose, currentUserId }) {
  const [players, setPlayers] = useState([]);
  const [city, setCity] = useState('كل المدن');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const q = query(collection(db,'users'), orderBy('wins','desc'), limit(50));
        const snap = await getDocs(q);
        setPlayers(snap.docs.map(d => ({id:d.id, ...d.data()})));
      } catch(e) { console.error(e); }
      setLoading(false);
    };
    fetch();
  }, []);
  const filtered = city === 'كل المدن' ? players : players.filter(p => p.city === city);
  return (
    <div style={{position:'fixed', inset:0, background:'#000e',
      display:'flex', flexDirection:'column', zIndex:300, backdropFilter:'blur(6px)'}}>
      <div style={{background:`linear-gradient(135deg,#071f10,#0a2a0a)`,
        border:`2px solid ${T.gold}`, borderRadius:'0 0 20px 20px', padding:'16px 20px',
        boxShadow:`0 4px 20px #00000088`}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{color:T.gold, fontSize:20, fontWeight:900}}>🏆 لوحة المتصدرين</div>
            <div style={{color:T.smoke, fontSize:12}}>أفضل اللاعبين</div>
          </div>
          <button onClick={onClose} style={{background:'transparent', color:T.smoke,
            border:`1px solid #333`, borderRadius:10, padding:'8px 14px', cursor:'pointer', fontSize:13}}>✕ إغلاق</button>
        </div>
        <div style={{display:'flex', gap:6, marginTop:12, overflowX:'auto', paddingBottom:4}}>
          {CITIES.map(c => (
            <button key={c} onClick={() => setCity(c)} style={{
              background: city===c ? `linear-gradient(135deg,${T.gold},${T.goldL})` : '#0a1a0a',
              color: city===c ? T.night : T.smoke,
              border:`1px solid ${city===c ? T.gold : '#333'}`,
              borderRadius:20, padding:'5px 14px',
              fontWeight: city===c ? 700 : 400, cursor:'pointer', fontSize:12, whiteSpace:'nowrap'}}>{c}</button>
          ))}
        </div>
      </div>
      <div style={{flex:1, overflowY:'auto', padding:'12px 16px'}}>
        {loading ? (
          <div style={{textAlign:'center', color:T.smoke, padding:40}}>جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:'center', color:T.smoke, padding:40}}>لا يوجد لاعبون بعد</div>
        ) : filtered.map((p, i) => {
          const total = (p.wins||0) + (p.losses||0);
          const wr = total > 0 ? Math.round(((p.wins||0)/total)*100) : 0;
          const isMe = p.id === currentUserId;
          return (
            <div key={p.id} style={{
              background: isMe ? `${T.gold}11` : '#071f10',
              border:`1.5px solid ${isMe ? T.gold : i<3 ? TEAM_COLORS[0]+'44' : '#1a2a1a'}`,
              borderRadius:14, padding:'12px 16px', marginBottom:8,
              display:'flex', alignItems:'center', gap:12}}>
              <div style={{width:32, height:32, borderRadius:'50%',
                background: i===0 ? `linear-gradient(135deg,${T.gold},${T.goldL})`
                  : i===1 ? 'linear-gradient(135deg,#aaa,#ccc)'
                  : i===2 ? 'linear-gradient(135deg,#cd7f32,#e8a050)' : '#1a2a1a',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: i<3 ? 16 : 13, fontWeight:900,
                color: i<3 ? T.night : T.smoke}}>
                {i < 3 ? ['🥇','🥈','🥉'][i] : i+1}
              </div>
              <div style={{fontSize:24}}>{p.avatar || '🧔'}</div>
              <div style={{flex:1}}>
                <div style={{color: isMe ? T.gold : T.cream, fontWeight:700, fontSize:14}}>
                  {p.name || 'لاعب'}{isMe && <span style={{color:T.gold, fontSize:10}}> (أنت)</span>}
                </div>
                <div style={{color:T.smoke, fontSize:11}}>{p.city || '—'} · {total} مباراة</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{color:T.greenL, fontSize:18, fontWeight:900}}>{p.wins||0}</div>
                <div style={{color:T.smoke, fontSize:9}}>انتصار</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{color:T.gold, fontSize:16, fontWeight:900}}>{wr}%</div>
                <div style={{color:T.smoke, fontSize:9}}>فوز</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Bidding Modal ─────────────────────────────────────────
function BiddingModal({ playerIndex, onBid, canSun, passCount, playerName, avatar }) {
  const [step, setStep] = useState('choose');
  return (
    <div style={{position:'fixed', inset:0,
      background:'linear-gradient(135deg,#000c,#001a0acc)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:100, padding:16, backdropFilter:'blur(4px)'}}>
      <div style={{background:`linear-gradient(135deg,#0D2A1A,#071f10)`,
        border:`2px solid ${T.gold}`, borderRadius:20, padding:28,
        maxWidth:320, width:'100%',
        boxShadow:`0 0 60px ${T.gold}33,0 20px 40px #00000088`}}>
        <div style={{textAlign:'center', marginBottom:20}}>
          <div style={{fontSize:40, marginBottom:6}}>{avatar || AVATARS[playerIndex%8]}</div>
          <div style={{color:T.gold, fontWeight:900, fontSize:18, textShadow:`0 0 20px ${T.gold}44`}}>
            {playerName || `اللاعب ${playerIndex+1}`}
          </div>
          <div style={{color:T.gold, fontSize:13, marginTop:2}}>دورك للمزايدة</div>
          {passCount > 0 && (
            <div style={{color:T.smoke, fontSize:11, marginTop:4,
              background:'#ffffff11', borderRadius:8, padding:'3px 10px', display:'inline-block'}}>
              {passCount} پاس قبلك
            </div>
          )}
        </div>
        {step === 'choose' ? (
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            <button onClick={() => setStep('pickSuit')} style={{
              background:`linear-gradient(135deg,${T.green},${T.greenL})`,
              color:'#fff', border:`2px solid ${T.greenL}`,
              borderRadius:14, padding:'15px', fontWeight:800,
              cursor:'pointer', fontSize:16, boxShadow:`0 4px 16px ${T.green}88`}}>
              🎯 حكم — اختر الأتو
            </button>
            {canSun && (
              <button onClick={() => onBid({type:'sun'})} style={{
                background:`linear-gradient(135deg,#6B4A00,#8B6400)`,
                color:T.goldL, border:`2px solid ${T.gold}`,
                borderRadius:14, padding:'15px', fontWeight:800,
                cursor:'pointer', fontSize:16, boxShadow:`0 4px 16px ${T.goldD}88`}}>
                ☀️ صن — بدون أتو (2×)
              </button>
            )}
            <button onClick={() => onBid({type:'pass'})} style={{
              background:'transparent', color:T.smoke,
              border:'1.5px solid #333', borderRadius:14,
              padding:'12px', fontWeight:700, cursor:'pointer', fontSize:14}}>
              ⏭ پاس
            </button>
          </div>
        ) : (
          <div>
            <div style={{color:T.goldL, fontWeight:700, marginBottom:14, textAlign:'center', fontSize:15}}>
              اختر لون الأتو 👑
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              {SUITS.map(s => (
                <button key={s.symbol}
                  onClick={() => onBid({type:'hokum', trump:s.symbol, trumpName:s.name})}
                  style={{background: s.isRed ? '#3a0a0a' : '#0a0a1a',
                    color: s.isRed ? '#ff7070' : '#aad4ff',
                    border:`2px solid ${s.isRed ? T.red : T.blue}`,
                    borderRadius:14, padding:'16px 10px',
                    fontWeight:800, cursor:'pointer', fontSize:28, textAlign:'center',
                    boxShadow:`0 4px 12px ${s.isRed ? T.red : T.blue}44`}}>
                  {s.symbol}
                  <div style={{fontSize:12, marginTop:4}}>{s.name}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep('choose')} style={{
              marginTop:12, background:'transparent', color:T.smoke,
              border:'1px solid #333', borderRadius:10, padding:'10px',
              cursor:'pointer', fontSize:12, width:'100%'}}>← رجوع</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Round End ─────────────────────────────────────────────
function RoundEndScreen({ result, contract, roundScores, gameScore, onNext, matchWinner }) {
  useEffect(() => {
    if (result.isGahwa) sounds.gahwa();
    else if (result.made) sounds.win();
  }, []);
  return (
    <div style={{position:'fixed', inset:0,
      background:'linear-gradient(135deg,#000e,#001a0acc)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:200, padding:16, backdropFilter:'blur(6px)'}}>
      <div style={{background:`linear-gradient(135deg,#0D2A1A,#071f10)`,
        border:`2px solid ${result.isGahwa ? T.gold : result.made ? T.greenL : T.redL}`,
        borderRadius:20, padding:28, maxWidth:360, width:'100%',
        boxShadow:`0 0 60px ${result.isGahwa ? T.gold : result.made ? T.greenL : T.redL}44`}}>
        <div style={{textAlign:'center', fontSize:56, marginBottom:8, animation:'bounce 0.5s ease'}}>
          {result.isGahwa ? '☕' : result.made ? '🎉' : '😔'}
        </div>
        <div style={{textAlign:'center',
          color: result.isGahwa ? T.gold : result.made ? T.greenL : T.redL,
          fontWeight:900, fontSize:18, marginBottom:20, textShadow:'0 0 20px currentColor'}}>
          {result.reason}
        </div>
        <div style={{display:'flex', gap:12, marginBottom:16}}>
          {[0,1].map(t => (
            <div key={t} style={{flex:1,
              background: contract.bidTeam===t ? '#0a2a0a' : '#071010',
              border:`1.5px solid ${contract.bidTeam===t ? T.greenL+'44' : '#1a2a1a'}`,
              borderRadius:14, padding:'12px', textAlign:'center'}}>
              <div style={{color:TEAM_COLORS[t], fontWeight:700, fontSize:12}}>
                Team {t===0?'A':'B'}{contract.bidTeam===t && <span style={{color:T.gold}}> 📋</span>}
              </div>
              <div style={{color:T.smoke, fontSize:11, marginBottom:4}}>جولة: {roundScores[t]}</div>
              <div style={{color:T.gold, fontSize:26, fontWeight:900, textShadow:`0 0 12px ${T.gold}66`}}>
                +{contract.bidTeam===t ? result.bidTeamFinal : result.oppTeamFinal}
              </div>
            </div>
          ))}
        </div>
        <div style={{background:'#071f10', borderRadius:14, padding:14, marginBottom:16, border:`1px solid ${T.border}`}}>
          <div style={{color:T.gold, fontSize:12, fontWeight:700, marginBottom:10, textAlign:'center'}}>
            🏆 المباراة — أول فريق يصل 152
          </div>
          {[0,1].map(t => (
            <div key={t} style={{marginBottom:10}}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4}}>
                <span style={{color:TEAM_COLORS[t], fontWeight:700}}>Team {t===0?'A':'B'}</span>
                <span style={{color:T.gold, fontWeight:700}}>{gameScore[t]} / 152</span>
              </div>
              <div style={{height:8, background:'#1a2a1a', borderRadius:4, overflow:'hidden'}}>
                <div style={{height:'100%', borderRadius:4,
                  width:`${Math.min((gameScore[t]/152)*100, 100)}%`,
                  background:`linear-gradient(to right,${TEAM_COLORS[t]},${TEAM_COLORS[t]}cc)`,
                  transition:'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                  boxShadow:`0 0 8px ${TEAM_COLORS[t]}88`}}/>
              </div>
            </div>
          ))}
        </div>
        {matchWinner !== null ? (
          <div style={{textAlign:'center'}}>
            <div style={{color:T.gold, fontWeight:900, fontSize:22, marginBottom:14, textShadow:`0 0 20px ${T.gold}88`}}>
              🏆 Team {matchWinner===0?'A':'B'} فازت!
            </div>
            <button onClick={onNext} style={{
              background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
              color:T.night, border:'none', borderRadius:14,
              padding:'14px 32px', fontWeight:900, cursor:'pointer',
              fontSize:17, width:'100%', boxShadow:`0 4px 20px ${T.gold}66`}}>
              🔄 مباراة جديدة
            </button>
          </div>
        ) : (
          <button onClick={onNext} style={{
            background:`linear-gradient(135deg,${T.green},${T.greenL})`,
            color:'#fff', border:'none', borderRadius:14,
            padding:'14px', fontWeight:800, cursor:'pointer',
            fontSize:16, width:'100%', boxShadow:`0 4px 16px ${T.green}88`}}>
            ▶ جولة جديدة
          </button>
        )}
      </div>
    </div>
  );
}

// ── Lobby ─────────────────────────────────────────────────
function LobbyScreen({ roomCode, players, isHost, onStart, myIndex, shareLink }) {
  const [copied, setCopied] = useState(false);
  const safePlayers = players || [];
  const copy = () => {
    navigator.clipboard?.writeText(shareLink).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{minHeight:'100vh',
      background:`radial-gradient(ellipse at 50% 0%,${T.greenL}44,${T.felt} 60%,${T.night})`,
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:24,
      fontFamily:'Segoe UI,Tahoma,Arial,sans-serif'}}>
      <div style={{textAlign:'center', marginBottom:28}}>
        <div style={{fontSize:56, marginBottom:4}}>🃏</div>
        <h1 style={{color:T.gold, fontSize:32, fontWeight:900, margin:'0 0 4px',
          textShadow:`0 0 30px ${T.gold}44`, letterSpacing:2}}>بلوت المملكة</h1>
        <p style={{color:T.smoke, fontSize:13, margin:0}}>
          {isHost ? 'أنت المضيف — شارك الكود' : 'انتظر المضيف'}
        </p>
      </div>
      <div style={{background:`linear-gradient(135deg,#071f10,#0a2a0a)`,
        border:`2px solid ${T.gold}`, borderRadius:20, padding:'20px 40px', marginBottom:16,
        textAlign:'center', boxShadow:`0 0 40px ${T.gold}22,0 8px 24px #00000066`}}>
        <div style={{color:T.smoke, fontSize:11, marginBottom:6, letterSpacing:2}}>كود الغرفة</div>
        <div style={{color:T.gold, fontSize:48, fontWeight:900, letterSpacing:10,
          textShadow:`0 0 20px ${T.gold}66`}}>{roomCode}</div>
      </div>
      <div style={{width:'100%', maxWidth:320, display:'flex', flexDirection:'column', gap:10, marginBottom:16}}>
        <button onClick={copy} style={{
          background: copied ? `linear-gradient(135deg,${T.green},${T.greenL})` : '#0a1a0a',
          color: copied ? '#fff' : T.smoke,
          border:`1.5px solid ${copied ? T.greenL : '#333'}`,
          borderRadius:12, padding:'11px 20px',
          fontWeight:700, cursor:'pointer', fontSize:14, transition:'all 0.3s'}}>
          {copied ? '✅ تم النسخ!' : '📋 انسخ رابط الدعوة'}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`تحداني في بلوت المملكة! 🃏\nكود: ${roomCode}\n${shareLink}`)}`}
          target="_blank" rel="noreferrer"
          style={{background:'linear-gradient(135deg,#075e54,#128c7e)',
            color:'#fff', borderRadius:12, padding:'11px 20px',
            fontWeight:700, fontSize:14, textDecoration:'none',
            display:'block', textAlign:'center', boxShadow:'0 4px 16px #075e5488'}}>
          📱 شارك عبر واتساب
        </a>
      </div>
      <div style={{width:'100%', maxWidth:320, marginBottom:20}}>
        <div style={{color:T.smoke, fontSize:11, marginBottom:10, textAlign:'center', letterSpacing:1}}>
          اللاعبون ({safePlayers.filter(p=>p).length} / 4)
        </div>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            background: safePlayers[i] ? '#0a2a0a' : '#071010',
            border:`1.5px solid ${safePlayers[i] ? TEAM_COLORS[i%2]+'44' : '#1a2a1a'}`,
            borderRadius:14, padding:'12px 16px', marginBottom:8,
            display:'flex', alignItems:'center', gap:12, transition:'all 0.3s',
            boxShadow: safePlayers[i] ? `0 2px 8px ${TEAM_COLORS[i%2]}22` : 'none'}}>
            <div style={{width:36, height:36, borderRadius:'50%',
              background: safePlayers[i] ? `${TEAM_COLORS[i%2]}22` : '#1a2a1a',
              border:`2px solid ${safePlayers[i] ? TEAM_COLORS[i%2] : '#333'}`,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>
              {safePlayers[i] ? AVATARS[i%8] : '⬜'}
            </div>
            <div style={{flex:1}}>
              <div style={{color: safePlayers[i] ? TEAM_COLORS[i%2] : '#444', fontWeight:700, fontSize:14}}>
                {safePlayers[i] || `اللاعب ${i+1}`}
                {i === myIndex && (
                  <span style={{color:T.gold, fontSize:9, background:`${T.gold}22`, borderRadius:6, padding:'1px 6px', marginRight:6}}> أنت</span>
                )}
              </div>
              <div style={{color:'#555', fontSize:10}}>Team {i%2===0?'A':'B'}</div>
            </div>
            {safePlayers[i] && (
              <div style={{background:`${T.greenL}22`, color:T.greenL, borderRadius:10, padding:'3px 10px', fontSize:10, fontWeight:700}}>
                متصل ✓
              </div>
            )}
          </div>
        ))}
      </div>
      {isHost && safePlayers.filter(p=>p).length >= 2 ? (
        <button onClick={onStart} style={{
          background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
          color:T.night, border:'none', borderRadius:16,
          padding:'16px 48px', fontWeight:900, cursor:'pointer', fontSize:20,
          width:'100%', maxWidth:320, boxShadow:`0 6px 24px ${T.gold}66`, letterSpacing:1}}>
          🎮 ابدأ اللعبة!
        </button>
      ) : isHost ? (
        <div style={{color:T.smoke, fontSize:13, textAlign:'center',
          background:'#ffffff0a', borderRadius:10, padding:'12px 20px'}}>
          انتظر لاعب واحد على الأقل...
        </div>
      ) : null}
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────
function ChatPanel({ roomCode, userName, avatar }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => {
    if (!roomCode) return;
    const unsub = onSnapshot(
      query(collection(db,'rooms',roomCode,'messages'), orderBy('ts','asc'), limit(50)),
      snap => {
        setMessages(snap.docs.map(d => ({id:d.id, ...d.data()})));
        setTimeout(() => bottomRef.current?.scrollIntoView({behavior:'smooth'}), 100);
      }
    );
    return unsub;
  }, [roomCode]);
  const send = async () => {
    if (!input.trim() || !roomCode) return;
    await addDoc(collection(db,'rooms',roomCode,'messages'), {
      text: input.trim(), name: userName, avatar, ts: serverTimestamp()
    });
    setInput('');
  };
  return (
    <div style={{position:'fixed', bottom:60, right:12, zIndex:400}}>
      <button onClick={() => setOpen(o => !o)} style={{
        background:`linear-gradient(135deg,${T.green},${T.greenL})`,
        color:'#fff', border:`2px solid ${T.gold}`,
        borderRadius:'50%', width:48, height:48,
        cursor:'pointer', fontSize:22,
        boxShadow:`0 4px 16px ${T.green}88`,
        display:'flex', alignItems:'center', justifyContent:'center'}}>
        💬
      </button>
      {open && (
        <div style={{position:'absolute', bottom:56, right:0,
          width:280, background:`linear-gradient(135deg,#0D2A1A,#071f10)`,
          border:`2px solid ${T.gold}44`, borderRadius:16,
          overflow:'hidden', boxShadow:`0 8px 32px #00000088`}}>
          <div style={{background:'#071f10', padding:'10px 14px',
            borderBottom:`1px solid ${T.border}`, color:T.gold, fontWeight:700, fontSize:13}}>
            💬 الدردشة
          </div>
          <div style={{height:200, overflowY:'auto', padding:10}}>
            {messages.map(m => (
              <div key={m.id} style={{marginBottom:8}}>
                <span style={{color:T.gold, fontSize:11, fontWeight:700}}>{m.avatar} {m.name}:</span>
                <span style={{color:T.cream, fontSize:12, marginRight:6}}>{m.text}</span>
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>
          <div style={{display:'flex', gap:6, padding:8, borderTop:`1px solid ${T.border}`}}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="اكتب رسالة..."
              style={{flex:1, background:'#0a2a0a', border:`1px solid ${T.greenL}`,
                borderRadius:8, padding:'6px 10px', color:'#fff',
                fontSize:12, outline:'none', direction:'rtl'}}/>
            <button onClick={send} style={{
              background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
              color:T.night, border:'none', borderRadius:8,
              padding:'6px 12px', cursor:'pointer', fontWeight:700, fontSize:12}}>
              إرسال
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [playerAvatar, setPlayerAvatar] = useState(AVATARS[0]);
  const [playerCity, setPlayerCity] = useState('الرياض');
  const [joinCode, setJoinCode] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [myIndex, setMyIndex] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState('');
  const [gameData, setGameData] = useState(null);
  const [timer, setTimer] = useState(10);
  const [reactions, setReactions] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const unsubRef = useRef(null);
  const botRef = useRef(null);
  const timerRef = useRef(null);
  const roomCodeRef = useRef('');
  const myIndexRef = useRef(0);
  const isHostRef = useRef(false);
  const gameDataRef = useRef(null);

  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { myIndexRef.current = myIndex; }, [myIndex]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { gameDataRef.current = gameData; }, [gameData]);

  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}?room=${roomCode}` : '';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) setJoinCode(room);
  }, []);

  // Auth listener
  useEffect(() => {
    let unsub = () => {};
    try {
      const { auth } = getFirebaseAuth();
      if (auth) {
        unsub = onAuthStateChanged(auth, async (u) => {
          setUser(u);
          setAuthLoading(false);
          if (u) {
            const profileRef = doc(db, 'users', u.uid);
            const snap = await getDoc(profileRef);
            if (snap.exists()) {
              const data = snap.data();
              setProfile(data);
              setPlayerName(data.name || u.displayName || '');
              setPlayerAvatar(data.avatar || AVATARS[0]);
              setPlayerCity(data.city || 'الرياض');
            } else {
              const newProfile = { name: u.displayName||'لاعب', avatar: AVATARS[0], city:'الرياض', wins:0, losses:0, createdAt:Date.now() };
              await setDoc(profileRef, newProfile);
              setProfile(newProfile);
              setPlayerName(u.displayName || '');
            }
          }
        });
      } else {
        setAuthLoading(false);
      }
    } catch(e) {
      console.error('Auth listener error:', e);
      setAuthLoading(false);
    }
    return unsub;
  }, []);

  const saveProfile = async () => {
    if (!user) return;
    const data = { name: playerName, avatar: playerAvatar, city: playerCity };
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
      setProfile(p => ({...p, ...data}));
    } catch(e) {}
  };

  const updateStats = async (won) => {
    if (!user) return;
    try {
      const profileRef = doc(db, 'users', user.uid);
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        const data = snap.data();
        await updateDoc(profileRef, {
          wins: (data.wins||0) + (won ? 1 : 0),
          losses: (data.losses||0) + (won ? 0 : 1),
        });
      }
    } catch(e) {}
  };

  const subscribeRoom = useCallback((code) => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = onSnapshot(
      doc(db, 'rooms', code),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setGameData(data);
          if (['bidding','playing','roundEnd'].includes(data.phase)) setScreen('game');
          else if (data.phase === 'lobby') setScreen('lobby');
        }
      },
      err => console.error(err)
    );
  }, []);

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const addReaction = (emoji) => {
    const id = Date.now();
    setReactions(r => [...r, {id, emoji, x: Math.random()*80+10}]);
    setTimeout(() => setReactions(r => r.filter(x => x.id !== id)), 2000);
  };

  const signInWithGoogle = async () => {
    try {
      const { auth, googleProvider } = getFirebaseAuth();
      if (auth && googleProvider) await signInWithPopup(auth, googleProvider);
    } catch(e) { setError('فشل تسجيل الدخول: ' + e.message); }
  };

  const createRoom = async () => {
    if (!playerName.trim()) { setError('أدخل اسمك أولاً'); return; }
    setError('');
    try {
      await saveProfile();
      const code = genCode();
      await setDoc(doc(db, 'rooms', code), {
        phase:'lobby', players:[playerName.trim(),null,null,null],
        avatars:[playerAvatar,null,null,null],
        h0:[], h1:[], h2:[], h3:[],
        bids:[], contract:null, biddingTurn:0,
        trickPlays:[], leader:0, roundScores:[0,0], gameScore:[0,0],
        trickResult:null, roundResult:null, matchWinner:null,
        hostIndex:0, createdAt:Date.now(),
      });
      setRoomCode(code); roomCodeRef.current = code;
      setMyIndex(0); myIndexRef.current = 0;
      setIsHost(true); isHostRef.current = true;
      subscribeRoom(code);
    } catch(e) { setError('فشل: ' + e.message); }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) { setError('أدخل اسمك أولاً'); return; }
    if (!joinCode.trim()) { setError('أدخل كود الغرفة'); return; }
    setError('');
    try {
      await saveProfile();
      const code = joinCode.trim();
      const snap = await getDoc(doc(db, 'rooms', code));
      if (!snap.exists()) { setError('الغرفة غير موجودة!'); return; }
      const data = snap.data();
      const emptySlot = data.players.findIndex(p => !p);
      if (emptySlot === -1) { setError('الغرفة ممتلئة!'); return; }
      const newPlayers = [...data.players]; newPlayers[emptySlot] = playerName.trim();
      const newAvatars = [...(data.avatars||[null,null,null,null])]; newAvatars[emptySlot] = playerAvatar;
      await updateDoc(doc(db, 'rooms', code), {players: newPlayers, avatars: newAvatars});
      setRoomCode(code); roomCodeRef.current = code;
      setMyIndex(emptySlot); myIndexRef.current = emptySlot;
      setIsHost(false); isHostRef.current = false;
      subscribeRoom(code);
    } catch(e) { setError('فشل: ' + e.message); }
  };

  const startGame = async () => {
    const code = roomCodeRef.current; if (!code) return;
    sounds.deal();
    const h = dealHands(shuffle(buildDeck()));
    await updateDoc(doc(db,'rooms',code), {
      phase:'bidding', h0:h.h0, h1:h.h1, h2:h.h2, h3:h.h3,
      bids:[], contract:null, biddingTurn:0,
      trickPlays:[], leader:0, roundScores:[0,0],
      trickResult:null, roundResult:null, matchWinner:null
    });
  };

  const handleBid = async (bid) => {
    const gd = gameDataRef.current; const code = roomCodeRef.current;
    if (!gd || !code) return;
    const newBids = [...gd.bids, {playerIndex: gd.biddingTurn, ...bid}];
    if (bid.type === 'pass') {
      if (newBids.filter(b => b.type==='pass').length === 4) {
        const h = dealHands(shuffle(buildDeck()));
        await updateDoc(doc(db,'rooms',code), {h0:h.h0, h1:h.h1, h2:h.h2, h3:h.h3, bids:[], biddingTurn:0});
        return;
      }
      await updateDoc(doc(db,'rooms',code), {bids:newBids, biddingTurn:(gd.biddingTurn+1)%4});
    } else {
      await updateDoc(doc(db,'rooms',code), {
        bids:newBids,
        contract:{type:bid.type, trump:bid.trump||null, trumpName:bid.trumpName||null,
          bidder:gd.biddingTurn, bidTeam:gd.biddingTurn%2},
        phase:'playing'
      });
    }
  };

  const playCard = async (card) => {
    const gd = gameDataRef.current; const code = roomCodeRef.current; const mi = myIndexRef.current;
    if (!gd || !code || !gd.contract) return;
    sounds.play();
    const hands = getHands(gd);
    const { trickPlays, contract, roundScores } = gd;
    const newPlays = [...trickPlays, {playerIndex:mi, card}];
    const newHand = hands[mi].filter(c => c.id !== card.id);
    if (newPlays.length === 4) {
      const mode = contract.type, trump = contract.trump;
      const winner = trickWinner(newPlays, mode, trump);
      let pts = newPlays.reduce((s,p) => s + cardValue(p.card,mode,trump), 0);
      if (mode === 'sun') pts *= 2;
      const winTeam = winner.playerIndex % 2;
      const newRS = [...roundScores]; newRS[winTeam] += pts;
      const newHands = hands.map((h,i) => i===mi ? newHand : h);
      const update = {trickPlays:newPlays, [`h${mi}`]:newHand, roundScores:newRS, trickResult:{winner,pts,winTeam}};
      if (newHands[0].length === 0) {
        const result = calcResult(newRS, contract);
        const newGS = [...gd.gameScore];
        newGS[contract.bidTeam] += result.bidTeamFinal;
        newGS[1-contract.bidTeam] += result.oppTeamFinal;
        const mw = newGS[0]>=152 ? 0 : newGS[1]>=152 ? 1 : null;
        if (mw !== null) updateStats(mw === mi%2);
        await updateDoc(doc(db,'rooms',code), {...update, gameScore:newGS, roundResult:result, matchWinner:mw, phase:'roundEnd'});
      } else {
        await updateDoc(doc(db,'rooms',code), update);
      }
    } else {
      await updateDoc(doc(db,'rooms',code), {trickPlays:newPlays, [`h${mi}`]:newHand});
    }
  };

  const nextTrick = async () => {
    const gd = gameDataRef.current; const code = roomCodeRef.current;
    if (!gd?.trickResult || !code) return;
    await updateDoc(doc(db,'rooms',code), {leader:gd.trickResult.winner.playerIndex, trickPlays:[], trickResult:null});
  };

  const newRound = async (resetMatch=false) => {
    const gd = gameDataRef.current; const code = roomCodeRef.current; if (!code) return;
    sounds.deal();
    const h = dealHands(shuffle(buildDeck()));
    await updateDoc(doc(db,'rooms',code), {
      phase:'bidding', h0:h.h0, h1:h.h1, h2:h.h2, h3:h.h3,
      bids:[], contract:null, biddingTurn:0, trickPlays:[], leader:0,
      roundScores:[0,0], trickResult:null, roundResult:null, matchWinner:null,
      gameScore: resetMatch ? [0,0] : gd?.gameScore || [0,0]
    });
  };

  // Bot bidding
  useEffect(() => {
    const gd = gameData;
    if (!gd || gd.phase !== 'bidding' || !isHostRef.current) return;
    const bt = gd.biddingTurn;
    if (gd.players[bt]) return;
    clearTimeout(botRef.current);
    botRef.current = setTimeout(async () => {
      const gd2 = gameDataRef.current; const code = roomCodeRef.current;
      if (!gd2 || !code) return;
      const hand = getHands(gd2)[bt]; if (!hand?.length) return;
      const bid = botBid(hand, gd2.bids.filter(b=>b.type==='pass').length);
      const newBids = [...gd2.bids, {playerIndex:bt, ...bid}];
      if (bid.type === 'pass') {
        if (newBids.filter(b=>b.type==='pass').length === 4) {
          const h = dealHands(shuffle(buildDeck()));
          await updateDoc(doc(db,'rooms',code), {h0:h.h0, h1:h.h1, h2:h.h2, h3:h.h3, bids:[], biddingTurn:0});
          return;
        }
        await updateDoc(doc(db,'rooms',code), {bids:newBids, biddingTurn:(bt+1)%4});
      } else {
        await updateDoc(doc(db,'rooms',code), {
          bids:newBids,
          contract:{type:bid.type, trump:bid.trump||null, trumpName:bid.trumpName||null, bidder:bt, bidTeam:bt%2},
          phase:'playing'
        });
      }
    }, 1500);
  }, [gameData?.biddingTurn, gameData?.phase]);

  // Bot playing
  useEffect(() => {
    const gd = gameData;
    if (!gd || gd.phase !== 'playing' || gd.trickResult || !isHostRef.current) return;
    const { leader, trickPlays, players } = gd;
    const activePIdx = (leader + trickPlays.length) % 4;
    if (players[activePIdx]) return;
    clearTimeout(botRef.current);
    botRef.current = setTimeout(async () => {
      const gd2 = gameDataRef.current; const code = roomCodeRef.current;
      if (!gd2 || !code || !gd2.contract) return;
      const hands = getHands(gd2); const hand = hands[activePIdx]; if (!hand?.length) return;
      const card = botPickCard(hand, gd2.trickPlays, gd2.contract.type, gd2.contract.trump);
      if (!card) return;
      sounds.play();
      const newPlays = [...gd2.trickPlays, {playerIndex:activePIdx, card}];
      const newHand = hand.filter(c => c.id !== card.id);
      if (newPlays.length === 4) {
        const mode = gd2.contract.type, trump = gd2.contract.trump;
        const winner = trickWinner(newPlays, mode, trump);
        let pts = newPlays.reduce((s,p) => s + cardValue(p.card,mode,trump), 0);
        if (mode === 'sun') pts *= 2;
        const winTeam = winner.playerIndex % 2;
        const newRS = [...gd2.roundScores]; newRS[winTeam] += pts;
        const allHands = hands.map((h,i) => i===activePIdx ? newHand : h);
        const update = {trickPlays:newPlays, [`h${activePIdx}`]:newHand, roundScores:newRS, trickResult:{winner,pts,winTeam}};
        if (allHands[0].length === 0) {
          const result = calcResult(newRS, gd2.contract);
          const newGS = [...gd2.gameScore];
          newGS[gd2.contract.bidTeam] += result.bidTeamFinal;
          newGS[1-gd2.contract.bidTeam] += result.oppTeamFinal;
          const mw = newGS[0]>=152 ? 0 : newGS[1]>=152 ? 1 : null;
          await updateDoc(doc(db,'rooms',code), {...update, gameScore:newGS, roundResult:result, matchWinner:mw, phase:'roundEnd'});
        } else {
          await updateDoc(doc(db,'rooms',code), update);
        }
      } else {
        await updateDoc(doc(db,'rooms',code), {trickPlays:newPlays, [`h${activePIdx}`]:newHand});
      }
    }, 3000);
  }, [gameData?.trickPlays?.length, gameData?.phase, gameData?.trickResult]);

  // Timer
  useEffect(() => {
    clearInterval(timerRef.current);
    const gd = gameData;
    if (!gd || gd.phase !== 'playing' || gd.trickResult) return;
    const mi = myIndexRef.current;
    const activePIdx = (gd.leader + gd.trickPlays.length) % 4;
    if (activePIdx !== mi) return;
    setTimer(10);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 3) sounds.tick();
        if (t <= 1) {
          clearInterval(timerRef.current);
          const gd2 = gameDataRef.current;
          const hand = getHands(gd2)[mi];
          if (hand?.length > 0) {
            const card = [...hand].sort((a,b) =>
              cardValue(a, gd2.contract.type, gd2.contract.trump) -
              cardValue(b, gd2.contract.type, gd2.contract.trump))[0];
            playCard(card);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameData?.trickPlays?.length, gameData?.phase, gameData?.trickResult]);

  // ── Render ────────────────────────────────────────────
  const gd = gameData;

  if (authLoading) return (
    <div style={{minHeight:'100vh', background:T.felt,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Segoe UI,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:56, marginBottom:12, animation:'float 2s ease-in-out infinite'}}>🃏</div>
        <div style={{color:T.gold, fontSize:18, fontWeight:700}}>جاري التحميل...</div>
      </div>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </div>
  );

  if (screen === 'home') return (
    <div style={{minHeight:'100vh',
      background:`radial-gradient(ellipse at 50% -10%,${T.greenL}66,${T.felt} 50%,${T.night})`,
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:24,
      fontFamily:'Segoe UI,Tahoma,Arial,sans-serif',
      position:'relative', overflow:'hidden'}}>
      <div style={{position:'absolute', inset:0,
        backgroundImage:`repeating-linear-gradient(45deg,${T.gold}08 0px,${T.gold}08 1px,transparent 1px,transparent 20px)`,
        pointerEvents:'none'}}/>
      <div style={{position:'absolute', top:16, right:16, left:16,
        display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <button onClick={() => setShowLeaderboard(true)} style={{
          background:'#00000033', color:T.gold, border:`1px solid ${T.border}`,
          borderRadius:10, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:700,
          backdropFilter:'blur(4px)'}}>🏆 المتصدرون</button>
        {user ? (
          <button onClick={() => setShowProfile(true)} style={{
            background:'#00000033', border:`1px solid ${T.border}`, borderRadius:20,
            padding:'6px 12px', cursor:'pointer',
            display:'flex', alignItems:'center', gap:6, backdropFilter:'blur(4px)'}}>
            <span style={{fontSize:20}}>{profile?.avatar || '🧔'}</span>
            <span style={{color:T.gold, fontSize:12, fontWeight:700}}>{profile?.name || user.displayName || 'لاعب'}</span>
          </button>
        ) : (
          <button onClick={signInWithGoogle} style={{
            background:'#fff', color:'#333', border:'none', borderRadius:10,
            padding:'6px 14px', cursor:'pointer', fontSize:12, fontWeight:700,
            display:'flex', alignItems:'center', gap:6, boxShadow:'0 2px 8px #00000044'}}>
            <span style={{fontWeight:900, color:'#4285F4'}}>G</span> تسجيل الدخول
          </button>
        )}
      </div>
      <div style={{textAlign:'center', marginBottom:32, position:'relative', zIndex:1}}>
        <div style={{fontSize:72, marginBottom:8,
          filter:'drop-shadow(0 8px 16px #00000088)',
          animation:'float 3s ease-in-out infinite'}}>🃏</div>
        <h1 style={{color:T.gold, fontSize:'clamp(2rem,8vw,3rem)',
          fontWeight:900, margin:'0 0 6px',
          textShadow:`0 0 40px ${T.gold}44,0 4px 8px #00000088`, letterSpacing:3}}>
          بلوت المملكة
        </h1>
        <div style={{color:T.smoke, fontSize:14, letterSpacing:1}}>اللعبة الأصيلة — العب مع أصدقائك</div>
        <div style={{width:80, height:2, margin:'12px auto 0',
          background:`linear-gradient(to right,transparent,${T.gold},transparent)`}}/>
      </div>
      <div style={{width:'100%', maxWidth:320, display:'flex', flexDirection:'column', gap:14, position:'relative', zIndex:1}}>
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <button onClick={() => setShowAvatarPicker(p => !p)} style={{
            width:52, height:52, borderRadius:'50%',
            background:`linear-gradient(135deg,${T.green},${T.greenL})`,
            border:`2px solid ${T.gold}`, fontSize:24, cursor:'pointer', flexShrink:0,
            boxShadow:`0 4px 12px ${T.green}88`}}>{playerAvatar}</button>
          <input value={playerName} onChange={e => setPlayerName(e.target.value)}
            placeholder="اسمك..."
            style={{flex:1, background:'#0a2a0a', border:`1.5px solid ${T.greenL}`,
              borderRadius:12, padding:'13px 16px', color:'#fff',
              fontSize:15, textAlign:'right', outline:'none', fontFamily:'inherit',
              boxShadow:'inset 0 2px 8px #00000033'}}/>
        </div>
        {showAvatarPicker && (
          <div style={{background:'#071f10', border:`1px solid ${T.border}`, borderRadius:14, padding:12,
            display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center'}}>
            {AVATARS.map(a => (
              <button key={a} onClick={() => { setPlayerAvatar(a); setShowAvatarPicker(false); }}
                style={{width:44, height:44, borderRadius:'50%',
                  background: playerAvatar===a ? `${T.gold}33` : 'transparent',
                  border:`2px solid ${playerAvatar===a ? T.gold : '#333'}`,
                  fontSize:22, cursor:'pointer'}}>{a}</button>
            ))}
          </div>
        )}
        <select value={playerCity} onChange={e => setPlayerCity(e.target.value)}
          style={{background:'#0a2a0a', border:`1.5px solid ${T.greenL}44`,
            borderRadius:12, padding:'10px 16px', color:T.smoke,
            fontSize:14, outline:'none', fontFamily:'inherit', direction:'rtl'}}>
          {CITIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {error && (
          <div style={{color:T.redL, fontSize:13, textAlign:'center',
            padding:'10px', background:'#3a0a0a',
            borderRadius:10, border:`1px solid ${T.red}44`}}>{error}</div>
        )}
        <button onClick={createRoom} style={{
          background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
          color:T.night, border:'none', borderRadius:14,
          padding:'16px', fontWeight:900, cursor:'pointer', fontSize:17,
          boxShadow:`0 6px 24px ${T.gold}66`, letterSpacing:1}}>
          🏠 إنشاء غرفة جديدة
        </button>
        <div style={{display:'flex', alignItems:'center', gap:10, color:'#333', fontSize:12}}>
          <div style={{flex:1, height:1, background:'#1a2a1a'}}/>
          <span>أو انضم لغرفة</span>
          <div style={{flex:1, height:1, background:'#1a2a1a'}}/>
        </div>
        <input value={joinCode} onChange={e => setJoinCode(e.target.value)}
          placeholder="كود الغرفة..." maxLength={6}
          style={{background:'#0a1a2a', border:`1.5px solid ${T.blueL}`,
            borderRadius:12, padding:'13px 16px', color:'#fff',
            fontSize:20, textAlign:'center', letterSpacing:8,
            outline:'none', fontFamily:'inherit',
            boxShadow:'inset 0 2px 8px #00000033'}}/>
        <button onClick={joinRoom} style={{
          background:`linear-gradient(135deg,${T.blue},${T.blueL})`,
          color:'#fff', border:'none', borderRadius:14,
          padding:'16px', fontWeight:800, cursor:'pointer', fontSize:17,
          boxShadow:`0 6px 24px ${T.blue}88`, letterSpacing:1}}>
          🚪 انضم لغرفة
        </button>
      </div>
      {showProfile && user && <ProfileScreen user={user} profile={profile} onClose={() => setShowProfile(false)}/>}
      {showLeaderboard && <LeaderboardScreen onClose={() => setShowLeaderboard(false)} currentUserId={user?.uid}/>}
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
        @keyframes bounce{0%{transform:scale(0.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}
        @keyframes pulse-border{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes float-up{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-100px);opacity:0}}
      `}</style>
    </div>
  );

  if (screen === 'lobby') return (
    <>
      <LobbyScreen
        roomCode={roomCode}
        players={gd?.players || [playerName,null,null,null]}
        isHost={isHost} onStart={startGame}
        myIndex={myIndex} shareLink={shareLink}
      />
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </>
  );

  if (screen === 'game' && gd) {
    const contract = gd.contract;
    const hands = getHands(gd);
    const myHand = hands[myIndex] || [];
    const activePIdx = gd.phase==='playing' && !gd.trickResult ? (gd.leader + gd.trickPlays.length) % 4 : -1;
    const isMyTurn = activePIdx === myIndex;
    const isBiddingTurn = gd.phase === 'bidding' && gd.biddingTurn === myIndex;
    const avatars = gd.avatars || AVATARS.map((_,i) => AVATARS[i%8]);

    return (
      <div style={{minHeight:'100vh',
        background:`radial-gradient(ellipse at 50% 0%,${T.feltL}88,${T.felt} 40%,${T.night})`,
        fontFamily:'Segoe UI,Tahoma,Arial,sans-serif',
        color:T.cream, padding:'10px', userSelect:'none',
        position:'relative', overflow:'hidden'}}>

        {reactions.map(r => (
          <div key={r.id} style={{position:'fixed', bottom:200, left:`${r.x}%`,
            fontSize:32, zIndex:500, pointerEvents:'none',
            animation:'float-up 2s ease forwards'}}>{r.emoji}</div>
        ))}

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center',
          marginBottom:8, background:'#00000033', borderRadius:14, padding:'8px 12px',
          backdropFilter:'blur(4px)'}}>
          <div>
            <div style={{color:T.gold, fontSize:16, fontWeight:900, textShadow:`0 0 12px ${T.gold}44`}}>
              🃏 بلوت المملكة
            </div>
            {contract && (
              <div style={{fontSize:10, color:T.smoke, marginTop:1}}>
                {contract.type==='hokum' ? `${contract.trumpName} ${contract.trump} 👑` : '☀️ صن'}
                {' · '}{roomCode}
              </div>
            )}
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            {[0,1].map(t => (
              <div key={t} style={{background:'#00000044',
                border:`1.5px solid ${TEAM_COLORS[t]}44`,
                borderRadius:12, padding:'4px 12px', textAlign:'center',
                backdropFilter:'blur(4px)'}}>
                <div style={{color:TEAM_COLORS[t], fontSize:9, fontWeight:700}}>{t===0?'A':'B'}</div>
                <div style={{color:T.gold, fontSize:18, fontWeight:900, lineHeight:1,
                  textShadow:`0 0 8px ${T.gold}66`}}>{gd.gameScore?.[t]||0}</div>
              </div>
            ))}
            <button onClick={() => setShowProfile(true)} style={{
              background:'#00000033', border:`1px solid ${T.border}`,
              borderRadius:'50%', width:36, height:36,
              cursor:'pointer', fontSize:18, backdropFilter:'blur(4px)'}}>
              {avatars[myIndex] || playerAvatar}
            </button>
          </div>
        </div>

        {gd.phase === 'bidding' && (
          <>
            <div style={{background:'#00000033', borderRadius:14, padding:12, marginBottom:8,
              border:`1px solid ${T.border}`, backdropFilter:'blur(4px)'}}>
              <div style={{color:T.gold, fontWeight:700, fontSize:11, marginBottom:8}}>🃏 يدك</div>
              <div style={{display:'flex', flexWrap:'wrap', justifyContent:'center'}}>
                {myHand.map(card => <Card key={card.id} card={card} mode='hokum' trump='' disabled/>)}
              </div>
            </div>
            {isBiddingTurn ? (
              <BiddingModal
                playerIndex={myIndex}
                playerName={gd.players?.[myIndex] || 'أنت'}
                avatar={avatars[myIndex]}
                onBid={handleBid}
                canSun={gd.bids?.length >= 1}
                passCount={gd.bids?.filter(b=>b.type==='pass').length || 0}
              />
            ) : (
              <div style={{position:'fixed', inset:0,
                background:'linear-gradient(135deg,#000c,#001a0acc)',
                display:'flex', alignItems:'center', justifyContent:'center',
                zIndex:100, backdropFilter:'blur(4px)'}}>
                <div style={{background:`linear-gradient(135deg,#0D2A1A,#071f10)`,
                  border:`2px solid ${T.greenL}`, borderRadius:20, padding:28,
                  textAlign:'center', boxShadow:`0 0 40px ${T.greenL}22`}}>
                  <div style={{fontSize:40}}>{avatars[gd.biddingTurn] || AVATARS[gd.biddingTurn%8]}</div>
                  <div style={{color:T.greenL, fontSize:17, fontWeight:700, marginTop:10}}>
                    {gd.players?.[gd.biddingTurn] || `اللاعب ${gd.biddingTurn+1}`}
                  </div>
                  <div style={{color:T.smoke, fontSize:13, marginTop:4}}>يفكر في المزايدة...</div>
                  <div style={{display:'flex', gap:4, justifyContent:'center', marginTop:12}}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{width:8, height:8, borderRadius:'50%',
                        background:T.greenL, animation:`pulse ${0.6+i*0.2}s infinite`}}/>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {(gd.phase === 'playing' || gd.phase === 'roundEnd') && contract && (
          <div>
            <div style={{display:'flex', gap:8, marginBottom:8, alignItems:'stretch'}}>
              <div style={{flex:1,
                background: contract.type==='sun' ? '#3a2a0088' : '#0a2a0a88',
                border:`1.5px solid ${contract.type==='sun' ? T.gold : T.greenL}44`,
                borderRadius:12, padding:'6px 12px', backdropFilter:'blur(4px)'}}>
                <div style={{color: contract.type==='sun' ? T.gold : T.greenL, fontWeight:800, fontSize:12}}>
                  {contract.type==='hokum' ? `🎯 حكم — ${contract.trumpName} ${contract.trump} 👑` : '☀️ صن (2×)'}
                </div>
                <div style={{color:T.smoke, fontSize:10}}>
                  {gd.players?.[contract.bidder] || `P${contract.bidder+1}`} · Team {contract.bidTeam===0?'A':'B'}
                </div>
              </div>
              {[0,1].map(t => (
                <div key={t} style={{background:'#00000044',
                  border:`1px solid ${TEAM_COLORS[t]}33`,
                  borderRadius:12, padding:'6px 10px', textAlign:'center',
                  minWidth:60, backdropFilter:'blur(4px)'}}>
                  <div style={{color:TEAM_COLORS[t], fontSize:9, fontWeight:700}}>
                    {t===0?'A':'B'}{contract.bidTeam===t && <span style={{color:T.gold}}> ✦</span>}
                  </div>
                  <div style={{color:T.gold, fontSize:20, fontWeight:900, lineHeight:1,
                    textShadow:`0 0 8px ${T.gold}66`}}>{gd.roundScores?.[t]||0}</div>
                </div>
              ))}
            </div>

            <div style={{
              background:`radial-gradient(ellipse at 50% 50%,${T.feltL},${T.felt} 60%,${T.greenD})`,
              border:`3px solid ${T.gold}44`, borderRadius:24, padding:14, marginBottom:8,
              boxShadow:`inset 0 0 60px #00000044,0 8px 32px #00000088`,
              position:'relative', minHeight:280}}>

              {[0,1,2,3].map(i => (
                <div key={i} style={{position:'absolute',
                  top:i<2?8:'auto', bottom:i>=2?8:'auto',
                  left:i%2===0?8:'auto', right:i%2===1?8:'auto',
                  width:16, height:16, border:`2px solid ${T.gold}33`, borderRadius:3}}/>
              ))}

              {(() => {
                const pIdx = (myIndex+2)%4; const isActive = activePIdx===pIdx;
                return (
                  <div style={{display:'flex', justifyContent:'center', marginBottom:10}}>
                    <div style={{textAlign:'center'}}>
                      <PlayerBadge name={gd.players?.[pIdx]||`P${pIdx+1}`} avatar={avatars[pIdx]||AVATARS[pIdx%8]} teamColor={TEAM_COLORS[pIdx%2]} isActive={isActive} cardCount={hands[pIdx]?.length}/>
                      <div style={{display:'flex', flexWrap:'wrap', justifyContent:'center', marginTop:6, maxWidth:220}}>
                        {(hands[pIdx]||[]).map((_,j) => <Card key={j} faceDown small card={{suit:{symbol:'',color:'',isRed:false},rank:{symbol:'',nameAr:''}}} mode='' trump=''/>)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
                {(() => {
                  const pIdx = (myIndex+1)%4; const isActive = activePIdx===pIdx;
                  return (
                    <div style={{textAlign:'center'}}>
                      <PlayerBadge name={gd.players?.[pIdx]||`P${pIdx+1}`} avatar={avatars[pIdx]||AVATARS[pIdx%8]} teamColor={TEAM_COLORS[pIdx%2]} isActive={isActive} cardCount={hands[pIdx]?.length}/>
                      <div style={{display:'flex', flexDirection:'column', alignItems:'center', marginTop:6}}>
                        {(hands[pIdx]||[]).map((_,j) => <Card key={j} faceDown small card={{suit:{symbol:'',color:'',isRed:false},rank:{symbol:'',nameAr:''}}} mode='' trump=''/>)}
                      </div>
                    </div>
                  );
                })()}

                <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6}}>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, padding:10,
                    background:'#00000033', borderRadius:16, border:`1px solid ${T.gold}22`,
                    backdropFilter:'blur(4px)', minWidth:130, minHeight:110,
                    boxShadow:'inset 0 0 20px #00000033'}}>
                    {[2,1,3,0].map(relIdx => {
                      const pIdx = (myIndex+relIdx)%4;
                      const play = gd.trickPlays?.find(p => p.playerIndex===pIdx);
                      return (
                        <div key={pIdx} style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:56}}>
                          {play ? (
                            <>
                              <div style={{color:T.smoke, fontSize:8, marginBottom:2}}>{gd.players?.[pIdx]||`P${pIdx+1}`}</div>
                              <Card card={play.card} mode={contract.type} trump={contract.trump} winner={gd.trickResult?.winner.playerIndex===pIdx} disabled small/>
                            </>
                          ) : (
                            <div style={{width:38, height:54, borderRadius:8, border:`1px dashed ${T.gold}22`, display:'flex', alignItems:'center', justifyContent:'center', color:`${T.gold}22`, fontSize:18}}>•</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {gd.trickResult && (
                    <div style={{textAlign:'center'}}>
                      <div style={{color:T.gold, fontSize:12, fontWeight:700, textShadow:`0 0 8px ${T.gold}66`}}>
                        🏆 {gd.players?.[gd.trickResult.winner.playerIndex]||`P${gd.trickResult.winner.playerIndex+1}`} +{gd.trickResult.pts}
                      </div>
                      {gd.phase === 'playing' && (
                        <button onClick={nextTrick} style={{marginTop:4,
                          background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
                          color:T.night, border:'none', borderRadius:10,
                          padding:'6px 16px', fontWeight:800, cursor:'pointer', fontSize:12,
                          boxShadow:`0 2px 8px ${T.gold}66`}}>التالي ▶</button>
                      )}
                    </div>
                  )}
                  {!gd.trickResult && activePIdx >= 0 && (
                    <div style={{color: isMyTurn ? T.greenL : T.smoke, fontSize:11, textAlign:'center', fontWeight:700}}>
                      {isMyTurn ? '🟢 دورك!' : `⏳ ${gd.players?.[activePIdx]||`P${activePIdx+1}`}...`}
                    </div>
                  )}
                </div>

                {(() => {
                  const pIdx = (myIndex+3)%4; const isActive = activePIdx===pIdx;
                  return (
                    <div style={{textAlign:'center'}}>
                      <PlayerBadge name={gd.players?.[pIdx]||`P${pIdx+1}`} avatar={avatars[pIdx]||AVATARS[pIdx%8]} teamColor={TEAM_COLORS[pIdx%2]} isActive={isActive} cardCount={hands[pIdx]?.length}/>
                      <div style={{display:'flex', flexDirection:'column', alignItems:'center', marginTop:6}}>
                        {(hands[pIdx]||[]).map((_,j) => <Card key={j} faceDown small card={{suit:{symbol:'',color:'',isRed:false},rank:{symbol:'',nameAr:''}}} mode='' trump=''/>)}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                <PlayerBadge name={gd.players?.[myIndex]||'أنت'} avatar={avatars[myIndex]||playerAvatar} teamColor={TEAM_COLORS[myIndex%2]} isActive={isMyTurn} isMe={true} timer={timer}/>
                {isMyTurn && (
                  <div style={{height:4, width:200, background:'#1a2a1a', borderRadius:2, margin:'6px auto', overflow:'hidden'}}>
                    <div style={{height:'100%', borderRadius:2, width:`${(timer/10)*100}%`,
                      background:`linear-gradient(to right,${timer<=3?T.redL:timer<=6?'#F39C12':T.greenL},${timer<=3?T.red:timer<=6?'#E67E22':T.green})`,
                      transition:'width 0.9s linear', boxShadow:'0 0 6px currentColor'}}/>
                  </div>
                )}
                <div style={{display:'flex', flexWrap:'wrap', justifyContent:'center', marginTop:6}}>
                  {myHand.map(card => (
                    <Card key={card.id} card={card} mode={contract.type} trump={contract.trump}
                      highlight={isMyTurn}
                      onClick={() => isMyTurn && !gd.trickResult && playCard(card)}
                      disabled={!isMyTurn || !!gd.trickResult}/>
                  ))}
                </div>
              </div>
            </div>

            <div style={{display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginBottom:4}}>
              {REACTIONS.map(e => (
                <button key={e} onClick={() => addReaction(e)} style={{
                  background:'#00000033', border:`1px solid ${T.border}`,
                  borderRadius:20, padding:'6px 10px', cursor:'pointer',
                  fontSize:18, backdropFilter:'blur(4px)'}}>{e}</button>
              ))}
            </div>
          </div>
        )}

        {gd.phase === 'roundEnd' && gd.roundResult && (
          <RoundEndScreen
            result={gd.roundResult} contract={gd.contract}
            roundScores={gd.roundScores||[0,0]}
            gameScore={gd.gameScore||[0,0]}
            matchWinner={gd.matchWinner}
            onNext={() => newRound(gd.matchWinner !== null)}
          />
        )}

        {showProfile && user && <ProfileScreen user={user} profile={profile} onClose={() => setShowProfile(false)}/>}

        <ChatPanel roomCode={roomCode} userName={playerName||'لاعب'} avatar={playerAvatar}/>

        <style>{`
          @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
          @keyframes bounce{0%{transform:scale(0.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}
          @keyframes pulse-border{0%,100%{opacity:1}50%{opacity:0.3}}
          @keyframes float-up{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-100px);opacity:0}}
        `}</style>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh', background:T.felt,
      display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Segoe UI,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:56, marginBottom:12, animation:'float 2s ease-in-out infinite'}}>🃏</div>
        <div style={{color:T.gold, fontSize:18, fontWeight:700, textShadow:`0 0 20px ${T.gold}44`}}>جاري التحميل...</div>
      </div>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </div>
  );
}
