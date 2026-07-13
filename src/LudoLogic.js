// ── Ludo Mamlaka — engine (classic rules, original implementation) ──
// Board model: a 15×15 grid. A 52-cell shared ring, four 6-cell home
// columns, four corner yards, centre finish. Token progress `rel`:
//   -1        = in yard
//   0..50     = on the ring (0 = own start square)
//   51..56    = own home column (56 = finished / centre)

export const LUDO_COLORS = [
  { id:'red',    name:'الأحمر', hex:'#E74C3C', start:0  },
  { id:'green',  name:'الأخضر', hex:'#27AE60', start:13 },
  { id:'yellow', name:'الأصفر', hex:'#F0C040', start:26 },
  { id:'blue',   name:'الأزرق', hex:'#3498DB', start:39 },
];

// 52 ring cells [row,col], clockwise. Index 0 = red's start square.
export const RING = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],
  [6,0],
];

// Home columns (6 cells each), from ring entrance toward the centre.
export const HOME_PATHS = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  blue:   [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
};

// Four token slots inside each corner yard (fractional grid coords).
export const YARD = {
  red:    [[1.5,1.5],[1.5,3.5],[3.5,1.5],[3.5,3.5]],
  green:  [[1.5,10.5],[1.5,12.5],[3.5,10.5],[3.5,12.5]],
  yellow: [[10.5,10.5],[10.5,12.5],[12.5,10.5],[12.5,12.5]],
  blue:   [[10.5,1.5],[10.5,3.5],[12.5,1.5],[12.5,3.5]],
};

export const CENTER = [7,7];
// Safe cells: the four start squares + four star squares (start+8).
export const SAFE = new Set([0,8,13,21,26,34,39,47]);
export const FINISH = 56;

export function absRing(playerIdx, rel){
  return (rel>=0 && rel<=50) ? (LUDO_COLORS[playerIdx].start + rel) % 52 : null;
}
// Grid cell [row,col] for a token, or null if in yard.
export function tokenCell(playerIdx, rel, tokenIdx){
  if(rel<0) return YARD[LUDO_COLORS[playerIdx].id][tokenIdx];
  if(rel<=50) return RING[(LUDO_COLORS[playerIdx].start + rel) % 52];
  if(rel<FINISH) return HOME_PATHS[LUDO_COLORS[playerIdx].id][rel-51];
  return CENTER;
}

export function initLudo(){
  return {
    tokens: [ [-1,-1,-1,-1], [-1,-1,-1,-1], [-1,-1,-1,-1], [-1,-1,-1,-1] ],
    ranks: [], // player indices in finishing order
  };
}

// Token indices this player may legally move with `dice`.
export function movableTokens(tokens, playerIdx, dice){
  const out=[];
  tokens[playerIdx].forEach((rel,i)=>{
    if(rel===FINISH) return;
    if(rel<0){ if(dice===6) out.push(i); return; }
    if(rel+dice<=FINISH) out.push(i);
  });
  return out;
}

// Apply a move, returning new tokens + flags. Pure.
export function applyMove(tokens, playerIdx, tokenIdx, dice){
  const next=tokens.map(a=>[...a]);
  let rel=next[playerIdx][tokenIdx];
  rel = rel<0 ? 0 : rel+dice;
  next[playerIdx][tokenIdx]=rel;
  const finished = rel===FINISH;
  let captured=false;
  const abs=absRing(playerIdx,rel);
  if(abs!=null && !SAFE.has(abs)){
    for(let p=0;p<4;p++){
      if(p===playerIdx) continue;
      next[p].forEach((r,i)=>{ if(absRing(p,r)===abs){ next[p][i]=-1; captured=true; } });
    }
  }
  return { tokens:next, captured, finished };
}

export function playerFinished(tokens, playerIdx){
  return tokens[playerIdx].every(r=>r===FINISH);
}

// Bot heuristic: capture > finish > leave yard > advance, prefer safe.
export function botPickToken(tokens, playerIdx, dice, moves){
  let best=moves[0], bestScore=-Infinity;
  for(const i of moves){
    const rel=tokens[playerIdx][i];
    const res=applyMove(tokens,playerIdx,i,dice);
    let score=0;
    if(res.captured) score+=100;
    if(res.finished) score+=80;
    if(rel<0) score+=45;
    const newRel = rel<0 ? 0 : rel+dice;
    score += newRel*0.6;
    const abs=absRing(playerIdx,newRel);
    if(abs!=null && SAFE.has(abs)) score+=12;
    if(score>bestScore){ bestScore=score; best=i; }
  }
  return best;
}

export function rollDie(){ return 1 + Math.floor(Math.random()*6); }
