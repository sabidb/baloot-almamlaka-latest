// ── Game Logic & Bot ──────────────────────────────────────
export const SUITS = [
  { symbol:'♠', name:'بستوني', color:'#0A0F0A', isRed:false },
  { symbol:'♥', name:'كبة',    color:'#C0392B', isRed:true  },
  { symbol:'♦', name:'ديناري', color:'#C0392B', isRed:true  },
  { symbol:'♣', name:'جاروني', color:'#0A0F0A', isRed:false },
];
export const RANKS = [
  { symbol:'A',  nameAr:'إيس',  hokumPlain:11, hokumTrump:11, sun:11 },
  { symbol:'K',  nameAr:'كينق', hokumPlain:4,  hokumTrump:4,  sun:4  },
  { symbol:'Q',  nameAr:'بنت',  hokumPlain:3,  hokumTrump:3,  sun:3  },
  { symbol:'J',  nameAr:'جاك',  hokumPlain:2,  hokumTrump:20, sun:2  },
  { symbol:'10', nameAr:'١٠',   hokumPlain:10, hokumTrump:10, sun:10 },
  { symbol:'9',  nameAr:'٩',    hokumPlain:0,  hokumTrump:14, sun:0  },
  { symbol:'8',  nameAr:'٨',    hokumPlain:0,  hokumTrump:0,  sun:0  },
  { symbol:'7',  nameAr:'٧',    hokumPlain:0,  hokumTrump:0,  sun:0  },
];
export const HOKUM_TRUMP_ORDER = ['J','9','A','10','K','Q','8','7'];
export const PLAIN_ORDER       = ['A','10','K','Q','J','9','8','7'];
export const TEAM_COLORS = ['#C9A84C', '#2E86C1'];
export const AVATARS = ['🧔','👲','🧕','👳','🧑','👩','👨','👧'];
export const CITIES = ['كل المدن','الرياض','جدة','الدمام','مكة','المدينة','أبها','تبوك'];
export const REACTIONS = ['👏','🔥','😤','🤣','☕','🃏','👑','💪'];

export const DECK_THEMES = {
  classic:  { name:'كلاسيك',        bg:'#fff',    border:'#ddd',    cost:0,   owned:true  },
  heritage: { name:'التراث السعودي', bg:'#fff8e8', border:'#C9A84C', cost:500, owned:false },
  desert:   { name:'الصحراء الذهبية',bg:'#fffbe6', border:'#8B6914', cost:800, owned:false },
  ramadan:  { name:'رمضان كريم 🌙',  bg:'#0a0620', border:'#6040C0', cost:300, owned:false },
  royal:    { name:'ملكي',           bg:'#0a0a1a', border:'#4040C0', cost:1000,owned:false },
};
export const TABLE_THEMES = {
  classic:  { name:'الكلاسيك',     felt:'#0D4A2A', cost:0   },
  midnight: { name:'منتصف الليل',  felt:'#0a0a2a', cost:400 },
  ramadan:  { name:'رمضان 🌙',     felt:'#1a0a40', cost:300 },
  desert:   { name:'الصحراء',      felt:'#2a1a00', cost:600 },
  royal:    { name:'الملكي',       felt:'#1a0020', cost:800 },
};
export const STORE_ITEMS = {
  decks: [
    { id:'heritage', name:'التراث السعودي', desc:'نقوش هندسية مستوحاة من التراث السعودي', cost:500, badge:'hot',      emoji:'🕌' },
    { id:'desert',   name:'الصحراء الذهبية',desc:'ألوان الرمال الذهبية — حصري',            cost:800, badge:'new',      emoji:'🏜️' },
    { id:'ramadan',  name:'رمضان كريم 🌙',  desc:'ثيم رمضاني حصري — متوفر موسمياً',       cost:300, badge:'seasonal', emoji:'🌙' },
    { id:'royal',    name:'الملكي الداكن',  desc:'تصميم ملكي فاخر بألوان الليل',           cost:1000,badge:'vip',      emoji:'👑' },
  ],
  tables: [
    { id:'midnight', name:'منتصف الليل',    desc:'طاولة داكنة فاخرة',                      cost:400, badge:'hot',      emoji:'🌃' },
    { id:'ramadan',  name:'رمضان 🌙',       desc:'طاولة رمضانية بنجوم وهلال',              cost:300, badge:'seasonal', emoji:'🌙' },
    { id:'desert',   name:'الصحراء',        desc:'طاولة بألوان الرمال الدافئة',             cost:600, badge:'new',      emoji:'🏜️' },
    { id:'royal',    name:'الملكي الأرجواني',desc:'أفخم طاولة في اللعبة',                  cost:800, badge:'vip',      emoji:'💜' },
  ],
  reactions: [
    { id:'fire_pack',   name:'حزمة النار 🔥',  desc:'٥ ردود فعل نارية متحركة', cost:200, badge:'hot',      emoji:'🔥' },
    { id:'royal_pack',  name:'حزمة الملكية 👑', desc:'ردود فعل ملكية فاخرة',   cost:400, badge:'vip',      emoji:'👑' },
    { id:'ramadan_pack',name:'حزمة رمضان 🌙',  desc:'هلال وفانوس ونجوم',       cost:200, badge:'seasonal', emoji:'🌙' },
    { id:'coffee_pack', name:'حزمة القهوة ☕',  desc:'ردود فعل القهوة العربية', cost:150, badge:'new',      emoji:'☕' },
  ],
  coins: [
    { id:'coins_500',  name:'حزمة ٥٠٠ رصيد',  desc:'رصيد للمتجر والبطولات',          coins:500,  price:10, emoji:'🪙' },
    { id:'coins_1500', name:'حزمة ١٥٠٠ رصيد', desc:'قيمة أعلى — وفّر ٥ ريال',        coins:1500, price:25, emoji:'💰' },
    { id:'coins_5000', name:'حزمة ٥٠٠٠ رصيد', desc:'للاعب الجاد — رصيد لأشهر',       coins:5000, price:75, emoji:'🏆', best:true },
  ],
};

export function buildDeck() {
  const d=[];
  for(const suit of SUITS) for(const rank of RANKS)
    d.push({suit,rank,id:`${rank.symbol}${suit.symbol}`});
  return d;
}
export function shuffle(deck) {
  const d=[...deck];
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}
export function dealHands(deck) {
  return{h0:deck.slice(0,8),h1:deck.slice(8,16),h2:deck.slice(16,24),h3:deck.slice(24,32)};
}
export function getHands(gd){return[gd.h0||[],gd.h1||[],gd.h2||[],gd.h3||[]];}
export function cardValue(card,mode,trump){
  if(!card)return 0;if(mode==='sun')return card.rank.sun;
  return card.suit.symbol===trump?card.rank.hokumTrump:card.rank.hokumPlain;
}
export function cardStrength(card,mode,trump){
  const isTrump=mode==='hokum'&&card.suit.symbol===trump;
  const order=isTrump?HOKUM_TRUMP_ORDER:PLAIN_ORDER;
  return isTrump?100+(order.length-order.indexOf(card.rank.symbol)):order.length-order.indexOf(card.rank.symbol);
}
export function trickWinner(plays,mode,trump){
  const ledSuit=plays[0].card.suit.symbol;
  return plays.reduce((best,cur)=>{
    const bT=mode==='hokum'&&best.card.suit.symbol===trump;
    const cT=mode==='hokum'&&cur.card.suit.symbol===trump;
    if(cT&&!bT)return cur;if(bT&&!cT)return best;
    if(!cT&&cur.card.suit.symbol!==ledSuit)return best;
    if(!bT&&best.card.suit.symbol!==ledSuit)return cur;
    return cardStrength(cur.card,mode,trump)>cardStrength(best.card,mode,trump)?cur:best;
  });
}
export function calcResult(roundScores,contract){
  const{type,bidTeam}=contract;
  const bidScore=roundScores[bidTeam],oppScore=roundScores[1-bidTeam],total=bidScore+oppScore;
  const isGahwa=oppScore===0;
  if(type==='sun'){const made=bidScore>oppScore;return{made,isGahwa,bidTeamFinal:made?total*2:0,oppTeamFinal:made?0:total*2,reason:made?(isGahwa?'☕ صن + قهوة!':'☀️ صن نجح!'):'☀️ صن فشل!'};}
  if(isGahwa)return{made:true,isGahwa:true,bidTeamFinal:total*2,oppTeamFinal:0,reason:'☕ قهوة! ضعف النقاط!'};
  const made=bidScore>=82;
  return{made,isGahwa:false,bidTeamFinal:made?bidScore:0,oppTeamFinal:made?oppScore:total,reason:made?`✅ حكم نجح! (${bidScore}≥82)`:`❌ حكم فشل!`};
}
export function botPickCard(hand,trickPlays,mode,trump){
  const ledSuit=trickPlays.length>0?trickPlays[0].card.suit.symbol:null;
  if(ledSuit){
    const following=hand.filter(c=>c.suit.symbol===ledSuit);
    if(following.length>0)return following.sort((a,b)=>cardStrength(b,mode,trump)-cardStrength(a,mode,trump))[0];
    const trumpCards=hand.filter(c=>c.suit.symbol===trump&&mode==='hokum');
    if(trumpCards.length>0)return trumpCards.sort((a,b)=>cardStrength(b,mode,trump)-cardStrength(a,mode,trump))[0];
  }
  return[...hand].sort((a,b)=>cardValue(a,mode,trump)-cardValue(b,mode,trump))[0];
}
export function botBid(hand,passCount){
  let bestSuit=null,bestScore=0;
  for(const suit of SUITS){
    const sc=hand.filter(c=>c.suit.symbol===suit.symbol).reduce((s,c)=>{
      if(c.rank.symbol==='J')return s+5;if(c.rank.symbol==='9')return s+4;if(c.rank.symbol==='A')return s+3;return s+1;
    },0);
    if(sc>bestScore){bestScore=sc;bestSuit=suit;}
  }
  if(bestScore>=6||passCount>=2)return{type:'hokum',trump:bestSuit.symbol,trumpName:bestSuit.name};
  return{type:'pass'};
}
export function genCode(){return Math.floor(100000+Math.random()*900000).toString();}
// ── Audio: shared AudioContext, foley + Majlis ambience ───
// NOTE: real deployments should swap these synthesized cues for the
// high-fidelity clips in the spec (§2). This keeps the wiring identical.
let _actx=null, _muted=false;
function ctx(){
  if(_muted) return null;
  try{
    if(!_actx) _actx=new (window.AudioContext||window.webkitAudioContext)();
    if(_actx.state==='suspended') _actx.resume();
    return _actx;
  }catch{ return null; }
}
export function setMuted(m){ _muted=!!m; if(_muted) stopAmbience(); }
export function isMuted(){ return _muted; }

export function playTone(freq,vol=0.1,type='sine'){
  const c=ctx(); if(!c) return;
  try{
    const freqs=Array.isArray(freq)?freq:[freq];
    freqs.forEach((f,i)=>{
      const osc=c.createOscillator(),gain=c.createGain();
      osc.connect(gain);gain.connect(c.destination);
      osc.type=type;osc.frequency.value=f;
      gain.gain.setValueAtTime(vol,c.currentTime+i*0.12);
      gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+i*0.12+0.15);
      osc.start(c.currentTime+i*0.12);osc.stop(c.currentTime+i*0.12+0.15);
    });
  }catch{ /* ignore */ }
}
// Short filtered-noise burst — the basis for card 'snap' and 'shuffle'.
function noise(dur=0.09,vol=0.14,{hp=800,lp=6000}={}){
  const c=ctx(); if(!c) return;
  try{
    const n=Math.floor(c.sampleRate*dur), buf=c.createBuffer(1,n,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n); // decaying
    const src=c.createBufferSource(); src.buffer=buf;
    const hpF=c.createBiquadFilter(); hpF.type='highpass'; hpF.frequency.value=hp;
    const lpF=c.createBiquadFilter(); lpF.type='lowpass';  lpF.frequency.value=lp;
    const g=c.createGain(); g.gain.value=vol;
    src.connect(hpF); hpF.connect(lpF); lpF.connect(g); g.connect(c.destination);
    src.start();
  }catch{ /* ignore */ }
}
export const sounds={
  shuffle:()=>{ noise(0.28,0.10,{hp:1200,lp:5000}); },     // deck slide/shuffle
  deal:  ()=>{ noise(0.06,0.10,{hp:1500,lp:7000}); },       // single card slide
  play:  ()=>{ noise(0.05,0.16,{hp:2000,lp:9000}); },       // crisp card 'snap'
  trick: ()=>playTone([660,880],0.06,'sine'),               // trick pickup
  win:   ()=>playTone([523,659,784],0.15,'sine'),           // round chime
  gahwa: ()=>playTone([784,659,523,659,784],0.2,'triangle'),// coffee! double
  tick:  ()=>playTone(880,0.05,'square'),
  buy:   ()=>playTone([523,659],0.1,'sine'),
  // ── Ludo foley ──
  dice:  ()=>{ noise(0.12,0.12,{hp:800,lp:5000}); setTimeout(()=>noise(0.10,0.10,{hp:800,lp:5000}),90); setTimeout(()=>noise(0.08,0.08,{hp:800,lp:5000}),180); },
  hop:   ()=>playTone(760,0.05,'sine'),                     // token step
  capture:()=>playTone([320,190,120],0.16,'sawtooth'),      // knock a token out
  home:  ()=>playTone([523,784,1046],0.14,'sine'),          // token reaches home
};

// Low-volume, low-pass Majlis ambience: a warm drone + coffee-shop hiss.
let _amb=null;
export function startAmbience(){
  if(_muted||_amb) return;
  const c=ctx(); if(!c) return;
  try{
    const master=c.createGain(); master.gain.value=0.05; master.connect(c.destination);
    const oscs=[110,164.81,220].map(f=>{
      const o=c.createOscillator(); o.type='sine'; o.frequency.value=f;
      const g=c.createGain(); g.gain.value=0.4; o.connect(g); g.connect(master); o.start(); return o;
    });
    const n=2*c.sampleRate, buf=c.createBuffer(1,n,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*0.12;
    const src=c.createBufferSource(); src.buffer=buf; src.loop=true;
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420;
    const ng=c.createGain(); ng.gain.value=0.35;
    src.connect(lp); lp.connect(ng); ng.connect(master); src.start();
    _amb={master,oscs,src};
  }catch{ /* ignore */ }
}
export function stopAmbience(){
  if(!_amb) return;
  try{ _amb.oscs.forEach(o=>o.stop()); _amb.src.stop(); }catch{ /* ignore */ }
  _amb=null;
}

// ── Legal move enforcement (Baloot rules) ─────────────────
// Must-follow-suit; in hokum must cut with trump when void, and
// must over-trump a trump already on the table when able.
export function legalPlays(hand, trick, mode, trump){
  if(!trick || trick.length===0) return [...hand];
  const led = trick[0].card.suit.symbol;
  const following = hand.filter(c=>c.suit.symbol===led);
  const trumpsInTrick = trick.filter(p=>p.card.suit.symbol===trump);
  const highestTrump = trumpsInTrick.length
    ? Math.max(...trumpsInTrick.map(p=>cardStrength(p.card,mode,trump))) : -1;
  if(following.length){
    // Following a trump lead: must raise above the highest trump if possible.
    if(mode==='hokum' && led===trump && trumpsInTrick.length){
      const higher = following.filter(c=>cardStrength(c,mode,trump)>highestTrump);
      if(higher.length) return higher;
    }
    return following;
  }
  // Void in led suit
  if(mode==='hokum'){
    const trumps = hand.filter(c=>c.suit.symbol===trump);
    if(trumps.length){
      if(trumpsInTrick.length){
        const higher = trumps.filter(c=>cardStrength(c,mode,trump)>highestTrump);
        if(higher.length) return higher; // must over-trump when able
      }
      return trumps; // otherwise must still cut with a trump
    }
  }
  return [...hand]; // sun mode void, or no trump in hand → free
}

// Would card `c`, played by seat `myIndex`, win the current partial trick?
export function wouldWin(c, trick, myIndex, mode, trump){
  const t=[...trick,{player:myIndex,card:c}];
  return trickWinner(t,mode,trump).card===c;
}

// ── Improved bot: play legal, cooperate with partner, win cheaply ──
export function botChoose(hand, trick, mode, trump, myIndex){
  const legal=legalPlays(hand,trick,mode,trump);
  if(legal.length===1) return legal[0];
  const byValueAsc=[...legal].sort((a,b)=>cardValue(a,mode,trump)-cardValue(b,mode,trump));
  const byStrengthDesc=[...legal].sort((a,b)=>cardStrength(b,mode,trump)-cardStrength(a,mode,trump));
  if(!trick || trick.length===0) return byStrengthDesc[0]; // lead strong
  const winning=trickWinner(trick,mode,trump);
  const partnerWinning=(winning.player%2)===(myIndex%2);
  if(partnerWinning) return byValueAsc[0]; // partner has it — dump lowest value
  const winners=legal.filter(c=>wouldWin(c,trick,myIndex,mode,trump));
  if(winners.length) return winners.sort((a,b)=>cardValue(a,mode,trump)-cardValue(b,mode,trump))[0];
  return byValueAsc[0]; // can't win — dump lowest value
}

// Points captured in a completed (or partial) trick.
export function trickPoints(trick,mode,trump){
  return trick.reduce((s,p)=>s+cardValue(p.card,mode,trump),0);
}

// Sort a hand for display: group by suit, strongest first within suit.
export function sortHand(hand,mode,trump){
  const order=SUITS.map(s=>s.symbol);
  return [...hand].sort((a,b)=>{
    const sa=order.indexOf(a.suit.symbol), sb=order.indexOf(b.suit.symbol);
    if(sa!==sb) return sa-sb;
    return cardStrength(b,mode,trump)-cardStrength(a,mode,trump);
  });
}

// ── Customization catalogs (tiered avatars + inventory) ───
export const AVATAR_CATALOG=[
  {emoji:'🧔',tier:'free',cost:0},
  {emoji:'👲',tier:'free',cost:0},
  {emoji:'🧕',tier:'free',cost:0},
  {emoji:'👨‍💼',tier:'free',cost:0},
  {emoji:'👩‍💼',tier:'free',cost:0},
  {emoji:'🤴',tier:'premium',cost:300},
  {emoji:'👸',tier:'premium',cost:300},
  {emoji:'🧙',tier:'premium',cost:500},
  {emoji:'🦸',tier:'premium',cost:600},
  {emoji:'🎩',tier:'premium',cost:800},
];
export const FREE_AVATARS=AVATAR_CATALOG.filter(a=>a.tier==='free').map(a=>a.emoji);

// Profile frames (border ring around the avatar). Some are earned, not sold.
export const FRAMES=[
  {id:'none',    name:'بدون',    cost:0,   ring:'rgba(255,255,255,.15)'},
  {id:'gold',    name:'ذهبي',    reward:'first_win', ring:'#F0C040'},
  {id:'emerald', name:'زمردي',   cost:400, ring:'#2ECC71'},
  {id:'sapphire',name:'ياقوتي',  cost:600, ring:'#3498DB'},
  {id:'royal',   name:'ملكي',    cost:1000,ring:'conic-gradient(#8B6914,#F0C040,#FFE08A,#F0C040,#8B6914)'},
  {id:'champion',name:'بطل',     reward:'ten_wins',  ring:'conic-gradient(#E74C3C,#F0C040,#E74C3C)'},
];
// Name plates (pill behind the player name).
export const NAMEPLATES=[
  {id:'none',   name:'بدون',   cost:0,   bg:'transparent',                                   fg:'#F0EDE5'},
  {id:'desert', name:'الصحراء',cost:300, bg:'linear-gradient(90deg,#8B6914,#C9A84C)',        fg:'#07090A'},
  {id:'night',  name:'الليل',  cost:300, bg:'linear-gradient(90deg,#0a0a2a,#3498DB)',        fg:'#fff'},
  {id:'veteran',name:'مخضرم',  reward:'five_wins', bg:'linear-gradient(90deg,#1A5C28,#2ECC71)', fg:'#fff'},
  {id:'royal',  name:'ملكي',   cost:800, bg:'linear-gradient(90deg,#4A0072,#9B59B6)',        fg:'#fff'},
];
// Chat / reaction bubbles (styling of the in-game reaction pop).
export const CHAT_BUBBLES=[
  {id:'none', name:'كلاسيك', cost:0,   bg:'rgba(8,12,10,.95)',  border:'#7A5B1A', fg:'#F0C040'},
  {id:'coffee',name:'قهوة ☕',cost:200, bg:'#2a1a00',            border:'#C9A84C', fg:'#F0C040'},
  {id:'fire', name:'نار 🔥', cost:250, bg:'#2a0a00',            border:'#E74C3C', fg:'#FFD08A'},
  {id:'royal',name:'ملكي 👑',reward:'first_win', bg:'#1a0020',  border:'#9B59B6', fg:'#E0C0FF'},
];

// Default inventory for a brand-new player.
export function defaultInventory(){
  return {
    avatars:  [...FREE_AVATARS],
    tables:   ['classic'],
    frames:   ['none'],
    nameplates:['none'],
    bubbles:  ['none'],
  };
}

// Achievement grants keyed off win count. Returns the item ids a player
// should now own (frames/nameplates/bubbles) given their total wins.
export function achievementGrants(wins){
  const g={frames:[],nameplates:[],bubbles:[]};
  if(wins>=1){ g.frames.push('gold'); g.bubbles.push('royal'); }
  if(wins>=5){ g.nameplates.push('veteran'); }
  if(wins>=10){ g.frames.push('champion'); }
  return g;
}

// Merge achievement grants into an inventory, returning {inventory, earned}.
export function applyAchievements(inventory, wins){
  const inv=inventory && typeof inventory==='object'
    ? {...defaultInventory(),...inventory} : defaultInventory();
  const g=achievementGrants(wins);
  const earned=[];
  for(const key of ['frames','nameplates','bubbles']){
    const owned=new Set(inv[key]||[]);
    for(const id of g[key]) if(!owned.has(id)){ owned.add(id); earned.push({key,id}); }
    inv[key]=[...owned];
  }
  return {inventory:inv, earned};
}
