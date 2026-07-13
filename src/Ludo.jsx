import { useReducer, useEffect, useRef, useState } from 'react';
import {
  LUDO_COLORS, RING, HOME_PATHS, CENTER, FINISH,
  initLudo, movableTokens, applyMove, playerFinished, botPickToken, tokenCell, rollDie,
} from './LudoLogic';
import { sounds, setMuted } from './GameLogic';

const CELL = 100/15; // percent per grid cell
const pos = (r,c)=>({ position:'absolute', top:`${r*CELL}%`, left:`${c*CELL}%`, width:`${CELL}%`, height:`${CELL}%` });
const START_INDEX = { 0:'red', 13:'green', 26:'yellow', 39:'blue' };
const STAR = new Set([8,21,34,47]);
const hexOf = id => LUDO_COLORS.find(c=>c.id===id).hex;

const BASES = [
  { color:'red',    r0:0, c0:0  },
  { color:'green',  r0:0, c0:9  },
  { color:'yellow', r0:9, c0:9  },
  { color:'blue',   r0:9, c0:0  },
];

function BoardStatic(){
  return (
    <>
      {BASES.map(b=>(
        <div key={b.color} style={{...pos(b.r0,b.c0),width:`${6*CELL}%`,height:`${6*CELL}%`,background:hexOf(b.color),borderRadius:'14%',padding:'8%'}}>
          <div style={{width:'100%',height:'100%',background:'rgba(255,255,255,.9)',borderRadius:'10%',display:'grid',gridTemplateColumns:'1fr 1fr',placeItems:'center',gap:'8%',padding:'10%'}}>
            {[0,1,2,3].map(i=><div key={i} style={{width:'62%',aspectRatio:'1',borderRadius:'50%',border:`3px solid ${hexOf(b.color)}`,background:'#fff'}}/>)}
          </div>
        </div>
      ))}
      {RING.map(([r,c],i)=>{
        const startColor=START_INDEX[i];
        const bg = startColor ? hexOf(startColor) : '#fdfdf7';
        return (
          <div key={`ring${i}`} style={{...pos(r,c),border:'1px solid rgba(0,0,0,.18)',background:bg,display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box'}}>
            {STAR.has(i)&&<span style={{color:'#8a6d1a',fontSize:'1.4vh'}}>★</span>}
          </div>
        );
      })}
      {Object.entries(HOME_PATHS).map(([id,cells])=>cells.map(([r,c],i)=>(
        <div key={`home${id}${i}`} style={{...pos(r,c),background:hexOf(id),border:'1px solid rgba(0,0,0,.15)',boxSizing:'border-box',opacity:0.85}}/>
      )))}
      <div style={{...pos(6,6),width:`${3*CELL}%`,height:`${3*CELL}%`,background:
        `conic-gradient(from 45deg, ${hexOf('yellow')} 0 90deg, ${hexOf('blue')} 90deg 180deg, ${hexOf('red')} 180deg 270deg, ${hexOf('green')} 270deg 360deg)`,
        border:'1px solid rgba(0,0,0,.2)'}}/>
    </>
  );
}

function nextActive(tokens, turn){
  let t=turn;
  for(let k=0;k<4;k++){ t=(t+1)%4; if(!playerFinished(tokens,t)) return t; }
  return turn;
}
function initState(){
  return { ...initLudo(), turn:0, dice:null, moves:[], phase:'roll', sixes:0, msg:null, winner:null, evt:0 };
}
function reducer(s,a){
  switch(a.type){
    case 'ROLL':{
      const dice=a.dice;
      const sixes = dice===6 ? s.sixes+1 : 0;
      if(dice===6 && sixes>=3)
        return { ...s, dice, moves:[], phase:'roll', sixes:0, turn:nextActive(s.tokens,s.turn), msg:'ثلاث ستات! ضاع الدور', evt:s.evt+1 };
      const moves=movableTokens(s.tokens,s.turn,dice);
      if(moves.length===0)
        return { ...s, dice, moves:[], phase:'roll', sixes:0, turn:nextActive(s.tokens,s.turn), msg:'لا يوجد حركة', evt:s.evt+1 };
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
      const activeLeft=[0,1,2,3].filter(p=>!playerFinished(tokens,p)).length;
      const over = ranks.includes(0) || ranks.length>=3 || activeLeft<=1;
      if(over){
        const finalRanks=[...ranks];
        for(let p=0;p<4;p++) if(!finalRanks.includes(p)) finalRanks.push(p);
        return { ...s, tokens, ranks:finalRanks, phase:'over', winner:finalRanks[0], moves:[], dice, evt:s.evt+1 };
      }
      const extra = (dice===6 || res.captured || res.finished) && !finishedAll;
      return {
        ...s, tokens, ranks, dice:null, moves:[], phase:'roll',
        turn: extra ? s.turn : nextActive(tokens,s.turn),
        sixes: extra ? s.sixes : 0,
        msg: res.captured?'أكل الخصم! 🍽️':(res.finished?'وصل للبيت! 🏠':(extra?'دور إضافي 🎲':null)),
        evt:s.evt+1,
      };
    }
    case 'RESET': return initState();
    default: return s;
  }
}

function Pips({n}){
  const map={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  const on=new Set(map[n]||[]);
  return (
    <div style={{width:'100%',height:'100%',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'1fr 1fr 1fr',gap:2,padding:5}}>
      {Array.from({length:9}).map((_,i)=><div key={i} style={{display:'flex',alignItems:'center',justifyContent:'center'}}>{on.has(i)&&<div style={{width:'62%',aspectRatio:'1',borderRadius:'50%',background:'#0C1410'}}/>}</div>)}
    </div>
  );
}

// Screen-space particle burst using the global `confetti` keyframe.
function spawnBurst(x,y,color){
  const palette=[color,'#F0C040','#fff','#FFE08A'];
  for(let i=0;i<16;i++){
    const el=document.createElement('div');
    const a=(Math.PI*2/16)*i, d=40+Math.random()*75, sz=4+Math.random()*6;
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
  const [portrait,setPortrait]=useState(typeof window!=='undefined' && window.innerHeight>window.innerWidth);
  const [toast,setToast]=useState(null);
  const [rolling,setRolling]=useState(false);
  const [fakeFace,setFakeFace]=useState(1);
  const [moving,setMoving]=useState(null); // {p,t,cell:[r,c]}
  const [muted,setMutedState]=useState(!!(profile&&profile.muted));
  const tn=useRef(0), rollingRef=useRef(false), movingRef=useRef(false), boardRef=useRef(null), awarded=useRef(false);
  const showT=m=>{tn.current++;const k=tn.current;setToast({m,k});setTimeout(()=>setToast(t=>t&&t.k===k?null:t),1600);};

  useEffect(()=>{ setMuted(!!(profile&&profile.muted)); },[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    try{ if(screen.orientation&&screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{}); }catch{ /* unsupported */ }
    const onR=()=>setPortrait(window.innerHeight>window.innerWidth);
    window.addEventListener('resize',onR);
    return ()=>{ window.removeEventListener('resize',onR); try{ if(screen.orientation&&screen.orientation.unlock) screen.orientation.unlock(); }catch{ /* noop */ } };
  },[]);
  useEffect(()=>{ if(state.msg) showT(state.msg); },[state.evt]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute=()=>{ const m=!muted; setMutedState(m); setMuted(m); if(onUpdate) onUpdate(p=>({...p,muted:m})); if(persist) persist({muted:m}); };

  const burstAtCell=(cell,color)=>{
    const el=boardRef.current; if(!el||!cell) return;
    const rect=el.getBoundingClientRect();
    const x=rect.left + (cell[1]+0.5)*CELL/100*rect.width;
    const y=rect.top  + (cell[0]+0.5)*CELL/100*rect.height;
    spawnBurst(x,y,color);
  };
  const launchConfetti=()=>{
    const el=boardRef.current; if(!el) return;
    const rect=el.getBoundingClientRect(); let n=0;
    const iv=setInterval(()=>{ spawnBurst(rect.left+Math.random()*rect.width, rect.top+Math.random()*rect.height*0.55, ['#F0C040','#E74C3C','#27AE60','#3498DB'][n%4]); if(++n>11) clearInterval(iv); },110);
  };

  // Roll with a tumbling animation, then commit.
  const performRoll=()=>{
    if(movingRef.current||rollingRef.current||state.phase!=='roll') return;
    rollingRef.current=true; setRolling(true); if(!muted) sounds.dice();
    const dice=rollDie();
    let n=0; const iv=setInterval(()=>{ setFakeFace(1+Math.floor(Math.random()*6)); if(++n>=6) clearInterval(iv); },70);
    setTimeout(()=>{ clearInterval(iv); rollingRef.current=false; setRolling(false); dispatch({type:'ROLL',dice}); }, 560);
  };

  // Move a token, hopping through each intermediate cell with sound + effects.
  const performMove=(ti)=>{
    if(movingRef.current || state.phase!=='move' || !state.moves.includes(ti)) return;
    const p=state.turn, dice=state.dice, fromRel=state.tokens[p][ti];
    if(!dice){ dispatch({type:'MOVE',tokenIdx:ti}); return; } // safety
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
    if(state.phase==='over' || state.turn===0 || movingRef.current || rollingRef.current) return;
    if(state.phase==='roll'){ const id=setTimeout(performRoll,520); return ()=>clearTimeout(id); }
    if(state.phase==='move'){ const id=setTimeout(()=>performMove(botPickToken(state.tokens,state.turn,state.dice,state.moves)),560); return ()=>clearTimeout(id); }
  },[state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Award coins + celebrate once when the game ends.
  useEffect(()=>{
    if(state.phase!=='over' || awarded.current) return;
    awarded.current=true;
    if(!muted) sounds.win();
    const place=state.ranks.indexOf(0);
    if(place===0) launchConfetti();
    const reward=[100,50,20,0][place]||0;
    if(reward>0){ if(onUpdate) onUpdate(p=>({...p,coins:(p.coins||0)+reward})); if(persist) persist({coins:(profile?.coins||0)+reward}); }
  },[state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const humanRoll=()=>performRoll();
  const humanMove=ti=>{ if(state.turn===0) performMove(ti); };

  // Token render data with stacking offsets.
  const placed=[];
  for(let p=0;p<4;p++) for(let t=0;t<4;t++){
    if(moving && moving.p===p && moving.t===t) continue; // hidden while it hops
    const rel=state.tokens[p][t];
    const [r,c]=tokenCell(p,rel,t);
    placed.push({p,t,rel,r,c});
  }
  const occ={};
  placed.forEach(k=>{ const key=`${k.r.toFixed(1)},${k.c.toFixed(1)}`; (occ[key]=occ[key]||[]).push(k); });
  const OFFS=[[0,0],[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]];
  const finishedCount=p=>state.tokens[p].filter(r=>r===FINISH).length;
  const humanMovable = state.phase==='move'&&state.turn===0&&!moving ? new Set(state.moves) : null;
  const tokenBox=(color,extra)=>({position:'absolute',width:'4.6%',aspectRatio:'1',borderRadius:'50% 50% 50% 8%',background:color,...extra});

  return (
    <div style={{width:'100%',height:'100%',background:'radial-gradient(ellipse 100% 80% at 50% 50%,#12241A,#07090A)',position:'relative',overflow:'hidden',fontFamily:'Tajawal,sans-serif',direction:'rtl'}}>
      {portrait&&(
        <div style={{position:'absolute',inset:0,zIndex:400,background:'rgba(7,9,10,.96)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,color:'#F0C040',textAlign:'center',padding:24}}>
          <div style={{fontSize:52,animation:'diceshake 1.4s ease-in-out infinite'}}>📱</div>
          <div style={{fontFamily:"'Scheherazade New',serif",fontSize:24}}>أدر جهازك أفقياً</div>
          <div style={{color:'rgba(240,237,229,.6)',fontSize:13}}>لودو المملكة يُلعب بالوضع الأفقي</div>
          <button onClick={onExit} style={{marginTop:10,padding:'9px 18px',borderRadius:10,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'rgba(240,237,229,.7)',fontFamily:'Tajawal,sans-serif',fontWeight:700}}>خروج</button>
        </div>
      )}

      {toast&&<div key={toast.k} style={{position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',background:'rgba(8,12,10,.95)',border:'1px solid #7A5B1A',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:700,color:'#F0C040',whiteSpace:'nowrap',zIndex:300,animation:'fadeUp .3s ease both'}}>{toast.m}</div>}

      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',gap:'2.5vh',padding:'2vh'}}>
        {/* Board */}
        <div ref={boardRef} style={{position:'relative',height:'94vh',aspectRatio:'1',maxWidth:'62vw',background:'#0d1712',borderRadius:'3%',boxShadow:'0 20px 60px rgba(0,0,0,.6)',border:'1px solid rgba(240,192,64,.15)',direction:'ltr'}}>
          <BoardStatic/>
          {placed.map(k=>{
            const key=`${k.r.toFixed(1)},${k.c.toFixed(1)}`;
            const group=occ[key]; const idx=group.indexOf(k); const [or,oc]=OFFS[Math.min(idx,4)];
            const color=hexOf(LUDO_COLORS[k.p].id);
            const canMove = k.p===0 && humanMovable && humanMovable.has(k.t);
            return (
              <div key={`${k.p}-${k.t}`} onClick={()=>k.p===0&&humanMove(k.t)}
                style={tokenBox(color,{
                  top:`${(k.r+0.5+or)*CELL}%`, left:`${(k.c+0.5+oc)*CELL}%`, transform:'translate(-50%,-60%)',
                  border:`2px solid ${canMove?'#fff':'rgba(0,0,0,.35)'}`,
                  boxShadow:canMove?'0 0 0 3px rgba(255,255,255,.7),0 4px 8px rgba(0,0,0,.5)':'0 4px 8px rgba(0,0,0,.5)',
                  cursor:canMove?'pointer':'default', zIndex:100+idx,
                  animation:canMove?'pulse 1s ease-in-out infinite':'none', transition:'top .3s,left .3s'})}/>
            );
          })}
          {/* Hopping token */}
          {moving&&moving.cell&&(
            <div style={tokenBox(hexOf(LUDO_COLORS[moving.p].id),{
              top:`${(moving.cell[0]+0.5)*CELL}%`, left:`${(moving.cell[1]+0.5)*CELL}%`, transform:'translate(-50%,-60%)',
              border:'2px solid #fff', boxShadow:'0 0 0 2px rgba(255,255,255,.5),0 6px 14px rgba(0,0,0,.6)', zIndex:200,
              transition:'top .14s linear,left .14s linear'})}/>
          )}
        </div>

        {/* Side panel */}
        <div style={{height:'94vh',width:'min(30vw,240px)',display:'flex',flexDirection:'column',gap:'1.4vh',color:'#F0EDE5'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontFamily:"'Scheherazade New',serif",fontSize:'2.6vh',color:'#F0C040'}}>لودو المملكة</div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={toggleMute} aria-label="mute" style={{padding:'0.6vh 1vh',borderRadius:8,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',fontSize:'1.5vh'}}>{muted?'🔇':'🔊'}</button>
              <button onClick={onExit} style={{padding:'0.6vh 1.4vh',borderRadius:8,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.7)',fontFamily:'Tajawal,sans-serif',fontWeight:700,fontSize:'1.5vh'}}>خروج</button>
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:'0.8vh'}}>
            {LUDO_COLORS.map((c,p)=>{
              const active=state.turn===p&&state.phase!=='over';
              return (
                <div key={c.id} style={{display:'flex',alignItems:'center',gap:8,background:active?'rgba(240,192,64,.12)':'rgba(13,20,16,.7)',border:`1px solid ${active?'#F0C040':'rgba(255,255,255,.06)'}`,borderRadius:10,padding:'0.9vh 1.1vh',transition:'all .2s',boxShadow:active?'0 0 14px rgba(240,192,64,.25)':'none'}}>
                  <div style={{width:'2.4vh',height:'2.4vh',borderRadius:'50%',background:c.hex,flexShrink:0,boxShadow:active?`0 0 10px ${c.hex}`:'none'}}/>
                  <span style={{fontSize:'1.6vh',fontWeight:700,flex:1}}>{p===0?(profile?.name||'أنت'):c.name}</span>
                  <span style={{fontSize:'1.5vh',fontWeight:900,color:'#F0C040'}}>{finishedCount(p)}/4</span>
                  {active&&<span style={{fontSize:'1.4vh'}}>▶</span>}
                </div>
              );
            })}
          </div>

          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1.6vh'}}>
            <div style={{width:'9vh',height:'9vh',borderRadius:'16%',background:'linear-gradient(145deg,#FEFDF8,#E8E2D2)',boxShadow:'0 8px 22px rgba(0,0,0,.55)',animation:rolling?'diceshake .32s ease-in-out infinite':'none'}}>
              {(state.dice||rolling)?<Pips n={rolling?fakeFace:state.dice}/>:<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#0C1410',fontSize:'3vh'}}>🎲</div>}
            </div>
            {state.turn===0&&state.phase==='roll'&&!rolling&&!moving&&(
              <button onClick={humanRoll} style={{padding:'1.2vh 2.4vh',borderRadius:12,border:'none',background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',fontFamily:'Tajawal,sans-serif',fontWeight:900,fontSize:'1.8vh',cursor:'pointer',boxShadow:'0 6px 16px rgba(240,192,64,.3)'}}>ارمِ النرد 🎲</button>
            )}
            {state.turn===0&&state.phase==='move'&&!moving&&<div style={{color:'#2ECC71',fontSize:'1.6vh',fontWeight:700}}>اختر قطعة للتحريك</div>}
            {(state.turn!==0||moving)&&state.phase!=='over'&&<div style={{color:'rgba(240,237,229,.6)',fontSize:'1.6vh'}}>دور {LUDO_COLORS[state.turn].name}…</div>}
          </div>
        </div>
      </div>

      {state.phase==='over'&&(
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:350,padding:20}}>
          <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #F0C040',borderRadius:20,padding:'3vh 4vh',textAlign:'center',maxWidth:360,animation:'popIn .5s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{fontSize:'6vh'}}>{state.winner===0?'🏆':'🎲'}</div>
            <div style={{fontFamily:"'Scheherazade New',serif",fontSize:'3vh',color:'#F0C040',margin:'1vh 0'}}>{state.winner===0?'فزت!':`فاز ${LUDO_COLORS[state.winner].name}`}</div>
            {state.ranks.indexOf(0)>=0&&<div style={{color:'rgba(240,237,229,.65)',fontSize:'1.6vh',marginBottom:'1vh'}}>+{[100,50,20,0][state.ranks.indexOf(0)]} عملة 🪙</div>}
            <div style={{display:'flex',flexDirection:'column',gap:6,margin:'1.5vh 0'}}>
              {state.ranks.map((p,i)=>(
                <div key={p} style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center',fontSize:'1.7vh'}}>
                  <span style={{width:22}}>{['🥇','🥈','🥉','4️⃣'][i]}</span>
                  <div style={{width:'1.8vh',height:'1.8vh',borderRadius:'50%',background:LUDO_COLORS[p].hex}}/>
                  <span>{p===0?(profile?.name||'أنت'):LUDO_COLORS[p].name}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={onExit} style={{flex:1,padding:'1.2vh',borderRadius:10,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.08)',color:'rgba(240,237,229,.75)',fontFamily:'Tajawal,sans-serif',fontWeight:700}}>خروج</button>
              <button onClick={()=>{awarded.current=false;dispatch({type:'RESET'});}} style={{flex:2,padding:'1.2vh',borderRadius:10,border:'none',background:'linear-gradient(135deg,#8B6914,#F0C040)',color:'#07090A',fontFamily:'Tajawal,sans-serif',fontWeight:900}}>العب مجدداً 🔄</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
