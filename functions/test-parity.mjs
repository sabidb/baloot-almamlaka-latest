// Parity: functions/rewards.js (server, CJS) must equal src/progress.js
// (client, ESM) for every reward op. Run:
//   node --experimental-loader ../_loader.mjs functions/test-parity.mjs
// (the loader resolves src/progress.js's extensionless imports)
import { createRequire } from 'node:module';
import * as client from '../src/progress.js';
const require = createRequire(import.meta.url);
const server = require('./rewards.js');

const eq = (a,b)=>JSON.stringify(a)===JSON.stringify(b);
let pass=0, fail=0; const bad=[];
const check=(name,a,b)=>{ if(eq(a,b)) pass++; else { fail++; bad.push({name, client:a, server:b}); } };

// deterministic-ish random profiles
function mulberry(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function makeProfile(r){
  const lvl=1+Math.floor(r()*12);
  const prog = r()<0.3 ? undefined : {
    xp:Math.floor(r()*300), level:lvl, streak:Math.floor(r()*9),
    lastPlayDay: r()<0.5 ? client.todayStr() : (r()<0.5?null:'2000-1-1'),
    dailyClaimedDay: r()<0.3 ? client.todayStr() : null,
    stats:{ gamesPlayed:Math.floor(r()*60), winStreak:Math.floor(r()*7), bestWinStreak:Math.floor(r()*12),
            ludoWins:Math.floor(r()*15), balootWins:Math.floor(r()*15) },
    missions: r()<0.5 ? client.makeMissions(client.todayStr()) : null,
    week: r()<0.6 ? client.weekStr() : null, weeklyGames:Math.floor(r()*10), weeklyWins:Math.floor(r()*6),
    weeklyClaimedWeek: r()<0.3 ? client.weekStr() : null,
  };
  // advance some missions so claims are exercised
  if(prog && prog.missions && r()<0.6) prog.missions.items.forEach(m=>{ m.progress=m.goal; });
  return { uid:'u', coins:Math.floor(r()*5000), gems:Math.floor(r()*20),
           wins:Math.floor(r()*40), losses:Math.floor(r()*40), ludoWins:Math.floor(r()*20),
           achClaimed: r()<0.3 ? ['first_win'] : [], progress:prog };
}

const rnd=mulberry(12345);
for(let i=0;i<4000;i++){
  const prof=makeProfile(rnd);
  const game = rnd()<0.5?'ludo':'baloot';
  const won  = rnd()<0.5;
  check('game', client.applyGameResult(structuredClone(prof),{game,won}), server.runReferee(structuredClone(prof),'game',{game,won}));
  check('daily', client.claimDaily(structuredClone(prof)), server.runReferee(structuredClone(prof),'claimDaily'));
  check('weekly', client.claimWeekly(structuredClone(prof)), server.runReferee(structuredClone(prof),'claimWeekly'));
  const mid = (prof.progress&&prof.progress.missions&&prof.progress.missions.items[0]&&prof.progress.missions.items[0].id)||'play3';
  check('mission', client.claimMission(structuredClone(prof),mid), server.runReferee(structuredClone(prof),'claimMission',{id:mid}));
  for(const aid of ['first_win','wins_10','level_10','wins_50','daily_7'])
    check('ach:'+aid, client.claimAchievement(structuredClone(prof),aid), server.runReferee(structuredClone(prof),'claimAchievement',{id:aid}));
}
console.log(`${pass} checks passed, ${fail} failed`);
if(fail){ console.log(JSON.stringify(bad.slice(0,4),null,2)); process.exit(1); }
