// Shared Baloot round/match reducer — used by the local GameScreen and the
// online table. Turn-based and seat-agnostic. Card matching is by `id` so it
// survives JSON serialization (Firestore / BroadcastChannel).
import { buildDeck, shuffle, dealHands, trickWinner, trickPoints, calcResult } from './GameLogic';

export const RANKSAR = { A:'أ', K:'ك', Q:'ق', J:'ج', '10':'١٠', '9':'٩', '8':'٨', '7':'٧' };
export const TARGET = 152;

// ── Card rehydration ──────────────────────────────────────────────
// The dealBaloot Cloud Function emits compact cards `{r,s,id}` (JSON-light,
// CSPRNG-dealt). The client engine needs full card objects
// (`{suit:{...},rank:{...},id}`) for rendering and legal-move logic. Because
// every card's `id` is `rank.symbol+suit.symbol` on both sides, we rehydrate
// by id from a canonical deck. Full client cards pass through untouched, so
// this is a safe no-op for the client-authoritative path.
const _byId = (()=>{ const m={}; for(const c of buildDeck()) m[c.id]=c; return m; })();
export function hydrateCard(c){
  if(!c) return c;
  if(c.suit && c.rank) return c;      // already a full client card
  return _byId[c.id] || c;            // compact {r,s,id} → full card
}
export function hydrateHand(h){ return Array.isArray(h) ? h.map(hydrateCard) : h; }
// Rehydrate every card inside a (possibly server-dealt) state: hands + trick.
export function hydrateState(s){
  if(!s) return s;
  const hands = Array.isArray(s.hands) ? s.hands.map(hydrateHand) : s.hands;
  const trick = Array.isArray(s.trick) ? s.trick.map(p=>({ ...p, card:hydrateCard(p.card) })) : s.trick;
  return { ...s, hands, trick };
}

export function freshRound(dealer){
  const {h0,h1,h2,h3}=dealHands(shuffle(buildDeck()));
  return {
    phase:'bidding', dealer, hands:[h0,h1,h2,h3],
    contract:null, bidTurn:(dealer+1)%4, passCount:0,
    turn:(dealer+1)%4, trick:[], roundScores:[0,0], tricksWon:[0,0],
    lastWinner:null, roundResult:null,
  };
}
export function initGame(){
  return { ...freshRound(Math.floor(Math.random()*4)), matchScores:[0,0], evt:0, banner:null };
}

export function gameReducer(s,a){
  switch(a.type){
    case 'BID':{
      const bid=a.payload;
      if(bid.type==='pass'){
        const pc=s.passCount+1;
        if(pc>=4) return { ...freshRound(s.dealer), matchScores:s.matchScores, evt:s.evt+1, banner:'طوشة! توزيع جديد 🔄' };
        // Bump evt every action so the online turn engine (which re-runs on
        // evt and dedupes by it, like Ludo) advances through each bid.
        return { ...s, passCount:pc, bidTurn:(s.bidTurn+1)%4, evt:s.evt+1, banner:null };
      }
      const contract={ type:bid.type, trump:bid.trump||null, trumpName:bid.trumpName||null, bidTeam:s.bidTurn%2 };
      return { ...s, contract, phase:'playing', turn:(s.dealer+1)%4, trick:[], evt:s.evt+1,
        banner: bid.type==='sun' ? 'صن ☀️ — بدأت الجولة' : `الحكم على ${bid.trumpName||''} ${bid.trump||''}` };
    }
    case 'PLAY':{
      const turn=s.turn, card=a.payload;
      const hands=s.hands.map((h,i)=> i===turn ? h.filter(c=>c.id!==card.id) : h);
      const trick=[...s.trick,{player:turn,card}];
      // evt bumps every play so the online engine re-runs and dedupes per
      // action (see BID); banner cleared so the local banner toast (keyed on
      // evt) shows once, not on every card.
      if(trick.length<4) return { ...s, hands, trick, turn:(turn+1)%4, evt:s.evt+1, banner:null };
      return { ...s, hands, trick, evt:s.evt+1, banner:null }; // trick full — effect triggers RESOLVE
    }
    case 'RESOLVE':{
      const mode=s.contract.type, trump=s.contract.trump;
      const w=trickWinner(s.trick,mode,trump), team=w.player%2;
      // Last trick = the 8th. Counting resolved tricks works whether or not
      // hands are visible (server-dealt online hides human hands, so the old
      // hands-empty check would misfire with 4 human players).
      const isLast=(s.tricksWon[0]+s.tricksWon[1])===7;
      let pts=trickPoints(s.trick,mode,trump); if(isLast) pts+=10; // آخر ديّة
      const roundScores=[...s.roundScores]; roundScores[team]+=pts;
      const tricksWon=[...s.tricksWon]; tricksWon[team]++;
      const base={ ...s, trick:[], roundScores, tricksWon, turn:w.player, lastWinner:w.player, evt:s.evt+1, banner:null };
      if(!isLast) return base;
      const res=calcResult(roundScores,s.contract);
      const matchScores=[...s.matchScores];
      matchScores[s.contract.bidTeam]   += res.bidTeamFinal;
      matchScores[1-s.contract.bidTeam] += res.oppTeamFinal;
      const over=Math.max(...matchScores)>=TARGET;
      return { ...base, phase:over?'gameOver':'roundOver', roundResult:res, matchScores };
    }
    case 'NEXT_ROUND':
      return { ...freshRound((s.dealer+1)%4), matchScores:s.matchScores, evt:s.evt+1, banner:null };
    case 'RESET':
      return initGame();
    case 'SYNC':
      return a.state;
    default: return s;
  }
}
