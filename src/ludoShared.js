// Shared Ludo constants, board geometry, colour helpers, and the turn
// reducer — used by both the local (Ludo.jsx) and online (LudoOnline.jsx)
// screens. Kept component-free so Fast Refresh stays happy.
import { LUDO_COLORS, initLudo, movableTokens, applyMove, playerFinished } from './LudoLogic';

export const CELL = 100/15;
export const pos = (r,c)=>({ position:'absolute', top:`${r*CELL}%`, left:`${c*CELL}%`, width:`${CELL}%`, height:`${CELL}%` });
export const cellCenter = (r,c)=>({ top:`${(r+0.5)*CELL}%`, left:`${(c+0.5)*CELL}%` });
export const START_INDEX = { 0:'green', 13:'yellow', 26:'blue', 39:'red' };
export const STAR = new Set([8,21,34,47]);
export const START_ARROW = { green:'▸', yellow:'▾', blue:'◂', red:'▴' };
export const HOME_ARROW = { green:'▸', yellow:'▾', blue:'◂', red:'▴' };
export const GRID = '1px solid rgba(30,30,40,.45)';
export const PLAYER_SETS = { 2:[0,2], 3:[0,1,2], 4:[0,1,2,3] };
export const BASES = [
  { color:'green',  r0:0, c0:0 }, // top-left
  { color:'yellow', r0:0, c0:9 }, // top-right
  { color:'blue',   r0:9, c0:9 }, // bottom-right
  { color:'red',    r0:9, c0:0 }, // bottom-left
];

export const hexOf = id => LUDO_COLORS.find(c=>c.id===id).hex;
const clamp = v => Math.max(0,Math.min(255,v));
export function shade(hex,amt){
  const n=parseInt(hex.slice(1),16), r=n>>16&255, g=n>>8&255, b=n&255;
  const t=amt>0?255:0, p=Math.abs(amt)/100;
  const m=x=>clamp(Math.round(x+(t-x)*p));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
export const tokenBg = c => `radial-gradient(circle at 34% 28%, ${shade(c,62)}, ${c} 58%, ${shade(c,-28)})`;

// Absolute position/size for a token coin at grid (r,c) with stacking offset.
export const coinPos = (r,c,or=0,oc=0,z=100,canMove=false)=>({
  position:'absolute', top:`${(r+0.5+or)*CELL}%`, left:`${(c+0.5+oc)*CELL}%`, transform:'translate(-50%,-50%)',
  width:'5.9%', aspectRatio:'1', zIndex:z,
  animation:canMove?'coinpulse 1s ease-in-out infinite':'none', transition:'top .28s,left .28s',
});

// Screen-space particle burst using the global `confetti` keyframe.
export function spawnBurst(x,y,color){
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

// ── Turn state machine ──
export function nextActive(tokens, turn, active){
  const i=active.indexOf(turn);
  for(let k=1;k<=active.length;k++){
    const t=active[(i+k)%active.length];
    if(!playerFinished(tokens,t)) return t;
  }
  return turn;
}
export function setupState(){
  return { ...initLudo(), active:[0,1,2,3], turn:0, dice:null, moves:[], phase:'setup', sixes:0, msg:null, winner:null, evt:0 };
}
// Fresh playing state for `count` players.
export function newGame(count){
  const active = PLAYER_SETS[count] || PLAYER_SETS[4];
  return { ...initLudo(), active, turn:active[0], dice:null, moves:[], phase:'roll', sixes:0, msg:null, winner:null, evt:0 };
}
export function reducer(s,a){
  switch(a.type){
    case 'START': return { ...newGame(a.count), evt:s.evt+1 };
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
      const over = ranks.length>=s.active.length-1 || activeLeft<=1;
      if(over){
        const finalRanks=[...ranks];
        for(const p of s.active) if(!finalRanks.includes(p)) finalRanks.push(p);
        return { ...s, tokens, ranks:finalRanks, phase:'over', winner:finalRanks[0], moves:[], dice, captured:res.captured, evt:s.evt+1 };
      }
      const extra = (dice===6 || res.captured || res.finished) && !finishedAll;
      return {
        ...s, tokens, ranks, dice:null, moves:[], phase:'roll',
        turn: extra ? s.turn : nextActive(tokens,s.turn,s.active),
        sixes: extra ? s.sixes : 0,
        captured: res.captured, finishedTok: res.finished,
        msg: res.captured?'أكل الخصم! 🍽️':(res.finished?'وصل للبيت! 🏠':(extra?'دور إضافي 🎲':null)),
        evt:s.evt+1,
      };
    }
    case 'RESET': return { ...newGame(s.active.length===2?2:s.active.length), evt:s.evt+1 };
    case 'SETUP': return { ...setupState(), evt:s.evt+1 };
    case 'SYNC': return a.state;
    default: return s;
  }
}
