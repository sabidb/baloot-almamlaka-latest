import { useEffect, useRef, useState } from 'react';
import { LUDO_COLORS, FINISH, tokenCell, botPickToken, rollDie } from './LudoLogic';
import { reducer, newGame, PLAYER_SETS, coinPos, hexOf, tokenBg } from './ludoShared';
import { BoardStatic, Coin, Pips } from './Ludo';
import { sounds, setMuted } from './GameLogic';
import { openRoom, genRoomCode, ONLINE_MODE, now } from './online';
import { applyGameResult } from './progress';

const TURN_MS = 18000;      // a player's own auto-act timeout
const HOST_TAKEOVER_MS = 26000; // host covers a stalled/disconnected human

function clientId(profile){
  if(profile?.uid && profile.uid!=='guest') return profile.uid;
  let id = sessionStorage.getItem('ludoGuestId');
  if(!id){ id='g'+Math.random().toString(36).slice(2,8); sessionStorage.setItem('ludoGuestId',id); }
  return id;
}

export default function LudoOnline({ profile, onExit, onUpdate, persist }){
  const myUid = clientId(profile);
  const myName = profile?.name || 'لاعب';
  const myAvatar = profile?.avatar || '🎲';

  const [room,setRoom]=useState(null);
  const [joinCode,setJoinCode]=useState('');
  const [count,setCount]=useState(4);
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const [muted,setMutedState]=useState(!!(profile&&profile.muted));
  const [copied,setCopied]=useState(false);
  const copyCode=code=>{ try{ navigator.clipboard&&navigator.clipboard.writeText(code); }catch{ /* ignore */ } setCopied(true); setTimeout(()=>setCopied(false),1500); };

  const chan=useRef(null);
  const roomRef=useRef(null);
  const actedEvt=useRef(-1);
  const prevEvt=useRef(-1);
  const unsub=useRef(null);
  const rewarded=useRef(false);

  useEffect(()=>{ setMuted(!!(profile&&profile.muted)); return ()=>{ if(unsub.current) unsub.current(); }; },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const setRoomBoth=r=>{ roomRef.current=r; setRoom(r); };
  const subscribe=(ch)=>{ if(unsub.current) unsub.current(); unsub.current=ch.subscribe(r=>{ if(r) setRoomBoth(r); }); };
  // Apply locally first — transports don't echo writes back to the sender.
  const writeRoom=async(patch)=>{ const base=roomRef.current; if(!base||!chan.current) return; const next={ ...base, ...patch, ts:now() }; setRoomBoth(next); await chan.current.set(next); };

  const create=async()=>{
    setBusy(true); setErr('');
    const c=genRoomCode(); const active=PLAYER_SETS[count];
    const r={ code:c, host:myUid, seatsWanted:count, active,
      players:{ [active[0]]:{uid:myUid,name:myName,avatar:myAvatar} },
      status:'waiting', state:null, ts:now() };
    chan.current=openRoom(c); roomRef.current=r;
    try{ await chan.current.set(r); setRoomBoth(r); subscribe(chan.current); }catch{ setErr('تعذّر إنشاء الغرفة'); }
    setBusy(false);
  };

  const join=async()=>{
    const c=joinCode.trim(); if(c.length<4){ setErr('أدخل كود صحيح'); return; }
    setBusy(true); setErr('');
    const ch=openRoom(c);
    try{
      const r=await ch.get();
      if(!r){ setErr('الغرفة غير موجودة'); setBusy(false); return; }
      if(r.status!=='waiting'){ setErr('اللعبة بدأت بالفعل'); setBusy(false); return; }
      const taken=new Set(Object.keys(r.players||{}).map(Number));
      if([...taken].some(s=>r.players[s].uid===myUid)){ chan.current=ch; setRoomBoth(r); subscribe(ch); setBusy(false); return; }
      const free=r.active.find(s=>!taken.has(s));
      if(free==null){ setErr('الغرفة ممتلئة'); setBusy(false); return; }
      const next={ ...r, players:{ ...r.players, [free]:{uid:myUid,name:myName,avatar:myAvatar} }, ts:now() };
      chan.current=ch; roomRef.current=next;
      await ch.set(next); setRoomBoth(next); subscribe(ch);
    }catch{ setErr('تعذّر الدخول'); }
    setBusy(false);
  };

  const leave=async()=>{
    try{
      const r=roomRef.current;
      if(r && r.status==='waiting' && chan.current){
        const players={...r.players};
        for(const s of Object.keys(players)) if(players[s].uid===myUid) delete players[s];
        await chan.current.set({ ...r, players, ts:now() });
      }
    }catch{ /* ignore */ }
    if(unsub.current) unsub.current();
    setRoomBoth(null); onExit();
  };

  const toggleMute=()=>{ const m=!muted; setMutedState(m); setMuted(m); };

  // ── derived ──
  const st = room?.state || null;
  const players = room?.players || {};
  const active = st?.active || room?.active || [];
  const isHost = room?.host===myUid;
  const seatOf = uid => { for(const s of Object.keys(players)) if(players[s].uid===uid) return Number(s); return -1; };
  const mySeat = seatOf(myUid);
  const isBotSeat = seat => !players[seat];
  const humanCount = Object.keys(players).length;

  // Compute next state and publish (guarded so only one writer acts per evt).
  const advance = (action) => {
    const cur=roomRef.current?.state; if(!cur) return;
    if(actedEvt.current===cur.evt) return;
    actedEvt.current=cur.evt;
    const next=reducer(cur, action);
    const over=next.phase==='over';
    writeRoom({ state:next, status:over?'over':'playing' });
  };

  const humanRoll = () => { if(st && st.phase==='roll' && st.turn===mySeat) advance({type:'ROLL',dice:rollDie()}); };
  const humanMove = ti => { if(st && st.phase==='move' && st.turn===mySeat && st.moves.includes(ti)) advance({type:'MOVE',tokenIdx:ti}); };

  // ── turn engine: bots (host) + auto-timeouts ──
  useEffect(()=>{
    if(!st || st.phase==='over') return;
    const seat=st.turn;
    const timers=[];
    if(isBotSeat(seat)){
      if(isHost){
        const act=()=>{ if(st.phase==='roll') advance({type:'ROLL',dice:rollDie()});
          else if(st.phase==='move' && st.moves.length) advance({type:'MOVE',tokenIdx:botPickToken(st.tokens,seat,st.dice,st.moves)}); };
        timers.push(setTimeout(act, 800));
      }
    } else {
      // human seat
      if(seat===mySeat){
        // auto-act if I stall
        const act=()=>{ if(st.phase==='roll') advance({type:'ROLL',dice:rollDie()});
          else if(st.phase==='move'&&st.moves.length) advance({type:'MOVE',tokenIdx:st.moves[st.moves.length-1]}); };
        timers.push(setTimeout(act, TURN_MS));
      } else if(isHost){
        // host covers a disconnected/AFK human
        const act=()=>{ if(st.phase==='roll') advance({type:'ROLL',dice:rollDie()});
          else if(st.phase==='move'&&st.moves.length) advance({type:'MOVE',tokenIdx:botPickToken(st.tokens,seat,st.dice,st.moves)}); };
        timers.push(setTimeout(act, HOST_TAKEOVER_MS));
      }
    }
    return ()=>timers.forEach(clearTimeout);
  },[room?.state?.evt, room?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── transitions: sounds + dice shake ──
  useEffect(()=>{
    if(!st) return;
    if(st.evt!==prevEvt.current){
      const prev=prevEvt.current; prevEvt.current=st.evt;
      if(prev>=0 && !muted){
        if(st.captured) sounds.capture();
        else if(st.finishedTok) sounds.home();
      }
      if(prev>=0 && !muted && st.dice && !st.captured && !st.finishedTok) sounds.dice();
      if(st.phase==='over' && !muted) sounds.win();
    }
  },[room?.state?.evt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reward the local human once the online game ends.
  useEffect(()=>{
    if(!st) return;
    if(st.phase!=='over'){ rewarded.current=false; return; }
    if(rewarded.current || mySeat<0) return;
    rewarded.current=true;
    const { patch }=applyGameResult(profile,{game:'ludo',won:st.winner===mySeat});
    if(onUpdate) onUpdate(p=>({ ...p, ...patch }));
    if(persist) persist(patch);
  },[room?.state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const curColor = st ? hexOf(LUDO_COLORS[st.turn].id) : '#F0C040';
  const activeColors = new Set(active.map(p=>LUDO_COLORS[p].id));
  const humanMovable = st && st.phase==='move' && st.turn===mySeat ? new Set(st.moves) : null;

  // ── token placement ──
  const placed=[];
  if(st) for(const p of active) for(let t=0;t<4;t++){ const rel=st.tokens[p][t]; const [r,c]=tokenCell(p,rel,t); placed.push({p,t,rel,r,c}); }
  const occ={}; placed.forEach(k=>{ const key=`${k.r.toFixed(1)},${k.c.toFixed(1)}`; (occ[key]=occ[key]||[]).push(k); });
  const OFFS=[[0,0],[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]];
  const finishedCount=p=> st ? st.tokens[p].filter(r=>r===FINISH).length : 0;
  const seatName=seat=> players[seat] ? players[seat].name : `${LUDO_COLORS[seat].name} 🤖`;

  const panel={fontFamily:'Tajawal,sans-serif',direction:'rtl',color:'#F0EDE5'};
  const btn=(bg,fg)=>({padding:'12px',borderRadius:12,border:'none',background:bg,color:fg,fontFamily:'Tajawal,sans-serif',fontWeight:900,fontSize:15,cursor:'pointer'});

  // ── MENU (no room yet) ──
  if(!room){
    return (
      <div style={{...panel,height:'100%',background:'radial-gradient(ellipse 120% 90% at 50% 25%,#14261B,#07090A)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:24,overflow:'auto'}}>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:30,color:'#F0C040'}}>لودو أونلاين</div>
        <div style={{fontSize:12,color:'rgba(240,237,229,.55)',textAlign:'center'}}>
          {ONLINE_MODE==='firestore' ? 'العب مع أصدقائك على أي جهاز 🌐' : '⚠️ وضع محلي (نفس المتصفح فقط) — أضف مفاتيح Firebase للعب عبر الأجهزة'}
        </div>
        <div style={{background:'rgba(13,20,16,.85)',border:'1px solid rgba(240,192,64,.2)',borderRadius:18,padding:20,width:'100%',maxWidth:340,display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:'rgba(240,237,229,.6)',marginBottom:8}}>إنشاء غرفة — عدد اللاعبين</div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              {[2,3,4].map(n=><button key={n} onClick={()=>setCount(n)} style={{flex:1,padding:'10px 0',borderRadius:10,border:`1.5px solid ${count===n?'#F0C040':'rgba(240,192,64,.25)'}`,background:count===n?'rgba(240,192,64,.15)':'transparent',color:'#F0C040',fontWeight:900,fontSize:18,cursor:'pointer'}}>{n}</button>)}
            </div>
            <button onClick={create} disabled={busy} style={{...btn('linear-gradient(135deg,#8B6914,#F0C040)','#07090A'),width:'100%'}}>إنشاء غرفة</button>
          </div>
          <div style={{height:1,background:'rgba(255,255,255,.1)'}}/>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:'rgba(240,237,229,.6)',marginBottom:8}}>دخول بكود</div>
            <div style={{display:'flex',gap:8}}>
              <input value={joinCode} onChange={e=>setJoinCode(e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" placeholder="1234" style={{flex:1,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.14)',borderRadius:10,padding:'11px',color:'#F0EDE5',fontSize:18,textAlign:'center',letterSpacing:4,fontFamily:'Tajawal,sans-serif',outline:'none'}}/>
              <button onClick={join} disabled={busy} style={{...btn('rgba(52,152,219,.2)','#5DADE2'),border:'1px solid rgba(52,152,219,.4)'}}>دخول</button>
            </div>
          </div>
          {err&&<div style={{color:'#E74C3C',fontSize:12,textAlign:'center'}}>{err}</div>}
        </div>
        <button onClick={onExit} style={{...btn('rgba(255,255,255,.08)','rgba(240,237,229,.7)'),border:'1px solid rgba(255,255,255,.12)',fontWeight:700,fontSize:13}}>رجوع</button>
      </div>
    );
  }

  // ── LOBBY (waiting) ──
  if(room.status==='waiting'){
    return (
      <div style={{...panel,height:'100%',background:'radial-gradient(ellipse 120% 90% at 50% 25%,#14261B,#07090A)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:24}}>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:26,color:'#F0C040'}}>غرفة اللعب</div>
        <div onClick={()=>copyCode(room.code)} style={{background:'rgba(240,192,64,.1)',border:'1px solid rgba(240,192,64,.35)',borderRadius:14,padding:'10px 26px',fontSize:34,fontWeight:900,color:'#F0C040',letterSpacing:8,cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>{room.code}<span style={{fontSize:16}}>📋</span></div>
        <div style={{fontSize:11,color:copied?'#2ECC71':'rgba(240,237,229,.55)'}}>{copied?'✓ تم نسخ الكود':'اضغط لنسخ الكود ومشاركته'}</div>
        <div style={{width:'100%',maxWidth:320,display:'flex',flexDirection:'column',gap:8,margin:'8px 0'}}>
          {room.active.map(seat=>{
            const pl=players[seat]; const c=LUDO_COLORS[seat];
            return (
              <div key={seat} style={{display:'flex',alignItems:'center',gap:10,background:'rgba(13,20,16,.8)',border:'1px solid rgba(255,255,255,.07)',borderRadius:10,padding:'9px 12px'}}>
                <div style={{width:16,height:16,borderRadius:'50%',background:tokenBg(c.hex)}}/>
                <span style={{flex:1,fontSize:13,fontWeight:700}}>{pl?pl.name:'بانتظار لاعب…'}</span>
                <span style={{fontSize:11,color:pl?'#2ECC71':'rgba(240,237,229,.4)'}}>{pl?(pl.uid===myUid?'أنت':'جاهز'):'🤖 روبوت'}</span>
              </div>
            );
          })}
        </div>
        {isHost
          ? <button onClick={()=>writeRoom({status:'playing',state:newGame(room.seatsWanted)})} style={{...btn('linear-gradient(135deg,#8B6914,#F0C040)','#07090A'),width:'100%',maxWidth:320}}>ابدأ اللعب ▶ {humanCount<room.seatsWanted?`(${room.seatsWanted-humanCount} روبوت)`:''}</button>
          : <div style={{color:'rgba(240,237,229,.6)',fontSize:13}}>بانتظار أن يبدأ المضيف…</div>}
        <button onClick={leave} style={{...btn('rgba(255,255,255,.08)','rgba(240,237,229,.7)'),border:'1px solid rgba(255,255,255,.12)',fontWeight:700,fontSize:13,maxWidth:320,width:'100%'}}>مغادرة</button>
      </div>
    );
  }

  // ── PLAYING / OVER ──
  return (
    <div style={{...panel,width:'100%',height:'100%',background:'radial-gradient(ellipse 120% 90% at 50% 30%,#14261B,#07090A)',position:'relative',overflow:'hidden',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'calc(env(safe-area-inset-top,0px)+10px) 14px 8px'}}>
        <button onClick={leave} style={{...btn('rgba(255,255,255,.08)','rgba(240,237,229,.75)'),padding:'6px 12px',fontSize:12,fontWeight:700,border:'1px solid rgba(255,255,255,.12)'}}>خروج</button>
        <div style={{fontFamily:"'Scheherazade New',serif",fontSize:22,color:'#F0C040'}}>لودو · {room.code}</div>
        <button onClick={toggleMute} style={{...btn('rgba(255,255,255,.08)','rgba(240,237,229,.75)'),padding:'6px 10px',fontSize:14}}>{muted?'🔇':'🔊'}</button>
      </div>

      {/* Player chips */}
      <div style={{flexShrink:0,display:'flex',gap:6,padding:'0 12px 8px',justifyContent:'center',flexWrap:'wrap'}}>
        {active.map(seat=>{
          const c=LUDO_COLORS[seat]; const turn=st&&st.turn===seat&&st.phase!=='over';
          return (
            <div key={seat} style={{display:'flex',alignItems:'center',gap:6,background:turn?'rgba(240,192,64,.14)':'rgba(13,20,16,.7)',border:`1px solid ${turn?'#F0C040':'rgba(255,255,255,.07)'}`,borderRadius:20,padding:'5px 10px',boxShadow:turn?`0 0 12px ${c.hex}55`:'none'}}>
              <div style={{width:14,height:14,borderRadius:'50%',background:tokenBg(c.hex)}}/>
              <span style={{fontSize:11,fontWeight:700}}>{seat===mySeat?'أنت':seatName(seat)}</span>
              <span style={{fontSize:11,fontWeight:900,color:'#F0C040'}}>{finishedCount(seat)}/4</span>
            </div>
          );
        })}
      </div>

      {/* Board */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'4px 10px',minHeight:0}}>
        <div style={{position:'relative',width:'min(94vw, 60vh)',aspectRatio:'1',background:'linear-gradient(150deg,#141a24,#0b0e14)',borderRadius:20,padding:'2.6%',boxShadow:'0 22px 55px rgba(0,0,0,.6), 0 0 0 1.5px rgba(240,192,64,.45)'}}>
          <div style={{position:'relative',width:'100%',height:'100%',borderRadius:8,overflow:'hidden',direction:'ltr',background:'#fefefe',boxShadow:'0 0 0 1px rgba(30,30,40,.35)'}}>
            <BoardStatic activeColors={activeColors}/>
            {placed.map(k=>{
              const key=`${k.r.toFixed(1)},${k.c.toFixed(1)}`; const g=occ[key]; const idx=g.indexOf(k); const [or,oc]=OFFS[Math.min(idx,4)];
              const canMove = k.p===mySeat && humanMovable && humanMovable.has(k.t);
              return <Coin key={`${k.p}-${k.t}`} color={hexOf(LUDO_COLORS[k.p].id)} canMove={canMove} onClick={()=>k.p===mySeat&&humanMove(k.t)} style={coinPos(k.r,k.c,or,oc,100+idx,canMove)}/>;
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      {st && st.phase!=='over' && (
        <div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',gap:14,padding:'8px 14px calc(env(safe-area-inset-bottom,0px)+14px)'}}>
          <div onClick={st.turn===mySeat&&st.phase==='roll'?humanRoll:undefined}
            style={{width:60,height:60,flexShrink:0,borderRadius:15,background:'linear-gradient(150deg,#ffffff,#eceef1 58%,#dcdfe4)',
              boxShadow:st.turn===mySeat&&st.phase==='roll'?`0 6px 16px ${curColor}55, 0 0 0 2px ${curColor}, inset 0 2px 3px #fff`:'0 6px 15px rgba(0,0,0,.45), inset 0 2px 3px #fff',
              cursor:st.turn===mySeat&&st.phase==='roll'?'pointer':'default', animation:'diceshake .35s ease'}} key={st.evt}>
            {st.dice?<Pips n={st.dice} color={curColor}/>:<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#0C1410',fontSize:26}}>🎲</div>}
          </div>
          <div style={{minWidth:130,textAlign:'center'}}>
            {st.turn===mySeat&&st.phase==='roll'&&<div style={{color:'#F0C040',fontSize:14,fontWeight:900}}>دورك — اضغط النرد 🎲</div>}
            {st.turn===mySeat&&st.phase==='move'&&<div style={{color:'#2ECC71',fontSize:13,fontWeight:700}}>اختر قطعة للتحريك</div>}
            {st.turn!==mySeat&&<div style={{color:'rgba(240,237,229,.6)',fontSize:13}}>دور {seatName(st.turn)}…</div>}
          </div>
        </div>
      )}

      {/* Game over */}
      {st && st.phase==='over' && (
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:350,padding:20}}>
          <div style={{background:'radial-gradient(ellipse at top,#1A3D20,#0C1410)',border:'1px solid #F0C040',borderRadius:20,padding:'26px 24px',textAlign:'center',maxWidth:320,width:'100%'}}>
            <div style={{fontSize:52}}>{st.winner===mySeat?'🏆':'🎲'}</div>
            <div style={{fontFamily:"'Scheherazade New',serif",fontSize:26,color:'#F0C040',margin:'6px 0'}}>{st.winner===mySeat?'فزت!':`فاز ${seatName(st.winner)}`}</div>
            <div style={{display:'flex',flexDirection:'column',gap:6,margin:'12px 0'}}>
              {st.ranks.map((p,i)=>(
                <div key={p} style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center',fontSize:14}}>
                  <span style={{width:22}}>{['🥇','🥈','🥉','4️⃣'][i]}</span>
                  <div style={{width:15,height:15,borderRadius:'50%',background:tokenBg(LUDO_COLORS[p].hex)}}/>
                  <span>{p===mySeat?'أنت':seatName(p)}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={leave} style={{...btn('rgba(255,255,255,.08)','rgba(240,237,229,.75)'),flex:1,border:'1px solid rgba(255,255,255,.12)',fontWeight:700}}>خروج</button>
              {isHost && <button onClick={()=>{ actedEvt.current=-1; prevEvt.current=-1; writeRoom({status:'playing',state:newGame(room.seatsWanted)}); }} style={{...btn('linear-gradient(135deg,#8B6914,#F0C040)','#07090A'),flex:1.4}}>مجدداً 🔄</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
