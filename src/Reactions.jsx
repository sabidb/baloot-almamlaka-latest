import { useState } from 'react';
import { REACTIONS, sounds, haptics } from './GameLogic';

// Floating reaction emoji, spawned imperatively like spawnParticles so it
// works identically in the bot game and multiplayer (where remote
// reactions arrive via the room doc).
export function spawnReaction(emoji, x, y) {
  const el = document.createElement('div');
  el.textContent = emoji;
  Object.assign(el.style, {
    position: 'fixed', left: x + 'px', top: y + 'px', fontSize: '34px',
    pointerEvents: 'none', zIndex: '9500',
    animation: 'reactFloat 1.6s ease-out forwards',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

// Quick-chat (تقطيق) bar: collapsed round button that expands into the
// reaction row. onSend lets multiplayer broadcast to the room.
export function ReactionBar({ onSend }) {
  const [open, setOpen] = useState(false);
  const send = (emoji, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    spawnReaction(emoji, r.left, r.top - 10);
    sounds.tick(); haptics.play();
    onSend && onSend(emoji);
    setOpen(false);
  };
  return (
    <div style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom,0px) + 122px)', right: 10, zIndex: 45, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 172, justifyContent: 'flex-end', background: 'rgba(8,12,10,.92)', border: '1px solid rgba(240,192,64,.25)', borderRadius: 14, padding: '8px 10px', animation: 'popIn .2s ease both' }}>
          {REACTIONS.map(r => (
            <span key={r} onClick={e => send(r, e)} style={{ fontSize: 22, cursor: 'pointer', touchAction: 'manipulation' }}>{r}</span>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(240,192,64,.3)', background: 'rgba(8,12,10,.85)', fontSize: 18, cursor: 'pointer', touchAction: 'manipulation' }}>
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
