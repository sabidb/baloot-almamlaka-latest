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
    // dashboard (colorful lobby)
    learn: 'تعلّم أصول البلوت', learnSub: 'احترفها الآن ✦', playNow: 'العب الآن',
    online: 'متصل', vsComputer: 'ضد الكمبيوتر', dailyReward: 'مكافأة يومية',
    freeBonus: 'هدية مجانية', featured: 'المميّز', quickPlay: 'لعبة سريعة',
    locked: 'مقفل', unlockAt: 'يفتح عند المستوى',
    player: 'لاعب', winsShort: 'انتصار',
    // onboarding
    ob_skip: 'تخطي', ob_next: 'التالي', ob_start: 'ابدأ اللعب!',
    ob1_title: 'مرحباً في بلوت المملكة!', ob1_sub: 'اللعبة الأصيلة — العب مع أصدقائك',
    ob1_a: '٣٢ ورقة — من ٧ حتى الإيس', ob1_b: '٤ لاعبين — فريقان (أ و ب)', ob1_c: 'أول فريق يصل ١٥٢ نقطة يفوز',
    ob2_title: 'طريقة اللعب', ob2_sub: 'بسيطة — ممتعة — تنافسية',
    ob2_a: 'المزايدة: اختر حكم أو صن أو باس', ob2_b: 'الأتو: اللون الذي تختاره يكسب دائماً', ob2_c: 'صن: بدون أتو — النقاط تتضاعف!',
    ob3_title: 'القهوة والحكم', ob3_sub: 'الحالات الخاصة في البلوت',
    ob3_a: 'قهوة: الخصم ٠ نقطة → نقاطك تتضاعف!', ob3_b: 'حكم نجح: الفريق المزايد يحصل على نقاطه', ob3_c: 'حكم فشل: الخصم يأخذ كل النقاط',
    ob4_title: 'جاهز للعب؟', ob4_sub: 'أنشئ غرفة وادعُ أصدقاءك الآن',
    ob4_a: 'أنشئ غرفة وشارك الكود', ob4_b: 'أرسل الدعوة عبر واتساب', ob4_c: 'اكسب رصيداً بكل انتصار',
    shareWhatsapp: 'شارك واتساب', close: 'إغلاق', winnerLabel: 'الفائز', loserLabel: 'الخاسر', teamWon: 'فازت!', gahwa: 'قهوة!',
    // friends
    friends_sub: 'العب مع أصدقائك', fr_my: 'أصدقائي', fr_requests: 'الطلبات', fr_search: 'بحث',
    fr_none: 'لا يوجد أصدقاء بعد', fr_findFriends: 'ابحث عن أصدقاء', fr_invite: 'دعوة',
    fr_noRequests: 'لا توجد طلبات صداقة', fr_wantsAdd: 'يريد إضافتك صديقاً', fr_accept: 'قبول',
    fr_searchPlaceholder: 'ابحث باسم اللاعب...', fr_isFriend: 'صديق', fr_add: 'إضافة', fr_noResults: 'لا توجد نتائج',
    fr_reqSent: '✅ تم إرسال طلب الصداقة', fr_sendFail: '❌ فشل الإرسال', fr_added: '✅ تمت إضافة الصديق', fr_fail: '❌ فشل',
    fr_createRoomFirst: 'أنشئ غرفة أولاً', fr_inviteSent: '✅ تم إرسال دعوة لـ {name}',
    // notifications
    notif_title: 'الإشعارات', notif_none: 'لا توجد إشعارات', notif_invited: 'دعاك للعب', notif_friendReq: 'أرسل طلب صداقة',
    notif_new: 'إشعار جديد', notif_roomCode: 'كود الغرفة', notif_join: 'انضم',
    // daily reward
    daily_title: 'مكافأة يومية', daily_claimed: 'تم الاستلام!', daily_added: 'أضفنا {n} رصيد لحسابك',
    daily_sub: 'سجّل دخولك يومياً للحصول على مكافآت أكبر', daily_todayReward: 'مكافأة اليوم — يوم {n}',
    daily_claim: 'استلم المكافأة', daily_vipBonus: 'مكافأة VIP!',
    // tournaments
    tourn_title: 'البطولات', tourn_sub: 'تنافس واربح جوائز ضخمة', tourn_all: 'كل البطولات', tourn_mine: 'بطولاتي',
    tourn_activeStat: 'بطولات نشطة', tourn_biggest: 'أكبر جائزة', tourn_playersToday: 'لاعبون اليوم',
    tourn_prize: 'جائزة', coinsShort: 'رصيد', sar: 'ريال', sarFull: 'ريال سعودي',
    tourn_registered: 'اللاعبون المسجلون', tourn_full: 'البطولة ممتلئة', tourn_spotsLeft: '{n} مقعد متبقي',
    tourn_view: 'عرض', tourn_join: 'انضم للبطولة', tourn_joined: 'مسجل', tourn_fullShort: 'ممتلئة',
    freq_weekly: 'أسبوعية', freq_monthly: 'شهرية', freq_daily: 'يومية',
    tourn_weekly: 'بطولة الأسبوع', tourn_kingdom: 'كأس المملكة', tourn_quick: 'بطولة سريعة', tourn_mega: 'البطولة الكبرى',
    status_open: 'مفتوح', status_active: 'جارية', status_completed: 'منتهية',
    tourn_first: 'المركز الأول', tourn_second: 'المركز الثاني', tourn_third: 'المركز الثالث',
    tourn_emptySeat: 'مقعد فارغ', tourn_matches: 'جدول المباريات', tourn_final: 'النهائي', tourn_semi: 'نصف النهائي', tourn_round: 'الدور {n}',
    tourn_winnerShort: 'فائز', tourn_room: 'غرفة', tourn_liveShort: 'جارية',
    tourn_champ: 'بطل البطولة', tourn_grandPrize: 'الجائزة الكبرى', tourn_rounds: 'جولات',
    tourn_payMethod: 'طريقة الدفع', tourn_pay: 'ادفع', tourn_joinPay: 'انضم',
    tourn_loginFirst: 'سجّل دخولك أولاً', tourn_registeredToast: '🎉 تم التسجيل في البطولة!', tourn_failed: '❌ فشل',
    tourn_loginView: 'سجّل دخولك لعرض بطولاتك', tourn_noneMine: 'لم تنضم لأي بطولة بعد', tourn_joinNow: 'انضم الآن', tourn_winnerBadge: 'فائز!',
    // multiplayer lobby
    mp_room: 'غرفة الأصدقاء', mp_shareCode: 'شارك الكود مع أصدقائك', mp_publicRoom: 'غرفة عامة', mp_privateRoom: 'غرفة خاصة',
    mp_emptySeat: 'مقعد فارغ', mp_host: 'مضيف', mp_teamLabel: 'فريق',
    mp_startBots: 'ابدأ مع روبوتات 🤖', mp_start: 'ابدأ اللعب 🃏', mp_waitingHost: 'بانتظار المضيف…',
    mp_joinRoom: 'انضم لغرفة', mp_joinBtn: 'انضم', mp_searching: 'نبحث عن لاعبين…', mp_creating: 'ننشئ الغرفة…', mp_error: 'حدث خطأ',
    mp_roomNotFound: 'الغرفة غير موجودة', mp_gameStarted: 'اللعبة بدأت بالفعل', mp_roomFull: 'الغرفة ممتلئة',
    mp_createFail: 'تعذر إنشاء الغرفة', mp_joinFail: 'تعذر الانضمام', mp_searchFail: 'تعذر البحث',
    mp_yourTeamWins: 'فريقك يفوز!', mp_yourTeamLost: 'فريقك خسر',
    // achievements
    achievementsSub: 'إنجازاتك ومكافآتك', unlocked: 'مفتوح', achProgress: '{done} من {total}',
    ach_firstwin: 'الفوز الأول', ach_wins10: '١٠ انتصارات', ach_wins50: '٥٠ انتصار', ach_wins250: '٢٥٠ انتصار',
    ach_games100: '١٠٠ مباراة', ach_streak5: 'سلسلة ٥ انتصارات', ach_rich: 'ثري — ٥٠٠٠ رصيد', ach_veteran: 'محترف — ٥٠٠ مباراة',
    // daily missions
    missions: 'المهام اليومية', missionsSub: 'أكملها اليوم', missionDone: 'مكتملة', missionsReset: 'تتجدد يومياً', claim: 'استلم',
    mission_play3: 'العب ٣ مباريات', mission_win2: 'افز بمباراتين', mission_score152: 'سجّل ١٥٢ نقطة',
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
    learn: 'Learn Baloot basics', learnSub: 'Master it now ✦', playNow: 'Play now',
    online: 'online', vsComputer: 'Vs. Computer', dailyReward: 'Daily reward',
    freeBonus: 'Free bonus', featured: 'Featured', quickPlay: 'Quick Match',
    locked: 'Locked', unlockAt: 'Unlocks at level',
    player: 'Player', winsShort: 'wins',
    // onboarding
    ob_skip: 'Skip', ob_next: 'Next', ob_start: 'Start playing!',
    ob1_title: 'Welcome to Baloot Kingdom!', ob1_sub: 'The authentic game — play with friends',
    ob1_a: '32 cards — from 7 up to Ace', ob1_b: '4 players — two teams (A & B)', ob1_c: 'First team to reach 152 points wins',
    ob2_title: 'How to play', ob2_sub: 'Simple — fun — competitive',
    ob2_a: 'Bidding: choose Hokum, Sun, or Pass', ob2_b: 'Trump: your chosen suit always wins', ob2_c: 'Sun: no trump — points double!',
    ob3_title: 'Gahwa & Hokum', ob3_sub: 'Special cases in Baloot',
    ob3_a: 'Gahwa: opponent scores 0 → your points double!', ob3_b: 'Hokum made: the bidding team keeps its points', ob3_c: 'Hokum failed: the opponent takes all points',
    ob4_title: 'Ready to play?', ob4_sub: 'Create a room and invite your friends now',
    ob4_a: 'Create a room and share the code', ob4_b: 'Send the invite over WhatsApp', ob4_c: 'Earn coins with every win',
    shareWhatsapp: 'Share on WhatsApp', close: 'Close', winnerLabel: 'Winner', loserLabel: 'Loser', teamWon: 'won!', gahwa: 'Gahwa!',
    // friends
    friends_sub: 'Play with your friends', fr_my: 'My friends', fr_requests: 'Requests', fr_search: 'Search',
    fr_none: 'No friends yet', fr_findFriends: 'Find friends', fr_invite: 'Invite',
    fr_noRequests: 'No friend requests', fr_wantsAdd: 'wants to add you', fr_accept: 'Accept',
    fr_searchPlaceholder: 'Search by player name...', fr_isFriend: 'Friend', fr_add: 'Add', fr_noResults: 'No results',
    fr_reqSent: '✅ Friend request sent', fr_sendFail: '❌ Failed to send', fr_added: '✅ Friend added', fr_fail: '❌ Failed',
    fr_createRoomFirst: 'Create a room first', fr_inviteSent: '✅ Invite sent to {name}',
    // notifications
    notif_title: 'Notifications', notif_none: 'No notifications', notif_invited: 'invited you to play', notif_friendReq: 'sent a friend request',
    notif_new: 'New notification', notif_roomCode: 'Room code', notif_join: 'Join',
    // daily reward
    daily_title: 'Daily reward', daily_claimed: 'Claimed!', daily_added: 'Added {n} coins to your account',
    daily_sub: 'Sign in daily for bigger rewards', daily_todayReward: 'Today’s reward — day {n}',
    daily_claim: 'Claim reward', daily_vipBonus: 'VIP bonus!',
    // tournaments
    tourn_title: 'Tournaments', tourn_sub: 'Compete and win huge prizes', tourn_all: 'All tournaments', tourn_mine: 'My tournaments',
    tourn_activeStat: 'Active', tourn_biggest: 'Biggest prize', tourn_playersToday: 'Players today',
    tourn_prize: 'prize', coinsShort: 'coins', sar: 'SAR', sarFull: 'Saudi Riyal',
    tourn_registered: 'Registered players', tourn_full: 'Tournament full', tourn_spotsLeft: '{n} spots left',
    tourn_view: 'View', tourn_join: 'Join tournament', tourn_joined: 'Registered', tourn_fullShort: 'Full',
    freq_weekly: 'Weekly', freq_monthly: 'Monthly', freq_daily: 'Daily',
    tourn_weekly: 'Weekly Cup', tourn_kingdom: 'Kingdom Cup', tourn_quick: 'Quick Cup', tourn_mega: 'Mega Tournament',
    status_open: 'Open', status_active: 'Live', status_completed: 'Ended',
    tourn_first: '1st place', tourn_second: '2nd place', tourn_third: '3rd place',
    tourn_emptySeat: 'Empty seat', tourn_matches: 'Bracket', tourn_final: 'Final', tourn_semi: 'Semifinal', tourn_round: 'Round {n}',
    tourn_winnerShort: 'Winner', tourn_room: 'Room', tourn_liveShort: 'Live',
    tourn_champ: 'Champion', tourn_grandPrize: 'Grand prize', tourn_rounds: 'rounds',
    tourn_payMethod: 'Payment method', tourn_pay: 'Pay', tourn_joinPay: 'Join',
    tourn_loginFirst: 'Sign in first', tourn_registeredToast: '🎉 Registered for the tournament!', tourn_failed: '❌ Failed',
    tourn_loginView: 'Sign in to view your tournaments', tourn_noneMine: 'You haven’t joined any tournament yet', tourn_joinNow: 'Join now', tourn_winnerBadge: 'Winner!',
    // multiplayer lobby
    mp_room: 'Friends Room', mp_shareCode: 'Share the code with your friends', mp_publicRoom: 'Public room', mp_privateRoom: 'Private room',
    mp_emptySeat: 'Empty seat', mp_host: 'Host', mp_teamLabel: 'Team',
    mp_startBots: 'Start with bots 🤖', mp_start: 'Start game 🃏', mp_waitingHost: 'Waiting for host…',
    mp_joinRoom: 'Join a room', mp_joinBtn: 'Join', mp_searching: 'Finding players…', mp_creating: 'Creating room…', mp_error: 'An error occurred',
    mp_roomNotFound: 'Room not found', mp_gameStarted: 'The game already started', mp_roomFull: 'Room is full',
    mp_createFail: 'Could not create the room', mp_joinFail: 'Could not join', mp_searchFail: 'Search failed',
    mp_yourTeamWins: 'Your team wins!', mp_yourTeamLost: 'Your team lost',
    // achievements
    achievementsSub: 'Your milestones & rewards', unlocked: 'Unlocked', achProgress: '{done} of {total}',
    ach_firstwin: 'First win', ach_wins10: '10 wins', ach_wins50: '50 wins', ach_wins250: '250 wins',
    ach_games100: '100 games', ach_streak5: '5-win streak', ach_rich: 'Rich — 5000 coins', ach_veteran: 'Veteran — 500 games',
    // daily missions
    missions: 'Daily Missions', missionsSub: 'Complete them today', missionDone: 'Done', missionsReset: 'Resets daily', claim: 'Claim',
    mission_play3: 'Play 3 games', mission_win2: 'Win 2 games', mission_score152: 'Score 152 points',
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
// Optional vars object interpolates {placeholders}: t('x',{name:'Ali'}).
export function t(key, vars) {
  let s = (STRINGS[current] && STRINGS[current][key]) ?? STRINGS.ar[key] ?? key;
  if (vars && typeof s === 'string') {
    for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
  }
  return s;
}

function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }

// Hook: re-renders the component whenever the language changes.
export function useLang() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return { lang, t, setLang, toggleLang, dir: STRINGS[lang].dir, isRTL: STRINGS[lang].dir === 'rtl' };
}
