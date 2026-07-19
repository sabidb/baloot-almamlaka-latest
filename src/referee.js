// ── Economy referee (client side) ────────────────────────────────────────
// When VITE_SERVER_ECONOMY=1 (and Firestore is configured), all coin/win/loss
// payouts are computed and written by the `referee` Cloud Function, so a
// client can't mint currency or fake a record. Otherwise the app keeps the
// local client-authoritative path (works offline and with permissive rules).
//
// Game results apply optimistically for snappy UI, then reconcile with the
// server's authoritative patch (idempotent — both compute from the same
// profile, see functions/test-parity.mjs). Claims go server-first so a
// rejected claim never shows a false success.
import { ONLINE_MODE } from './online';
import { applyGameResult, claimDaily, claimMission, claimWeekly, claimAchievement } from './progress';

export const SERVER_ECONOMY = ONLINE_MODE === 'firestore' && import.meta.env.VITE_SERVER_ECONOMY === '1';

async function call(op, params){
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const res = await httpsCallable(getFunctions(), 'referee')({ op, params: params || {} });
  return res.data; // { ok, patch, toasts, reward, gems } | { ok:false, locked }
}

const LOCAL = {
  game:             (p, x) => applyGameResult(p, { game:x.game, won:x.won }),
  claimDaily:       (p)    => claimDaily(p),
  claimMission:     (p, x) => claimMission(p, x.id),
  claimWeekly:      (p)    => claimWeekly(p),
  claimAchievement: (p, x) => claimAchievement(p, x.id),
};

// End-of-game payout. Applies optimistically now; reconciles with the server
// when SERVER_ECONOMY. Returns the local result ({ patch, toasts, coins, gems })
// so callers can drive toasts immediately.
export function commitGame(profile, params, { onPatch, persist }){
  const local = LOCAL.game(profile, params);
  if(onPatch) onPatch(local.patch);
  if(SERVER_ECONOMY){
    call('game', params).then(r => { if(r && r.ok && r.patch && onPatch) onPatch(r.patch); })
      .catch(e => console.warn('referee(game) failed:', e?.message || e));
  } else if(persist){
    persist(local.patch);
  }
  return local;
}

// Reward claim (daily / mission / weekly / achievement). Authoritative:
// server-first when SERVER_ECONOMY. Resolves to { ok, patch, reward, gems, toasts }.
export async function commitClaim(profile, op, params, { onPatch, persist }){
  if(SERVER_ECONOMY){
    try{
      const r = await call(op, params);
      if(r && r.ok && r.patch && onPatch) onPatch(r.patch);
      return r || { ok:false };
    }catch(e){ console.warn(`referee(${op}) failed:`, e?.message || e); return { ok:false, error:true }; }
  }
  const res = LOCAL[op](profile, params || {});
  if(!res || res.locked || !res.patch) return { ok:false, locked: !!(res && res.locked) };
  if(onPatch) onPatch(res.patch);
  if(persist) persist(res.patch);
  return { ok:true, patch:res.patch, reward:res.reward || 0, gems:res.gems || 0, toasts:res.toasts || [] };
}
