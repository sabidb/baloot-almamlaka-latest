import { useReducer, useEffect, useRef, useState } from 'react';
import {
  LUDO_COLORS, RING, HOME_PATHS, CENTER, FINISH,
  initLudo, movableTokens, applyMove, playerFinished, botPickToken, tokenCell, rollDie,
} from './LudoLogic';
import { sounds, setMuted } from './GameLogic';

const CELL = 100/15;
const pos = (r,c)=>({ position:'absolute', top:`${r*CELL}%`, left:`${c*CELL}%`, width:`${CELL}%`, height:`${CELL}%` });
const START_INDEX = { 0:'red', 13:'green', 26:'yellow', 39:'blue' };
const STAR = new Set([8,21,34,47]);
const hexOf = id => LUDO_COLORS.find(c=>c.id===id).hex;
const PLAYER_SETS = { 2:[0,2], 3:[0,1,2], 4:[0,1,2,3] };

// ── colour helpers for glossy gradients ──
const clamp = v => Math.max(0,Math.min(255,v));
function shade(hex,amt){
  const n=parseInt(hex.slice(1),16), r=n>>16&255, g=n>>8&255, b=n&255;
  const t=amt>0?255:0, p=Math.abs(amt)/100;
  const m=x=>clamp(Math.round(x+(t-x)*p));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
const tokenBg = c => `radial-gradient(circle at 34% 28%, ${shade(c,62)}, ${c} 58%, ${shade(c,-28)})`;

const BASES = [
  { color:'red',    r0:0, c0:0, arrow:'▸' },
  { color:'green',  r0:0, c0:9, arrow:'▾' },
  { color:'yellow', r0:9, c0:9, arrow:'◂' },
  { color:'blue',   r0:9, c0:0, arrow:'▴' },
];
const HOME_ARROW = { red:'▸', green:'▾', yellow:'◂', blue:'▴' };

function BoardStatic({ active }){
  return (
    <>
      {/* Corner bases */}
      {BASES.map((b,pi)=>{
        const on=active.includes(pi); const col=hexOf(b.color);
        return (
          <div key={b.color} style={{...pos(b.r0,b.c0),width:`${6*CELL}%`,height:`${6*CELL}%`,
            background:`linear-gradient(135deg, ${shade(col,18)}, ${col} 55%, ${shade(col,-22)})`,
            borderRadius:'16%',padding:'9%',opacity:on?1:0.32,boxShadow:'inset 0 2px 6px rgba(255,255,255,.25), inset 0 -3px 8px rgba(0,0,0,.3)'}}>
            <div style={{width:'100%',height:'100%',background:'linear-gradient(160deg,#ffffff,#eef0ec)',borderRadius:'12%',display:'grid',gridTemplateColumns:'1fr 1fr',placeItems:'center',gap:'6%',padding:'11%',boxShadow:'inset 0 1px 3px rgba(0,0,0,.25)'}}>
              {[0,1,2,3].map(i=><div key={i} style={{width:'66%',aspectRatio:'1',borderRadius:'50%',background:`radial-gradient(circle at 40% 35%, #fff, ${shade(col,55)})`,boxShadow:`inset 0 2px 4px rgba(0,0,0,.28), 0 0 0 2px ${col}`}}/>)}
            </div>
          </div>
        );
      })}

      {/* Ring cells */}
      {RING.map(([r,c],i)=>{
        const startColor=START_INDEX[i];
        const safe=STAR.has(i);
        const bg = startColor
          ? `linear-gradient(135deg, ${shade(hexOf(startColor),25)}, ${hexOf(startColor)})`
          : '#fbfaf4';
        return (
          <div key={`ring${i}`} style={{...pos(r,c),border:'1px solid rgba(0,0,0,.14)',background:bg,display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
            boxShadow:startColor?'inset 0 1px 3px rgba(255,255,255,.4)':'inset 0 0 3px rgba(0,0,0,.04)'}}>
            {safe&&<span style={{color:startColor?'rgba(255,255,255,.9)':'#C9A84C',fontSize:'1.5vh',lineHeight:1,textShadow:'0 1px 1px rgba(0,0,0,.3)'}}>★</span>}
          </div>
        );
      })}

      {/* Home columns with directional chevrons */}
      {Object.entries(HOME_PATHS).map(([id,cells])=>cells.map(([r,c],i)=>(
        <div key={`home${id}${i}`} style={{...pos(r,c),background:`linear-gradient(135deg, ${shade(hexOf(id),22)}, ${hexOf(id)})`,border:'1px solid rgba(0,0,0,.12)',boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,.55)',fontSize:'1.2vh'}}>
          {i<5&&HOME_ARROW[id]}
        </div>
      )))}

      {/* Centre pinwheel + emblem */}
      <div style={{...pos(6,6),width:`${3*CELL}%`,height:`${3*CELL}%`,background:
        `conic-gradient(from 45deg, ${hexOf('yellow')} 0 90deg, ${hexOf('blue')} 90deg 180deg, ${hexOf('red')} 180deg 270deg, ${hexOf('green')} 270deg 360deg)`,
        border:'1px solid rgba(0,0,0,.25)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'inset 0 2px 8px rgba(255,255,255,.25), inset 0 -3px 8px rgba(0,0,0,.35)'}}>
        <div style={{width:'46%',height:'46%',borderRadius:'50%',background:'radial-gradient(circle at 40% 35%, #FFE9A8, #C9A84C 70%, #8B6914)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.7vh',boxShadow:'0 1px 4px rgba(0,0,0,.5)'}}>👑</div>
      </div>
    </>
  );
}

function nextActive(tokens, turn, active){
  const i=active.indexOf(turn);
  for(let k=1;k<=active.length;k++){
    const t=active[(i+k)%active.length];
    if(!playerFinished(tokens,t)) return t;
  }
  return turn;
}
function initState(){
  return { ...initLudo(), active:[0,1,2,3], turn:0, dice:null, moves:[], phase:'setup', sixes:0, msg:null, winner:null, evt:0 };
}
function reducer(s,a){
  switch(a.type){
    case 'START':{
      const active=PLAYER_SETS[a.count]||PLAYER_SETS[4];
      return { ...initLudo(), active, turn:active[0], dice:null, moves:[], phase:'roll', sixes:0, msg:null, winner:null, evt:s.evt+1 };
    }
    case 'ROLL':{
      const dice=a.dice;
      const sixes = dice===6 ? s.sixes+1 : 0;
      if(dice===6 && sixes>=3)
        return { ...s, dice, moves:[], phase:'roll', sixes:0, turn:nextActive(s.tokens,s.turn,s.active), msg:'ثلاث ستات! ضاع الدور', evt:s.evt+1 };
      const moves=movableTokens(s.tokens,s.turn,dice);
      if(moves.length===0)
        return { ...s, dice, moves:[], phase:'roll', sixes:0, turn:nextActive(s.tokens,s.turn,s.active), msg:'لا يوجد حركة', evt:s.evt+1 };
      return { ...s, dice, moves, phase:'move', sixes, msg:null, evt:s.evt+1 };
    }
    case 'MOVE':{
      const ti=a.tokenIdx, dice=s.dice;
      if(!s.moves.includes(ti)) return s;
      const res=applyMove(s.tokens,s.turn,ti,dice);
      const tokens=res.tokens;
      let ranks=[...s.ranks];
      const finishedAll=playerFinished(tokens,s.turn)&&!ranks.includes(s.turn);
      if(finishedAll) ranks.push(s.turn);
      const activeLeft=s.active.filter(p=>!playerFinished(tokens,p)).length;
      const over = ranks.includes(0) || ranks.length>=s.active.length-1 || activeLeft<=1;
      if(over){
        const finalRanks=[...ranks];
        for(const p of s.active) if(!finalRanks.includes(p)) finalRanks.push(p);
        return { ...s, tokens, ranks:finalRanks, phase:'over', winner:finalRanks[0], moves:[], dice, evt:s.evt+1 };
      }
      const extra = (dice===6 || res.captured || res.finished) && !finishedAll;
      return {
        ...s, tokens, ranks, dice:null, moves:[], phase:'roll',
        turn: extra ? s.turn : nextActive(tokens,s.turn,s.active),
        sixes: extra ? s.sixes : 0,
        msg: res.captured?'أكل الخصم! 🍽️':(res.finished?'وصل للبيت! 🏠':(extra?'دور إضافي 🎲':null)),
        evt:s.evt+1,
      };
    }
    case 'RESET': return { ...initLudo(), active:s.active, turn:s.active[0], dice:null, moves:[], phase:'roll', sixes:0, msg:null, winner:null, evt:s.evt+1 };
    case 'SETUP': return { ...initState(), evt:s.evt+1 };
    default: return s;
  }
}

function Pips({n,color='#0C1410'}){
  const map={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  const on=new Set(map[n]||[]);
  return (
    <div style={{width:'100%',height:'100%',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'1fr 1fr 1fr',gap:2,padding:'11%'}}>
      {Array.from({length:9}).map((_,i)=><div key={i} style={{display:'flex',alignItems:'center',justifyContent:'center'}}>{on.has(i)&&<div style={{width:'70%',aspectRatio:'1',borderRadius:'50%',background:color,boxShadow:'inset 0 1px 1px rgba(255,255,255,.4)'}}/>}</div>)}
    </div>
  );
}

function spawnBurst(x,y,color){
  const palette=[color,'#F0C040','#fff','#FFE08A'];
  for(let i=0;i<18;i++){
    const el=document.createElement('div');
    const a=(Math.PI*2/18)*i, d=44+Math.random()*80, sz=4+Math.random()*7;
    Object.assign(el.style,{position:'fixed',left:x+'px',top:y+'px',width:sz+'px',height:sz+'px',borderRadius:'2px',background:palette[i%palette.length],pointerEvents:'none',zIndex:'9999',animation:`confetti ${0.5+Math.random()*0.6}s ease-out forwards`});
    el.style.setProperty('--tx',Math.cos(a)*d+'px');
    el.style.setProperty('--ty',Math.sin(a)*d+'px');
    el.style.setProperty('--rot',(Math.random()*720-360)+'deg');
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1300);
  }
}

export default function LudoScreen({ profile, onUpdate, persist, onExit }){
  const [state,dispatch]=useReducer(reducer,undefined,initState);
  const [toast,setToast]=useState(null);
  const [rolling,setRolling]=useState(false);
  const [fakeFace,setFakeFace]=useState(1);
  const [moving,setMoving]=useState(null);
  const [muted,setMutedState]=useState(!!(profile&&profile.muted));
  const tn=useRef(0), rollingRef=useRef(false), movingRef=useRef(false), boardRef=useRef(null), awarded=useRef(false);
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

  // Award coins + stats + celebrate once.
  useEffect(()=>{
    if(state.phase!=='over' || awarded.current) return;
    awarded.current=true;
    if(!muted) sounds.win();
    const place=state.ranks.indexOf(0);
    if(place===0) launchConfetti();
    const reward=[100,50,20,0][place]||0;
    const patch={};
    if(reward>0) patch.coins=(profile?.coins||0)+reward;
    if(place===0) patch.ludoWins=(profile?.ludoWins||0)+1;
    if(Object.keys(patch).length){ if(onUpdate) onUpdate(p=>({...p,...patch,coins:patch.coins??p.coins})); if(persist) persist(patch); }
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

  const tokenStyle=(p,r,c,or,oc,z,canMove)=>({
    position:'absolute', top:`${(r+0.5+or)*CELL}%`, left:`${(c+0.5+oc)*CELL}%`, transform:'translate(-50%,-62%)',
    width:'5%', aspectRatio:'0.82', borderRadius:'50% 50% 50% 50% / 60% 60% 42% 42%',
    background:tokenBg(hexOf(LUDO_COLORS[p].id)),
    border:`1.5px solid ${canMove?'#fff':'rgba(0,0,0,.4)'}`,
    boxShadow:canMove?'0 0 0 3px rgba(255,255,255,.75),0 4px 9px rgba(0,0,0,.55)':'0 4px 9px rgba(0,0,0,.5), inset 0 2px 2px rgba(255,255,255,.4)',
    cursor:canMove?'pointer':'default', zIndex:z,
    animation:canMove?'pulse 1s ease-in-out infinite':'none', transition:'top .3s,left .3s',
  });

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
          background:'linear-gradient(160deg,#12201A,#0a130e)',borderRadius:18,
          padding:'2.4%',boxShadow:'0 22px 60px rgba(0,0,0,.65), 0 0 0 2px rgba(240,192,64,.25), inset 0 0 0 1px rgba(0,0,0,.4)'}}>
          <div style={{position:'relative',width:'100%',height:'100%',borderRadius:10,overflow:'hidden',direction:'ltr',background:'#0d1712'}}>
            <BoardStatic active={state.active}/>

            {/* Destination previews */}
            {previews.map(pv=>(
              <div key={`pv${pv.key}`} style={{position:'absolute',top:`${(pv.cell[0]+0.5)*CELL}%`,left:`${(pv.cell[1]+0.5)*CELL}%`,transform:'translate(-50%,-50%)',width:'4.4%',aspectRatio:'1',borderRadius:'50%',border:'2px dashed rgba(255,255,255,.85)',boxShadow:'0 0 8px rgba(255,255,255,.4)',zIndex:90,pointerEvents:'none',animation:'pulse 1.1s ease-in-out infinite'}}/>
            ))}

            {/* Tokens */}
            {placed.map(k=>{
              const key=`${k.r.toFixed(1)},${k.c.toFixed(1)}`;
              const group=occ[key]; const idx=group.indexOf(k); const [or,oc]=OFFS[Math.min(idx,4)];
              const canMove = k.p===0 && humanMovable && humanMovable.has(k.t);
              return <div key={`${k.p}-${k.t}`} onClick={()=>k.p===0&&humanMove(k.t)} style={tokenStyle(k.p,k.r,k.c,or,oc,100+idx,canMove)}/>;
            })}

            {/* Hopping token */}
            {moving&&moving.cell&&(
              <div style={{...tokenStyle(moving.p,moving.cell[0],moving.cell[1],0,0,200,false),
                border:'1.5px solid #fff', boxShadow:'0 0 0 2px rgba(255,255,255,.5),0 7px 15px rgba(0,0,0,.6)',
                animation:'none', transition:'top .14s linear,left .14s linear'}}/>
            )}
          </div>
        </div>
      </div>

      {/* Dice / controls */}
      {state.phase!=='setup'&&state.phase!=='over'&&(
        <div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',gap:16,padding:'8px 14px calc(env(safe-area-inset-bottom,0px)+14px)'}}>
          <div onClick={state.turn===0&&state.phase==='roll'?humanRoll:undefined}
            style={{width:58,height:58,borderRadius:14,background:'linear-gradient(145deg,#FEFDF8,#E4DECB)',
              boxShadow:state.turn===0&&state.phase==='roll'?`0 6px 18px ${curColor}66, 0 0 0 2px ${curColor}`:'0 6px 16px rgba(0,0,0,.5)',
              cursor:state.turn===0&&state.phase==='roll'?'pointer':'default',
              animation:rolling?'diceshake .32s ease-in-out infinite':'none'}}>
            {(state.dice||rolling)?<Pips n={rolling?fakeFace:state.dice} color={curColor}/>:<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#0C1410',fontSize:24}}>🎲</div>}
          </div>
          <div style={{minWidth:120,textAlign:'center'}}>
            {state.turn===0&&state.phase==='roll'&&!rolling&&!moving&&<div style={{color:'#F0C040',fontSize:14,fontWeight:900}}>دورك — اضغط النرد 🎲</div>}
            {state.turn===0&&state.phase==='move'&&!moving&&<div style={{color:'#2ECC71',fontSize:13,fontWeight:700}}>اختر قطعة للتحريك</div>}
            {(state.turn!==0||moving||rolling)&&<div style={{color:'rgba(240,237,229,.6)',fontSize:13}}>دور {state.turn===0?'اللاعب':LUDO_COLORS[state.turn].name}…</div>}
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
