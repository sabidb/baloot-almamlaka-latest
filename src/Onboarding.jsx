import React,{useState}from'react';

const T={gold:'#C9A84C',goldL:'#F0C060',green:'#006C35',greenL:'#1a8a4a',night:'#07070F',bg2:'#0D0D1A',cream:'#F0EEE8',smoke:'#888',border:'#C9A84C33'};

const SLIDES=[
  {
    id:1,
    icon:'🃏',
    title:'مرحباً في بلوت المملكة!',
    subtitle:'اللعبة الأصيلة — العب مع أصدقائك',
    content:[
      {icon:'🎴',text:'٣٢ ورقة — من ٧ حتى الإيس'},
      {icon:'👥',text:'٤ لاعبين — فريقان (A و B)'},
      {icon:'🏆',text:'أول فريق يصل ١٥٢ نقطة يفوز'},
    ],
    bg:'linear-gradient(135deg,#0D4A2A,#071f10)',
    accent:'#C9A84C',
  },
  {
    id:2,
    icon:'🎯',
    title:'طريقة اللعب',
    subtitle:'بسيطة — ممتعة — تنافسية',
    content:[
      {icon:'🗣️',text:'المزايدة: اختر حكم أو صن أو پاس'},
      {icon:'♠️',text:'الأتو: اللون الذي تختاره يكسب دائماً'},
      {icon:'☀️',text:'صن: بدون أتو — النقاط تتضاعف!'},
    ],
    bg:'linear-gradient(135deg,#1A3A6B,#0a1a2a)',
    accent:'#2E86C1',
  },
  {
    id:3,
    icon:'☕',
    title:'القهوة والحكم',
    subtitle:'الحالات الخاصة في البلوت',
    content:[
      {icon:'☕',text:'قهوة: الخصم ٠ نقطة → نقاطك تتضاعف!'},
      {icon:'✅',text:'حكم نجح: الفريق المزايد يحصل على نقاطه'},
      {icon:'❌',text:'حكم فشل: الخصم يأخذ كل النقاط'},
    ],
    bg:'linear-gradient(135deg,#2a1a00,#1a0f00)',
    accent:'#C9A84C',
  },
  {
    id:4,
    icon:'🚀',
    title:'جاهز للعب؟',
    subtitle:'أنشئ غرفة وادعُ أصدقاءك الآن',
    content:[
      {icon:'🏠',text:'أنشئ غرفة واشارك الكود'},
      {icon:'📱',text:'أرسل الدعوة عبر واتساب'},
      {icon:'🪙',text:'اكسب رصيداً بكل انتصار'},
    ],
    bg:'linear-gradient(135deg,#1a0a40,#0a0620)',
    accent:'#9060FF',
  },
];

export default function OnboardingTutorial({onComplete}){
  const[slide,setSlide]=useState(0);
  const[animating,setAnimating]=useState(false);

  const current=SLIDES[slide];
  const isLast=slide===SLIDES.length-1;

  const next=()=>{
    if(animating)return;
    if(isLast){onComplete&&onComplete();return;}
    setAnimating(true);
    setTimeout(()=>{setSlide(s=>s+1);setAnimating(false);},200);
  };

  const skip=()=>{onComplete&&onComplete();};

  return(
    <div style={{position:'fixed',inset:0,zIndex:1000,fontFamily:'Segoe UI,Tahoma,Arial,sans-serif',overflow:'hidden'}}>
      <div style={{minHeight:'100vh',background:current.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,transition:'background 0.5s ease',position:'relative'}}>

        {/* Skip button */}
        {!isLast&&(
          <button onClick={skip} style={{position:'absolute',top:20,left:20,background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:10,padding:'7px 14px',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>
            تخطي
          </button>
        )}

        {/* Slide counter */}
        <div style={{position:'absolute',top:24,right:24,display:'flex',gap:6}}>
          {SLIDES.map((_,i)=>(
            <div key={i} onClick={()=>setSlide(i)} style={{width:i===slide?24:8,height:8,borderRadius:4,background:i===slide?current.accent:'rgba(255,255,255,0.2)',transition:'all 0.3s ease',cursor:'pointer'}}/>
          ))}
        </div>

        {/* Content */}
        <div style={{maxWidth:360,width:'100%',textAlign:'center',opacity:animating?0:1,transition:'opacity 0.2s ease'}}>
          {/* Big icon */}
          <div style={{fontSize:80,marginBottom:16,filter:`drop-shadow(0 0 20px ${current.accent}66)`,animation:'float 3s ease-in-out infinite'}}>
            {current.icon}
          </div>

          <h1 style={{color:current.accent,fontSize:26,fontWeight:900,margin:'0 0 8px',textShadow:`0 0 30px ${current.accent}44`}}>
            {current.title}
          </h1>
          <p style={{color:'rgba(255,255,255,0.6)',fontSize:14,margin:'0 0 32px'}}>
            {current.subtitle}
          </p>

          {/* Feature list */}
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:40}}>
            {current.content.map((item,i)=>(
              <div key={i} style={{background:'rgba(255,255,255,0.08)',border:`1px solid ${current.accent}33`,borderRadius:14,padding:'14px 18px',display:'flex',alignItems:'center',gap:14,textAlign:'right',animation:`slideIn 0.4s ${i*0.1}s ease both`}}>
                <span style={{fontSize:24,flexShrink:0}}>{item.icon}</span>
                <span style={{color:'rgba(255,255,255,0.9)',fontSize:15,fontWeight:600,lineHeight:1.4}}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Button */}
          <button onClick={next} style={{background:`linear-gradient(135deg,${current.accent},${current.accent}cc)`,color:current.accent===T.gold?T.night:'#fff',border:'none',borderRadius:16,padding:'16px 48px',fontWeight:900,cursor:'pointer',fontSize:18,fontFamily:'inherit',boxShadow:`0 6px 24px ${current.accent}44`,width:'100%',maxWidth:300}}>
            {isLast?'🚀 ابدأ اللعب!':'التالي ←'}
          </button>

          {/* Progress text */}
          <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,marginTop:12}}>
            {slide+1} / {SLIDES.length}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes slideIn{0%{opacity:0;transform:translateX(20px)}100%{opacity:1;transform:translateX(0)}}
      `}</style>
    </div>
  );
}

// ── Share Score Card ──────────────────────────────────────
export function ShareScoreCard({winner,loser,winnerScore,loserScore,isGahwa,onClose}){
  const share=()=>{
    const text=`🃏 بلوت المملكة\n\n${isGahwa?'☕ قهوة!':''}\nالفائز: Team ${winner===0?'A':'B'} 🏆\nالنتيجة: ${winnerScore} - ${loserScore}\n\nانضم وتحداني! 👊\nbaloot-almamlaka-latest.vercel.app`;
    if(navigator.share){
      navigator.share({title:'بلوت المملكة',text}).catch(()=>{});
    }else{
      navigator.clipboard?.writeText(text);
    }
  };

  return(
    <div style={{position:'fixed',inset:0,background:'#000c',display:'flex',alignItems:'center',justifyContent:'center',zIndex:700,padding:16,backdropFilter:'blur(8px)'}}>
      <div style={{background:'linear-gradient(135deg,#0D2A1A,#071f10)',border:`2px solid ${T.gold}`,borderRadius:24,padding:28,maxWidth:320,width:'100%',textAlign:'center',boxShadow:`0 0 80px ${T.gold}33`}}>
        <div style={{fontSize:16,color:T.smoke,marginBottom:8,letterSpacing:2}}>🃏 بلوت المملكة</div>
        
        {isGahwa&&(
          <div style={{background:`${T.gold}22`,border:`1px solid ${T.gold}44`,borderRadius:12,padding:'8px',marginBottom:12}}>
            <div style={{color:T.gold,fontWeight:900,fontSize:16}}>☕ قهوة!</div>
          </div>
        )}

        <div style={{fontSize:48,marginBottom:8}}>🏆</div>
        <div style={{color:T.gold,fontSize:22,fontWeight:900,marginBottom:4}}>
          Team {winner===0?'A':'B'} فازت!
        </div>

        <div style={{display:'flex',gap:12,margin:'20px 0',justifyContent:'center',alignItems:'center'}}>
          <div style={{textAlign:'center'}}>
            <div style={{color:T.greenL,fontSize:36,fontWeight:900}}>{winnerScore}</div>
            <div style={{color:T.smoke,fontSize:11}}>الفائز</div>
          </div>
          <div style={{color:T.smoke,fontSize:20,fontWeight:700}}>—</div>
          <div style={{textAlign:'center'}}>
            <div style={{color:'rgba(255,255,255,0.4)',fontSize:36,fontWeight:900}}>{loserScore}</div>
            <div style={{color:T.smoke,fontSize:11}}>الخاسر</div>
          </div>
        </div>

        <div style={{color:'rgba(255,255,255,0.5)',fontSize:12,marginBottom:20}}>
          baloot-almamlaka-latest.vercel.app
        </div>

        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,background:'rgba(255,255,255,0.06)',color:T.smoke,border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'12px',fontWeight:700,cursor:'pointer',fontSize:14,fontFamily:'inherit'}}>إغلاق</button>
          <button onClick={share} style={{flex:2,background:'linear-gradient(135deg,#25D366,#128c7e)',color:'#fff',border:'none',borderRadius:12,padding:'12px',fontWeight:900,cursor:'pointer',fontSize:14,fontFamily:'inherit',boxShadow:'0 4px 16px #25D36644'}}>
            📱 شارك واتساب
          </button>
        </div>
      </div>
    </div>
  );
}
