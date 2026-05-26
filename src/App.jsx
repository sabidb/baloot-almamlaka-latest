import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase';
import { doc, setDoc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';

// ── Design Tokens ─────────────────────────────────────────
const T = {
  gold:    '#C9A84C',
  goldL:   '#F0C060',
  goldD:   '#8B6914',
  green:   '#006C35',
  greenL:  '#1a8a4a',
  greenD:  '#004D26',
  night:   '#0A0F0A',
  felt:    '#0D4A2A',
  feltL:   '#1a5c35',
  cream:   '#FDF6E3',
  red:     '#C0392B',
  redL:    '#E74C3C',
  blue:    '#1A4A8A',
  blueL:   '#2E86C1',
  smoke:   '#888',
  border:  '#C9A84C33',
};

// ── Data ──────────────────────────────────────────────────
const SUITS = [
  { symbol: '♠', name: 'بستوني', color: T.night, isRed: false },
  { symbol: '♥', name: 'كبة',    color: T.red,   isRed: true  },
  { symbol: '♦', name: 'ديناري', color: T.red,   isRed: true  },
  { symbol: '♣', name: 'جاروني', color: T.night, isRed: false },
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
const TEAM_COLORS = [T.gold, T.blueL];
const AVATARS = ['🧔','👲','🧕','👳','🧑','👩','👨','👧'];
const CITY_OPTIONS = ['كل المدن','الرياض','جدة','الدمام','مكة','المدينة','أبها','تبوك'];

// ── Sound Engine ──────────────────────────────────────────
const sounds = {
  deal: () => playTone(440, 0.1, 'triangle'),
  play: () => playTone(520, 0.08, 'sine'),
  win:  () => playTone([523,659,784], 0.15, 'sine'),
  gahwa:()=> playTone([784,659,523,659,784], 0.2, 'triangle'),
  tick: () => playTone(880, 0.05, 'square'),
};
function playTone(freq, vol=0.1, type='sine') {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const freqs = Array.isArray(freq) ? freq : [freq];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = f;
      gain.gain.setValueAtTime(vol, ctx.currentTime + i*0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.12 + 0.15);
      osc.start(ctx.currentTime + i*0.12);
      osc.stop(ctx.currentTime + i*0.12 + 0.15);
    });
  } catch(e) {}
}

// ── Core Game Functions ───────────────────────────────────
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
function dealHands(deck) {
  return { h0:deck.slice(0,8), h1:deck.slice(8,16), h2:deck.slice(16,24), h3:deck.slice(24,32) };
}
function getHands(gd) {
  return [gd.h0||[], gd.h1||[], gd.h2||[], gd.h3||[]];
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
    return { made,isGahwa,
      bidTeamFinal:made?total*2:0, oppTeamFinal:made?0:total*2,
      reason:made?(isGahwa?'☕ صن + قهوة!':'☀️ صن نجح!'):'☀️ صن فشل!' };
  }
  if(isGahwa) return { made:true,isGahwa:true,
    bidTeamFinal:total*2,oppTeamFinal:0,reason:'☕ قهوة! ضعف النقاط!' };
  const made=bidScore>=82;
  return { made,isGahwa:false,
    bidTeamFinal:made?bidScore:0, oppTeamFinal:made?oppScore:total,
    reason:made?`✅ حكم نجح! (${bidScore}≥82)`:`❌ حكم فشل!` };
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

// ── Premium Card Component ────────────────────────────────
function Card({card,mode,trump,highlight,winner,onClick,disabled,faceDown,small,deckStyle='classic'}) {
  const [flipped,setFlipped]=useState(false);
  useEffect(()=>{
    if(!faceDown){setTimeout(()=>setFlipped(true),50);}
    else setFlipped(false);
  },[faceDown]);

  const isTrump=mode==='hokum'&&card?.suit?.symbol===trump;
  const val=card?cardValue(card,mode,trump):0;
  const isRed=card?.suit?.isRed;
  const w=small?44:56; const h=small?64:80;

  if(faceDown) return(
    <div style={{
      width:w,height:h,borderRadius:10,margin:3,
      background:`linear-gradient(135deg, ${T.green} 0%, ${T.greenD} 40%, ${T.green} 100%)`,
      border:`2px solid ${T.gold}`,
      display:'flex',alignItems:'center',justifyContent:'center',
      boxShadow:`0 4px 12px #00000066, inset 0 0 8px #00000033`,
      position:'relative',overflow:'hidden',flexShrink:0,
    }}>
      <div style={{
        position:'absolute',inset:4,
        border:`1px solid ${T.gold}44`,borderRadius:6,
        backgroundImage:`repeating-linear-gradient(45deg, ${T.gold}11 0px, ${T.gold}11 1px, transparent 1px, transparent 8px)`,
      }}/>
      <div style={{fontSize:small?14:18,zIndex:1}}>🃏</div>
    </div>
  );

  return(
    <div
      onClick={!disabled?()=>{sounds.play();onClick&&onClick();}:undefined}
      style={{
        width:w,height:h,
        background:winner
          ?`linear-gradient(135deg, #fffbe6, #fff9d6)`
          :highlight?`linear-gradient(135deg, #f0fff4, #e8fef0)`
          :`linear-gradient(135deg, #ffffff, #f8f8f8)`,
        border:`2px solid ${winner?T.gold:highlight?T.greenL:isTrump?T.gold+'88':'#ddd'}`,
        borderRadius:10,
        display:'flex',flexDirection:'column',
        alignItems:'center',justifyContent:'space-between',
        padding:'4px 3px',
        boxShadow:winner
          ?`0 0 20px ${T.gold}88, 0 6px 16px #0004`
          :highlight?`0 0 12px ${T.greenL}66, 0 4px 10px #0003`
          :`0 3px 8px #0002`,
        cursor:disabled?'default':'pointer',
        transform:winner
          ?'scale(1.15) translateY(-6px)'
          :highlight?'translateY(-8px) scale(1.03)':'none',
        transition:'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        margin:3,position:'relative',flexShrink:0,
      }}
    >
      {/* Top rank */}
      <div style={{
        fontSize:small?9:11,fontWeight:900,
        color:isRed?T.red:T.night,
        alignSelf:'flex-start',paddingLeft:3,lineHeight:1,
      }}>{card.rank.symbol}</div>

      {/* Center suit */}
      <div style={{
        fontSize:small?18:24,
        color:isRed?T.red:T.night,
        lineHeight:1,
        textShadow:isRed?`0 0 8px ${T.red}44`:`0 0 8px #00000022`,
      }}>{card.suit.symbol}</div>

      {/* Arabic name */}
      <div style={{
        fontSize:small?8:10,
        color:isRed?T.red:T.night,
        fontWeight:700,lineHeight:1,
      }}>{card.rank.nameAr}</div>

      {/* Points badge */}
      {val>0&&(
        <div style={{
          position:'absolute',top:-7,right:-7,
          background:isTrump
            ?`linear-gradient(135deg,${T.gold},${T.goldL})`
            :`linear-gradient(135deg,${T.green},${T.greenL})`,
          color:isTrump?T.night:'#fff',
          borderRadius:'50%',width:16,height:16,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:7,fontWeight:900,
          border:`2px solid white`,
          boxShadow:'0 2px 4px #0003',
        }}>{val}</div>
      )}

      {/* Trump crown */}
      {isTrump&&(
        <div style={{
          position:'absolute',top:-10,left:'50%',
          transform:'translateX(-50%)',
          fontSize:10,filter:'drop-shadow(0 1px 2px #0004)',
        }}>👑</div>
      )}

      {/* Winner glow */}
      {winner&&(
        <div style={{
          position:'absolute',bottom:-14,left:'50%',
          transform:'translateX(-50%)',fontSize:12,
        }}>🏆</div>
      )}

      {/* Highlight pulse */}
      {highlight&&(
        <div style={{
          position:'absolute',inset:-2,borderRadius:11,
          border:`2px solid ${T.greenL}`,
          animation:'pulse-border 1s infinite',
          pointerEvents:'none',
        }}/>
      )}
    </div>
  );
}

// ── Premium Player Badge ──────────────────────────────────
function PlayerBadge({name,avatar,teamColor,isActive,isMe,cardCount,timer}) {
  return(
    <div style={{
      display:'inline-flex',alignItems:'center',gap:6,
      background:isActive?`${teamColor}22`:'#0a1a0a',
      border:`2px solid ${isActive?teamColor:'#1a2a1a'}`,
      borderRadius:24,padding:'5px 12px',
      transition:'all 0.3s ease',
      boxShadow:isActive?`0 0 16px ${teamColor}44`:'none',
    }}>
      <span style={{fontSize:18}}>{avatar||'🧔'}</span>
      <div>
        <div style={{
          color:isActive?teamColor:T.smoke,
          fontWeight:700,fontSize:12,lineHeight:1.2,
        }}>
          {name}{isMe&&<span style={{color:T.gold,fontSize:9}}> ✦</span>}
        </div>
        <div style={{color:'#555',fontSize:9}}>
          {cardCount!==undefined?`${cardCount} ورقة`:''}
        </div>
      </div>
      {isActive&&isMe&&timer>0&&(
        <div style={{
          background:timer<=3?T.redL:timer<=6?'#F39C12':T.greenL,
          color:'#fff',borderRadius:'50%',
          width:24,height:24,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:11,fontWeight:900,
          animation:timer<=3?'pulse 0.5s infinite':'none',
          boxShadow:`0 0 8px ${timer<=3?T.redL:T.greenL}88`,
        }}>{timer}</div>
      )}
    </div>
  );
}

// ── Bidding Modal ─────────────────────────────────────────
function BiddingModal({playerIndex,onBid,canSun,passCount,playerName,avatar}) {
  const [step,setStep]=useState('choose');
  return(
    <div style={{
      position:'fixed',inset:0,
      background:'linear-gradient(135deg,#000c,#001a0acc)',
      display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:100,padding:16,backdropFilter:'blur(4px)',
    }}>
      <div style={{
        background:`linear-gradient(135deg,#0D2A1A,#071f10)`,
        border:`2px solid ${T.gold}`,
        borderRadius:20,padding:28,maxWidth:320,width:'100%',
        boxShadow:`0 0 60px ${T.gold}33, 0 20px 40px #00000088`,
      }}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:6}}>{avatar||AVATARS[playerIndex%8]}</div>
          <div style={{
            color:T.gold,fontWeight:900,fontSize:18,
            textShadow:`0 0 20px ${T.gold}44`,
          }}>
            {playerName||`اللاعب ${playerIndex+1}`}
          </div>
          <div style={{color:T.gold,fontSize:13,marginTop:2}}>دورك للمزايدة</div>
          {passCount>0&&(
            <div style={{
              color:T.smoke,fontSize:11,marginTop:4,
              background:'#ffffff11',borderRadius:8,padding:'3px 10px',
              display:'inline-block',
            }}>{passCount} پاس قبلك</div>
          )}
        </div>

        {step==='choose'?(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <button onClick={()=>setStep('pickSuit')} style={{
              background:`linear-gradient(135deg,${T.green},${T.greenL})`,
              color:'#fff',border:`2px solid ${T.greenL}`,
              borderRadius:14,padding:'15px',fontWeight:800,
              cursor:'pointer',fontSize:16,
              boxShadow:`0 4px 16px ${T.green}88`,
              transition:'transform 0.15s',
            }}>🎯 حكم — اختر الأتو</button>
            {canSun&&(
              <button onClick={()=>onBid({type:'sun'})} style={{
                background:`linear-gradient(135deg,#6B4A00,#8B6400)`,
                color:T.goldL,border:`2px solid ${T.gold}`,
                borderRadius:14,padding:'15px',fontWeight:800,
                cursor:'pointer',fontSize:16,
                boxShadow:`0 4px 16px ${T.goldD}88`,
              }}>☀️ صن — بدون أتو (2×)</button>
            )}
            <button onClick={()=>onBid({type:'pass'})} style={{
              background:'transparent',color:T.smoke,
              border:`1.5px solid #333`,
              borderRadius:14,padding:'12px',fontWeight:700,
              cursor:'pointer',fontSize:14,
            }}>⏭ پاس</button>
          </div>
        ):(
          <div>
            <div style={{
              color:T.goldL,fontWeight:700,marginBottom:14,
              textAlign:'center',fontSize:15,
            }}>اختر لون الأتو 👑</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {SUITS.map(s=>(
                <button key={s.symbol}
                  onClick={()=>onBid({type:'hokum',trump:s.symbol,trumpName:s.name})}
                  style={{
                    background:s.isRed?'#3a0a0a':'#0a0a1a',
                    color:s.isRed?'#ff7070':'#aad4ff',
                    border:`2px solid ${s.isRed?T.red:T.blue}`,
                    borderRadius:14,padding:'16px 10px',
                    fontWeight:800,cursor:'pointer',fontSize:28,
                    textAlign:'center',
                    boxShadow:`0 4px 12px ${s.isRed?T.red:T.blue}44`,
                    transition:'transform 0.15s',
                  }}>
                  {s.symbol}
                  <div style={{fontSize:12,marginTop:4}}>{s.name}</div>
                </button>
              ))}
            </div>
            <button onClick={()=>setStep('choose')} style={{
              marginTop:12,background:'transparent',color:T.smoke,
              border:`1px solid #333`,borderRadius:10,padding:'10px',
              cursor:'pointer',fontSize:12,width:'100%',
            }}>← رجوع</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Round End Screen ──────────────────────────────────────
function RoundEndScreen({result,contract,roundScores,gameScore,onNext,matchWinner}) {
  useEffect(()=>{
    if(result.isGahwa) sounds.gahwa();
    else if(result.made) sounds.win();
  },[]);

  return(
    <div style={{
      position:'fixed',inset:0,
      background:'linear-gradient(135deg,#000e,#001a0acc)',
      display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:200,padding:16,backdropFilter:'blur(6px)',
    }}>
      <div style={{
        background:`linear-gradient(135deg,#0D2A1A,#071f10)`,
        border:`2px solid ${result.isGahwa?T.gold:result.made?T.greenL:T.redL}`,
        borderRadius:20,padding:28,maxWidth:360,width:'100%',
        boxShadow:`0 0 60px ${result.isGahwa?T.gold:result.made?T.greenL:T.redL}44`,
      }}>
        <div style={{textAlign:'center',fontSize:56,marginBottom:8,
          animation:'bounce 0.5s ease'}}>
          {result.isGahwa?'☕':result.made?'🎉':'😔'}
        </div>
        <div style={{
          textAlign:'center',
          color:result.isGahwa?T.gold:result.made?T.greenL:T.redL,
          fontWeight:900,fontSize:18,marginBottom:20,
          textShadow:`0 0 20px currentColor`,
        }}>{result.reason}</div>

        <div style={{display:'flex',gap:12,marginBottom:16}}>
          {[0,1].map(t=>(
            <div key={t} style={{
              flex:1,
              background:contract.bidTeam===t?'#0a2a0a':'#071010',
              border:`1.5px solid ${contract.bidTeam===t?T.greenL+'44':'#1a2a1a'}`,
              borderRadius:14,padding:'12px',textAlign:'center',
            }}>
              <div style={{color:TEAM_COLORS[t],fontWeight:700,fontSize:12}}>
                Team {t===0?'A':'B'}
                {contract.bidTeam===t&&<span style={{color:T.gold}}> 📋</span>}
              </div>
              <div style={{color:T.smoke,fontSize:11,marginBottom:4}}>
                جولة: {roundScores[t]}
              </div>
              <div style={{
                color:T.gold,fontSize:26,fontWeight:900,
                textShadow:`0 0 12px ${T.gold}66`,
              }}>
                +{contract.bidTeam===t?result.bidTeamFinal:result.oppTeamFinal}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          background:'#071f10',borderRadius:14,padding:14,marginBottom:16,
          border:`1px solid ${T.border}`,
        }}>
          <div style={{
            color:T.gold,fontSize:12,fontWeight:700,
            marginBottom:10,textAlign:'center',
          }}>🏆 المباراة — أول فريق يصل 152</div>
          {[0,1].map(t=>(
            <div key={t} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',
                fontSize:12,marginBottom:4}}>
                <span style={{color:TEAM_COLORS[t],fontWeight:700}}>
                  Team {t===0?'A':'B'}
                </span>
                <span style={{color:T.gold,fontWeight:700}}>
                  {gameScore[t]} / 152
                </span>
              </div>
              <div style={{height:8,background:'#1a2a1a',borderRadius:4,overflow:'hidden'}}>
                <div style={{
                  height:'100%',borderRadius:4,
                  width:`${Math.min((gameScore[t]/152)*100,100)}%`,
                  background:`linear-gradient(to right,${TEAM_COLORS[t]},${TEAM_COLORS[t]}cc)`,
                  transition:'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                  boxShadow:`0 0 8px ${TEAM_COLORS[t]}88`,
                }}/>
              </div>
            </div>
          ))}
        </div>

        {matchWinner!==null?(
          <div style={{textAlign:'center'}}>
            <div style={{
              color:T.gold,fontWeight:900,fontSize:22,marginBottom:14,
              textShadow:`0 0 20px ${T.gold}88`,
            }}>
              🏆 Team {matchWinner===0?'A':'B'} فازت بالمباراة!
            </div>
            <button onClick={onNext} style={{
              background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
              color:T.night,border:'none',borderRadius:14,
              padding:'14px 32px',fontWeight:900,cursor:'pointer',
              fontSize:17,width:'100%',
              boxShadow:`0 4px 20px ${T.gold}66`,
            }}>🔄 مباراة جديدة</button>
          </div>
        ):(
          <button onClick={onNext} style={{
            background:`linear-gradient(135deg,${T.green},${T.greenL})`,
            color:'#fff',border:'none',borderRadius:14,
            padding:'14px',fontWeight:800,cursor:'pointer',
            fontSize:16,width:'100%',
            boxShadow:`0 4px 16px ${T.green}88`,
          }}>▶ جولة جديدة</button>
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
    <div style={{
      minHeight:'100vh',
      background:`radial-gradient(ellipse at 50% 0%, ${T.greenL}44, ${T.felt} 60%, ${T.night})`,
      display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',padding:24,
      fontFamily:'Segoe UI,Tahoma,Arial,sans-serif',
    }}>
      {/* Logo */}
      <div style={{textAlign:'center',marginBottom:28}}>
        <div style={{fontSize:56,marginBottom:4,filter:'drop-shadow(0 4px 8px #00000088)'}}>🃏</div>
        <h1 style={{
          color:T.gold,fontSize:32,fontWeight:900,margin:'0 0 4px',
          textShadow:`0 0 30px ${T.gold}44`,
          letterSpacing:2,
        }}>بلوت المملكة</h1>
        <p style={{color:T.smoke,fontSize:13,margin:0}}>
          {isHost?'أنت المضيف — شارك الكود مع أصدقائك':'انتظر المضيف ليبدأ اللعبة'}
        </p>
      </div>

      {/* Room code display */}
      <div style={{
        background:`linear-gradient(135deg,#071f10,#0a2a0a)`,
        border:`2px solid ${T.gold}`,
        borderRadius:20,padding:'20px 40px',marginBottom:16,
        textAlign:'center',
        boxShadow:`0 0 40px ${T.gold}22, 0 8px 24px #00000066`,
      }}>
        <div style={{color:T.smoke,fontSize:11,marginBottom:6,letterSpacing:2}}>
          كود الغرفة
        </div>
        <div style={{
          color:T.gold,fontSize:48,fontWeight:900,letterSpacing:10,
          textShadow:`0 0 20px ${T.gold}66`,
          fontVariantNumeric:'tabular-nums',
        }}>{roomCode}</div>
      </div>

      {/* Action buttons */}
      <div style={{width:'100%',maxWidth:320,display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
        <button onClick={copy} style={{
          background:copied?`linear-gradient(135deg,${T.green},${T.greenL})`:'#0a1a0a',
          color:copied?'#fff':T.smoke,
          border:`1.5px solid ${copied?T.greenL:'#333'}`,
          borderRadius:12,padding:'11px 20px',
          fontWeight:700,cursor:'pointer',fontSize:14,
          transition:'all 0.3s',
        }}>
          {copied?'✅ تم النسخ!':'📋 انسخ رابط الدعوة'}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`تحداني في بلوت المملكة! 🃏\nكود: ${roomCode}\n${shareLink}`)}`}
          target="_blank" rel="noreferrer"
          style={{
            background:'linear-gradient(135deg,#075e54,#128c7e)',
            color:'#fff',borderRadius:12,padding:'11px 20px',
            fontWeight:700,fontSize:14,textDecoration:'none',
            display:'block',textAlign:'center',
            boxShadow:'0 4px 16px #075e5488',
          }}>
          📱 شارك عبر واتساب
        </a>
      </div>

      {/* Players list */}
      <div style={{width:'100%',maxWidth:320,marginBottom:20}}>
        <div style={{
          color:T.smoke,fontSize:11,marginBottom:10,
          textAlign:'center',letterSpacing:1,
        }}>
          اللاعبون ({safePlayers.filter(p=>p).length} / 4)
        </div>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{
            background:safePlayers[i]?'#0a2a0a':'#071010',
            border:`1.5px solid ${safePlayers[i]?TEAM_COLORS[i%2]+'44':'#1a2a1a'}`,
            borderRadius:14,padding:'12px 16px',marginBottom:8,
            display:'flex',alignItems:'center',gap:12,
            transition:'all 0.3s',
            boxShadow:safePlayers[i]?`0 2px 8px ${TEAM_COLORS[i%2]}22`:'none',
          }}>
            <div style={{
              width:36,height:36,borderRadius:'50%',
              background:safePlayers[i]?`${TEAM_COLORS[i%2]}22`:'#1a2a1a',
              border:`2px solid ${safePlayers[i]?TEAM_COLORS[i%2]:'#333'}`,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:18,
            }}>
              {safePlayers[i]?AVATARS[i%8]:'⬜'}
            </div>
            <div style={{flex:1}}>
              <div style={{
                color:safePlayers[i]?TEAM_COLORS[i%2]:'#444',
                fontWeight:700,fontSize:14,
              }}>
                {safePlayers[i]||`اللاعب ${i+1}`}
                {i===myIndex&&(
                  <span style={{
                    color:T.gold,fontSize:9,
                    background:`${T.gold}22`,
                    borderRadius:6,padding:'1px 6px',marginRight:6,
                  }}> أنت</span>
                )}
              </div>
              <div style={{color:'#555',fontSize:10}}>
                Team {i%2===0?'A':'B'}
              </div>
            </div>
            {safePlayers[i]&&(
              <div style={{
                background:`${T.greenL}22`,color:T.greenL,
                borderRadius:10,padding:'3px 10px',
                fontSize:10,fontWeight:700,
              }}>متصل ✓</div>
            )}
          </div>
        ))}
      </div>

      {isHost&&safePlayers.filter(p=>p).length>=2?(
        <button onClick={onStart} style={{
          background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
          color:T.night,border:'none',borderRadius:16,
          padding:'16px 48px',fontWeight:900,
          cursor:'pointer',fontSize:20,
          width:'100%',maxWidth:320,
          boxShadow:`0 6px 24px ${T.gold}66`,
          letterSpacing:1,
        }}>🎮 ابدأ اللعبة!</button>
      ):isHost?(
        <div style={{
          color:T.smoke,fontSize:13,textAlign:'center',
          background:'#ffffff0a',borderRadius:10,padding:'12px 20px',
        }}>
          انتظر لاعب واحد على الأقل للانضمام...
        </div>
      ):null}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState('home');
  const [playerName,setPlayerName]=useState('');
  const [playerAvatar,setPlayerAvatar]=useState(AVATARS[0]);
  const [joinCode,setJoinCode]=useState('');
  const [roomCode,setRoomCode]=useState('');
  const [myIndex,setMyIndex]=useState(0);
  const [isHost,setIsHost]=useState(false);
  const [error,setError]=useState('');
  const [gameData,setGameData]=useState(null);
  const [timer,setTimer]=useState(10);
  const [showAvatarPicker,setShowAvatarPicker]=useState(false);
  const [reactions,setReactions]=useState([]);

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

  const shareLink=typeof window!=='undefined'
    ?`${window.location.origin}?room=${roomCode}`:'';

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const room=params.get('room');
    if(room) setJoinCode(room);
  },[]);

  const subscribeRoom=useCallback((code)=>{
    if(unsubRef.current) unsubRef.current();
    unsubRef.current=onSnapshot(
      doc(db,'rooms',code),
      (snap)=>{
        if(snap.exists()){
          const data=snap.data();
          setGameData(data);
          if(['bidding','playing','roundEnd'].includes(data.phase))
            setScreen('game');
          else if(data.phase==='lobby')
            setScreen('lobby');
        }
      },
      (err)=>console.error('Firestore:',err)
    );
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
    try {
      const code=generateRoomCode();
      await setDoc(doc(db,'rooms',code),{
        phase:'lobby',
        players:[playerName.trim(),null,null,null],
        avatars:[playerAvatar,null,null,null],
        h0:[],h1:[],h2:[],h3:[],
        bids:[],contract:null,biddingTurn:0,
        trickPlays:[],leader:0,
        roundScores:[0,0],gameScore:[0,0],
        trickResult:null,roundResult:null,
        matchWinner:null,hostIndex:0,
        createdAt:Date.now(),
      });
      setRoomCode(code); roomCodeRef.current=code;
      setMyIndex(0); myIndexRef.current=0;
      setIsHost(true); isHostRef.current=true;
      subscribeRoom(code);
    } catch(e){setError('فشل: '+e.message);}
  };

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
      const newAvatars=[...(data.avatars||[null,null,null,null])];
      newAvatars[emptySlot]=playerAvatar;
      await updateDoc(doc(db,'rooms',code),{players:newPlayers,avatars:newAvatars});
      setRoomCode(code); roomCodeRef.current=code;
      setMyIndex(emptySlot); myIndexRef.current=emptySlot;
      setIsHost(false); isHostRef.current=false;
      subscribeRoom(code);
    } catch(e){setError('فشل: '+e.message);}
  };

  const startGame=async()=>{
    const code=roomCodeRef.current;
    if(!code) return;
    sounds.deal();
    const shuffled=shuffle(buildDeck());
    const h=dealHands(shuffled);
    await updateDoc(doc(db,'rooms',code),{
      phase:'bidding',h0:h.h0,h1:h.h1,h2:h.h2,h3:h.h3,
      bids:[],contract:null,biddingTurn:0,
      trickPlays:[],leader:0,roundScores:[0,0],
      trickResult:null,roundResult:null,matchWinner:null,
    });
  };

  const handleBid=async(bid)=>{
    const gd=gameDataRef.current;
    const code=roomCodeRef.current;
    if(!gd||!code) return;
    const newBids=[...gd.bids,{playerIndex:gd.biddingTurn,...bid}];
    if(bid.type==='pass') {
      if(newBids.filter(b=>b.type==='pass').length===4) {
        const shuffled=shuffle(buildDeck());
        const h=dealHands(shuffled);
        await updateDoc(doc(db,'rooms',code),{
          h0:h.h0,h1:h.h1,h2:h.h2,h3:h.h3,bids:[],biddingTurn:0});
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

  const playCard=async(card)=>{
    const gd=gameDataRef.current;
    const code=roomCodeRef.current;
    const mi=myIndexRef.current;
    if(!gd||!code||!gd.contract) return;
    sounds.play();
    const hands=getHands(gd);
    const {trickPlays,leader,contract,roundScores}=gd;
    const newPlays=[...trickPlays,{playerIndex:mi,card}];
    const newHand=hands[mi].filter(c=>c.id!==card.id);
    if(newPlays.length===4) {
      const mode=contract.type,trump=contract.trump;
      const winner=trickWinner(newPlays,mode,trump);
      let pts=newPlays.reduce((s,p)=>s+cardValue(p.card,mode,trump),0);
      if(mode==='sun') pts*=2;
      const winTeam=winner.playerIndex%2;
      const newRS=[...roundScores]; newRS[winTeam]+=pts;
      const trickResult={winner,pts,winTeam};
      const newHands=hands.map((h,i)=>i===mi?newHand:h);
      const update={trickPlays:newPlays,[`h${mi}`]:newHand,roundScores:newRS,trickResult};
      if(newHands[0].length===0) {
        const result=calculateRoundResult(newRS,contract);
        const newGS=[...gd.gameScore];
        newGS[contract.bidTeam]+=result.bidTeamFinal;
        newGS[1-contract.bidTeam]+=result.oppTeamFinal;
        const mw=newGS[0]>=152?0:newGS[1]>=152?1:null;
        await updateDoc(doc(db,'rooms',code),{
          ...update,gameScore:newGS,roundResult:result,matchWinner:mw,phase:'roundEnd'});
      } else {
        await updateDoc(doc(db,'rooms',code),update);
      }
    } else {
      await updateDoc(doc(db,'rooms',code),{trickPlays:newPlays,[`h${mi}`]:newHand});
    }
  };

  const nextTrick=async()=>{
    const gd=gameDataRef.current;
    const code=roomCodeRef.current;
    if(!gd?.trickResult||!code) return;
    await updateDoc(doc(db,'rooms',code),{
      leader:gd.trickResult.winner.playerIndex,trickPlays:[],trickResult:null});
  };

  const newRound=async(resetMatch=false)=>{
    const gd=gameDataRef.current;
    const code=roomCodeRef.current;
    if(!code) return;
    sounds.deal();
    const shuffled=shuffle(buildDeck());
    const h=dealHands(shuffled);
    await updateDoc(doc(db,'rooms',code),{
      phase:'bidding',h0:h.h0,h1:h.h1,h2:h.h2,h3:h.h3,
      bids:[],contract:null,biddingTurn:0,trickPlays:[],
      leader:0,roundScores:[0,0],trickResult:null,
      roundResult:null,matchWinner:null,
      gameScore:resetMatch?[0,0]:gd?.gameScore||[0,0]});
  };

  // Bot bidding
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
      const hands=getHands(gd2);
      const hand=hands[bt];
      if(!hand?.length) return;
      const bid=botBid(hand,gd2.bids.filter(b=>b.type==='pass').length);
      const newBids=[...gd2.bids,{playerIndex:bt,...bid}];
      if(bid.type==='pass') {
        if(newBids.filter(b=>b.type==='pass').length===4) {
          const shuffled=shuffle(buildDeck());
          const h=dealHands(shuffled);
          await updateDoc(doc(db,'rooms',code),{
            h0:h.h0,h1:h.h1,h2:h.h2,h3:h.h3,bids:[],biddingTurn:0});
          return;
        }
        await updateDoc(doc(db,'rooms',code),{bids:newBids,biddingTurn:(bt+1)%4});
      } else {
        await updateDoc(doc(db,'rooms',code),{
          bids:newBids,
          contract:{type:bid.type,trump:bid.trump||null,
            trumpName:bid.trumpName||null,bidder:bt,bidTeam:bt%2},
          phase:'playing'});
      }
    },1500);
  },[gameData?.biddingTurn,gameData?.phase]);

  // Bot playing
  useEffect(()=>{
    const gd=gameData;
    if(!gd||gd.phase!=='playing'||gd.trickResult||!isHostRef.current) return;
    const {leader,trickPlays,players}=gd;
    const activePIdx=(leader+trickPlays.length)%4;
    if(players[activePIdx]) return;
    clearTimeout(botRef.current);
    botRef.current=setTimeout(async()=>{
      const gd2=gameDataRef.current;
      const code=roomCodeRef.current;
      if(!gd2||!code||!gd2.contract) return;
      const hands=getHands(gd2);
      const hand=hands[activePIdx];
      if(!hand?.length) return;
      const card=botPickCard(hand,gd2.trickPlays,gd2.contract.type,gd2.contract.trump);
      if(!card) return;
      sounds.play();
      const newPlays=[...gd2.trickPlays,{playerIndex:activePIdx,card}];
      const newHand=hand.filter(c=>c.id!==card.id);
      if(newPlays.length===4) {
        const mode=gd2.contract.type,trump=gd2.contract.trump;
        const winner=trickWinner(newPlays,mode,trump);
        let pts=newPlays.reduce((s,p)=>s+cardValue(p.card,mode,trump),0);
        if(mode==='sun') pts*=2;
        const winTeam=winner.playerIndex%2;
        const newRS=[...gd2.roundScores]; newRS[winTeam]+=pts;
        const allHands=hands.map((h,i)=>i===activePIdx?newHand:h);
        const update={trickPlays:newPlays,[`h${activePIdx}`]:newHand,
          roundScores:newRS,trickResult:{winner,pts,winTeam}};
        if(allHands[0].length===0) {
          const result=calculateRoundResult(newRS,gd2.contract);
          const newGS=[...gd2.gameScore];
          newGS[gd2.contract.bidTeam]+=result.bidTeamFinal;
          newGS[1-gd2.contract.bidTeam]+=result.oppTeamFinal;
          const mw=newGS[0]>=152?0:newGS[1]>=152?1:null;
          await updateDoc(doc(db,'rooms',code),{
            ...update,gameScore:newGS,roundResult:result,matchWinner:mw,phase:'roundEnd'});
        } else {
          await updateDoc(doc(db,'rooms',code),update);
        }
      } else {
        await updateDoc(doc(db,'rooms',code),{trickPlays:newPlays,[`h${activePIdx}`]:newHand});
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
        if(t<=3) sounds.tick();
        if(t<=1) {
          clearInterval(timerRef.current);
          const gd2=gameDataRef.current;
          const hands=getHands(gd2);
          const hand=hands[mi];
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

  // ── Render ────────────────────────────────────────────
  const gd=gameData;

  // HOME SCREEN
  if(screen==='home') return(
    <div style={{
      minHeight:'100vh',
      background:`radial-gradient(ellipse at 50% -10%, ${T.greenL}66, ${T.felt} 50%, ${T.night})`,
      display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',padding:24,
      fontFamily:'Segoe UI,Tahoma,Arial,sans-serif',
      position:'relative',overflow:'hidden',
    }}>
      {/* Background pattern */}
      <div style={{
        position:'absolute',inset:0,
        backgroundImage:`repeating-linear-gradient(45deg, ${T.gold}08 0px, ${T.gold}08 1px, transparent 1px, transparent 20px)`,
        pointerEvents:'none',
      }}/>

      {/* Logo */}
      <div style={{textAlign:'center',marginBottom:32,position:'relative',zIndex:1}}>
        <div style={{
          fontSize:72,marginBottom:8,
          filter:'drop-shadow(0 8px 16px #00000088)',
          animation:'float 3s ease-in-out infinite',
        }}>🃏</div>
        <h1 style={{
          color:T.gold,
          fontSize:'clamp(2rem,8vw,3rem)',
          fontWeight:900,margin:'0 0 6px',
          textShadow:`0 0 40px ${T.gold}44, 0 4px 8px #00000088`,
          letterSpacing:3,
        }}>بلوت المملكة</h1>
        <div style={{
          color:T.smoke,fontSize:14,
          letterSpacing:1,
        }}>اللعبة الأصيلة — العب مع أصدقائك</div>
        <div style={{
          width:80,height:2,margin:'12px auto 0',
          background:`linear-gradient(to right,transparent,${T.gold},transparent)`,
        }}/>
      </div>

      {/* Form */}
      <div style={{
        width:'100%',maxWidth:320,
        display:'flex',flexDirection:'column',gap:14,
        position:'relative',zIndex:1,
      }}>
        {/* Avatar + Name */}
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <button
            onClick={()=>setShowAvatarPicker(p=>!p)}
            style={{
              width:52,height:52,borderRadius:'50%',
              background:`linear-gradient(135deg,${T.green},${T.greenL})`,
              border:`2px solid ${T.gold}`,fontSize:24,
              cursor:'pointer',flexShrink:0,
              boxShadow:`0 4px 12px ${T.green}88`,
            }}>{playerAvatar}</button>
          <input
            value={playerName}
            onChange={e=>setPlayerName(e.target.value)}
            placeholder="اسمك..."
            style={{
              flex:1,background:'#0a2a0a',
              border:`1.5px solid ${T.greenL}`,
              borderRadius:12,padding:'13px 16px',
              color:'#fff',fontSize:15,textAlign:'right',
              outline:'none',fontFamily:'inherit',
              boxShadow:`inset 0 2px 8px #00000033`,
            }}
          />
        </div>

        {/* Avatar picker */}
        {showAvatarPicker&&(
          <div style={{
            background:'#071f10',border:`1px solid ${T.border}`,
            borderRadius:14,padding:12,
            display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',
          }}>
            {AVATARS.map(a=>(
              <button key={a} onClick={()=>{setPlayerAvatar(a);setShowAvatarPicker(false);}}
                style={{
                  width:44,height:44,borderRadius:'50%',
                  background:playerAvatar===a?`${T.gold}33`:'transparent',
                  border:`2px solid ${playerAvatar===a?T.gold:'#333'}`,
                  fontSize:22,cursor:'pointer',
                }}>{a}</button>
            ))}
          </div>
        )}

        {error&&(
          <div style={{
            color:T.redL,fontSize:13,textAlign:'center',
            padding:'10px',background:'#3a0a0a',
            borderRadius:10,border:`1px solid ${T.red}44`,
          }}>{error}</div>
        )}

        <button onClick={createRoom} style={{
          background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
          color:T.night,border:'none',borderRadius:14,
          padding:'16px',fontWeight:900,cursor:'pointer',fontSize:17,
          boxShadow:`0 6px 24px ${T.gold}66`,
          letterSpacing:1,
          transition:'transform 0.15s',
        }}>🏠 إنشاء غرفة جديدة</button>

        <div style={{
          display:'flex',alignItems:'center',gap:10,
          color:'#333',fontSize:12,
        }}>
          <div style={{flex:1,height:1,background:'#1a2a1a'}}/>
          <span>أو انضم لغرفة</span>
          <div style={{flex:1,height:1,background:'#1a2a1a'}}/>
        </div>

        <input
          value={joinCode}
          onChange={e=>setJoinCode(e.target.value)}
          placeholder="كود الغرفة..."
          maxLength={6}
          style={{
            background:'#0a1a2a',
            border:`1.5px solid ${T.blueL}`,
            borderRadius:12,padding:'13px 16px',
            color:'#fff',fontSize:20,textAlign:'center',
            letterSpacing:8,outline:'none',fontFamily:'inherit',
            boxShadow:`inset 0 2px 8px #00000033`,
          }}
        />
        <button onClick={joinRoom} style={{
          background:`linear-gradient(135deg,${T.blue},${T.blueL})`,
          color:'#fff',border:'none',borderRadius:14,
          padding:'16px',fontWeight:800,cursor:'pointer',fontSize:17,
          boxShadow:`0 6px 24px ${T.blue}88`,
          letterSpacing:1,
        }}>🚪 انضم لغرفة</button>
      </div>

      <style>{`
        @keyframes float {
          0%,100%{transform:translateY(0)}
          50%{transform:translateY(-8px)}
        }
        @keyframes pulse {
          0%,100%{transform:scale(1)}
          50%{transform:scale(1.2)}
        }
        @keyframes bounce {
          0%{transform:scale(0.5)}
          70%{transform:scale(1.1)}
          100%{transform:scale(1)}
        }
        @keyframes pulse-border {
          0%,100%{opacity:1}
          50%{opacity:0.3}
        }
        @keyframes float-up {
          0%{transform:translateY(0);opacity:1}
          100%{transform:translateY(-100px);opacity:0}
        }
      `}</style>
    </div>
  );

  // LOBBY
  if(screen==='lobby') return(
    <>
      <LobbyScreen
        roomCode={roomCode}
        players={gd?.players||[playerName,null,null,null]}
        isHost={isHost}
        onStart={startGame}
        myIndex={myIndex}
        shareLink={shareLink}
      />
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </>
  );

  // GAME SCREEN
  if(screen==='game'&&gd) {
    const contract=gd.contract;
    const hands=getHands(gd);
    const myHand=hands[myIndex]||[];
    const activePIdx=gd.phase==='playing'&&!gd.trickResult
      ?(gd.leader+gd.trickPlays.length)%4:-1;
    const isMyTurn=activePIdx===myIndex;
    const isBiddingTurn=gd.phase==='bidding'&&gd.biddingTurn===myIndex;
    const avatars=gd.avatars||AVATARS.map((_,i)=>AVATARS[i%8]);

    return(
      <div style={{
        minHeight:'100vh',
        background:`radial-gradient(ellipse at 50% 0%,${T.feltL}88,${T.felt} 40%,${T.night})`,
        fontFamily:'Segoe UI,Tahoma,Arial,sans-serif',
        color:T.cream,padding:'10px',userSelect:'none',
        position:'relative',overflow:'hidden',
      }}>

        {/* Floating reactions */}
        {reactions.map(r=>(
          <div key={r.id} style={{
            position:'fixed',bottom:200,left:`${r.x}%`,
            fontSize:32,zIndex:500,pointerEvents:'none',
            animation:'float-up 2s ease forwards',
          }}>{r.emoji}</div>
        ))}

        {/* Header */}
        <div style={{
          display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:8,
          background:'#00000033',borderRadius:14,padding:'8px 12px',
          backdropFilter:'blur(4px)',
        }}>
          <div>
            <div style={{
              color:T.gold,fontSize:16,fontWeight:900,
              textShadow:`0 0 12px ${T.gold}44`,
            }}>🃏 بلوت المملكة</div>
            {contract&&(
              <div style={{fontSize:10,color:T.smoke,marginTop:1}}>
                {contract.type==='hokum'
                  ?`${contract.trumpName} ${contract.trump} 👑`
                  :'☀️ صن'}
                {' · '}{roomCode}
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {[0,1].map(t=>(
              <div key={t} style={{
                background:'#00000044',
                border:`1.5px solid ${TEAM_COLORS[t]}44`,
                borderRadius:12,padding:'4px 12px',textAlign:'center',
                backdropFilter:'blur(4px)',
              }}>
                <div style={{color:TEAM_COLORS[t],fontSize:9,fontWeight:700}}>
                  {t===0?'A':'B'}
                </div>
                <div style={{
                  color:T.gold,fontSize:18,fontWeight:900,lineHeight:1,
                  textShadow:`0 0 8px ${T.gold}66`,
                }}>{gd.gameScore?.[t]||0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bidding phase */}
        {gd.phase==='bidding'&&(
          <>
            <div style={{
              background:'#00000033',borderRadius:14,
              padding:12,marginBottom:8,
              border:`1px solid ${T.border}`,
              backdropFilter:'blur(4px)',
            }}>
              <div style={{color:T.gold,fontWeight:700,fontSize:11,marginBottom:8}}>
                🃏 يدك
              </div>
              <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center'}}>
                {myHand.map(card=>(
                  <Card key={card.id} card={card} mode='hokum' trump='' disabled/>
                ))}
              </div>
            </div>
            {isBiddingTurn?(
              <BiddingModal
                playerIndex={myIndex}
                playerName={gd.players?.[myIndex]||'أنت'}
                avatar={avatars[myIndex]}
                onBid={handleBid}
                canSun={gd.bids?.length>=1}
                passCount={gd.bids?.filter(b=>b.type==='pass').length||0}
              />
            ):(
              <div style={{
                position:'fixed',inset:0,
                background:'linear-gradient(135deg,#000c,#001a0acc)',
                display:'flex',alignItems:'center',justifyContent:'center',
                zIndex:100,backdropFilter:'blur(4px)',
              }}>
                <div style={{
                  background:`linear-gradient(135deg,#0D2A1A,#071f10)`,
                  border:`2px solid ${T.greenL}`,
                  borderRadius:20,padding:28,textAlign:'center',
                  boxShadow:`0 0 40px ${T.greenL}22`,
                }}>
                  <div style={{fontSize:40}}>{avatars[gd.biddingTurn]||AVATARS[gd.biddingTurn%8]}</div>
                  <div style={{color:T.greenL,fontSize:17,fontWeight:700,marginTop:10}}>
                    {gd.players?.[gd.biddingTurn]||`اللاعب ${gd.biddingTurn+1}`}
                  </div>
                  <div style={{color:T.smoke,fontSize:13,marginTop:4}}>يفكر في المزايدة...</div>
                  <div style={{
                    display:'flex',gap:4,justifyContent:'center',marginTop:12,
                  }}>
                    {[0,1,2].map(i=>(
                      <div key={i} style={{
                        width:8,height:8,borderRadius:'50%',
                        background:T.greenL,
                        animation:`pulse ${0.6+i*0.2}s infinite`,
                      }}/>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Playing phase */}
        {(gd.phase==='playing'||gd.phase==='roundEnd')&&contract&&(
          <div>
            {/* Contract + scores */}
            <div style={{
              display:'flex',gap:8,marginBottom:8,alignItems:'stretch',
            }}>
              <div style={{
                flex:1,
                background:contract.type==='sun'?'#3a2a0088':'#0a2a0a88',
                border:`1.5px solid ${contract.type==='sun'?T.gold:T.greenL}44`,
                borderRadius:12,padding:'6px 12px',
                backdropFilter:'blur(4px)',
              }}>
                <div style={{
                  color:contract.type==='sun'?T.gold:T.greenL,
                  fontWeight:800,fontSize:12,
                }}>
                  {contract.type==='hokum'
                    ?`🎯 حكم — ${contract.trumpName} ${contract.trump} 👑`
                    :'☀️ صن (2×)'}
                </div>
                <div style={{color:T.smoke,fontSize:10}}>
                  {gd.players?.[contract.bidder]||`P${contract.bidder+1}`}
                  {' · '}Team {contract.bidTeam===0?'A':'B'}
                </div>
              </div>
              {[0,1].map(t=>(
                <div key={t} style={{
                  background:'#00000044',
                  border:`1px solid ${TEAM_COLORS[t]}33`,
                  borderRadius:12,padding:'6px 10px',
                  textAlign:'center',minWidth:60,
                  backdropFilter:'blur(4px)',
                }}>
                  <div style={{color:TEAM_COLORS[t],fontSize:9,fontWeight:700}}>
                    {t===0?'A':'B'}
                    {contract.bidTeam===t&&<span style={{color:T.gold}}> ✦</span>}
                  </div>
                  <div style={{
                    color:T.gold,fontSize:20,fontWeight:900,lineHeight:1,
                    textShadow:`0 0 8px ${T.gold}66`,
                  }}>{gd.roundScores?.[t]||0}</div>
                </div>
              ))}
            </div>

            {/* THE TABLE */}
            <div style={{
              background:`radial-gradient(ellipse at 50% 50%,${T.feltL},${T.felt} 60%,${T.greenD})`,
              border:`3px solid ${T.gold}44`,
              borderRadius:24,padding:14,marginBottom:8,
              boxShadow:`inset 0 0 60px #00000044, 0 8px 32px #00000088`,
              position:'relative',minHeight:280,
            }}>
              {/* Decorative corner */}
              {[0,1,2,3].map(i=>(
                <div key={i} style={{
                  position:'absolute',
                  top:i<2?8:'auto',bottom:i>=2?8:'auto',
                  left:i%2===0?8:'auto',right:i%2===1?8:'auto',
                  width:16,height:16,
                  border:`2px solid ${T.gold}33`,
                  borderRadius:3,
                }}/>
              ))}

              {/* Top player */}
              {(()=>{
                const pIdx=(myIndex+2)%4;
                const isActive=activePIdx===pIdx;
                return(
                  <div style={{display:'flex',justifyContent:'center',marginBottom:10}}>
                    <div style={{textAlign:'center'}}>
                      <PlayerBadge
                        name={gd.players?.[pIdx]||`P${pIdx+1}`}
                        avatar={avatars[pIdx]||AVATARS[pIdx%8]}
                        teamColor={TEAM_COLORS[pIdx%2]}
                        isActive={isActive}
                        cardCount={hands[pIdx]?.length}
                      />
                      <div style={{display:'flex',flexWrap:'wrap',
                        justifyContent:'center',marginTop:6,maxWidth:220}}>
                        {(hands[pIdx]||[]).map((_,j)=>(
                          <Card key={j} faceDown small
                            card={{suit:{symbol:'',color:'',isRed:false},rank:{symbol:'',nameAr:''}}}
                            mode='' trump=''/>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Middle row */}
              <div style={{display:'flex',alignItems:'center',
                justifyContent:'space-between',marginBottom:10}}>

                {/* Left */}
                {(()=>{
                  const pIdx=(myIndex+1)%4;
                  const isActive=activePIdx===pIdx;
                  return(
                    <div style={{textAlign:'center'}}>
                      <PlayerBadge
                        name={gd.players?.[pIdx]||`P${pIdx+1}`}
                        avatar={avatars[pIdx]||AVATARS[pIdx%8]}
                        teamColor={TEAM_COLORS[pIdx%2]}
                        isActive={isActive}
                        cardCount={hands[pIdx]?.length}
                      />
                      <div style={{display:'flex',flexDirection:'column',
                        alignItems:'center',marginTop:6}}>
                        {(hands[pIdx]||[]).map((_,j)=>(
                          <Card key={j} faceDown small
                            card={{suit:{symbol:'',color:'',isRed:false},rank:{symbol:'',nameAr:''}}}
                            mode='' trump=''/>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* CENTER TRICK AREA */}
                <div style={{
                  flex:1,display:'flex',flexDirection:'column',
                  alignItems:'center',gap:6,
                }}>
                  <div style={{
                    display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,
                    padding:10,
                    background:'#00000033',
                    borderRadius:16,
                    border:`1px solid ${T.gold}22`,
                    backdropFilter:'blur(4px)',
                    minWidth:130,minHeight:110,
                    boxShadow:`inset 0 0 20px #00000033`,
                  }}>
                    {[2,1,3,0].map(relIdx=>{
                      const pIdx=(myIndex+relIdx)%4;
                      const play=gd.trickPlays?.find(p=>p.playerIndex===pIdx);
                      return(
                        <div key={pIdx} style={{
                          display:'flex',flexDirection:'column',
                          alignItems:'center',justifyContent:'center',
                          minHeight:56,
                        }}>
                          {play?(
                            <>
                              <div style={{color:T.smoke,fontSize:8,marginBottom:2}}>
                                {gd.players?.[pIdx]||`P${pIdx+1}`}
                              </div>
                              <Card card={play.card}
                                mode={contract.type} trump={contract.trump}
                                winner={gd.trickResult?.winner.playerIndex===pIdx}
                                disabled small/>
                            </>
                          ):(
                            <div style={{
                              width:38,height:54,borderRadius:8,
                              border:`1px dashed ${T.gold}22`,
                              display:'flex',alignItems:'center',
                              justifyContent:'center',
                              color:`${T.gold}22`,fontSize:18,
                            }}>•</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {gd.trickResult&&(
                    <div style={{textAlign:'center'}}>
                      <div style={{
                        color:T.gold,fontSize:12,fontWeight:700,
                        textShadow:`0 0 8px ${T.gold}66`,
                      }}>
                        🏆 {gd.players?.[gd.trickResult.winner.playerIndex]||
                          `P${gd.trickResult.winner.playerIndex+1}`}
                        {' '}+{gd.trickResult.pts}
                      </div>
                      {gd.phase==='playing'&&(
                        <button onClick={nextTrick} style={{
                          marginTop:4,
                          background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
                          color:T.night,border:'none',borderRadius:10,
                          padding:'6px 16px',fontWeight:800,
                          cursor:'pointer',fontSize:12,
                          boxShadow:`0 2px 8px ${T.gold}66`,
                        }}>التالي ▶</button>
                      )}
                    </div>
                  )}

                  {!gd.trickResult&&activePIdx>=0&&(
                    <div style={{
                      color:isMyTurn?T.greenL:T.smoke,
                      fontSize:11,textAlign:'center',fontWeight:700,
                    }}>
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
                      <PlayerBadge
                        name={gd.players?.[pIdx]||`P${pIdx+1}`}
                        avatar={avatars[pIdx]||AVATARS[pIdx%8]}
                        teamColor={TEAM_COLORS[pIdx%2]}
                        isActive={isActive}
                        cardCount={hands[pIdx]?.length}
                      />
                      <div style={{display:'flex',flexDirection:'column',
                        alignItems:'center',marginTop:6}}>
                        {(hands[pIdx]||[]).map((_,j)=>(
                          <Card key={j} faceDown small
                            card={{suit:{symbol:'',color:'',isRed:false},rank:{symbol:'',nameAr:''}}}
                            mode='' trump=''/>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* MY HAND */}
              <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                <PlayerBadge
                  name={gd.players?.[myIndex]||'أنت'}
                  avatar={avatars[myIndex]||playerAvatar}
                  teamColor={TEAM_COLORS[myIndex%2]}
                  isActive={isMyTurn}
                  isMe={true}
                  timer={timer}
                />
                {isMyTurn&&(
                  <div style={{
                    height:4,width:200,
                    background:'#1a2a1a',
                    borderRadius:2,margin:'6px auto',overflow:'hidden',
                  }}>
                    <div style={{
                      height:'100%',borderRadius:2,
                      width:`${(timer/10)*100}%`,
                      background:`linear-gradient(to right,${timer<=3?T.redL:timer<=6?'#F39C12':T.greenL},${timer<=3?T.red:timer<=6?'#E67E22':T.green})`,
                      transition:'width 0.9s linear',
                      boxShadow:`0 0 6px currentColor`,
                    }}/>
                  </div>
                )}
                <div style={{
                  display:'flex',flexWrap:'wrap',
                  justifyContent:'center',marginTop:6,
                }}>
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

            {/* Emoji reactions */}
            <div style={{
              display:'flex',gap:8,justifyContent:'center',
              flexWrap:'wrap',marginBottom:4,
            }}>
              {['👏','🔥','😤','🤣','☕','🃏','👑','💪'].map(e=>(
                <button key={e} onClick={()=>addReaction(e)} style={{
                  background:'#00000033',border:`1px solid ${T.border}`,
                  borderRadius:20,padding:'6px 10px',cursor:'pointer',
                  fontSize:18,transition:'transform 0.15s',
                  backdropFilter:'blur(4px)',
                }}>{e}</button>
              ))}
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

        <style>{`
          @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
          @keyframes bounce{0%{transform:scale(0.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}
          @keyframes pulse-border{0%,100%{opacity:1}50%{opacity:0.3}}
          @keyframes float-up{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-100px);opacity:0}}
        `}</style>
      </div>
    );
  }

  // Loading
  return(
    <div style={{
      minHeight:'100vh',background:T.felt,
      display:'flex',alignItems:'center',justifyContent:'center',
      fontFamily:'Segoe UI,sans-serif',
    }}>
      <div style={{textAlign:'center'}}>
        <div style={{
          fontSize:56,marginBottom:12,
          animation:'float 2s ease-in-out infinite',
        }}>🃏</div>
        <div style={{color:T.gold,fontSize:18,fontWeight:700,
          textShadow:`0 0 20px ${T.gold}44`}}>
          جاري التحميل...
        </div>
      </div>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </div>
  );
}
