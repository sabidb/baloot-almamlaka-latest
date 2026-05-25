import React, { useState, useEffect, useCallback, useRef } from 'react';

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
const NAMES = ['أنت','سارة','خالد','نورة'];
const AVATARS = ['🧑','👩','👨','👧'];
const TEAM_COLORS = ['#4ADE80','#60A5FA'];

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
  const oppTeam=1-bidTeam;
  const bidScore=roundScores[bidTeam];
  const oppScore=roundScores[oppTeam];
  const total=bidScore+oppScore;
  const isGahwa=oppScore===0;
  if(type==='sun') {
    const made=bidScore>oppScore;
    return {
      made,isGahwa,
      bidTeamFinal:made?total*2:0,
      oppTeamFinal:made?0:total*2,
      reason:made?(isGahwa?'☕ صن + قهوة!':'☀️ صن نجح!'):'☀️ صن فشل — الخصم يأخذ الضعف!',
    };
  }
  if(isGahwa) return {
    made:true,isGahwa:true,
    bidTeamFinal:total*2,oppTeamFinal:0,
    reason:'☕ قهوة! فريق المزايدة فاز بكل الضربات — ضعف النقاط!',
  };
  const made=bidScore>=82;
  return {
    made,isGahwa:false,
    bidTeamFinal:made?bidScore:0,
    oppTeamFinal:made?oppScore:total,
    reason:made?`✅ حكم نجح! (${bidScore} ≥ 82)`:`❌ حكم فشل! (${bidScore} < 82) — الخصم يأخذ كل شيء`,
  };
}

// ── Bot Logic ─────────────────────────────────────────────
function botPickCard(hand, trickPlays, mode, trump) {
  const ledSuit = trickPlays.length > 0 ? trickPlays[0].card.suit.symbol : null;
  
  // Must follow suit if possible
  if (ledSuit) {
    const following = hand.filter(c => c.suit.symbol === ledSuit);
    if (following.length > 0) {
      // Play strongest if winning, lowest if losing
      const currentWinner = trickWinner(trickPlays, mode, trump);
      const winTeam = currentWinner.playerIndex % 2;
      return following.sort((a,b) => 
        cardStrength(b,mode,trump) - cardStrength(a,mode,trump)
      )[0];
    }
    // Can't follow — play trump if available
    const trumpCards = hand.filter(c => c.suit.symbol === trump && mode === 'hokum');
    if (trumpCards.length > 0) {
      return trumpCards.sort((a,b) => 
        cardStrength(b,mode,trump) - cardStrength(a,mode,trump)
      )[0];
    }
  }
  // Play lowest value card
  return hand.sort((a,b) => cardValue(a,mode,trump) - cardValue(b,mode,trump))[0];
}

function botBid(hand, passCount) {
  // Count trump potential per suit
  let bestSuit = null, bestScore = 0;
  for (const suit of SUITS) {
    const suitCards = hand.filter(c => c.suit.symbol === suit.symbol);
    const score = suitCards.reduce((s,c) => {
      if(c.rank.symbol==='J') return s+5;
      if(c.rank.symbol==='9') return s+4;
      if(c.rank.symbol==='A') return s+3;
      return s+1;
    },0);
    if(score > bestScore) { bestScore=score; bestSuit=suit; }
  }
  if(bestScore >= 6) return { type:'hokum', trump:bestSuit.symbol, trumpName:bestSuit.name };
  if(passCount >= 2) return { type:'hokum', trump:bestSuit.symbol, trumpName:bestSuit.name };
  return { type:'pass' };
}

// ── Card Component ────────────────────────────────────────
function Card({ card, mode, trump, highlight, winner, onClick, disabled, faceDown, small }) {
  const isTrump = mode==='hokum' && card?.suit?.symbol===trump;
  const val = card ? cardValue(card,mode,trump) : 0;
  const isRed = card?.suit?.color==='#c0392b';
  const w = small ? 42 : 54;
  const h = small ? 62 : 78;

  if(faceDown) return (
    <div style={{
      width:w, height:h, borderRadius:8, margin:3,
      background:'linear-gradient(135deg, #006C35 0%, #004D26 100%)',
      border:'2px solid #C9A84C44',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:16, boxShadow:'0 2px 6px #0004',
    }}>🃏</div>
  );

  return (
    <div onClick={!disabled?onClick:undefined} style={{
      width:w, height:h,
      background:winner?'#fffbe6':highlight?'#f0fff4':'#fff',
      border:`2px solid ${winner?'#C9A84C':highlight?'#2ECC71':isTrump?'#C9A84C88':'#ddd'}`,
      borderRadius:9,
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'space-between',
      padding:'3px 2px',
      boxShadow:winner?'0 0 14px #C9A84C, 0 4px 12px #0004'
        :highlight?'0 0 8px #2ECC7188':'0 2px 6px #0002',
      cursor:disabled?'default':'pointer',
      transform:winner?'scale(1.12) translateY(-4px)':highlight?'translateY(-6px)':'none',
      transition:'all 0.2s ease',
      margin:3, position:'relative', flexShrink:0,
    }}>
      <div style={{ fontSize:small?9:10, fontWeight:900, color:isRed?'#c0392b':'#1a1a2e',
        alignSelf:'flex-start', paddingLeft:2, lineHeight:1 }}>
        {card.rank.symbol}
      </div>
      <div style={{ fontSize:small?16:20, color:isRed?'#c0392b':'#1a1a2e', lineHeight:1 }}>
        {card.suit.symbol}
      </div>
      <div style={{ fontSize:small?8:9, color:isRed?'#c0392b':'#1a1a2e', fontWeight:700 }}>
        {card.rank.nameAr}
      </div>
      {val>0 && (
        <div style={{
          position:'absolute', top:-6, right:-6,
          background:isTrump?'#C9A84C':'#1B6B3A', color:'#fff',
          borderRadius:'50%', width:15, height:15,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:7, fontWeight:900, border:'1.5px solid white',
        }}>{val}</div>
      )}
      {isTrump && (
        <div style={{ position:'absolute', top:-9, left:'50%',
          transform:'translateX(-50%)', fontSize:9 }}>👑</div>
      )}
      {winner && (
        <div style={{ position:'absolute', bottom:-12, left:'50%',
          transform:'translateX(-50%)', fontSize:12 }}>🏆</div>
      )}
    </div>
  );
}

// ── Player Seat ───────────────────────────────────────────
function PlayerSeat({ playerIndex, hand, isActive, isBot, trickCard, trickWon, contract, timer, position }) {
  const teamColor = TEAM_COLORS[playerIndex % 2];
  const posStyles = {
    top:    { alignItems:'center', marginBottom:8 },
    left:   { alignItems:'flex-start', marginRight:8 },
    right:  { alignItems:'flex-end', marginLeft:8 },
    bottom: { alignItems:'center', marginTop:8 },
  };

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      ...posStyles[position],
      minWidth: position==='left'||position==='right' ? 80 : 'auto',
    }}>
      {/* Name badge */}
      <div style={{
        display:'flex', alignItems:'center', gap:5,
        background: isActive ? `${teamColor}22` : '#0a1a0a',
        border:`1.5px solid ${isActive ? teamColor : '#1a2a1a'}`,
        borderRadius:20, padding:'4px 10px',
        marginBottom:6, transition:'all 0.3s',
        boxShadow: isActive ? `0 0 12px ${teamColor}44` : 'none',
      }}>
        <span style={{ fontSize:16 }}>{AVATARS[playerIndex]}</span>
        <div>
          <div style={{ color:isActive?teamColor:'#888', fontWeight:700, fontSize:11, lineHeight:1.2 }}>
            {NAMES[playerIndex]}
          </div>
          <div style={{ color:'#555', fontSize:9 }}>
            Team {playerIndex%2===0?'A':'B'}
            {isBot && playerIndex!==0 && ' 🤖'}
          </div>
        </div>
        {isActive && playerIndex===0 && timer > 0 && (
          <div style={{
            background: timer<=3?'#EF476F':timer<=6?'#F39C12':'#2ECC71',
            color:'#fff', borderRadius:'50%',
            width:20, height:20,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:10, fontWeight:900, marginRight:2,
            animation: timer<=3?'pulse 0.5s infinite':'none',
          }}>{timer}</div>
        )}
      </div>

      {/* Cards */}
      {position==='bottom' ? (
        // Player hand — show face up
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', maxWidth:340 }}>
          {hand?.map(card => (
            <Card key={card.id} card={card}
              mode={contract?.type} trump={contract?.trump}
              disabled highlight={isActive}
              small={hand.length > 6}
            />
          ))}
        </div>
      ) : (
        // Other players — face down
        <div style={{ display:'flex', flexWrap:'wrap',
          justifyContent: position==='top'?'center':'flex-start',
          maxWidth: position==='top'?300:60,
        }}>
          {hand?.map((_,i) => (
            <Card key={i} faceDown small
              card={{suit:{symbol:'',color:''},rank:{symbol:'',nameAr:''}}}
              mode='' trump=''
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bidding Modal ─────────────────────────────────────────
function BiddingModal({ playerIndex, onBid, canSun, passCount }) {
  const [step, setStep] = useState('choose');
  return (
    <div style={{
      position:'fixed', inset:0, background:'#000b',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:100, padding:16,
    }}>
      <div style={{
        background:'#0D2A1A', border:'2px solid #C9A84C',
        borderRadius:16, padding:24, maxWidth:320, width:'100%',
        boxShadow:'0 0 40px #C9A84C44',
      }}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:28 }}>{AVATARS[playerIndex]}</div>
          <div style={{ color:'#C9A84C', fontWeight:900, fontSize:17, marginTop:4 }}>
            {NAMES[playerIndex]} — دورك للمزايدة
          </div>
          <div style={{ color:'#888', fontSize:11, marginTop:3 }}>
            {passCount>0?`${passCount} پاس قبلك`:'أنت أول من يزايد'}
          </div>
        </div>

        {step==='choose' ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button onClick={()=>setStep('pickSuit')} style={{
              background:'#1B6B3A', color:'#fff', border:'2px solid #2ECC71',
              borderRadius:10, padding:'13px', fontWeight:800,
              cursor:'pointer', fontSize:15,
            }}>🎯 حكم — اختر الأتو</button>
            {canSun && (
              <button onClick={()=>onBid({type:'sun'})} style={{
                background:'#6B4A00', color:'#FFD166', border:'2px solid #C9A84C',
                borderRadius:10, padding:'13px', fontWeight:800,
                cursor:'pointer', fontSize:15,
              }}>☀️ صن — بدون أتو (2×)</button>
            )}
            <button onClick={()=>onBid({type:'pass'})} style={{
              background:'transparent', color:'#888', border:'1.5px solid #555',
              borderRadius:10, padding:'11px', fontWeight:700,
              cursor:'pointer', fontSize:13,
            }}>⏭ پاس</button>
          </div>
        ) : (
          <div>
            <div style={{ color:'#4ADE80', fontWeight:700, marginBottom:12, textAlign:'center', fontSize:14 }}>
              اختر لون الأتو 👑
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {SUITS.map(s => (
                <button key={s.symbol}
                  onClick={()=>onBid({type:'hokum',trump:s.symbol,trumpName:s.name})}
                  style={{
                    background:s.color==='#c0392b'?'#3a0a0a':'#0a0a2a',
                    color:s.color==='#c0392b'?'#ff6b6b':'#aad4ff',
                    border:`2px solid ${s.color==='#c0392b'?'#c0392b':'#2a2a6e'}`,
                    borderRadius:10, padding:'14px 10px',
                    fontWeight:800, cursor:'pointer', fontSize:22, textAlign:'center',
                  }}>
                  {s.symbol}
                  <div style={{fontSize:11,marginTop:4}}>{s.name}</div>
                </button>
              ))}
            </div>
            <button onClick={()=>setStep('choose')} style={{
              marginTop:10, background:'transparent', color:'#888',
              border:'1px solid #555', borderRadius:8, padding:'8px',
              cursor:'pointer', fontSize:11, width:'100%',
            }}>← رجوع</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Round End Screen ──────────────────────────────────────
function RoundEndScreen({ result, contract, roundScores, gameScore, onNext, matchWinner }) {
  return (
    <div style={{
      position:'fixed', inset:0, background:'#000c',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:200, padding:16,
    }}>
      <div style={{
        background:'#0D2A1A',
        border:`2px solid ${result.isGahwa?'#C9A84C':result.made?'#2ECC71':'#EF476F'}`,
        borderRadius:16, padding:24, maxWidth:340, width:'100%',
        boxShadow:`0 0 40px ${result.isGahwa?'#C9A84C44':result.made?'#2ECC7144':'#EF476F44'}`,
      }}>
        <div style={{ textAlign:'center', fontSize:48, marginBottom:8 }}>
          {result.isGahwa?'☕':result.made?'🎉':'😔'}
        </div>
        <div style={{
          textAlign:'center',
          color:result.isGahwa?'#C9A84C':result.made?'#4ADE80':'#EF476F',
          fontWeight:900, fontSize:16, marginBottom:16,
        }}>{result.reason}</div>

        {/* Scores */}
        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          {[0,1].map(t => (
            <div key={t} style={{
              flex:1, background:'#071f10', borderRadius:10, padding:'10px',
              textAlign:'center',
              border:`1px solid ${contract.bidTeam===t?'#2ECC7133':'#1a2a1a'}`,
            }}>
              <div style={{ color:TEAM_COLORS[t], fontWeight:700, fontSize:11 }}>
                Team {t===0?'A':'B'}
                {contract.bidTeam===t&&<span style={{color:'#C9A84C'}}> 📋</span>}
              </div>
              <div style={{ color:'#888', fontSize:10, marginBottom:2 }}>
                جولة: {roundScores[t]}
              </div>
              <div style={{ color:'#C9A84C', fontSize:22, fontWeight:900 }}>
                +{contract.bidTeam===t?result.bidTeamFinal:result.oppTeamFinal}
              </div>
            </div>
          ))}
        </div>

        {/* Game score progress */}
        <div style={{ background:'#071f10', borderRadius:10, padding:12, marginBottom:16 }}>
          <div style={{ color:'#C9A84C', fontSize:11, fontWeight:700, marginBottom:8, textAlign:'center' }}>
            🏆 المباراة — أول فريق يصل 152
          </div>
          {[0,1].map(t => (
            <div key={t} style={{ marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                <span style={{ color:TEAM_COLORS[t], fontWeight:700 }}>Team {t===0?'A':'B'}</span>
                <span style={{ color:'#C9A84C' }}>{gameScore[t]} / 152</span>
              </div>
              <div style={{ height:6, background:'#1a2a1a', borderRadius:3, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:3,
                  width:`${Math.min((gameScore[t]/152)*100,100)}%`,
                  background:TEAM_COLORS[t], transition:'width 0.6s ease',
                }}/>
              </div>
            </div>
          ))}
        </div>

        {matchWinner !== null ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ color:'#C9A84C', fontWeight:900, fontSize:20, marginBottom:12 }}>
              🏆 Team {matchWinner===0?'A':'B'} فازت بالمباراة!
            </div>
            <button onClick={onNext} style={{
              background:'#C9A84C', color:'#000', border:'none',
              borderRadius:10, padding:'12px 32px',
              fontWeight:900, cursor:'pointer', fontSize:16, width:'100%',
            }}>🔄 مباراة جديدة</button>
          </div>
        ) : (
          <button onClick={onNext} style={{
            background:'#1B6B3A', color:'#fff', border:'none',
            borderRadius:10, padding:'12px', fontWeight:800,
            cursor:'pointer', fontSize:15, width:'100%',
          }}>▶ جولة جديدة</button>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [phase, setPhase]           = useState('idle');
  const [hands, setHands]           = useState(null);
  const [bids, setBids]             = useState([]);
  const [contract, setContract]     = useState(null);
  const [biddingTurn, setBiddingTurn] = useState(0);
  const [trickPlays, setTrickPlays] = useState([]);
  const [leader, setLeader]         = useState(0);
  const [roundScores, setRoundScores] = useState([0,0]);
  const [gameScore, setGameScore]   = useState([0,0]);
  const [trickResult, setTrickResult] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [matchWinner, setMatchWinner] = useState(null);
  const [botEnabled, setBotEnabled] = useState(true);
  const [timer, setTimer]           = useState(10);
  const [log, setLog]               = useState([]);
  const timerRef                    = useRef(null);
  const botRef                      = useRef(null);

  const activePIdx = trickResult ? -1 : (leader + trickPlays.length) % 4;
  const isPlayerTurn = activePIdx === 0 && phase === 'playing' && !trickResult;

  // ── Timer for player turn ────────────────────────────────
  useEffect(() => {
    clearInterval(timerRef.current);
    if (isPlayerTurn && phase === 'playing') {
      setTimer(10);
      timerRef.current = setInterval(() => {
        setTimer(t => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            // Auto play lowest card
            if (hands?.[0]?.length > 0) {
              const card = hands[0].sort((a,b) =>
                cardValue(a, contract.type, contract.trump) -
                cardValue(b, contract.type, contract.trump)
              )[0];
              setTimeout(() => playCard(0, card), 100);
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [activePIdx, phase, trickResult]);

  // ── Bot bidding ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'bidding' || biddingTurn === 0) return;
    if (!botEnabled) return;
    clearTimeout(botRef.current);
    botRef.current = setTimeout(() => {
      const bid = botBid(hands[biddingTurn], bids.filter(b=>b.type==='pass').length);
      handleBid(bid);
    }, 1500);
    return () => clearTimeout(botRef.current);
  }, [phase, biddingTurn, botEnabled]);

  // ── Bot playing ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    if (activePIdx === 0 || activePIdx === -1) return;
    if (!botEnabled || trickResult) return;
    clearTimeout(botRef.current);
    botRef.current = setTimeout(() => {
      const card = botPickCard(
        hands[activePIdx], trickPlays,
        contract.type, contract.trump
      );
      if (card) playCard(activePIdx, card);
    }, 3000);
    return () => clearTimeout(botRef.current);
  }, [activePIdx, phase, trickResult, botEnabled]);

  const startRound = useCallback((resetMatch=false) => {
    clearInterval(timerRef.current);
    clearTimeout(botRef.current);
    const shuffled = shuffle(buildDeck());
    setHands(deal(shuffled));
    setBids([]);
    setContract(null);
    setBiddingTurn(0);
    setTrickPlays([]);
    setLeader(0);
    setRoundScores([0,0]);
    setTrickResult(null);
    setRoundResult(null);
    setMatchWinner(null);
    if(resetMatch) setGameScore([0,0]);
    setPhase('bidding');
    setLog(['🃏 جولة جديدة! المزايدة تبدأ.']);
  }, []);

  const handleBid = useCallback((bid) => {
    setBids(prev => {
      const newBids = [...prev, { playerIndex: biddingTurn, ...bid }];
      if(bid.type==='pass') {
        setLog(p=>[...p,`${NAMES[biddingTurn]}: پاس ⏭`]);
        if(newBids.filter(b=>b.type==='pass').length===4) {
          setLog(p=>[...p,'🔄 الكل پاس — إعادة التوزيع!']);
          setTimeout(()=>startRound(false),800);
          return newBids;
        }
        setBiddingTurn(t=>(t+1)%4);
      } else {
        const c={type:bid.type,trump:bid.trump||null,
          trumpName:bid.trumpName||null,
          bidder:biddingTurn,bidTeam:biddingTurn%2};
        setContract(c);
        setPhase('playing');
        setLog(p=>[...p,
          bid.type==='hokum'
            ?`${NAMES[biddingTurn]}: حكم ${bid.trumpName} ${bid.trump} 👑`
            :`${NAMES[biddingTurn]}: صن ☀️`,
          '▶ اللعب يبدأ!',
        ]);
      }
      return newBids;
    });
  }, [biddingTurn, startRound]);

  const playCard = useCallback((pIdx, card) => {
    setHands(prev => {
      if(!prev || !prev[pIdx]) return prev;
      const newHands = prev.map((h,i) =>
        i===pIdx ? h.filter(c=>c.id!==card.id) : h
      );

      setTrickPlays(prevPlays => {
        if(prevPlays.find(p=>p.playerIndex===pIdx)) return prevPlays;
        const newPlays = [...prevPlays, {playerIndex:pIdx, card}];

        if(newPlays.length===4) {
          const mode=contract.type, trump=contract.trump;
          const winner=trickWinner(newPlays,mode,trump);
          let pts=newPlays.reduce((s,p)=>s+cardValue(p.card,mode,trump),0);
          if(mode==='sun') pts*=2;
          const winTeam=winner.playerIndex%2;

          setRoundScores(prev=>{
            const newRS=[...prev];
            newRS[winTeam]+=pts;

            // Last trick?
            if(newHands[0].length===0) {
              setTimeout(()=>endRound(newRS),1200);
            }
            return newRS;
          });

          setTrickResult({winner,pts,winTeam});
          setLog(p=>[...p,`🏆 ${NAMES[winner.playerIndex]} يفوز بالضربة +${pts}نقطة`]);
        }
        return newPlays;
      });

      return newHands;
    });
  }, [contract]);

  const endRound = useCallback((finalScores) => {
    if(!contract) return;
    const result = calculateRoundResult(finalScores, contract);
    setGameScore(prev => {
      const newGS=[...prev];
      newGS[contract.bidTeam]+=result.bidTeamFinal;
      newGS[1-contract.bidTeam]+=result.oppTeamFinal;
      const mw=newGS[0]>=152?0:newGS[1]>=152?1:null;
      setMatchWinner(mw);
      setRoundResult(result);
      setPhase('roundEnd');
      setLog(p=>[...p,'─── انتهت الجولة ───',result.reason]);
      return newGS;
    });
  }, [contract]);

  const nextTrick = () => {
    if(!trickResult) return;
    setLeader(trickResult.winner.playerIndex);
    setTrickPlays([]);
    setTrickResult(null);
  };

  return (
    <div style={{
      minHeight:'100vh',
      background:'radial-gradient(ellipse at center, #1a5c35 0%, #0D4A2A 50%, #071f10 100%)',
      fontFamily:'Segoe UI, Tahoma, sans-serif',
      color:'#E8E0D0', padding:'12px 10px',
      userSelect:'none',
    }}>
      {/* Header */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        marginBottom:12, flexWrap:'wrap', gap:8,
      }}>
        <div>
          <h1 style={{ color:'#C9A84C', fontSize:20, margin:0, fontWeight:900, lineHeight:1 }}>
            🃏 بلوت المملكة
          </h1>
          {contract && (
            <div style={{ fontSize:10, color:'#888', marginTop:2 }}>
              {contract.type==='hokum'
                ?`أتو: ${contract.trumpName} ${contract.trump} 👑`
                :'☀️ صن'}
              {' · '}Team {contract.bidTeam===0?'A':'B'} يزايد
            </div>
          )}
        </div>

        {/* Score pills */}
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {[0,1].map(t=>(
            <div key={t} style={{
              background:'#071f10',
              border:`1.5px solid ${TEAM_COLORS[t]}44`,
              borderRadius:20, padding:'4px 12px',
              textAlign:'center',
            }}>
              <div style={{ color:TEAM_COLORS[t], fontSize:9, fontWeight:700 }}>
                Team {t===0?'A':'B'}
              </div>
              <div style={{ color:'#C9A84C', fontSize:16, fontWeight:900, lineHeight:1 }}>
                {gameScore[t]}
              </div>
            </div>
          ))}

          {/* Bot toggle */}
          <div
            onClick={()=>setBotEnabled(b=>!b)}
            style={{
              background:botEnabled?'#1B6B3A':'#3a1a1a',
              border:`1.5px solid ${botEnabled?'#2ECC71':'#EF476F'}`,
              borderRadius:20, padding:'4px 10px',
              cursor:'pointer', textAlign:'center',
              transition:'all 0.2s',
            }}
          >
            <div style={{ fontSize:9, color:botEnabled?'#4ADE80':'#EF476F', fontWeight:700 }}>
              🤖 بوت
            </div>
            <div style={{ fontSize:10, color:'#fff', fontWeight:800 }}>
              {botEnabled?'ON':'OFF'}
            </div>
          </div>
        </div>
      </div>

      {/* Idle screen */}
      {phase==='idle' && (
        <div style={{ textAlign:'center', padding:'30px 0' }}>
          <div style={{ fontSize:56, marginBottom:12 }}>🃏</div>
          <div style={{ color:'#C9A84C', fontSize:22, fontWeight:900, marginBottom:6 }}>
            بلوت المملكة
          </div>
          <div style={{ color:'#888', fontSize:13, marginBottom:24 }}>
            اللعبة الأصيلة — ألعب الآن
          </div>
          <button onClick={()=>startRound(true)} style={{
            background:'linear-gradient(135deg, #C9A84C, #F0C060)',
            color:'#000', border:'none', borderRadius:14,
            padding:'16px 44px', fontWeight:900, cursor:'pointer',
            fontSize:20, boxShadow:'0 4px 20px #C9A84C44',
          }}>
            🎮 ابدأ اللعب
          </button>
        </div>
      )}

      {/* Bidding */}
      {phase==='bidding' && hands && (
        <>
          <div style={{
            background:'#071f10', borderRadius:12, padding:12,
            border:'1px solid #C9A84C33', marginBottom:10,
          }}>
            <div style={{ color:'#C9A84C', fontWeight:700, fontSize:11, marginBottom:6 }}>
              🃏 يدك — {NAMES[0]}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap' }}>
              {hands[0].map(card=>(
                <Card key={card.id} card={card} mode='hokum' trump='' disabled />
              ))}
            </div>
          </div>
          {biddingTurn===0 && (
            <BiddingModal
              playerIndex={0}
              onBid={handleBid}
              canSun={bids.length>=1}
              passCount={bids.filter(b=>b.type==='pass').length}
            />
          )}
          {biddingTurn!==0 && (
            <div style={{
              position:'fixed', inset:0, background:'#000b',
              display:'flex', alignItems:'center', justifyContent:'center',
              zIndex:100,
            }}>
              <div style={{
                background:'#0D2A1A', border:'2px solid #1B6B3A',
                borderRadius:16, padding:24, textAlign:'center',
              }}>
                <div style={{ fontSize:32 }}>{AVATARS[biddingTurn]}</div>
                <div style={{ color:'#4ADE80', fontSize:16, fontWeight:700, marginTop:8 }}>
                  {NAMES[biddingTurn]} يفكر...
                </div>
                <div style={{ color:'#888', fontSize:12, marginTop:4 }}>🤖 البوت يزايد</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Playing */}
      {phase==='playing' && contract && hands && (
        <div>
          {/* Round scores */}
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            {[0,1].map(t=>(
              <div key={t} style={{
                flex:1, background:'#071f10',
                border:`1px solid ${TEAM_COLORS[t]}33`,
                borderRadius:10, padding:'6px 10px',
                display:'flex', justifyContent:'space-between', alignItems:'center',
              }}>
                <div style={{ color:TEAM_COLORS[t], fontWeight:700, fontSize:11 }}>
                  Team {t===0?'A':'B'}
                  {contract.bidTeam===t&&<span style={{color:'#C9A84C',fontSize:9}}> 📋</span>}
                </div>
                <div style={{ color:'#C9A84C', fontSize:18, fontWeight:900 }}>
                  {roundScores[t]}
                </div>
              </div>
            ))}
          </div>

          {/* TABLE */}
          <div style={{
            background:'radial-gradient(ellipse, #1a5c35, #0D4A2A)',
            border:'3px solid #C9A84C44',
            borderRadius:20, padding:16,
            marginBottom:10, minHeight:280,
            boxShadow:'inset 0 0 40px #00000044',
            position:'relative',
          }}>
            {/* P3 — Top */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
              <PlayerSeat
                playerIndex={2} hand={hands[2]}
                isActive={activePIdx===2} isBot={botEnabled}
                trickCard={trickPlays.find(p=>p.playerIndex===2)?.card}
                contract={contract} timer={timer} position='top'
              />
            </div>

            {/* P2 Left | Center Trick | P4 Right */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              {/* P2 Left */}
              <PlayerSeat
                playerIndex={1} hand={hands[1]}
                isActive={activePIdx===1} isBot={botEnabled}
                contract={contract} timer={timer} position='left'
              />

              {/* Center trick area */}
              <div style={{
                flex:1, minHeight:120,
                display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center',
                gap:6,
              }}>
                {/* Trick cards */}
                <div style={{
                  display:'grid', gridTemplateColumns:'1fr 1fr',
                  gap:4, padding:8,
                  background:'#00000022', borderRadius:12,
                  border:'1px solid #C9A84C22',
                  minWidth:130, minHeight:100,
                }}>
                  {[2,1,3,0].map(pIdx => {
                    const play = trickPlays.find(p=>p.playerIndex===pIdx);
                    return (
                      <div key={pIdx} style={{
                        display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'center',
                        minHeight:50,
                      }}>
                        {play ? (
                          <>
                            <div style={{ color:'#888', fontSize:8, marginBottom:1 }}>
                              {NAMES[pIdx]}
                            </div>
                            <Card
                              card={play.card}
                              mode={contract.type}
                              trump={contract.trump}
                              winner={trickResult?.winner.playerIndex===pIdx}
                              disabled small
                            />
                          </>
                        ) : (
                          <div style={{
                            width:36, height:52, borderRadius:6,
                            border:'1px dashed #C9A84C33',
                            display:'flex', alignItems:'center',
                            justifyContent:'center',
                            color:'#C9A84C22', fontSize:18,
                          }}>•</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Trick result */}
                {trickResult && (
                  <div style={{ textAlign:'center' }}>
                    <div style={{ color:'#C9A84C', fontSize:11, fontWeight:700 }}>
                      🏆 {NAMES[trickResult.winner.playerIndex]} +{trickResult.pts}
                    </div>
                    <button onClick={nextTrick} style={{
                      marginTop:4, background:'#C9A84C', color:'#000',
                      border:'none', borderRadius:8, padding:'6px 16px',
                      fontWeight:800, cursor:'pointer', fontSize:12,
                    }}>التالي ▶</button>
                  </div>
                )}

                {/* Turn indicator */}
                {!trickResult && activePIdx>=0 && (
                  <div style={{
                    color: activePIdx===0?'#4ADE80':'#888',
                    fontSize:10, textAlign:'center',
                    animation: activePIdx===0?'none':'none',
                  }}>
                    {activePIdx===0?'🟢 دورك!`':`⏳ ${NAMES[activePIdx]}...`}
                  </div>
                )}
              </div>

              {/* P4 Right */}
              <PlayerSeat
                playerIndex={3} hand={hands[3]}
                isActive={activePIdx===3} isBot={botEnabled}
                contract={contract} timer={timer} position='right'
              />
            </div>

            {/* P1 Bottom — YOU */}
            <div style={{ display:'flex', justifyContent:'center' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{
                  display:'flex', alignItems:'center', gap:6,
                  justifyContent:'center', marginBottom:6,
                }}>
                  <span style={{ fontSize:16 }}>{AVATARS[0]}</span>
                  <div style={{
                    color:isPlayerTurn?'#4ADE80':'#888',
                    fontWeight:700, fontSize:12,
                  }}>
                    {NAMES[0]} (أنت)
                    {isPlayerTurn && (
                      <span style={{
                        background:'#4ADE80', color:'#000',
                        fontSize:9, padding:'1px 7px',
                        borderRadius:10, fontWeight:800, marginRight:6,
                      }}>دورك ▶</span>
                    )}
                  </div>
                  {isPlayerTurn && timer > 0 && (
                    <div style={{
                      background:timer<=3?'#EF476F':timer<=6?'#F39C12':'#2ECC71',
                      color:'#fff', borderRadius:'50%',
                      width:22, height:22,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, fontWeight:900,
                    }}>{timer}</div>
                  )}
                </div>
                {/* Timer bar */}
                {isPlayerTurn && (
                  <div style={{
                    height:3, width:200, background:'#1a2a1a',
                    borderRadius:2, margin:'0 auto 8px', overflow:'hidden',
                  }}>
                    <div style={{
                      height:'100%', borderRadius:2,
                      width:`${(timer/10)*100}%`,
                      background:timer<=3?'#EF476F':timer<=6?'#F39C12':'#2ECC71',
                      transition:'width 0.9s linear',
                    }}/>
                  </div>
                )}
                {/* Your cards */}
                <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', maxWidth:320 }}>
                  {hands[0].map(card=>(
                    <Card
                      key={card.id} card={card}
                      mode={contract.type} trump={contract.trump}
                      highlight={isPlayerTurn}
                      onClick={()=>isPlayerTurn&&!trickResult&&playCard(0,card)}
                      disabled={!isPlayerTurn||!!trickResult}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Log */}
          <div style={{
            background:'#071f10', borderRadius:10, padding:'8px 12px',
            border:'1px solid #1B6B3A', maxHeight:80, overflowY:'auto',
          }}>
            {log.slice(-4).map((l,i)=>(
              <div key={i} style={{
                color:l.includes('🏆')||l.includes('✅')||l.includes('☕')?'#C9A84C'
                  :l.includes('❌')?'#EF476F':'#888',
                fontSize:10, lineHeight:1.7, fontFamily:'monospace',
              }}>{l}</div>
            ))}
          </div>
        </div>
      )}

      {/* Round End */}
      {phase==='roundEnd' && roundResult && (
        <RoundEndScreen
          result={roundResult}
          contract={contract}
          roundScores={roundScores}
          gameScore={gameScore}
          matchWinner={matchWinner}
          onNext={()=>matchWinner!==null?startRound(true):startRound(false)}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%,100%{transform:scale(1)}
          50%{transform:scale(1.15)}
        }
      `}</style>
    </div>
  );
}