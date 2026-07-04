import React,{useState,useEffect,useRef}from'react';
import{db}from'./firebase';
import{doc,getDoc,setDoc,updateDoc,collection,query,where,getDocs,addDoc,onSnapshot,orderBy,limit}from'firebase/firestore';
import{claimDailyReward}from'./functions';
import{useLang}from'./i18n';

const T={gold:'#C9A84C',goldL:'#F0C060',green:'#006C35',greenL:'#1a8a4a',night:'#07070F',bg2:'#0D0D1A',cream:'#F0EEE8',red:'#C0392B',redL:'#E74C3C',smoke:'#888',border:'#C9A84C33',blueL:'#2E86C1'};

// ── Daily Rewards Config ──────────────────────────────────
const DAILY_REWARDS=[
  {day:1, coins:50,  icon:'🪙', label:'يوم ١'},
  {day:2, coins:75,  icon:'🪙', label:'يوم ٢'},
  {day:3, coins:100, icon:'💰', label:'يوم ٣'},
  {day:4, coins:150, icon:'💰', label:'يوم ٤'},
  {day:5, coins:200, icon:'🏆', label:'يوم ٥'},
  {day:6, coins:300, icon:'🏆', label:'يوم ٦'},
  {day:7, coins:500, icon:'👑', label:'يوم ٧', bonus:'مكافأة VIP!'},
];

// ── Daily Reward Popup ────────────────────────────────────
export function DailyRewardPopup({userId,profile,onClaim,onClose}){
  const{t,dir}=useLang();
  const[claimed,setClaimed]=useState(false);
  const[reward,setReward]=useState(null);
  const[streak,setStreak]=useState(0);

  useEffect(()=>{
    if(!userId)return;
    const checkReward=async()=>{
      try{
        const ref=doc(db,'users',userId);
        const snap=await getDoc(ref);
        if(!snap.exists())return;
        const data=snap.data();
        const lastClaim=data.lastDailyClaim||0;
        const now=Date.now();
        const oneDayMs=86400000;
        const hoursSince=(now-lastClaim)/3600000;
        if(hoursSince<20)return; // Already claimed today
        const currentStreak=data.dailyStreak||0;
        const streakBroken=hoursSince>48;
        const newStreak=streakBroken?1:Math.min(currentStreak+1,7);
        const dayReward=DAILY_REWARDS[newStreak-1];
        setStreak(newStreak);
        setReward(dayReward);
      }catch(e){}
    };
    checkReward();
  },[userId]);

  if(!reward)return null;

  const claim=async()=>{
    if(claimed||!userId)return;
    try{
      // Server computes streak + reward and grants the coins authoritatively.
      const res=await claimDailyReward();
      const newCoins=(profile?.coins||0)+(res?.reward??reward.coins);
      setClaimed(true);
      onClaim&&onClaim({coins:newCoins,dailyStreak:res?.dailyStreak??streak});
      setTimeout(onClose,2000);
    }catch(e){/* already claimed or offline */}
  };

  return(
    <div style={{position:'fixed',inset:0,background:'#000c',display:'flex',alignItems:'center',justifyContent:'center',zIndex:600,padding:16,backdropFilter:'blur(8px)',direction:dir}}>
      <div style={{background:`linear-gradient(135deg,#0D2A1A,#071f10)`,border:`2px solid ${T.gold}`,borderRadius:24,padding:28,maxWidth:340,width:'100%',textAlign:'center',boxShadow:`0 0 80px ${T.gold}33`}}>
        {/* Stars */}
        <div style={{fontSize:48,marginBottom:8,animation:'bounce 0.6s ease'}}>
          {claimed?'🎉':reward.icon}
        </div>
        <div style={{color:T.gold,fontSize:20,fontWeight:800,marginBottom:4}}>
          {claimed?t('daily_claimed'):t('daily_title')+' 🎁'}
        </div>
        <div style={{color:T.smoke,fontSize:13,marginBottom:20}}>
          {claimed?t('daily_added',{n:reward.coins}):t('daily_sub')}
        </div>

        {/* Streak days */}
        <div style={{display:'flex',gap:6,justifyContent:'center',marginBottom:20,flexWrap:'wrap'}}>
          {DAILY_REWARDS.map((r,i)=>{
            const isToday=r.day===streak;
            const isDone=r.day<streak;
            return(
              <div key={r.day} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                <div style={{width:36,height:36,borderRadius:10,
                  background:isDone?`${T.greenL}22`:isToday?`${T.gold}33`:'rgba(255,255,255,0.05)',
                  border:`1.5px solid ${isDone?T.greenL:isToday?T.gold:'rgba(255,255,255,0.1)'}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:16,position:'relative',
                  boxShadow:isToday?`0 0 12px ${T.gold}66`:'none'}}>
                  {isDone?'✓':r.icon}
                  {isToday&&<div style={{position:'absolute',top:-4,left:'50%',transform:'translateX(-50%)',width:6,height:6,borderRadius:'50%',background:T.gold}}/>}
                </div>
                <div style={{fontSize:8,color:isDone?T.greenL:isToday?T.gold:T.smoke,fontWeight:isToday?700:400}}>
                  {r.coins}🪙
                </div>
              </div>
            );
          })}
        </div>

        {/* Today's reward highlight */}
        <div style={{background:`${T.gold}22`,border:`1px solid ${T.gold}44`,borderRadius:16,padding:'14px',marginBottom:16}}>
          <div style={{color:T.smoke,fontSize:11,marginBottom:4}}>{t('daily_todayReward',{n:streak})}</div>
          <div style={{color:T.goldL,fontSize:32,fontWeight:800}}>{reward.coins} 🪙</div>
          {reward.bonus&&<div style={{color:T.greenL,fontSize:12,marginTop:4,fontWeight:700}}>{t('daily_vipBonus')}</div>}
        </div>

        {!claimed?(
          <button onClick={claim} style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,border:'none',borderRadius:14,padding:'14px',fontWeight:800,cursor:'pointer',fontSize:17,width:'100%',fontFamily:'inherit',boxShadow:`0 4px 20px ${T.gold}66`}}>
            🎁 {t('daily_claim')}
          </button>
        ):(
          <div style={{color:T.greenL,fontSize:16,fontWeight:700}}>✅ {t('daily_claimed')}</div>
        )}

        <button onClick={onClose} style={{marginTop:10,background:'transparent',color:T.smoke,border:'none',cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>
          {claimed?'':t('ob_skip')}
        </button>
      </div>
      <style>{`@keyframes bounce{0%{transform:scale(0.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}`}</style>
    </div>
  );
}

// ── Push Notifications ────────────────────────────────────
export async function requestNotificationPermission(userId){
  if(!('Notification' in window))return null;
  if(Notification.permission==='granted')return Notification.permission;
  const perm=await Notification.requestPermission();
  return perm;
}

export function sendLocalNotification(title,body,icon='🃏'){
  if(Notification.permission!=='granted')return;
  try{
    new Notification(title,{body,icon:'/icon-192.png',badge:'/icon-192.png',tag:'baloot',renotify:true});
  }catch(e){}
}

export function useNotifications(userId,roomCode){
  useEffect(()=>{
    if(!userId||!roomCode)return;
    // Listen for game invites
    const unsub=onSnapshot(doc(db,'rooms',roomCode),(snap)=>{
      if(!snap.exists())return;
      const data=snap.data();
      // Notify when it's your turn - handled in game
    });
    return unsub;
  },[userId,roomCode]);
}

export function NotificationBanner({message,onClose}){
  useEffect(()=>{
    const t=setTimeout(onClose,4000);
    return()=>clearTimeout(t);
  },[]);
  return(
    <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',
      background:`linear-gradient(135deg,${T.green},${T.greenL})`,
      color:'#fff',fontWeight:700,fontSize:14,
      padding:'12px 20px',borderRadius:16,zIndex:9999,
      whiteSpace:'nowrap',boxShadow:'0 8px 30px #00000066',
      display:'flex',alignItems:'center',gap:10,
      animation:'slideDown 0.3s ease'}}>
      <span>🃏</span>
      <span>{message}</span>
      <button onClick={onClose} style={{background:'transparent',border:'none',color:'#fff',cursor:'pointer',fontSize:16,marginRight:-4}}>✕</button>
      <style>{`@keyframes slideDown{0%{transform:translateX(-50%) translateY(-20px);opacity:0}100%{transform:translateX(-50%) translateY(0);opacity:1}}`}</style>
    </div>
  );
}

// ── Friend System ─────────────────────────────────────────
export function FriendSystem({userId,userProfile,onInvite,currentRoomCode}){
  const{t,dir}=useLang();
  const[tab,setTab]=useState('friends');
  const[friends,setFriends]=useState([]);
  const[requests,setRequests]=useState([]);
  const[search,setSearch]=useState('');
  const[searchResults,setSearchResults]=useState([]);
  const[searching,setSearching]=useState(false);
  const[toast,setToast]=useState(null);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),2000);};

  // Load friends
  useEffect(()=>{
    if(!userId)return;
    const unsub=onSnapshot(collection(db,'users',userId,'friends'),snap=>{
      setFriends(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    const unsub2=onSnapshot(
      query(collection(db,'friendRequests'),where('to','==',userId),where('status','==','pending')),
      snap=>{setRequests(snap.docs.map(d=>({id:d.id,...d.data()})));}
    );
    return()=>{unsub();unsub2();};
  },[userId]);

  const searchPlayers=async()=>{
    if(!search.trim())return;
    setSearching(true);
    try{
      const q=query(collection(db,'users'),where('name','>=',search),where('name','<=',search+'\uf8ff'),limit(10));
      const snap=await getDocs(q);
      const results=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.id!==userId);
      setSearchResults(results);
    }catch(e){}
    setSearching(false);
  };

  const sendRequest=async(toUser)=>{
    try{
      await addDoc(collection(db,'friendRequests'),{
        from:userId,fromName:userProfile?.name||t('player'),fromAvatar:userProfile?.avatar||'🧔',
        to:toUser.id,toName:toUser.name,
        status:'pending',createdAt:Date.now()
      });
      showToast(t('fr_reqSent'));
    }catch(e){showToast(t('fr_sendFail'));}
  };

  const acceptRequest=async(request)=>{
    try{
      // Add to both friends lists
      await setDoc(doc(db,'users',userId,'friends',request.from),{
        uid:request.from,name:request.fromName,avatar:request.fromAvatar,addedAt:Date.now()
      });
      await setDoc(doc(db,'users',request.from,'friends',userId),{
        uid:userId,name:userProfile?.name||t('player'),avatar:userProfile?.avatar||'🧔',addedAt:Date.now()
      });
      await updateDoc(doc(db,'friendRequests',request.id),{status:'accepted'});
      showToast(t('fr_added'));
    }catch(e){showToast(t('fr_fail'));}
  };

  const rejectRequest=async(requestId)=>{
    try{
      await updateDoc(doc(db,'friendRequests',requestId),{status:'rejected'});
    }catch(e){}
  };

  const inviteFriend=async(friend)=>{
    if(!currentRoomCode){showToast(t('fr_createRoomFirst'));return;}
    try{
      await addDoc(collection(db,'notifications'),{
        to:friend.uid,type:'game_invite',
        fromName:userProfile?.name||t('player'),fromAvatar:userProfile?.avatar||'🧔',
        roomCode:currentRoomCode,createdAt:Date.now(),read:false
      });
      showToast(t('fr_inviteSent',{name:friend.name}));
    }catch(e){showToast(t('fr_sendFail'));}
  };

  return(
    <div style={{minHeight:'100vh',background:T.night,fontFamily:'Changa,sans-serif',color:T.cream,paddingBottom:80,direction:dir}}>
      {/* Header */}
      <div style={{background:T.bg2,borderBottom:`1px solid ${T.border}`,padding:'20px 20px 0',position:'sticky',top:0,zIndex:100}}>
        <div style={{color:T.gold,fontSize:20,fontWeight:800,marginBottom:4}}>👥 {t('nav_friends')}</div>
        <div style={{color:T.smoke,fontSize:12,marginBottom:14}}>{t('friends_sub')}</div>
        <div style={{display:'flex',gap:8}}>
          {[{id:'friends',l:`${t('fr_my')} (${friends.length})`},{id:'requests',l:`${t('fr_requests')} ${requests.length>0?`(${requests.length})`:''}`},{id:'search',l:t('fr_search')}].map(tb=>(
            <button key={tb.id} onClick={()=>setTab(tb.id)} style={{padding:'7px 14px',borderRadius:'10px 10px 0 0',border:`1px solid ${tab===tb.id?T.gold:'rgba(255,255,255,0.1)'}`,borderBottom:'none',background:tab===tb.id?`${T.gold}15`:'transparent',color:tab===tb.id?T.gold:T.smoke,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',position:'relative'}}>
              {tb.l}
              {tb.id==='requests'&&requests.length>0&&<div style={{position:'absolute',top:-4,insetInlineEnd:-4,width:8,height:8,borderRadius:'50%',background:T.redL}}/>}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:'16px'}}>
        {/* Friends list */}
        {tab==='friends'&&(
          <div>
            {friends.length===0?(
              <div style={{textAlign:'center',padding:40}}>
                <div style={{fontSize:48,marginBottom:12}}>👥</div>
                <div style={{color:T.smoke,fontSize:14,marginBottom:8}}>{t('fr_none')}</div>
                <button onClick={()=>setTab('search')} style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,border:'none',borderRadius:12,padding:'10px 24px',fontWeight:700,cursor:'pointer',fontSize:14,fontFamily:'inherit'}}>{t('fr_findFriends')}</button>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {friends.map(f=>(
                  <div key={f.id} style={{background:T.bg2,border:`1px solid rgba(255,255,255,0.07)`,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:44,height:44,borderRadius:'50%',background:`${T.greenL}22`,border:`2px solid ${T.greenL}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{f.avatar||'🧔'}</div>
                    <div style={{flex:1}}>
                      <div style={{color:T.cream,fontWeight:700,fontSize:15}}>{f.name||t('player')}</div>
                      <div style={{color:T.smoke,fontSize:11,marginTop:2}}>{f.wins||0} {t('winsShort')}</div>
                    </div>
                    {currentRoomCode&&(
                      <button onClick={()=>inviteFriend(f)} style={{background:`${T.greenL}22`,color:T.greenL,border:`1px solid ${T.greenL}44`,borderRadius:10,padding:'7px 14px',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>{t('fr_invite')} 🎮</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Friend requests */}
        {tab==='requests'&&(
          <div>
            {requests.length===0?(
              <div style={{textAlign:'center',padding:40,color:T.smoke,fontSize:14}}>{t('fr_noRequests')}</div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {requests.map(r=>(
                  <div key={r.id} style={{background:T.bg2,border:`1px solid ${T.gold}33`,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
                    <div style={{fontSize:28}}>{r.fromAvatar||'🧔'}</div>
                    <div style={{flex:1}}>
                      <div style={{color:T.cream,fontWeight:700,fontSize:15}}>{r.fromName||t('player')}</div>
                      <div style={{color:T.smoke,fontSize:11,marginTop:2}}>{t('fr_wantsAdd')}</div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>acceptRequest(r)} style={{background:`${T.greenL}22`,color:T.greenL,border:`1px solid ${T.greenL}44`,borderRadius:10,padding:'7px 12px',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>✅ {t('fr_accept')}</button>
                      <button onClick={()=>rejectRequest(r.id)} style={{background:`${T.redL}11`,color:T.redL,border:`1px solid ${T.red}33`,borderRadius:10,padding:'7px 12px',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>❌</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        {tab==='search'&&(
          <div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchPlayers()} placeholder={t('fr_searchPlaceholder')} style={{flex:1,background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,padding:'11px 16px',color:'#fff',fontSize:14,outline:'none',fontFamily:'inherit',direction:dir}}/>
              <button onClick={searchPlayers} style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,border:'none',borderRadius:12,padding:'11px 18px',fontWeight:700,cursor:'pointer',fontSize:14,fontFamily:'inherit'}}>
                {searching?'...':t('fr_search')}
              </button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {searchResults.map(p=>{
                const isFriend=friends.some(f=>f.uid===p.id||f.id===p.id);
                return(
                  <div key={p.id} style={{background:T.bg2,border:`1px solid rgba(255,255,255,0.07)`,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
                    <div style={{fontSize:28}}>{p.avatar||'🧔'}</div>
                    <div style={{flex:1}}>
                      <div style={{color:T.cream,fontWeight:700,fontSize:15}}>{p.name||t('player')}</div>
                      <div style={{color:T.smoke,fontSize:11,marginTop:2}}>📍 {p.city||'—'} · {p.wins||0} {t('winsShort')}</div>
                    </div>
                    {isFriend?(
                      <div style={{color:T.greenL,fontSize:12,fontWeight:700}}>✓ {t('fr_isFriend')}</div>
                    ):(
                      <button onClick={()=>sendRequest(p)} style={{background:`${T.gold}22`,color:T.gold,border:`1px solid ${T.gold}44`,borderRadius:10,padding:'7px 14px',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>{t('fr_add')} +</button>
                    )}
                  </div>
                );
              })}
              {searchResults.length===0&&search&&!searching&&(
                <div style={{textAlign:'center',color:T.smoke,padding:30,fontSize:13}}>{t('fr_noResults')}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast&&<div style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,fontWeight:800,fontSize:14,padding:'12px 24px',borderRadius:24,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}
    </div>
  );
}

// ── Notification Center ───────────────────────────────────
export function NotificationCenter({userId,onGameInvite}){
  const{t,dir}=useLang();
  const[notifs,setNotifs]=useState([]);
  const[open,setOpen]=useState(false);

  useEffect(()=>{
    if(!userId)return;
    const unsub=onSnapshot(
      query(collection(db,'notifications'),where('to','==',userId),where('read','==',false),orderBy('createdAt','desc'),limit(20)),
      snap=>{setNotifs(snap.docs.map(d=>({id:d.id,...d.data()})));}
    );
    return unsub;
  },[userId]);

  const markRead=async(id)=>{
    await updateDoc(doc(db,'notifications',id),{read:true});
  };

  const handleNotif=async(n)=>{
    await markRead(n.id);
    if(n.type==='game_invite'&&onGameInvite){onGameInvite(n.roomCode);}
    setOpen(false);
  };

  return(
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(o=>!o)} style={{background:'#00000033',border:`1px solid ${T.border}`,borderRadius:10,padding:'6px 10px',cursor:'pointer',fontSize:16,position:'relative',backdropFilter:'blur(4px)'}}>
        🔔
        {notifs.length>0&&<div style={{position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:'50%',background:T.redL,color:'#fff',fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${T.night}`}}>{notifs.length>9?'9+':notifs.length}</div>}
      </button>
      {open&&(
        <div style={{position:'absolute',top:44,insetInlineEnd:0,width:300,background:T.bg2,border:`1px solid ${T.border}`,borderRadius:16,overflow:'hidden',boxShadow:'0 8px 32px #00000088',zIndex:500,direction:dir}}>
          <div style={{background:'#0a1a0a',padding:'12px 16px',borderBottom:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{color:T.gold,fontWeight:700,fontSize:14}}>🔔 {t('notif_title')}</div>
            <button onClick={()=>setOpen(false)} style={{background:'transparent',border:'none',color:T.smoke,cursor:'pointer',fontSize:16}}>✕</button>
          </div>
          <div style={{maxHeight:300,overflowY:'auto'}}>
            {notifs.length===0?(
              <div style={{textAlign:'center',color:T.smoke,padding:24,fontSize:13}}>{t('notif_none')}</div>
            ):notifs.map(n=>(
              <div key={n.id} onClick={()=>handleNotif(n)} style={{padding:'12px 16px',borderBottom:`1px solid rgba(255,255,255,0.05)`,cursor:'pointer',display:'flex',gap:10,alignItems:'center',transition:'background 0.2s'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{fontSize:24}}>{n.fromAvatar||'🧔'}</div>
                <div style={{flex:1}}>
                  <div style={{color:T.cream,fontSize:13,fontWeight:600}}>
                    {n.type==='game_invite'?`${n.fromName} ${t('notif_invited')} 🎮`:n.type==='friend_request'?`${n.fromName} ${t('notif_friendReq')}`:n.message||t('notif_new')}
                  </div>
                  {n.type==='game_invite'&&<div style={{color:T.greenL,fontSize:11,marginTop:2,fontWeight:700}}>{t('notif_roomCode')}: {n.roomCode}</div>}
                </div>
                {n.type==='game_invite'&&<div style={{background:`${T.greenL}22`,color:T.greenL,fontSize:10,padding:'3px 8px',borderRadius:8,fontWeight:700,whiteSpace:'nowrap'}}>{t('notif_join')} ▶</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
