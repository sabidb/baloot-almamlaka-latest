import React,{useState,useEffect,useRef}from'react';
import{db}from'./firebase';
import{collection,doc,setDoc,getDoc,getDocs,updateDoc,onSnapshot,query,orderBy,where,limit,serverTimestamp,increment}from'firebase/firestore';
import{useLang,t as tr}from'./i18n';

const T={gold:'#C9A84C',goldL:'#F0C060',green:'#006C35',greenL:'#1a8a4a',greenD:'#004D26',night:'#07070F',felt:'#0D4A2A',bg2:'#0D0D1A',bg3:'#121225',cream:'#F0EEE8',red:'#C0392B',redL:'#E74C3C',blue:'#1A4A8A',blueL:'#2E86C1',smoke:'#888',border:'#C9A84C33'};

// name/freq are i18n keys resolved at render; icon shown separately.
const TOURNAMENTS_CONFIG=[
  {id:'weekly_8',  nameKey:'tourn_weekly', icon:'⚔️',  size:8,  rounds:3, entryCoins:100, entrySAR:10, prizeCoins:600,  prizeSAR:60,  color:'#2E86C1', freqKey:'freq_weekly'},
  {id:'monthly_16',nameKey:'tourn_kingdom',icon:'👑',  size:16, rounds:4, entryCoins:500, entrySAR:50, prizeCoins:4000, prizeSAR:400, color:'#C9A84C', freqKey:'freq_monthly'},
  {id:'quick_8',   nameKey:'tourn_quick',  icon:'⚡',  size:8,  rounds:3, entryCoins:50,  entrySAR:5,  prizeCoins:300,  prizeSAR:30,  color:'#1a8a4a', freqKey:'freq_daily'},
  {id:'mega_16',   nameKey:'tourn_mega',   icon:'🔥',  size:16, rounds:4, entryCoins:200, entrySAR:20, prizeCoins:2000, prizeSAR:200, color:'#E74C3C', freqKey:'freq_monthly'},
];
// status label helper (used across components)
const statusLabel=s=>({open:'🟡 '+tr('status_open'),active:'🟢 '+tr('status_active'),completed:'🏁 '+tr('status_completed')}[s]||s);

function genTournamentId(){return'T'+Date.now().toString(36).toUpperCase();}

function buildBracket(players){
  const shuffled=[...players].sort(()=>Math.random()-0.5);
  const matches=[];
  for(let i=0;i<shuffled.length;i+=2){
    matches.push({p1:shuffled[i],p2:shuffled[i+1]||null,winner:null,room:null});
  }
  return matches;
}

function TournamentCard({config,onJoin,onView,userCoins,userId}){
  const{t}=useLang();
  const[tournament,setTournament]=useState(null);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    const fetchLatest=async()=>{
      try{
        const q=query(collection(db,'tournaments'),where('configId','==',config.id),where('status','in',['open','active']),orderBy('createdAt','desc'),limit(1));
        const snap=await getDocs(q);
        if(!snap.empty)setTournament({id:snap.docs[0].id,...snap.docs[0].data()});
        else setTournament(null);
      }catch(e){}
      setLoading(false);
    };
    fetchLatest();
  },[config.id]);

  const players=tournament?.players||[];
  const isFull=players.length>=config.size;
  const isJoined=players.some(p=>p.uid===userId);
  const spotsLeft=config.size-players.length;
  const fillPct=(players.length/config.size)*100;

  return(
    <div style={{background:T.bg2,border:`1px solid ${config.color}44`,borderRadius:20,overflow:'hidden',transition:'all 0.3s',boxShadow:`0 4px 20px ${config.color}22`}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${config.color}22,${config.color}11)`,borderBottom:`1px solid ${config.color}33`,padding:'18px 20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:32,marginBottom:4}}>{config.icon}</div>
            <div style={{color:T.cream,fontSize:17,fontWeight:800}}>{t(config.nameKey)}</div>
            <div style={{color:config.color,fontSize:11,marginTop:3,fontWeight:700}}>{t(config.freqKey)} · {config.size} {t('player')}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{color:config.color,fontSize:22,fontWeight:800}}>{config.prizeCoins.toLocaleString()}</div>
            <div style={{color:T.smoke,fontSize:10}}>🪙 {t('tourn_prize')}</div>
            <div style={{color:T.greenL,fontSize:14,fontWeight:700,marginTop:2}}>{config.prizeSAR} {t('sar')}</div>
          </div>
        </div>
      </div>

      <div style={{padding:'16px 20px'}}>
        {/* Entry options */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
          <div style={{background:`${config.color}11`,border:`1px solid ${config.color}33`,borderRadius:12,padding:'10px',textAlign:'center'}}>
            <div style={{color:config.color,fontSize:16,fontWeight:800}}>🪙 {config.entryCoins}</div>
            <div style={{color:T.smoke,fontSize:10,marginTop:2}}>{t('coinsShort')}</div>
          </div>
          <div style={{background:`${T.greenL}11`,border:`1px solid ${T.greenL}33`,borderRadius:12,padding:'10px',textAlign:'center'}}>
            <div style={{color:T.greenL,fontSize:16,fontWeight:800}}>{config.entrySAR} {t('sar')}</div>
            <div style={{color:T.smoke,fontSize:10,marginTop:2}}>{t('sarFull')}</div>
          </div>
        </div>

        {/* Players progress */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:6}}>
            <span style={{color:T.smoke}}>{t('tourn_registered')}</span>
            <span style={{color:config.color,fontWeight:700}}>{players.length} / {config.size}</span>
          </div>
          <div style={{height:6,background:'#1a2a1a',borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:3,width:`${fillPct}%`,background:`linear-gradient(to right,${config.color},${config.color}cc)`,transition:'width 0.5s ease'}}/>
          </div>
          <div style={{color:isFull?T.redL:T.greenL,fontSize:10,marginTop:4,fontWeight:700}}>
            {isFull?t('tourn_full'):t('tourn_spotsLeft',{n:spotsLeft})}
          </div>
        </div>

        {/* Players avatars */}
        {players.length>0&&(
          <div style={{display:'flex',gap:4,marginBottom:14,flexWrap:'wrap'}}>
            {players.slice(0,8).map((p,i)=>(
              <div key={i} style={{width:28,height:28,borderRadius:'50%',background:`${config.color}22`,border:`1.5px solid ${config.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,position:'relative'}}>
                {p.avatar||'🧔'}
                {p.uid===userId&&<div style={{position:'absolute',bottom:-2,right:-2,width:8,height:8,borderRadius:'50%',background:T.greenL,border:'1px solid '+T.bg2}}/>}
              </div>
            ))}
            {players.length>8&&<div style={{width:28,height:28,borderRadius:'50%',background:'#1a2a1a',border:`1px solid #333`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:T.smoke}}>+{players.length-8}</div>}
          </div>
        )}

        {/* Action buttons */}
        <div style={{display:'flex',gap:8}}>
          {tournament&&<button onClick={()=>onView(tournament)} style={{flex:1,background:'rgba(255,255,255,0.06)',color:T.smoke,border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'10px',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>{t('tourn_view')}</button>}
          {!isJoined&&!isFull&&(
            <button onClick={()=>onJoin(config,tournament)} style={{flex:2,background:`linear-gradient(135deg,${config.color},${config.color}cc)`,color:config.color===T.gold?T.night:'#fff',border:'none',borderRadius:12,padding:'10px',fontWeight:800,cursor:'pointer',fontSize:14,fontFamily:'inherit',boxShadow:`0 4px 16px ${config.color}44`}}>
              {t('tourn_join')}
            </button>
          )}
          {isJoined&&<div style={{flex:2,background:`${T.greenL}22`,color:T.greenL,border:`1px solid ${T.greenL}44`,borderRadius:12,padding:'10px',fontWeight:700,fontSize:13,textAlign:'center'}}>✅ {t('tourn_joined')}</div>}
          {isFull&&!isJoined&&<div style={{flex:2,background:'rgba(192,57,43,0.1)',color:T.redL,border:`1px solid ${T.red}33`,borderRadius:12,padding:'10px',fontWeight:700,fontSize:13,textAlign:'center'}}>{t('tourn_fullShort')}</div>}
        </div>
      </div>
    </div>
  );
}

function BracketView({tournament,config,userId,onClose}){
  const{t:tx,dir}=useLang();
  const[t,setT]=useState(tournament);
  useEffect(()=>{
    const unsub=onSnapshot(doc(db,'tournaments',tournament.id),snap=>{if(snap.exists())setT({id:snap.id,...snap.data()});});
    return unsub;
  },[tournament.id]);

  const rounds=t?.rounds||[];
  const statusColor={open:T.blueL,active:T.gold,completed:T.greenL}[t?.status]||T.smoke;

  return(
    <div style={{position:'fixed',inset:0,background:'#000e',display:'flex',flexDirection:'column',zIndex:400,backdropFilter:'blur(6px)',direction:dir}}>
      {/* Header */}
      <div style={{background:T.bg2,borderBottom:`1px solid ${T.border}`,padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{color:T.gold,fontSize:18,fontWeight:800}}>{config.icon} {tx(config.nameKey)}</div>
          <div style={{display:'flex',gap:8,marginTop:4,alignItems:'center'}}>
            <div style={{background:`${statusColor}22`,color:statusColor,fontSize:10,padding:'2px 8px',borderRadius:8,fontWeight:700,border:`1px solid ${statusColor}44`}}>
              {statusLabel(t?.status)}
            </div>
            <div style={{color:T.smoke,fontSize:11}}>{t?.players?.length||0} / {config.size} {tx('player')}</div>
          </div>
        </div>
        <button onClick={onClose} style={{background:'transparent',color:T.smoke,border:'1px solid #333',borderRadius:10,padding:'8px 14px',cursor:'pointer',fontSize:13}}>✕ {tx('close')}</button>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'20px 16px'}}>
        {/* Prize info */}
        <div style={{background:`linear-gradient(135deg,${T.gold}22,${T.gold}11)`,border:`1px solid ${T.border}`,borderRadius:16,padding:'16px 20px',marginBottom:20,display:'flex',gap:16}}>
          {[{l:'🥇 '+tx('tourn_first'),v:`${Math.floor(config.prizeCoins*0.6).toLocaleString()} 🪙`,sub:`${Math.floor(config.prizeSAR*0.6)} ${tx('sar')}`},{l:'🥈 '+tx('tourn_second'),v:`${Math.floor(config.prizeCoins*0.25).toLocaleString()} 🪙`,sub:`${Math.floor(config.prizeSAR*0.25)} ${tx('sar')}`},{l:'🥉 '+tx('tourn_third'),v:`${Math.floor(config.prizeCoins*0.15).toLocaleString()} 🪙`,sub:`${Math.floor(config.prizeSAR*0.15)} ${tx('sar')}`}].map(p=>(
            <div key={p.l} style={{flex:1,textAlign:'center'}}>
              <div style={{color:T.smoke,fontSize:9,marginBottom:4}}>{p.l}</div>
              <div style={{color:T.goldL,fontSize:14,fontWeight:800}}>{p.v}</div>
              <div style={{color:T.greenL,fontSize:10}}>{p.sub}</div>
            </div>
          ))}
        </div>

        {/* Players list */}
        {t?.status==='open'&&(
          <div style={{marginBottom:20}}>
            <div style={{color:T.gold,fontSize:15,fontWeight:700,marginBottom:12}}>👥 {tx('tourn_registered')}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
              {(t?.players||[]).map((p,i)=>(
                <div key={i} style={{background:T.bg2,border:`1px solid ${p.uid===userId?T.gold:'rgba(255,255,255,0.07)'}`,borderRadius:12,padding:'10px',display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:20}}>{p.avatar||'🧔'}</span>
                  <div>
                    <div style={{color:p.uid===userId?T.gold:T.cream,fontSize:12,fontWeight:700}}>{p.name||tx('player')}{p.uid===userId&&' ✦'}</div>
                    <div style={{color:T.smoke,fontSize:10}}>{p.wins||0} {tx('winsShort')}</div>
                  </div>
                </div>
              ))}
              {Array.from({length:config.size-(t?.players?.length||0)}).map((_,i)=>(
                <div key={'empty'+i} style={{background:'#0a0a14',border:'1px dashed rgba(255,255,255,0.1)',borderRadius:12,padding:'10px',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.2)',fontSize:12}}>{tx('tourn_emptySeat')}</div>
              ))}
            </div>
          </div>
        )}

        {/* Bracket rounds */}
        {rounds.length>0&&(
          <div>
            <div style={{color:T.gold,fontSize:15,fontWeight:700,marginBottom:16}}>🏆 {tx('tourn_matches')}</div>
            {rounds.map((round,ri)=>(
              <div key={ri} style={{marginBottom:24}}>
                <div style={{color:T.smoke,fontSize:12,fontWeight:700,marginBottom:10,letterSpacing:1}}>
                  {ri===rounds.length-1?'🏆 '+tx('tourn_final'):ri===rounds.length-2?'🥊 '+tx('tourn_semi'):tx('tourn_round',{n:ri+1})}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {round.matches?.map((match,mi)=>(
                    <div key={mi} style={{background:T.bg2,border:`1px solid ${match.winner?T.gold:'rgba(255,255,255,0.07)'}`,borderRadius:14,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:match.winner?`0 0 12px ${T.gold}22`:'none'}}>
                      {/* P1 */}
                      <div style={{flex:1,display:'flex',alignItems:'center',gap:8,opacity:match.winner&&match.winner!==match.p1?.uid?0.4:1}}>
                        <span style={{fontSize:20}}>{match.p1?.avatar||'🧔'}</span>
                        <div>
                          <div style={{color:match.winner===match.p1?.uid?T.gold:T.cream,fontWeight:700,fontSize:13}}>{match.p1?.name||tx('player')}</div>
                          {match.winner===match.p1?.uid&&<div style={{color:T.gold,fontSize:10}}>🏆 {tx('tourn_winnerShort')}</div>}
                        </div>
                      </div>
                      {/* VS */}
                      <div style={{color:T.smoke,fontSize:12,fontWeight:700,background:'rgba(255,255,255,0.06)',borderRadius:8,padding:'4px 8px'}}>
                        {match.winner?'✓':match.room?'🔴 '+tx('tourn_liveShort'):'VS'}
                      </div>
                      {/* P2 */}
                      <div style={{flex:1,display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end',opacity:match.winner&&match.winner!==match.p2?.uid?0.4:1}}>
                        <div style={{textAlign:dir==='rtl'?'right':'left'}}>
                          <div style={{color:match.winner===match.p2?.uid?T.gold:T.cream,fontWeight:700,fontSize:13}}>{match.p2?.name||match.p2===null?'BYE':tx('player')}</div>
                          {match.winner===match.p2?.uid&&<div style={{color:T.gold,fontSize:10,textAlign:dir==='rtl'?'right':'left'}}>🏆 {tx('tourn_winnerShort')}</div>}
                        </div>
                        <span style={{fontSize:20}}>{match.p2?.avatar||'🧔'}</span>
                      </div>
                      {/* Room code */}
                      {match.room&&!match.winner&&(
                        <div style={{background:`${T.greenL}22`,color:T.greenL,fontSize:10,padding:'4px 8px',borderRadius:8,fontWeight:700,whiteSpace:'nowrap'}}>
                          {tx('tourn_room')}: {match.room}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Winner */}
        {t?.status==='completed'&&t?.winner&&(
          <div style={{background:`linear-gradient(135deg,${T.gold}22,${T.gold}11)`,border:`2px solid ${T.gold}`,borderRadius:20,padding:24,textAlign:'center',marginTop:16}}>
            <div style={{fontSize:48}}>🏆</div>
            <div style={{color:T.gold,fontSize:20,fontWeight:800,marginTop:8}}>{tx('tourn_champ')}</div>
            <div style={{fontSize:36,marginTop:8}}>{t.winner.avatar||'🧔'}</div>
            <div style={{color:T.goldL,fontSize:18,fontWeight:700,marginTop:4}}>{t.winner.name}</div>
            <div style={{color:T.greenL,fontSize:14,marginTop:8}}>🪙 {Math.floor(config.prizeCoins*0.6).toLocaleString()} {tx('coinsShort')}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function JoinModal({config,tournament,userId,userProfile,onConfirm,onClose}){
  const{t,dir}=useLang();
  const[payMethod,setPayMethod]=useState('coins');
  const hasCoins=(userProfile?.coins||0)>=config.entryCoins;

  return(
    <div style={{position:'fixed',inset:0,background:'#000c',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:16,backdropFilter:'blur(6px)',direction:dir}}>
      <div style={{background:`linear-gradient(135deg,#0D2A1A,#071f10)`,border:`2px solid ${config.color}`,borderRadius:20,padding:28,maxWidth:340,width:'100%',boxShadow:`0 0 60px ${config.color}33`}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:40}}>{config.icon}</div>
          <div style={{color:T.gold,fontSize:18,fontWeight:800,marginTop:8}}>{t(config.nameKey)}</div>
          <div style={{color:T.smoke,fontSize:12,marginTop:4}}>{config.size} {t('player')} · {config.rounds} {t('tourn_rounds')}</div>
        </div>

        {/* Prize */}
        <div style={{background:`${config.color}11`,border:`1px solid ${config.color}33`,borderRadius:14,padding:'12px',marginBottom:16,textAlign:'center'}}>
          <div style={{color:T.smoke,fontSize:11,marginBottom:4}}>🏆 {t('tourn_grandPrize')}</div>
          <div style={{color:T.goldL,fontSize:22,fontWeight:800}}>🪙 {Math.floor(config.prizeCoins*0.6).toLocaleString()}</div>
          <div style={{color:T.greenL,fontSize:13,marginTop:2}}>{Math.floor(config.prizeSAR*0.6)} {t('sarFull')}</div>
        </div>

        {/* Payment method */}
        <div style={{marginBottom:16}}>
          <div style={{color:T.smoke,fontSize:11,marginBottom:8}}>{t('tourn_payMethod')}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <button onClick={()=>setPayMethod('coins')} style={{background:payMethod==='coins'?`${config.color}22`:'transparent',border:`1.5px solid ${payMethod==='coins'?config.color:'rgba(255,255,255,0.1)'}`,borderRadius:12,padding:'12px',cursor:'pointer',fontFamily:'inherit',transition:'all 0.2s'}}>
              <div style={{fontSize:20}}>🪙</div>
              <div style={{color:payMethod==='coins'?config.color:T.smoke,fontSize:13,fontWeight:700,marginTop:4}}>{config.entryCoins} {t('coinsShort')}</div>
              {!hasCoins&&<div style={{color:T.redL,fontSize:9,marginTop:2}}>{t('insufficient')}</div>}
            </button>
            <button onClick={()=>setPayMethod('sar')} style={{background:payMethod==='sar'?`${T.greenL}22`:'transparent',border:`1.5px solid ${payMethod==='sar'?T.greenL:'rgba(255,255,255,0.1)'}`,borderRadius:12,padding:'12px',cursor:'pointer',fontFamily:'inherit',transition:'all 0.2s'}}>
              <div style={{fontSize:20}}>💳</div>
              <div style={{color:payMethod==='sar'?T.greenL:T.smoke,fontSize:13,fontWeight:700,marginTop:4}}>{config.entrySAR} {t('sar')}</div>
            </button>
          </div>
        </div>

        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,background:'transparent',color:T.smoke,border:'1px solid #333',borderRadius:12,padding:'12px',fontWeight:700,cursor:'pointer',fontSize:14,fontFamily:'inherit'}}>{t('cancel')}</button>
          <button
            onClick={()=>onConfirm(payMethod)}
            disabled={payMethod==='coins'&&!hasCoins}
            style={{flex:2,background:payMethod==='coins'&&!hasCoins?'#1a1a1a':`linear-gradient(135deg,${config.color},${config.color}cc)`,color:config.color===T.gold?T.night:'#fff',border:'none',borderRadius:12,padding:'12px',fontWeight:800,cursor:payMethod==='coins'&&!hasCoins?'not-allowed':'pointer',fontSize:15,fontFamily:'inherit',opacity:payMethod==='coins'&&!hasCoins?0.5:1}}>
            {payMethod==='sar'?'💳 '+t('tourn_pay'):'🪙 '+t('tourn_joinPay')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TournamentScreen({userId,userProfile,onUpdateProfile}){
  const{t:tx,dir}=useLang();
  const[joining,setJoining]=useState(null);
  const[viewing,setViewing]=useState(null);
  const[toast,setToast]=useState(null);
  const[myTournaments,setMyTournaments]=useState([]);
  const[tab,setTab]=useState('all');

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),2500);};

  useEffect(()=>{
    if(!userId)return;
    const fetchMine=async()=>{
      try{
        const q=query(collection(db,'tournaments'),where('playerIds','array-contains',userId),orderBy('createdAt','desc'),limit(10));
        const snap=await getDocs(q);
        setMyTournaments(snap.docs.map(d=>({id:d.id,...d.data()})));
      }catch(e){}
    };
    fetchMine();
  },[userId]);

  const joinTournament=async(config,existingTournament,payMethod)=>{
    if(!userId){showToast(tx('tourn_loginFirst'));return;}
    setJoining(null);
    try{
      let tId,tRef;
      if(existingTournament&&existingTournament.status==='open'&&existingTournament.players.length<config.size){
        tId=existingTournament.id;tRef=doc(db,'tournaments',tId);
        const newPlayers=[...existingTournament.players,{uid:userId,name:userProfile?.name||tx('player'),avatar:userProfile?.avatar||'🧔',wins:userProfile?.wins||0}];
        const newIds=[...(existingTournament.playerIds||[]),userId];
        const updates={players:newPlayers,playerIds:newIds};
        if(newPlayers.length>=config.size){
          const rounds=[{matches:buildBracket(newPlayers).map(m=>({...m,room:null,winner:null}))}];
          updates.status='active';updates.rounds=rounds;updates.startedAt=Date.now();
        }
        await updateDoc(tRef,updates);
      }else{
        tId=genTournamentId();tRef=doc(db,'tournaments',tId);
        await setDoc(tRef,{configId:config.id,status:'open',players:[{uid:userId,name:userProfile?.name||tx('player'),avatar:userProfile?.avatar||'🧔',wins:userProfile?.wins||0}],playerIds:[userId],rounds:[],winner:null,createdAt:Date.now(),entryMethod:payMethod,prizePool:{coins:config.prizeCoins,sar:config.prizeSAR}});
      }
      if(payMethod==='coins'&&userProfile?.uid){
        const newCoins=(userProfile.coins||0)-config.entryCoins;
        await updateDoc(doc(db,'users',userId),{coins:newCoins});
        onUpdateProfile&&onUpdateProfile({coins:newCoins});
      }
      showToast(tx('tourn_registeredToast'));
    }catch(e){showToast(tx('tourn_failed')+': '+e.message);}
  };

  const viewingConfig=viewing?TOURNAMENTS_CONFIG.find(c=>c.id===viewing.configId):null;

  return(
    <div style={{minHeight:'100vh',background:T.night,fontFamily:'Changa,sans-serif',color:T.cream,paddingBottom:80,direction:dir}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${T.bg2},${T.bg3})`,borderBottom:`1px solid ${T.border}`,padding:'20px 20px 0',position:'sticky',top:0,zIndex:100,backdropFilter:'blur(12px)'}}>
        <div style={{fontSize:22,color:T.gold,fontWeight:800,marginBottom:4}}>🏆 {tx('tourn_title')}</div>
        <div style={{color:T.smoke,fontSize:12,marginBottom:16}}>{tx('tourn_sub')}</div>
        <div style={{display:'flex',gap:8,paddingBottom:0}}>
          {[{id:'all',l:tx('tourn_all')},{id:'mine',l:tx('tourn_mine')}].map(tb=>(
            <button key={tb.id} onClick={()=>setTab(tb.id)} style={{padding:'8px 18px',borderRadius:'12px 12px 0 0',border:`1px solid ${tab===tb.id?T.gold:'rgba(255,255,255,0.1)'}`,borderBottom:'none',background:tab===tb.id?`${T.gold}15`:'transparent',color:tab===tb.id?T.gold:T.smoke,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{tb.l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:'20px 16px'}}>
        {tab==='all'&&(
          <div>
            {/* Stats bar */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
              {[{l:tx('tourn_activeStat'),v:TOURNAMENTS_CONFIG.length,i:'⚔️',c:T.blueL},{l:tx('tourn_biggest'),v:'4000 🪙',i:'👑',c:T.gold},{l:tx('tourn_playersToday'),v:'24+',i:'👥',c:T.greenL}].map(s=>(
                <div key={s.l} style={{background:T.bg2,border:`1px solid ${s.c}33`,borderRadius:14,padding:'12px',textAlign:'center'}}>
                  <div style={{fontSize:20,marginBottom:4}}>{s.i}</div>
                  <div style={{color:s.c,fontSize:16,fontWeight:800}}>{s.v}</div>
                  <div style={{color:T.smoke,fontSize:9,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Tournament cards */}
            <div style={{display:'grid',gap:16,gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))'}}>
              {TOURNAMENTS_CONFIG.map(config=>(
                <TournamentCard
                  key={config.id}
                  config={config}
                  userId={userId}
                  userCoins={userProfile?.coins||0}
                  onJoin={(cfg,t)=>setJoining({config:cfg,tournament:t})}
                  onView={t=>setViewing(t)}
                />
              ))}
            </div>
          </div>
        )}

        {tab==='mine'&&(
          <div>
            {!userId?(
              <div style={{textAlign:'center',padding:40}}>
                <div style={{fontSize:48,marginBottom:16}}>👤</div>
                <div style={{color:T.smoke,fontSize:14}}>{tx('tourn_loginView')}</div>
              </div>
            ):myTournaments.length===0?(
              <div style={{textAlign:'center',padding:40}}>
                <div style={{fontSize:48,marginBottom:16}}>🏆</div>
                <div style={{color:T.smoke,fontSize:14,marginBottom:8}}>{tx('tourn_noneMine')}</div>
                <button onClick={()=>setTab('all')} style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,border:'none',borderRadius:12,padding:'10px 24px',fontWeight:700,cursor:'pointer',fontSize:14,fontFamily:'inherit'}}>{tx('tourn_joinNow')}</button>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {myTournaments.map(t=>{
                  const cfg=TOURNAMENTS_CONFIG.find(c=>c.id===t.configId);
                  if(!cfg)return null;
                  const isWinner=t.winner?.uid===userId;
                  return(
                    <div key={t.id} onClick={()=>setViewing(t)} style={{background:T.bg2,border:`1px solid ${isWinner?T.gold:cfg.color+'44'}`,borderRadius:16,padding:'16px 20px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,boxShadow:isWinner?`0 0 20px ${T.gold}22`:'none'}}>
                      <div style={{fontSize:32}}>{isWinner?'🏆':cfg.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{color:isWinner?T.gold:T.cream,fontWeight:700,fontSize:15}}>{tx(cfg.nameKey)}</div>
                        <div style={{color:T.smoke,fontSize:11,marginTop:3}}>{t.players?.length||0} {tx('player')} · {statusLabel(t.status)}</div>
                      </div>
                      {isWinner&&<div style={{color:T.goldL,fontSize:12,fontWeight:700}}>🥇 {tx('tourn_winnerBadge')}</div>}
                      <div style={{color:T.smoke,fontSize:18}}>›</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Join modal */}
      {joining&&(
        <JoinModal
          config={joining.config}
          tournament={joining.tournament}
          userId={userId}
          userProfile={userProfile}
          onConfirm={method=>joinTournament(joining.config,joining.tournament,method)}
          onClose={()=>setJoining(null)}
        />
      )}

      {/* Bracket view */}
      {viewing&&viewingConfig&&(
        <BracketView
          tournament={viewing}
          config={viewingConfig}
          userId={userId}
          onClose={()=>setViewing(null)}
        />
      )}

      {toast&&<div style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',background:`linear-gradient(135deg,${T.gold},${T.goldL})`,color:T.night,fontWeight:800,fontSize:14,padding:'12px 24px',borderRadius:24,zIndex:9999,whiteSpace:'nowrap',boxShadow:`0 8px 30px ${T.gold}44`}}>{toast}</div>}
    </div>
  );
}
