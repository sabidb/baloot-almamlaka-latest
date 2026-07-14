// ── Engagement / progression engine ──────────────────────
// Every reward here is earned by PLAYING — never by watching ads or videos.
// Pure functions: given a profile, return the patch to persist + UI events.

export function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function ydayStr(){ const d=new Date(Date.now()-86400000); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
export function weekStr(){ const d=new Date(); const jan1=new Date(d.getFullYear(),0,1); const w=Math.ceil((((d-jan1)/86400000)+jan1.getDay()+1)/7); return `${d.getFullYear()}-W${w}`; }

function baseProgress(){
  return {
    xp:0, level:1, streak:0, lastPlayDay:null, dailyClaimedDay:null,
    stats:{ gamesPlayed:0, winStreak:0, bestWinStreak:0, ludoWins:0, balootWins:0 },
    missions:null,
    week:null, weeklyGames:0, weeklyWins:0, weeklyClaimedWeek:null,
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

  // Weekly tally (resets each ISO week).
  const wk=weekStr();
  if(p.week!==wk){ p.week=wk; p.weeklyGames=0; p.weeklyWins=0; }
  p.weeklyGames++; if(won) p.weeklyWins++;

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

// ── Weekly reward: a performance bonus for the week's play, claimable once
// per ISO week (only if you've played). Scales with wins this week.
export function weeklyReward(wins){ return 100 + wins*40; }
export function weeklyStatus(profile){
  const p=withProgress(profile); const wk=weekStr();
  const games = p.week===wk ? p.weeklyGames : 0;
  const wins  = p.week===wk ? p.weeklyWins  : 0;
  return { games, wins, reward:weeklyReward(wins), claimed:p.weeklyClaimedWeek===wk, playable:games>0 };
}
export function claimWeekly(profile){
  const p=withProgress(profile); const wk=weekStr();
  if(p.weeklyClaimedWeek===wk) return null;
  if(p.week!==wk || p.weeklyGames<1) return { locked:true };
  const reward=weeklyReward(p.weeklyWins);
  p.weeklyClaimedWeek=wk;
  return { patch:{ progress:p, coins:(profile.coins||0)+reward }, reward };
}

// ── Achievements (milestones earned by playing) ──
const totalWins = pr => (pr.stats.balootWins||0)+(pr.stats.ludoWins||0);
export const ACHIEVEMENTS = [
  { id:'first_win', icon:'🥇', title:'الفوز الأول',  desc:'افز بأول مباراة',    goal:1,  coins:100,           metric:p=>totalWins(p) },
  { id:'games_20',  icon:'🎮', title:'مثابر',        desc:'العب ٢٠ مباراة',     goal:20, coins:150,           metric:p=>p.stats.gamesPlayed },
  { id:'wins_10',   icon:'🏆', title:'بطل صاعد',     desc:'١٠ انتصارات',        goal:10, coins:250, gems:1,   metric:p=>totalWins(p) },
  { id:'streak_5',  icon:'🔥', title:'لا يُقهر',      desc:'٥ انتصارات متتالية', goal:5,  coins:300, gems:1,   metric:p=>p.stats.bestWinStreak },
  { id:'ludo_10',   icon:'🎲', title:'سيد اللودو',   desc:'١٠ انتصارات لودو',   goal:10, coins:300,           metric:p=>p.stats.ludoWins },
  { id:'baloot_10', icon:'🃏', title:'صقر البلوت',   desc:'١٠ انتصارات بلوت',   goal:10, coins:300,           metric:p=>p.stats.balootWins },
  { id:'level_10',  icon:'⭐', title:'خبير',         desc:'بلوغ المستوى ١٠',    goal:10, coins:500, gems:2,   metric:p=>p.level },
  { id:'daily_7',   icon:'📅', title:'مواظب',        desc:'سلسلة ٧ أيام',       goal:7,  coins:400, gems:2,   metric:p=>p.streak },
  { id:'wins_50',   icon:'👑', title:'ملك الطاولة',  desc:'٥٠ انتصار',          goal:50, coins:1000,gems:5,   metric:p=>totalWins(p) },
];
export function achievementList(profile){
  const p=withProgress(profile); const claimed=new Set(profile.achClaimed||[]);
  return ACHIEVEMENTS.map(a=>{ const value=Math.min(a.metric(p),a.goal); const done=value>=a.goal;
    return { ...a, value, done, claimed:claimed.has(a.id) }; });
}
export function claimAchievement(profile, id){
  const a=ACHIEVEMENTS.find(x=>x.id===id); if(!a) return null;
  const p=withProgress(profile); const claimed=profile.achClaimed||[];
  if(claimed.includes(id) || a.metric(p)<a.goal) return null;
  return { patch:{ achClaimed:[...claimed,id], coins:(profile.coins||0)+a.coins, gems:(profile.gems||0)+(a.gems||0) }, reward:a.coins, gems:a.gems||0 };
}
