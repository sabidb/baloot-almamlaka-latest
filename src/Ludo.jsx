import { useReducer, useEffect, useRef, useState } from 'react';
import {
  LUDO_COLORS, RING, HOME_PATHS, YARD, CENTER, FINISH,
  applyMove, botPickToken, tokenCell, rollDie,
} from './LudoLogic';
import { sounds, setMuted, REACTIONS } from './GameLogic';
import { applyGameResult } from './progress';
import {
  CELL, pos, START_INDEX, STAR, START_ARROW, HOME_ARROW, GRID, BASES, cellCenter,
  hexOf, shade, tokenBg, coinPos, spawnBurst, setupState, reducer,
} from './ludoShared';

const PHRASES = ['أحسنت! 👍','لعبة موفقة 🎉','بالتوفيق 🍀','يالله بسرعة ⏱️','ما شاء الله','لا بأس 😅'];
const TURN_SECONDS = 15;

// Coin-style token: colour ring, light centre, crown emblem.
export function Coin({ color, canMove, style, onClick }){
  return (
    <div onClick={onClick} style={{...style, borderRadius:'50%', background:color,
      boxShadow:canMove?'0 0 0 3px rgba(255,255,255,.9),0 4px 9px rgba(0,0,0,.5)':'0 4px 9px rgba(0,0,0,.5)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:'12%',
      cursor:canMove?'pointer':'default'}}>
      <div style={{width:'100%',height:'100%',borderRadius:'50%',background:`radial-gradient(circle at 50% 36%, #ffffff, ${shade(color,58)})`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'inset 0 -1px 2px rgba(0,0,0,.2)'}}>
        <span style={{color,fontSize:'min(1.9vh,3.6vw)',lineHeight:1,fontWeight:900,textShadow:'0 1px 0 rgba(255,255,255,.5)'}}>♛</span>
      </div>
    </div>
  );
}

export function BoardStatic({ activeColors }){
  return (
    <>
      {/* Corner bases — clean solid fill + soft inner tray */}
      {BASES.map(b=>{
        const on=activeColors.has(b.color); const col=hexOf(b.color);
        return (
          <div key={b.color} style={{...pos(b.r0,b.c0),width:`${6*CELL}%`,height:`${6*CELL}%`,
            background:col,border:GRID,boxSizing:'border-box',borderRadius:'8%',opacity:on?1:0.38}}>
            <div style={{position:'absolute',inset:'15%',borderRadius:'11%',background:'rgba(255,255,255,.9)',boxShadow:'inset 0 1px 3px rgba(0,0,0,.2)'}}/>
          </div>
        );
      })}
      {/* Yard sockets (aligned to token positions) */}
      {BASES.map(b=>{
        const on=activeColors.has(b.color); const col=hexOf(b.color);
        return YARD[b.color].map(([r,c],i)=>(
          <div key={`sock${b.color}${i}`} style={{position:'absolute',...cellCenter(r,c),transform:'translate(-50%,-50%)',width:'6.6%',aspectRatio:'1',borderRadius:'50%',background:col,opacity:on?1:0.38,boxShadow:'inset 0 2px 4px rgba(0,0,0,.45), 0 1px 0 rgba(255,255,255,.4)'}}/>
        ));
      })}

      {/* Ring cells — white grid, colored starts w/ arrow, star safes */}
      {RING.map(([r,c],i)=>{
        const startColor=START_INDEX[i];
        const safe=STAR.has(i);
        return (
          <div key={`ring${i}`} style={{...pos(r,c),border:GRID,background:startColor?hexOf(startColor):'#fefefe',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box'}}>
            {startColor&&<span style={{color:'rgba(255,255,255,.95)',fontSize:'1.6vh',lineHeight:1,textShadow:'0 1px 1px rgba(0,0,0,.3)'}}>{START_ARROW[startColor]}</span>}
            {!startColor&&safe&&<span style={{color:'#9aa0a6',fontSize:'1.8vh',lineHeight:1}}>★</span>}
          </div>
        );
      })}

      {/* Home columns — solid colour with subtle chevrons */}
      {Object.entries(HOME_PATHS).map(([id,cells])=>cells.map(([r,c],i)=>(
        <div key={`home${id}${i}`} style={{...pos(r,c),background:hexOf(id),border:GRID,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,.65)',fontSize:'1.25vh'}}>
          {i<5&&HOME_ARROW[id]}
        </div>
      )))}

      {/* Centre — four clean triangles toward each home */}
      <div style={{...pos(6,6),width:`${3*CELL}%`,height:`${3*CELL}%`,border:GRID,boxSizing:'border-box',background:
        `conic-gradient(from 45deg, ${hexOf('blue')} 0 90deg, ${hexOf('red')} 90deg 180deg, ${hexOf('green')} 180deg 270deg, ${hexOf('yellow')} 270deg 360deg)`,
        boxShadow:'inset 0 0 0 1px rgba(255,255,255,.15)'}}/>
    </>
  );
}

export function Pips({n,color='#0C1410'}){
  const map={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  const on=new Set(map[n]||[]);
  return (
    <div style={{width:'100%',height:'100%',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'1fr 1fr 1fr',gap:'6%',padding:'16%'}}>
      {Array.from({length:9}).map((_,i)=><div key={i} style={{display:'flex',alignItems:'center',justifyContent:'center'}}>{on.has(i)&&<div style={{width:'82%',aspectRatio:'1',borderRadius:'50%',background:`radial-gradient(circle at 38% 32%, ${shade(color,35)}, ${color} 75%)`,boxShadow:'0 1px 1px rgba(0,0,0,.35), inset 0 -1px 1px rgba(0,0,0,.25)'}}/>}</div>)}
    </div>
  );
}

export default function LudoScreen({ profile, onUpdate, persist, onExit, onOnline }){
  const [state,dispatch]=useReducer(reducer,undefined,setupState);
  const [toast,setToast]=useState(null);
  const [rolling,setRolling]=useState(false);
  const [fakeFace,setFakeFace]=useState(1);
  const [moving,setMoving]=useState(null);
  const [muted,setMutedState]=useState(!!(profile&&profile.muted));
  const [bubbles,setBubbles]=useState([]);
  const [tray,setTray]=useState(null); // 'emoji' | 'chat' | null
  const tn=useRef(0), rollingRef=useRef(false), movingRef=useRef(false), boardRef=useRef(null), awarded=useRef(false), bn=useRef(0);
  const popBubble=(seat,txt)=>{bn.current++;const k=bn.current;setBubbles(b=>[...b,{seat,txt,k}]);setTimeout(()=>setBubbles(b=>b.filter(x=>x.k!==k)),2400);};
  const showT=m=>{tn.current++;const k=tn.current;setToast({m,k});setTimeout(()=>setToast(t=>t&&t.k===k?null:t),1500);};

  useEffect(()=>{ setMuted(!!(profile&&profile.muted)); },[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{ if(state.msg) showT(state.msg); },[state.evt]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute=()=>{ const m=!muted; setMutedState(m); setMuted(m); if(onUpdate) onUpdate(p=>({...p,muted:m})); if(persist) persist({muted:m}); };

  const burstAtCell=(cell,color)=>{
    const el=boardRef.current; if(!el||!cell) return;
    const rect=el.getBoundingClientRect();
    spawnBurst(rect.left+(cell[1]+0.5)*CELL/100*rect.width, rect.top+(cell[0]+0.5)*CELL/100*rect.height, color);
  };
  const launchConfetti=()=>{
    const el=boardRef.current; if(!el) return;
    const rect=el.getBoundingClientRect(); let n=0;
    const iv=setInterval(()=>{ spawnBurst(rect.left+Math.random()*rect.width, rect.top+Math.random()*rect.height*0.5, ['#F0C040','#E74C3C','#27AE60','#3498DB'][n%4]); if(++n>13) clearInterval(iv); },100);
  };

  const performRoll=()=>{
    if(movingRef.current||rollingRef.current||state.phase!=='roll') return;
    rollingRef.current=true; setRolling(true); if(!muted) sounds.dice();
    const dice=rollDie();
    let n=0; const iv=setInterval(()=>{ setFakeFace(1+Math.floor(Math.random()*6)); if(++n>=6) clearInterval(iv); },70);
    setTimeout(()=>{ clearInterval(iv); rollingRef.current=false; setRolling(false); dispatch({type:'ROLL',dice}); }, 560);
  };

  const performMove=(ti)=>{
    if(movingRef.current || state.phase!=='move' || !state.moves.includes(ti)) return;
    const p=state.turn, dice=state.dice, fromRel=state.tokens[p][ti];
    if(!dice){ dispatch({type:'MOVE',tokenIdx:ti}); return; }
    const fromCell=tokenCell(p,fromRel,ti);
    const path=[];
    if(fromRel<0) path.push(tokenCell(p,0,ti));
    else for(let r=fromRel+1;r<=fromRel+dice;r++) path.push(tokenCell(p,r,ti));
    if(path.length===0){ dispatch({type:'MOVE',tokenIdx:ti}); return; }
    const res=applyMove(state.tokens,p,ti,dice);
    movingRef.current=true; setMoving({p,t:ti,cell:fromCell});
    let i=0; const stepMs=145;
    const step=()=>{
      setMoving(m=>m?{...m,cell:path[i]}:m);
      if(!muted) sounds.hop();
      i++;
      if(i<path.length){ setTimeout(step,stepMs); }
      else setTimeout(()=>{
        if(res.captured){ if(!muted) sounds.capture(); burstAtCell(path[path.length-1],'#ffffff'); }
        if(res.finished){ if(!muted) sounds.home(); burstAtCell(CENTER,hexOf(LUDO_COLORS[p].id)); }
        movingRef.current=false; setMoving(null);
        dispatch({type:'MOVE',tokenIdx:ti});
      }, stepMs);
    };
    setTimeout(step,70);
  };

  // Bots.
  useEffect(()=>{
    if(state.phase==='over'||state.phase==='setup' || state.turn===0 || movingRef.current || rollingRef.current) return;
    if(state.phase==='roll'){ const id=setTimeout(performRoll,520); return ()=>clearTimeout(id); }
    if(state.phase==='move'){ const id=setTimeout(()=>performMove(botPickToken(state.tokens,state.turn,state.dice,state.moves)),560); return ()=>clearTimeout(id); }
  },[state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-play the only option (human QoL).
  useEffect(()=>{
    if(state.phase==='move' && state.turn===0 && state.moves.length===1 && !movingRef.current){
      const id=setTimeout(()=>performMove(state.moves[0]),360); return ()=>clearTimeout(id);
    }
  },[state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Turn timer — auto-act if the human stalls past the countdown.
  useEffect(()=>{
    if(state.turn!==0 || state.phase==='over' || state.phase==='setup' || movingRef.current) return;
    const id=setTimeout(()=>{
      if(state.phase==='roll') performRoll();
      else if(state.phase==='move' && state.moves.length) performMove(state.moves[state.moves.length-1]);
    }, TURN_SECONDS*1000);
    return ()=>clearTimeout(id);
  },[state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Award coins + XP/level/streak/missions + celebrate once.
  useEffect(()=>{
    if(state.phase!=='over' || awarded.current) return;
    awarded.current=true;
    if(!muted) sounds.win();
    const place=state.ranks.indexOf(0);
    if(place===0) launchConfetti();
    const { patch, toasts }=applyGameResult(profile,{game:'ludo',won:place===0});
    if(onUpdate) onUpdate(p=>({ ...p, ...patch }));
    if(persist) persist(patch);
    toasts.forEach((t,i)=>setTimeout(()=>{
      if(t.type==='levelup') showT(`🎉 المستوى ${t.value}!`);
      else if(t.type==='streak'&&t.value>1) showT(`🔥 سلسلة ${t.value} أيام!`);
      else if(t.type==='mission') showT('✅ أنجزت مهمة!');
    }, 1100+i*750));
  },[state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const humanRoll=()=>performRoll();
  const humanMove=ti=>{ if(state.turn===0) performMove(ti); };

  // Token render + stacking.
  const placed=[];
  for(const p of state.active) for(let t=0;t<4;t++){
    if(moving && moving.p===p && moving.t===t) continue;
    const rel=state.tokens[p][t];
    const [r,c]=tokenCell(p,rel,t);
    placed.push({p,t,rel,r,c});
  }
  const occ={};
  placed.forEach(k=>{ const key=`${k.r.toFixed(1)},${k.c.toFixed(1)}`; (occ[key]=occ[key]||[]).push(k); });
  const OFFS=[[0,0],[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]];
  const finishedCount=p=>state.tokens[p].filter(r=>r===FINISH).length;
  const humanMovable = state.phase==='move'&&state.turn===0&&!moving ? new Set(state.moves) : null;

  // Destination previews for the human.
  const previews=[];
  if(humanMovable){
    for(const ti of state.moves){
      const rel=state.tokens[0][ti];
      const to = rel<0 ? 0 : Math.min(rel+state.dice,FINISH);
      const cell=tokenCell(0,to,ti);
      if(cell) previews.push({cell,key:ti});
    }
  }

  const activeColors = new Set(state.active.map(p=>LUDO_COLORS[p].id));
  const curColor = state.phase!=='setup' ? hexOf(LUDO_COLORS[state.turn].id) : '#F0C040';

  return (
    <div style={{width:'100%',height:'100%',background:'radial-gradient(ellipse 120% 90% at 50% 30%,#14261B,#07090A)',position:'relative',overflow:'hidden',fontFamily:'Tajawal,sans-serif',direction:'rtl',display:'flex',flexDirection:'column'}}>
      {toast&&<div key={toast.k} style={{position:'absolute',top:'calc(env(safe-area-inset-top,0px)+52px)',left:'50%',transform:'translateX(-50%)',background:'rgba(8,12,10,.95)',border:'1px solid #7A5B1A',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:700,color:'#F0C040',whiteSpace:'nowrap',zIndex:300,animation:'fadeUp .3s ease both'}}>{toast.m}</div>}

      {/* Header */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'calc(env(safe-area-inset-top,0px)+10px) 14px 8px'}}>
        <button onClick={onExit} style={{padding:'6px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.75)',fontFamily:'Tajawal,sans-serif',fontWeight:700,fontSize:12}}>خروج</button>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:24,background:'linear-gradient(135deg,#7A5B1A,#F0C040,#FFE08A,#F0C040,#7A5B1A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>لودو المملكة</div>
        <button onClick={toggleMute} aria-label="mute" style={{padding:'6px 10px',borderRadius:9,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.75)',fontSize:14}}>{muted?'🔇':'🔊'}</button>
      </div>

      {/* Player chips */}
      {state.phase!=='setup'&&(
        <div style={{flexShrink:0,display:'flex',gap:6,padding:'0 12px 8px',justifyContent:'center',flexWrap:'wrap'}}>
          {state.active.map(p=>{
            const c=LUDO_COLORS[p]; const activeTurn=state.turn===p&&state.phase!=='over';
            return (
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:6,background:activeTurn?'rgba(240,192,64,.14)':'rgba(13,20,16,.7)',border:`1px solid ${activeTurn?'#F0C040':'rgba(255,255,255,.07)'}`,borderRadius:20,padding:'5px 10px',boxShadow:activeTurn?`0 0 12px ${c.hex}55`:'none',transition:'all .2s'}}>
                <div style={{width:15,height:15,borderRadius:'50%',background:tokenBg(c.hex),boxShadow:activeTurn?`0 0 8px ${c.hex}`:'none'}}/>
                <span style={{fontSize:11,fontWeight:700,color:'#F0EDE5'}}>{p===0?(profile?.name||'أنت'):c.name}</span>
                <span style={{fontSize:11,fontWeight:900,color:'#F0C040'}}>{finishedCount(p)}/4</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Board */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'4px 10px',minHeight:0}}>
        <div ref={boardRef} style={{position:'relative',width:'min(94vw, 60vh)',aspectRatio:'1',
          background:'linear-gradient(150deg,#141a24,#0b0e14)',borderRadius:20,
          padding:'2.6%',boxShadow:'0 22px 55px rgba(0,0,0,.6), 0 0 0 1.5px rgba(240,192,64,.45), inset 0 1px 1px rgba(255,255,255,.08)'}}>
          <div style={{position:'relative',width:'100%',height:'100%',borderRadius:8,overflow:'hidden',direction:'ltr',background:'#fefefe',boxShadow:'0 0 0 1px rgba(30,30,40,.35)',boxSizing:'border-box'}}>
            <BoardStatic activeColors={activeColors}/>

            {/* Destination previews */}
            {previews.map(pv=>(
              <div key={`pv${pv.key}`} style={{position:'absolute',top:`${(pv.cell[0]+0.5)*CELL}%`,left:`${(pv.cell[1]+0.5)*CELL}%`,transform:'translate(-50%,-50%)',width:'5%',aspectRatio:'1',borderRadius:'50%',border:'2px dashed rgba(20,20,20,.75)',boxShadow:'0 0 8px rgba(255,255,255,.6)',zIndex:90,pointerEvents:'none',animation:'pulse 1.1s ease-in-out infinite'}}/>
            ))}

            {/* Tokens */}
            {placed.map(k=>{
              const key=`${k.r.toFixed(1)},${k.c.toFixed(1)}`;
              const group=occ[key]; const idx=group.indexOf(k); const [or,oc]=OFFS[Math.min(idx,4)];
              const canMove = k.p===0 && humanMovable && humanMovable.has(k.t);
              return <Coin key={`${k.p}-${k.t}`} color={hexOf(LUDO_COLORS[k.p].id)} canMove={canMove} onClick={()=>k.p===0&&humanMove(k.t)} style={coinPos(k.r,k.c,or,oc,100+idx,canMove)}/>;
            })}

            {/* Hopping token */}
            {moving&&moving.cell&&(
              <Coin color={hexOf(LUDO_COLORS[moving.p].id)} canMove={false}
                style={{...coinPos(moving.cell[0],moving.cell[1],0,0,200,false),animation:'none',transition:'top .14s linear,left .14s linear'}}/>
            )}
          </div>
        </div>
      </div>

      {/* Reaction bubbles */}
      {bubbles.map(bub=>(
        <div key={bub.k} style={{position:'absolute',bottom:112,left:'50%',transform:'translateX(-50%)',background:'#fff',color:'#1a1a1a',borderRadius:16,padding:'8px 16px',fontSize:16,fontWeight:700,boxShadow:'0 8px 20px rgba(0,0,0,.45)',zIndex:150,animation:'popIn .3s cubic-bezier(.34,1.56,.64,1)',whiteSpace:'nowrap'}}>{bub.txt}</div>
      ))}

      {/* Dice / controls */}
      {state.phase!=='setup'&&state.phase!=='over'&&(
        <div style={{flexShrink:0,padding:'6px 14px calc(env(safe-area-inset-bottom,0px)+12px)'}}>
          {/* Turn timer (human) */}
          {state.turn===0&&!moving&&(
            <div style={{height:4,borderRadius:2,background:'rgba(255,255,255,.12)',margin:'0 auto 8px',maxWidth:220,overflow:'hidden'}}>
              <div key={state.evt} style={{height:'100%',background:curColor,borderRadius:2,animation:`shrinkbar ${TURN_SECONDS}s linear forwards`}}/>
            </div>
          )}
          {/* Tray palette */}
          {tray&&(
            <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',marginBottom:8,background:'rgba(8,12,10,.9)',border:'1px solid #7A5B1A',borderRadius:14,padding:8,maxWidth:340,margin:'0 auto 8px'}}>
              {(tray==='emoji'?REACTIONS:PHRASES).map(x=>(
                <button key={x} onClick={()=>{popBubble(0,x);setTray(null);}} style={{background:'rgba(255,255,255,.06)',border:'none',borderRadius:8,padding:tray==='emoji'?'4px 8px':'6px 10px',fontSize:tray==='emoji'?20:12,fontWeight:700,color:'#F0EDE5',cursor:'pointer',fontFamily:'Tajawal,sans-serif'}}>{x}</button>
              ))}
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setTray(t=>t==='emoji'?null:'emoji')} style={{width:40,height:40,borderRadius:10,border:'1px solid rgba(255,255,255,.12)',background:tray==='emoji'?'rgba(240,192,64,.18)':'rgba(255,255,255,.08)',fontSize:18,cursor:'pointer'}}>😄</button>
              <button onClick={()=>setTray(t=>t==='chat'?null:'chat')} style={{width:40,height:40,borderRadius:10,border:'1px solid rgba(255,255,255,.12)',background:tray==='chat'?'rgba(240,192,64,.18)':'rgba(255,255,255,.08)',fontSize:16,cursor:'pointer'}}>💬</button>
            </div>
            <div style={{flex:1,textAlign:'center',minWidth:0}}>
              {state.turn===0&&state.phase==='roll'&&!rolling&&!moving&&<div style={{color:'#F0C040',fontSize:14,fontWeight:900}}>دورك — اضغط النرد 🎲</div>}
              {state.turn===0&&state.phase==='move'&&!moving&&<div style={{color:'#2ECC71',fontSize:13,fontWeight:700}}>اختر قطعة للتحريك</div>}
              {(state.turn!==0||moving||rolling)&&<div style={{color:'rgba(240,237,229,.6)',fontSize:13}}>دور {state.turn===0?'اللاعب':LUDO_COLORS[state.turn].name}…</div>}
            </div>
            <div onClick={state.turn===0&&state.phase==='roll'?humanRoll:undefined}
              style={{width:60,height:60,flexShrink:0,borderRadius:15,background:'linear-gradient(150deg,#ffffff,#eceef1 58%,#dcdfe4)',
                boxShadow:state.turn===0&&state.phase==='roll'
                  ? `0 6px 16px ${curColor}55, 0 0 0 2px ${curColor}, inset 0 2px 3px #fff, inset 0 -4px 7px rgba(0,0,0,.12)`
                  : '0 6px 15px rgba(0,0,0,.45), inset 0 2px 3px #fff, inset 0 -4px 7px rgba(0,0,0,.12)',
                cursor:state.turn===0&&state.phase==='roll'?'pointer':'default',
                animation:rolling?'diceshake .32s ease-in-out infinite':'none'}}>
              {(state.dice||rolling)?<Pips n={rolling?fakeFace:state.dice} color={shade(curColor,-18)}/>:<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#0C1410',fontSize:26}}>🎲</div>}
            </div>
          </div>
        </div>
      )}

      {/* Setup: choose players */}
      {state.phase==='setup'&&(
        <div style={{position:'absolute',inset:0,background:'rgba(7,9,10,.9)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:350,padding:20}}>
          <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #F0C040',borderRadius:20,padding:'26px 22px',textAlign:'center',maxWidth:320,width:'100%',animation:'popIn .4s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{fontSize:44}}>🎲</div>
            <div style={{fontFamily:"'Scheherazade New',serif",fontSize:24,color:'#F0C040',margin:'6px 0 4px'}}>لودو المملكة</div>
            <div style={{color:'rgba(240,237,229,.6)',fontSize:12,marginBottom:18}}>اختر عدد اللاعبين</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              {[2,3,4].map(n=>(
                <button key={n} onClick={()=>dispatch({type:'START',count:n})} style={{flex:1,padding:'16px 0',borderRadius:14,border:'1px solid rgba(240,192,64,.3)',background:'rgba(240,192,64,.1)',color:'#F0C040',fontFamily:'Tajawal,sans-serif',fontWeight:900,fontSize:22,cursor:'pointer'}}>
                  {n}
                  <div style={{fontSize:10,fontWeight:700,color:'rgba(240,237,229,.55)',marginTop:2}}>لاعبين</div>
                </button>
              ))}
            </div>
            <div style={{color:'rgba(240,237,229,.45)',fontSize:10,marginTop:14}}>أنت الأحمر · البقية روبوت</div>
            {onOnline&&<>
              <div style={{height:1,background:'rgba(255,255,255,.1)',margin:'16px 0 12px'}}/>
              <button onClick={onOnline} style={{width:'100%',padding:'12px',borderRadius:12,border:'1px solid rgba(52,152,219,.4)',background:'rgba(52,152,219,.12)',color:'#5DADE2',fontFamily:'Tajawal,sans-serif',fontWeight:900,fontSize:14,cursor:'pointer'}}>🌐 أونلاين مع الأصدقاء</button>
            </>}
          </div>
        </div>
      )}

      {/* Game over */}
      {state.phase==='over'&&(
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:350,padding:20}}>
          <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #F0C040',borderRadius:20,padding:'26px 24px',textAlign:'center',maxWidth:320,width:'100%',animation:'popIn .5s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{fontSize:52}}>{state.winner===0?'🏆':'🎲'}</div>
            <div style={{fontFamily:"'Scheherazade New',serif",fontSize:26,color:'#F0C040',margin:'6px 0'}}>{state.winner===0?'فزت!':`فاز ${LUDO_COLORS[state.winner].name}`}</div>
            {state.ranks.indexOf(0)>=0&&[100,50,20,0][state.ranks.indexOf(0)]>0&&<div style={{color:'rgba(240,237,229,.65)',fontSize:13,marginBottom:8}}>+{[100,50,20,0][state.ranks.indexOf(0)]} عملة 🪙</div>}
            <div style={{display:'flex',flexDirection:'column',gap:6,margin:'12px 0'}}>
              {state.ranks.map((p,i)=>(
                <div key={p} style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center',fontSize:14}}>
                  <span style={{width:22}}>{['🥇','🥈','🥉','4️⃣'][i]}</span>
                  <div style={{width:15,height:15,borderRadius:'50%',background:tokenBg(LUDO_COLORS[p].hex)}}/>
                  <span>{p===0?(profile?.name||'أنت'):LUDO_COLORS[p].name}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>dispatch({type:'SETUP'})} style={{flex:1,padding:12,borderRadius:10,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.75)',fontFamily:'Tajawal,sans-serif',fontWeight:700}}>لاعبون آخرون</button>
              <button onClick={()=>{awarded.current=false;dispatch({type:'RESET'});}} style={{flex:1.4,padding:12,borderRadius:10,border:'none',background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',fontFamily:'Tajawal,sans-serif',fontWeight:900}}>العب مجدداً 🔄</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
