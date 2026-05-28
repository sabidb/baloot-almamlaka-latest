import React,{useState,useEffect}from'react';
import{db}from'./firebase';
import{collection,getDocs,doc,updateDoc,deleteDoc,query,orderBy,limit,getDoc,setDoc}from'firebase/firestore';

const T={gold:'#C9A84C',goldL:'#F0C060',green:'#006C35',greenL:'#1a8a4a',night:'#07070F',bg2:'#0D0D1A',cream:'#F0EEE8',red:'#C0392B',redL:'#E74C3C',smoke:'#888',border:'#C9A84C33'};

const ADMIN_PIN='1234';

function StatCard({label,value,color,icon}){
  return(
    <div style={{background:T.bg2,border:`1px solid ${color}33`,borderRadius:14,padding:'16px 20px',textAlign:'center'}}>
      <div style={{fontSize:28,marginBottom:6}}>{icon}</div>
      <div style={{color,fontSize:28,fontWeight:900}}>{value}</div>
      <div style={{color:T.smoke,fontSize:12,marginTop:4}}>{label}</div>
    </div>
  );
}

export default function AdminPanel(){
  const[pin,setPin]=useState('');
  const[auth,setAuth]=useState(false);
  const[players,setPlayers]=useState([]);
  const[loading,setLoading]=useState(false);
  const[search,setSearch]=useState('');
  const[selected,setSelected]=useState(null);
  const[editCoins,setEditCoins]=useState('');
  const[toast,setToast]=useState(null);
  const[tab,setTab]=useState('players');
  const[stats,setStats]=useState({total:0,totalCoins:0,totalWins:0,vip:0});

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),2500);};

  const loadPlayers=async()=>{
    setLoading(true);
    try{
      const q=query(collection(db,'users'),orderBy('createdAt','desc'),limit(200));
      const snap=await getDocs(q);
      const data=snap.docs.map(d=>({id:d.id,...d.data()}));
      setPlayers(data);
      setStats({
        total:data.length,
        totalCoins:data.reduce((s,p)=>s+(p.coins||0),0),
        totalWins:data.reduce((s,p)=>s+(p.wins||0),0),
        vip:data.filter(p=>p.isVip).length,
      });
    }catch(e){showToast('خطأ في التحميل: '+e.message);}
    setLoading(false);
  };

  useEffect(()=>{if(auth)loadPlayers();},[auth]);

  const updateCoins=async(uid,coins)=>{
    try{
      await updateDoc(doc(db,'users',uid),{coins:parseInt(coins)||0});
      setPlayers(ps=>ps.map(p=>p.id===uid?{...p,coins:parseInt(coins)||0}:p));
      if(selected?.id===uid)setSelected(s=>({...s,coins:parseInt(coins)||0}));
      showToast('✅ تم تحديث الرصيد');
    }catch(e){showToast('❌ فشل: '+e.message);}
  };

  const toggleVip=async(uid,current)=>{
    try{
      await updateDoc(doc(db,'users',uid),{isVip:!current});
      setPlayers(ps=>ps.map(p=>p.id===uid?{...p,isVip:!current}:p));
      if(selected?.id===uid)setSelected(s=>({...s,isVip:!current}));
      showToast(current?'❌ تم إلغاء VIP':'👑 تم تفعيل VIP');
    }catch(e){showToast('❌ فشل');}
  };

  const toggleBan=async(uid,current)=>{
    try{
      await updateDoc(doc(db,'users',uid),{banned:!current});
      setPlayers(ps=>ps.map(p=>p.id===uid?{...p,banned:!current}:p));
      if(selected?.id===uid)setSelected(s=>({...s,banned:!current}));
      showToast(current?'✅ تم رفع الحظر':'🚫 تم حظر اللاعب');
    }catch(e){showToast('❌ فشل');}
  };

  const deletePlayer=async uid=>{
    if(!window.confirm('هل أنت متأكد؟ سيتم حذف اللاعب نهائياً'))return;
    try{
      await deleteDoc(doc(db,'users',uid));
      setPlayers(ps=>ps.filter(p=>p.id!==uid));
      setSelected(null);
      showToast('🗑️ تم حذف اللاعب');
    }catch(e){showToast('❌ فشل الحذف');}
  };

  const addCoinsToAll=async amount=>{
    if(!window.confirm(`إضافة ${amount} رصيد لجميع اللاعبين؟`))return;
    try{
      for(const p of players){
        await updateDoc(doc(db,'users',p.id),{coins:(p.coins||0)+amount});
      }
      setPlayers(ps=>ps.map(p=>({...p,coins:(p.coins||0)+amount})));
      showToast(`✅ تمت إضافة ${amount} رصيد للجميع`);
    }catch(e){showToast('❌ فشل');}
  };

  const filtered=players.filter(p=>
    !search||
    p.name?.toLowerCase().includes(search.toLowerCase())||
    p.city?.includes(search)||
    p.id?.includes(search)
  );

  if(!auth)return(
    <div style={{minHeight:'100vh',background:T.night,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Segoe UI,Tahoma,Arial,sans-serif'}}>
      <div style={{background:T.bg2,border:`2px solid ${T.gold}`,borderRadius:20,padding:40,maxWidth:340,width:'100%',textAlign:'center',boxShadow:`0 0 60px ${T.gold}22`}}>
        <div style={{fontSize:48,marginBottom:12}}>🔐</div>
        <div style={{color:T.gold,fontSize:22,fontWeight:900,marginBottom:4}}>لوحة التحكم</div>
        <div style={{color:T.smoke,fontSize:13,marginBottom:24}}>بلوت المملكة — Admin</div>
        <input
          type="password"
          value={pin}
          onChange={e=>setPin(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&(pin===ADMIN_PIN?setAuth(true):showToast('❌ رمز خاطئ'))}
          placeholder="أدخل رمز الدخول..."
          style={{background:'#0a1a0a',border:`1.5px solid ${T.greenL}`,borderRadius:12,padding:'13px 16px',color:'#fff',fontSize:16,textAlign:'center',outline:'none',fontFamily:'inherit',width:'100%',marginBottom:12,boxSizing:'border-box'}}
        />
        <button
          onClick={()=>pin===ADMIN_PIN?setAuth(true):showToast('❌ رمز خاطئ')}
          style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,border:'none',borderRadius:12,padding:'14px',fontWeight:900,cursor:'pointer',fontSize:16,width:'100%',fontFamily:'inherit'}}>
          دخول
        </button>
        {toast&&<div style={{marginTop:12,color:T.redL,fontSize:13}}>{toast}</div>}
      </div>
    </div>
  );

  return(
    <div style={{minHeight:'100vh',background:T.night,fontFamily:'Segoe UI,Tahoma,Arial,sans-serif',color:T.cream}}>
      {/* Header */}
      <div style={{background:T.bg2,borderBottom:`1px solid ${T.border}`,padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:100}}>
        <div style={{color:T.gold,fontSize:20,fontWeight:900}}>🃏 لوحة تحكم بلوت المملكة</div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <button onClick={loadPlayers} style={{background:'#0a2a0a',color:T.greenL,border:`1px solid ${T.greenL}44`,borderRadius:10,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>🔄 تحديث</button>
          <button onClick={()=>setAuth(false)} style={{background:'#3a0a0a',color:T.redL,border:`1px solid ${T.red}44`,borderRadius:10,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>خروج</button>
        </div>
      </div>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 16px'}}>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:16,marginBottom:24}}>
          <StatCard label="إجمالي اللاعبين" value={stats.total} color={T.gold} icon="👥"/>
          <StatCard label="إجمالي الرصيد" value={stats.totalCoins.toLocaleString()} color={T.greenL} icon="🪙"/>
          <StatCard label="إجمالي الانتصارات" value={stats.totalWins} color={T.blueL||'#2E86C1'} icon="🏆"/>
          <StatCard label="أعضاء VIP" value={stats.vip} color={T.gold} icon="👑"/>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:10,marginBottom:20}}>
          {[{id:'players',l:'👥 اللاعبون'},{id:'actions',l:'⚡ إجراءات جماعية'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'9px 18px',borderRadius:12,border:`1px solid ${tab===t.id?T.gold:'rgba(255,255,255,0.1)'}`,background:tab===t.id?'rgba(201,168,76,0.15)':'transparent',color:tab===t.id?T.gold:T.smoke,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{t.l}</button>
          ))}
        </div>

        {tab==='players'&&(
          <div style={{display:'grid',gridTemplateColumns:selected?'1fr 360px':'1fr',gap:16}}>
            {/* Players list */}
            <div>
              <input
                value={search}
                onChange={e=>setSearch(e.target.value)}
                placeholder="بحث باسم أو مدينة أو ID..."
                style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,padding:'11px 16px',color:'#fff',fontSize:14,outline:'none',fontFamily:'inherit',width:'100%',marginBottom:14,boxSizing:'border-box',direction:'rtl'}}
              />
              {loading?(
                <div style={{textAlign:'center',color:T.smoke,padding:40}}>جاري التحميل...</div>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {filtered.map(p=>(
                    <div
                      key={p.id}
                      onClick={()=>{setSelected(p);setEditCoins(p.coins?.toString()||'0');}}
                      style={{background:selected?.id===p.id?'rgba(201,168,76,0.08)':T.bg2,border:`1px solid ${selected?.id===p.id?T.gold:p.banned?T.red+'44':'rgba(255,255,255,0.07)'}`,borderRadius:14,padding:'14px 18px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,transition:'all 0.2s'}}>
                      <div style={{fontSize:28}}>{p.avatar||'🧔'}</div>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{color:T.cream,fontWeight:700,fontSize:15}}>{p.name||'لاعب'}</div>
                          {p.isVip&&<div style={{background:'rgba(201,168,76,0.2)',color:T.gold,fontSize:9,padding:'2px 6px',borderRadius:6,fontWeight:700}}>👑 VIP</div>}
                          {p.banned&&<div style={{background:'rgba(192,57,43,0.2)',color:T.redL,fontSize:9,padding:'2px 6px',borderRadius:6,fontWeight:700}}>🚫 محظور</div>}
                        </div>
                        <div style={{color:T.smoke,fontSize:11,marginTop:2}}>📍 {p.city||'—'} · {p.wins||0} انتصار · {p.losses||0} هزيمة</div>
                      </div>
                      <div style={{textAlign:'center'}}>
                        <div style={{color:T.goldL,fontSize:18,fontWeight:900}}>🪙 {p.coins||0}</div>
                      </div>
                    </div>
                  ))}
                  {filtered.length===0&&<div style={{textAlign:'center',color:T.smoke,padding:40}}>لا يوجد نتائج</div>}
                </div>
              )}
            </div>

            {/* Player detail */}
            {selected&&(
              <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:16,padding:20,height:'fit-content',position:'sticky',top:80}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                  <div style={{color:T.gold,fontWeight:700,fontSize:16}}>تفاصيل اللاعب</div>
                  <button onClick={()=>setSelected(null)} style={{background:'transparent',color:T.smoke,border:'none',cursor:'pointer',fontSize:18}}>✕</button>
                </div>
                <div style={{textAlign:'center',marginBottom:16}}>
                  <div style={{fontSize:48}}>{selected.avatar||'🧔'}</div>
                  <div style={{color:T.cream,fontWeight:700,fontSize:18,marginTop:6}}>{selected.name||'لاعب'}</div>
                  <div style={{color:T.smoke,fontSize:12,marginTop:3}}>{selected.id}</div>
                  {selected.city&&<div style={{color:T.greenL,fontSize:12,marginTop:2}}>📍 {selected.city}</div>}
                </div>

                {/* Stats */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:16}}>
                  {[{l:'انتصار',v:selected.wins||0,c:T.greenL},{l:'هزيمة',v:selected.losses||0,c:T.redL},{l:'رصيد',v:selected.coins||0,c:T.gold}].map(s=>(
                    <div key={s.l} style={{background:'#0a0a14',border:`1px solid ${s.c}33`,borderRadius:10,padding:'8px',textAlign:'center'}}>
                      <div style={{color:s.c,fontSize:18,fontWeight:900}}>{s.v}</div>
                      <div style={{color:T.smoke,fontSize:10}}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Edit coins */}
                <div style={{marginBottom:12}}>
                  <div style={{color:T.smoke,fontSize:11,marginBottom:6}}>تعديل الرصيد</div>
                  <div style={{display:'flex',gap:8}}>
                    <input
                      type="number"
                      value={editCoins}
                      onChange={e=>setEditCoins(e.target.value)}
                      style={{flex:1,background:'#0a1a0a',border:`1px solid ${T.greenL}44`,borderRadius:10,padding:'9px 12px',color:'#fff',fontSize:14,outline:'none',fontFamily:'inherit'}}
                    />
                    <button onClick={()=>updateCoins(selected.id,editCoins)} style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,border:'none',borderRadius:10,padding:'9px 16px',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>حفظ</button>
                  </div>
                  <div style={{display:'flex',gap:6,marginTop:6}}>
                    {[100,500,1000].map(a=>(
                      <button key={a} onClick={()=>{const nc=(selected.coins||0)+a;setEditCoins(nc.toString());updateCoins(selected.id,nc);}} style={{flex:1,background:'rgba(201,168,76,0.1)',color:T.gold,border:`1px solid ${T.gold}33`,borderRadius:8,padding:'6px',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'inherit'}}>+{a}</button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <button onClick={()=>toggleVip(selected.id,selected.isVip)} style={{background:selected.isVip?'rgba(192,57,43,0.15)':'rgba(201,168,76,0.15)',color:selected.isVip?T.redL:T.gold,border:`1px solid ${selected.isVip?T.red:T.gold}44`,borderRadius:10,padding:'10px',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>
                    {selected.isVip?'❌ إلغاء VIP':'👑 تفعيل VIP'}
                  </button>
                  <button onClick={()=>toggleBan(selected.id,selected.banned)} style={{background:selected.banned?'rgba(26,138,74,0.15)':'rgba(192,57,43,0.15)',color:selected.banned?T.greenL:T.redL,border:`1px solid ${selected.banned?T.greenL:T.red}44`,borderRadius:10,padding:'10px',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>
                    {selected.banned?'✅ رفع الحظر':'🚫 حظر اللاعب'}
                  </button>
                  <button onClick={()=>deletePlayer(selected.id)} style={{background:'rgba(192,57,43,0.1)',color:T.redL,border:`1px solid ${T.red}33`,borderRadius:10,padding:'10px',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>
                    🗑️ حذف اللاعب نهائياً
                  </button>
                </div>

                {/* Owned items */}
                {selected.owned&&(
                  <div style={{marginTop:14,padding:12,background:'#0a0a14',borderRadius:10,border:`1px solid ${T.border}`}}>
                    <div style={{color:T.smoke,fontSize:11,marginBottom:8,fontWeight:700}}>العناصر المملوكة</div>
                    <div style={{fontSize:11,color:T.cream}}>
                      <div>🃏 سكنات: {(selected.owned.decks||[]).join(', ')||'—'}</div>
                      <div style={{marginTop:4}}>🎮 طاولات: {(selected.owned.tables||[]).join(', ')||'—'}</div>
                      <div style={{marginTop:4}}>😤 ردود: {(selected.owned.reactions||[]).join(', ')||'—'}</div>
                    </div>
                  </div>
                )}

                {/* Account info */}
                <div style={{marginTop:12,padding:12,background:'#0a0a14',borderRadius:10,border:`1px solid ${T.border}`}}>
                  <div style={{color:T.smoke,fontSize:11,marginBottom:8,fontWeight:700}}>معلومات الحساب</div>
                  <div style={{fontSize:11,color:T.smoke}}>
                    <div>📅 تاريخ الإنشاء: {selected.createdAt?new Date(selected.createdAt).toLocaleDateString('ar-SA'):'—'}</div>
                    <div style={{marginTop:4}}>🃏 السكن النشط: {selected.activeDeck||'classic'}</div>
                    <div style={{marginTop:4}}>🎮 الطاولة النشطة: {selected.activeTable||'classic'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='actions'&&(
          <div style={{maxWidth:600}}>
            <div style={{color:T.goldL,fontSize:18,fontWeight:700,marginBottom:16}}>⚡ إجراءات جماعية</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[{label:'إضافة 100 رصيد للجميع',amount:100,color:T.greenL},{label:'إضافة 500 رصيد للجميع',amount:500,color:T.gold},{label:'إضافة 1000 رصيد للجميع 🎁',amount:1000,color:T.goldL}].map(a=>(
                <div key={a.amount} style={{background:T.bg2,border:`1px solid ${a.color}33`,borderRadius:14,padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{color:T.cream,fontWeight:700,fontSize:14}}>{a.label}</div>
                    <div style={{color:T.smoke,fontSize:11,marginTop:3}}>{players.length} لاعب · إجمالي {(a.amount*players.length).toLocaleString()} رصيد</div>
                  </div>
                  <button onClick={()=>addCoinsToAll(a.amount)} style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,border:'none',borderRadius:10,padding:'10px 18px',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:'inherit',whiteSpace:'nowrap'}}>تطبيق</button>
                </div>
              ))}
              <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:14,padding:'16px 20px'}}>
                <div style={{color:T.cream,fontWeight:700,fontSize:14,marginBottom:10}}>تصدير بيانات اللاعبين</div>
                <button onClick={()=>{
                  const csv=['الاسم,المدينة,الرصيد,الانتصارات,الهزائم,VIP,محظور',...players.map(p=>`${p.name||''},${p.city||''},${p.coins||0},${p.wins||0},${p.losses||0},${p.isVip?'نعم':'لا'},${p.banned?'نعم':'لا'}`)].join('\n');
                  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
                  const url=URL.createObjectURL(blob);
                  const a=document.createElement('a');a.href=url;a.download='players.csv';a.click();
                  showToast('✅ تم تصدير البيانات');
                }} style={{background:`linear-gradient(135deg,${T.green},${T.greenL})`,color:'#fff',border:'none',borderRadius:10,padding:'10px 18px',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>
                  📥 تصدير CSV
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,fontWeight:900,fontSize:14,padding:'12px 24px',borderRadius:24,zIndex:9999,whiteSpace:'nowrap',boxShadow:`0 8px 30px ${T.gold}44`}}>{toast}</div>}
    </div>
  );
}
