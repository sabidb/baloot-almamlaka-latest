// Lightweight i18n: a module-level store (no provider needed) + a hook.
// Language persists in localStorage and defaults to the device language.
import { useSyncExternalStore } from 'react';

const STRINGS = {
  ar: {
    dir: 'rtl',
    appName: 'بلوت المملكة', appShort: 'بلوت',
    kingdom: 'المملكة العربية السعودية',
    tagline: 'العب · تنافس · افُز',
    // nav
    nav_home: 'الرئيسية', nav_board: 'المتصدرون', nav_store: 'المتجر', nav_friends: 'أصدقاء', nav_profile: 'ملفي', nav_settings: 'الإعدادات',
    // auth
    signInTitle: 'سجّل دخولك',
    signInSub: 'سجّل باستخدام Google للحفاظ على تقدمك',
    signInGoogle: 'تسجيل الدخول بـ Google',
    terms: 'بالمتابعة توافق على شروط الاستخدام',
    loginFailed: 'تعذر تسجيل الدخول',
    completeProfile: 'أكمل ملفك',
    welcome: 'مرحباً', yourCity: 'مدينتك', chooseAvatar: 'اختر رمزك',
    startPlaying: 'ابدأ اللعب',
    // modes
    playModes: 'أنماط اللعب',
    mode_bot: 'مع الروبوت', mode_bot_sub: 'تدرّب بدون انتظار',
    mode_create: 'مع الأصدقاء', mode_create_sub: 'أنشئ غرفة وشارك الكود',
    mode_join: 'انضم لغرفة', mode_join_sub: 'أدخل كود الغرفة',
    mode_quick: 'لعبة سريعة', mode_quick_sub: 'العب مع لاعبين عشوائيين',
    tournaments: 'البطولات', tournaments_sub: 'تنافس واربح جوائز نقدية وعملات',
    stat_players: 'لاعب', stat_live: 'مباراة الآن', stat_rating: 'التقييم',
    // profile
    wins: 'انتصار', losses: 'هزيمة', coins: 'رصيد', level: 'المستوى', rank: 'الرتبة',
    winRate: 'نسبة الفوز', gamesPlayed: 'المباريات', bestStreak: 'أطول سلسلة',
    editProfile: 'تعديل الملف', editProfileSub: 'الاسم، الرمز، المدينة',
    myStats: 'إحصائياتي', myStatsSub: 'تفاصيل أدائك',
    achievements: 'الإنجازات',
    settings: 'الإعدادات', settingsSub: 'اللغة، الصوت، التنبيهات',
    logout: 'تسجيل الخروج',
    name: 'الاسم', city: 'المدينة', symbol: 'الرمز', save: 'حفظ', cancel: 'إلغاء',
    // ranks
    rank_bronze: 'برونزي', rank_silver: 'فضي', rank_gold: 'ذهبي', rank_platinum: 'بلاتيني', rank_diamond: 'ماسي', rank_legend: 'أسطورة',
    // leaderboard
    leaderboard: 'المتصدرون', leaderboard_sub: 'أفضل لاعبي المملكة',
    region_all: 'الكل', noPlayers: 'لا يوجد لاعبون بعد',
    // store
    store: 'المتجر', yourBalance: 'رصيدك',
    tab_decks: 'أطقم', tab_tables: 'طاولات', tab_coins: 'رصيد',
    owned: 'مملوك', activate: 'فعّل', active: 'مفعّل', insufficient: 'رصيد غير كافٍ',
    purchased: 'تم الشراء', activated: 'تم التفعيل', paymentSoon: 'الدفع متوفر قريباً — Apple Pay ومدى',
    bestValue: 'الأفضل قيمة', paymentComingSoon: 'Apple Pay ومدى — قريباً',
    // settings screen
    language: 'اللغة', arabic: 'العربية', english: 'English',
    sound: 'المؤثرات الصوتية', haptics: 'الاهتزاز', notifications: 'الإشعارات',
    on: 'مفعّل', off: 'متوقف', account: 'الحساب', appVersion: 'إصدار التطبيق',
    // game
    exit: 'خروج', bidding: 'مزايدة', hokum: 'حكم', sun: 'صن', pass: 'باس',
    yourBidTurn: 'دورك للمزايدة', chooseTrump: 'اختر لون الحكم',
    yourTurn: 'دورك أنت', turnOf: 'دور', trump: 'الكوز',
    tookTrick: 'أخذ الضربة', team: 'الفريق', teamA: 'أ', teamB: 'ب',
    nextRound: 'الجولة التالية', showResult: 'عرض النتيجة',
    wonGame: 'يفوز!', reached152: 'وصلتم إلى ١٥٢ نقطة', playAgain: 'العب مجدداً', share: 'مشاركة',
    allPassed: 'الكل مرّر — توزيع جديد', newDeal: 'توزيع جديد',
    thinking: 'يفكر…', bidding_ing: 'يزايد…',
    back: 'رجوع', comingSoon: 'قريباً',
  },
  en: {
    dir: 'ltr',
    appName: 'Baloot Kingdom', appShort: 'Baloot',
    kingdom: 'Kingdom of Saudi Arabia',
    tagline: 'Play · Compete · Win',
    nav_home: 'Home', nav_board: 'Leaders', nav_store: 'Store', nav_friends: 'Friends', nav_profile: 'Profile', nav_settings: 'Settings',
    signInTitle: 'Sign in',
    signInSub: 'Sign in with Google to save your progress',
    signInGoogle: 'Sign in with Google',
    terms: 'By continuing you agree to the terms of use',
    loginFailed: 'Sign-in failed',
    completeProfile: 'Complete your profile',
    welcome: 'Welcome', yourCity: 'Your city', chooseAvatar: 'Choose your avatar',
    startPlaying: 'Start playing',
    playModes: 'Game modes',
    mode_bot: 'Vs. Bots', mode_bot_sub: 'Practice instantly',
    mode_create: 'With Friends', mode_create_sub: 'Create a room & share the code',
    mode_join: 'Join Room', mode_join_sub: 'Enter a room code',
    mode_quick: 'Quick Match', mode_quick_sub: 'Play with random players',
    tournaments: 'Tournaments', tournaments_sub: 'Compete for cash & coin prizes',
    stat_players: 'players', stat_live: 'live now', stat_rating: 'rating',
    wins: 'Wins', losses: 'Losses', coins: 'Coins', level: 'Level', rank: 'Rank',
    winRate: 'Win rate', gamesPlayed: 'Games', bestStreak: 'Best streak',
    editProfile: 'Edit profile', editProfileSub: 'Name, avatar, city',
    myStats: 'My statistics', myStatsSub: 'Your performance details',
    achievements: 'Achievements',
    settings: 'Settings', settingsSub: 'Language, sound, notifications',
    logout: 'Log out',
    name: 'Name', city: 'City', symbol: 'Avatar', save: 'Save', cancel: 'Cancel',
    rank_bronze: 'Bronze', rank_silver: 'Silver', rank_gold: 'Gold', rank_platinum: 'Platinum', rank_diamond: 'Diamond', rank_legend: 'Legend',
    leaderboard: 'Leaderboard', leaderboard_sub: 'Top players of the Kingdom',
    region_all: 'All', noPlayers: 'No players yet',
    store: 'Store', yourBalance: 'Your balance',
    tab_decks: 'Decks', tab_tables: 'Tables', tab_coins: 'Coins',
    owned: 'Owned', activate: 'Use', active: 'Active', insufficient: 'Not enough coins',
    purchased: 'Purchased', activated: 'Activated', paymentSoon: 'Payments coming soon — Apple Pay & Mada',
    bestValue: 'Best value', paymentComingSoon: 'Apple Pay & Mada — coming soon',
    language: 'Language', arabic: 'العربية', english: 'English',
    sound: 'Sound effects', haptics: 'Vibration', notifications: 'Notifications',
    on: 'On', off: 'Off', account: 'Account', appVersion: 'App version',
    exit: 'Exit', bidding: 'Bidding', hokum: 'Hokum', sun: 'Sun', pass: 'Pass',
    yourBidTurn: 'Your turn to bid', chooseTrump: 'Choose the trump suit',
    yourTurn: 'Your turn', turnOf: 'Turn:', trump: 'Trump',
    tookTrick: 'took the trick', team: 'Team', teamA: 'A', teamB: 'B',
    nextRound: 'Next round', showResult: 'Show result',
    wonGame: 'wins!', reached152: 'Reached 152 points', playAgain: 'Play again', share: 'Share',
    allPassed: 'All passed — new deal', newDeal: 'New deal',
    thinking: 'thinking…', bidding_ing: 'bidding…',
    back: 'Back', comingSoon: 'Soon',
  },
};

function detect() {
  try {
    const saved = localStorage.getItem('baloot_lang');
    if (saved === 'ar' || saved === 'en') return saved;
    const nav = (navigator.language || 'ar').toLowerCase();
    return nav.startsWith('ar') ? 'ar' : 'en';
  } catch { return 'ar'; }
}

let current = detect();
const listeners = new Set();

export function getLang() { return current; }
export function setLang(l) {
  if (l !== 'ar' && l !== 'en') return;
  current = l;
  try { localStorage.setItem('baloot_lang', l); } catch { /* ignore */ }
  applyDir();
  listeners.forEach((fn) => fn());
}
export function toggleLang() { setLang(current === 'ar' ? 'en' : 'ar'); }
export function dir() { return STRINGS[current].dir; }
export function isRTL() { return STRINGS[current].dir === 'rtl'; }

export function applyDir() {
  try {
    document.documentElement.lang = current;
    document.documentElement.dir = STRINGS[current].dir;
  } catch { /* ignore */ }
}

// Translate. Falls back to Arabic, then to the key itself.
export function t(key) {
  return (STRINGS[current] && STRINGS[current][key]) ?? STRINGS.ar[key] ?? key;
}

function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }

// Hook: re-renders the component whenever the language changes.
export function useLang() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return { lang, t, setLang, toggleLang, dir: STRINGS[lang].dir, isRTL: STRINGS[lang].dir === 'rtl' };
}
