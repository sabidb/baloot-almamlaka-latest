// ── Engagement / progression engine ──────────────────────
// Every reward here is earned by PLAYING — never by watching ads or videos.
// Pure functions: given a profile, return the patch to persist + UI events.

export function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function ydayStr(){ const d=new Date(Date.now()-86400000); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }

function baseProgress(){
  return {
    xp:0, level:1, streak:0, lastPlayDay:null, dailyClaimedDay:null,
    stats:{ gamesPlayed:0, winStreak:0, bestWinStreak:0, ludoWins:0, balootWins:0 },
    missions:null,
  };
}
export function withProgress(profile){
  const p = { ...baseProgress(), ...(profile?.progress||{}) };
  p.stats = { ...baseProgress().stats, ...(p.stats||{}) };
  return p;
}

// XP to advance FROM `level` to the next — a gentle curve.
export function xpForLevel(level){ return 80 + level*40; }
export function levelBar(profile){
  const p = withProgress(profile);
  const need = xpForLevel(p.level);
  return { level:p.level, xp:p.xp, need, pct: Math.max(0,Math.min(1, p.xp/need)) };
}

// ── Daily missions ──
const MISSION_POOL = [
  { id:'play3',   type:'play',        goal:3, reward:60,  label:'العب ٣ مباريات',   icon:'🎮' },
  { id:'play5',   type:'play',        goal:5, reward:120, label:'العب ٥ مباريات',   icon:'🎯' },
  { id:'win1',    type:'win',         goal:1, reward:80,  label:'افز بمباراة',       icon:'🏆' },
  { id:'win2',    type:'win',         goal:2, reward:150, label:'افز بمباراتين',     icon:'🔥' },
  { id:'ludo1',   type:'ludo_win',    goal:1, reward:100, label:'افز بلعبة لودو',    icon:'🎲' },
  { id:'baloot1', type:'baloot_win',  goal:1, reward:100, label:'افز بجولة بلوت',    icon:'🃏' },
];
function seededPick(day, n){
  let seed=[...day].reduce((a,c)=>a+c.charCodeAt(0),7);
  const arr=[...MISSION_POOL], out=[];
  for(let i=0;i<n && arr.length;i++){ seed=(seed*9301+49297)%233280; out.push(arr.splice(seed%arr.length,1)[0]); }
  return out;
}
export function makeMissions(day){
  return { day, items: seededPick(day,3).map(m=>({ ...m, progress:0, claimed:false })) };
}
function ensureMissions(p){
  const t=todayStr();
  if(!p.missions || p.missions.day!==t) p.missions = makeMissions(t);
  return p;
}
export function getMissions(profile){ const p=withProgress(profile); ensureMissions(p); return p.missions; }

// Daily reward: escalates with your play streak; unlocked only after you've
// played a game today. Loss-aversion streak keeps players coming back.
export function dailyReward(streak){ return Math.min(50 + Math.max(0,streak-1)*25, 300); }
export function dailyStatus(profile){
  const p=withProgress(profile); const t=todayStr();
  return { streak:p.streak, playedToday:p.lastPlayDay===t, claimed:p.dailyClaimedDay===t, reward:dailyReward(p.streak||1) };
}
export function claimDaily(profile){
  const p=withProgress(profile); const t=todayStr();
  if(p.dailyClaimedDay===t) return null;
  if(p.lastPlayDay!==t) return { locked:true };
  const reward=dailyReward(p.streak);
  p.dailyClaimedDay=t;
  return { patch:{ progress:p, coins:(profile.coins||0)+reward }, reward };
}
export function claimMission(profile, id){
  const p=withProgress(profile); ensureMissions(p);
  const m=p.missions.items.find(x=>x.id===id);
  if(!m || m.claimed || m.progress<m.goal) return null;
  m.claimed=true;
  return { patch:{ progress:p, coins:(profile.coins||0)+m.reward }, reward:m.reward };
}

// Called at the end of every game. Returns { patch, toasts }.
export function applyGameResult(profile, { game, won }){
  const p=withProgress(profile); ensureMissions(p);
  const toasts=[];

  p.stats.gamesPlayed++;
  if(won){ p.stats.winStreak++; p.stats.bestWinStreak=Math.max(p.stats.bestWinStreak,p.stats.winStreak);
    if(game==='ludo') p.stats.ludoWins++; else p.stats.balootWins++; }
  else p.stats.winStreak=0;

  // Daily play streak (once per calendar day).
  const t=todayStr();
  if(p.lastPlayDay!==t){
    p.streak = (p.lastPlayDay===ydayStr()) ? (p.streak||0)+1 : 1;
    p.lastPlayDay=t;
    toasts.push({ type:'streak', value:p.streak });
  }

  // XP (+ win-streak bonus) and coins.
  let coins = won ? (game==='ludo'?60:50) : 8;
  let gain = won ? 55 : 18;
  if(won) gain += Math.min(p.stats.winStreak-1,5)*8;
  p.xp += gain;
  let gems=0;
  while(p.xp >= xpForLevel(p.level)){ p.xp -= xpForLevel(p.level); p.level++; coins += p.level*40; if(p.level%5===0) gems++; toasts.push({ type:'levelup', value:p.level }); }

  // Missions.
  for(const m of p.missions.items){ if(m.claimed) continue;
    if(m.type==='play') m.progress++;
    else if(m.type==='win' && won) m.progress++;
    else if(m.type==='ludo_win' && won && game==='ludo') m.progress++;
    else if(m.type==='baloot_win' && won && game==='baloot') m.progress++;
    if(m.progress>m.goal) m.progress=m.goal;
    if(m.progress>=m.goal) toasts.push({ type:'mission', label:m.label });
  }

  const patch = { progress:p, coins:(profile.coins||0)+coins, gems:(profile.gems||0)+gems };
  if(won) patch.wins=(profile.wins||0)+1; else patch.losses=(profile.losses||0)+1;
  if(won && game==='ludo') patch.ludoWins=(profile.ludoWins||0)+1;
  return { patch, toasts, coins, gems };
}
