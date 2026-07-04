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

// Custom boards (game tables): a felt gradient (a→b) + a colored rail.
// Rendered live on the game table via getThemeStyles().board.
export const BOARDS = {
  classic:  { a:'#14522f', b:'#06170e', rail:'#7A5B1A' },
  emerald:  { a:'#0b7a4a', b:'#03150c', rail:'#22c55e' },
  midnight: { a:'#16296b', b:'#05081a', rail:'#3b82f6' },
  ruby:     { a:'#7a0b32', b:'#1a0208', rail:'#e11d5c' },
  royal:    { a:'#3b1a6b', b:'#0d0620', rail:'#a855f7' },
  desert:   { a:'#7a4a10', b:'#1a0f02', rail:'#e0a020' },
  sunset:   { a:'#8a2a2a', b:'#1a0808', rail:'#ff7a45' },
  ocean:    { a:'#0b5a6b', b:'#02141a', rail:'#22b8cf' },
};

// Avatar frames: a ring color + glow; 'conic' = animated rainbow.
export const FRAMES = {
  none:     { ring:'rgba(240,192,64,.5)', glow:'transparent',        anim:false },
  gold:     { ring:'#F0C040',             glow:'#F0C040',            anim:false },
  emerald:  { ring:'#22c55e',             glow:'#22c55e',            anim:false },
  ruby:     { ring:'#e11d5c',             glow:'#e11d5c',            anim:false },
  sapphire: { ring:'#3b82f6',             glow:'#3b82f6',            anim:false },
  diamond:  { ring:'#5DE0E6',             glow:'#5DE0E6',            anim:true  },
  royal:    { ring:'#a855f7',             glow:'#a855f7',            anim:false },
  fire:     { ring:'#ff7a45',             glow:'#ff5a2a',            anim:true  },
  rainbow:  { ring:'conic',               glow:'#F0C040',            anim:true  },
};
export function getFrame(profile){ return FRAMES[profile?.activeFrame||'none']||FRAMES.none; }
export const STORE_ITEMS = {
  decks: [
    { id:'heritage', name:'التراث السعودي', desc:'نقوش هندسية مستوحاة من التراث السعودي', cost:500, badge:'hot',      emoji:'🕌' },
    { id:'desert',   name:'الصحراء الذهبية',desc:'ألوان الرمال الذهبية — حصري',            cost:800, badge:'new',      emoji:'🏜️' },
    { id:'ramadan',  name:'رمضان كريم 🌙',  desc:'ثيم رمضاني حصري — متوفر موسمياً',       cost:300, badge:'seasonal', emoji:'🌙' },
    { id:'royal',    name:'الملكي الداكن',  desc:'تصميم ملكي فاخر بألوان الليل',           cost:1000,badge:'vip',      emoji:'👑' },
  ],
  tables: [
    { id:'emerald',  name:'الزمرد',          name_en:'Emerald',   desc:'طاولة خضراء زمردية لامعة',   desc_en:'Glowing emerald green felt',   cost:300, badge:'new',      emoji:'🟢' },
    { id:'midnight', name:'منتصف الليل',     name_en:'Midnight',  desc:'أزرق ليلي فاخر',              desc_en:'Deep luxury night blue',       cost:400, badge:'hot',      emoji:'🌃' },
    { id:'ruby',     name:'الياقوت',         name_en:'Ruby',      desc:'أحمر ياقوتي جريء',            desc_en:'Bold ruby-red felt',           cost:500, badge:'hot',      emoji:'🔴' },
    { id:'ocean',    name:'المحيط',          name_en:'Ocean',     desc:'أزرق مائي منعش',              desc_en:'Fresh aqua ocean felt',        cost:500, badge:'new',      emoji:'🌊' },
    { id:'desert',   name:'الصحراء',         name_en:'Desert',    desc:'ذهبي رملي دافئ',              desc_en:'Warm golden sand',             cost:600, badge:null,      emoji:'🏜️' },
    { id:'sunset',   name:'الغروب',          name_en:'Sunset',    desc:'برتقالي غروب متوهّج',          desc_en:'Glowing sunset orange',        cost:700, badge:'new',      emoji:'🌅' },
    { id:'royal',    name:'الملكي',          name_en:'Royal',     desc:'بنفسجي ملكي فاخر',            desc_en:'Regal royal purple',           cost:800, badge:'vip',      emoji:'💜' },
  ],
  frames: [
    { id:'gold',     name:'إطار ذهبي',       name_en:'Gold frame',      desc:'حلقة ذهبية متوهّجة',       desc_en:'Glowing gold ring',        cost:200, badge:'hot',  emoji:'🟡' },
    { id:'emerald',  name:'إطار زمردي',      name_en:'Emerald frame',   desc:'حلقة خضراء',               desc_en:'Emerald ring',             cost:250, badge:null,  emoji:'🟢' },
    { id:'sapphire', name:'إطار ياقوتي أزرق',name_en:'Sapphire frame',  desc:'حلقة زرقاء',               desc_en:'Sapphire ring',            cost:250, badge:null,  emoji:'🔵' },
    { id:'ruby',     name:'إطار ياقوتي',     name_en:'Ruby frame',      desc:'حلقة حمراء',               desc_en:'Ruby ring',                cost:300, badge:null,  emoji:'🔴' },
    { id:'royal',    name:'إطار ملكي',       name_en:'Royal frame',     desc:'حلقة بنفسجية',             desc_en:'Royal purple ring',        cost:400, badge:'vip', emoji:'🟣' },
    { id:'diamond',  name:'إطار ماسي',       name_en:'Diamond frame',   desc:'حلقة ماسية متلألئة',       desc_en:'Shimmering diamond ring',  cost:600, badge:'vip', emoji:'💎' },
    { id:'fire',     name:'إطار ناري',       name_en:'Fire frame',      desc:'حلقة نارية متحركة',        desc_en:'Animated fire ring',       cost:700, badge:'hot', emoji:'🔥' },
    { id:'rainbow',  name:'إطار قوس قزح',    name_en:'Rainbow frame',   desc:'حلقة ملوّنة دوّارة',        desc_en:'Rotating rainbow ring',    cost:1000,badge:'vip', emoji:'🌈' },
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

// Resolve the player's active cosmetics into concrete styles.
// Dark decks need light pips or black suits become invisible.
export function getThemeStyles(profile){
  const deckId=profile?.activeDeck||'classic';
  const tableId=profile?.activeTable||'classic';
  const deck=DECK_THEMES[deckId]||DECK_THEMES.classic;
  const darkDeck=['ramadan','royal'].includes(deckId);
  const board=BOARDS[tableId]||BOARDS.classic;
  return{
    felt:board.a,
    feltGrad:`radial-gradient(ellipse 92% 78% at 50% 46%,${board.a},${board.b} 82%)`,
    rail:board.rail,
    board,
    cardBg:deckId==='classic'?'linear-gradient(145deg,#FEFDF8,#F0EBE0)':`linear-gradient(145deg,${deck.bg},${deck.bg})`,
    cardBorder:deck.border,
    darkDeck,
    suitColor:(suit)=>darkDeck?(suit.isRed?'#FF7B6B':'#F0EDE5'):suit.color,
  };
}

export function buildDeck() {
  const d=[];
  for(const suit of SUITS) for(const rank of RANKS)
    d.push({suit,rank,id:`${rank.symbol}${suit.symbol}`});
  return d;
}
// Cryptographically secure Fisher-Yates: rejection sampling avoids modulo bias.
function secureRandInt(maxExclusive){
  if(typeof crypto==='undefined'||!crypto.getRandomValues)return Math.floor(Math.random()*maxExclusive);
  const limit=Math.floor(0x100000000/maxExclusive)*maxExclusive;
  const buf=new Uint32Array(1);
  do{crypto.getRandomValues(buf);}while(buf[0]>=limit);
  return buf[0]%maxExclusive;
}
export function shuffle(deck) {
  const d=[...deck];
  for(let i=d.length-1;i>0;i--){const j=secureRandInt(i+1);[d[i],d[j]]=[d[j],d[i]];}
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
// User preferences (sound / haptics / notifications), persisted locally.
const PREF_DEFAULTS={sound:true,haptics:true,notifications:true};
export function getPref(key){
  try{const v=localStorage.getItem('baloot_pref_'+key);return v===null?PREF_DEFAULTS[key]:v==='1';}
  catch{return PREF_DEFAULTS[key];}
}
export function setPref(key,val){
  try{localStorage.setItem('baloot_pref_'+key,val?'1':'0');}catch{/* ignore */}
}

export function playTone(freq,vol=0.1,type='sine'){
  if(!getPref('sound'))return;
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const freqs=Array.isArray(freq)?freq:[freq];
    freqs.forEach((f,i)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.type=type;osc.frequency.value=f;
      gain.gain.setValueAtTime(vol,ctx.currentTime+i*0.12);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.12+0.15);
      osc.start(ctx.currentTime+i*0.12);osc.stop(ctx.currentTime+i*0.12+0.15);
    });
  }catch{/* audio unavailable */}
}
export const sounds={
  deal:()=>playTone(440,0.1,'triangle'),
  play:()=>playTone(520,0.08,'sine'),
  win: ()=>playTone([523,659,784],0.15,'sine'),
  gahwa:()=>playTone([784,659,523,659,784],0.2,'triangle'),
  tick:()=>playTone(880,0.05,'square'),
  buy: ()=>playTone([523,659],0.1,'sine'),
};

// Haptic feedback — the "slam" mechanic. No-op where unsupported (iOS Safari).
export function vibrate(pattern){
  if(!getPref('haptics'))return;
  try{if(navigator.vibrate)navigator.vibrate(pattern);}catch{/* unsupported */}
}
export const haptics={
  play:()=>vibrate(18),
  slam:()=>vibrate([10,25,45]),
  win: ()=>vibrate([30,40,30,40,80]),
  gahwa:()=>vibrate([50,60,50,60,50,60,120]),
  buy: ()=>vibrate([15,30,15]),
};
