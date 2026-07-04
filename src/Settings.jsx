import { useState } from 'react';
import { useLang } from './i18n';
import { getPref, setPref } from './GameLogic';

function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: 46, height: 27, borderRadius: 20, background: on ? 'linear-gradient(90deg,#8B6914,#F0C040)' : 'rgba(255,255,255,.12)', position: 'relative', cursor: 'pointer', transition: 'background .25s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, insetInlineStart: on ? 22 : 3, width: 21, height: 21, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .25s', boxShadow: '0 2px 6px rgba(0,0,0,.4)' }} />
    </div>
  );
}

function Row({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 15, background: 'rgba(16,26,18,.85)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, marginBottom: 9 }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{label}</div>
      {children}
    </div>
  );
}

export default function SettingsScreen({ profile, onClose, onLogout }) {
  const { t, lang, setLang, dir } = useLang();
  const [sound, setSound] = useState(getPref('sound'));
  const [haptics, setHaptics] = useState(getPref('haptics'));
  const [notif, setNotif] = useState(getPref('notifications'));
  const arrow = lang === 'ar' ? '‹' : '›';

  const toggle = (key, val, setter) => { setter(val); setPref(key, val); };

  return (
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'radial-gradient(ellipse 90% 50% at 50% 0%,rgba(26,61,32,.4),#07090A)', color: '#F0EDE5', fontFamily: 'Changa,sans-serif', direction: dir, paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top,0px) + 16px) 16px 12px' }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(240,192,64,.3)', color: '#F0EDE5', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{arrow} {t('back')}</button>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#F0C040' }}>⚙️ {t('settings')}</div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '8px 14px' }}>
        {/* Language — segmented control */}
        <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(240,237,229,.5)', margin: '4px 4px 8px' }}>🌐 {t('language')}</div>
        <div style={{ display: 'flex', gap: 8, background: 'rgba(16,26,18,.85)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 6, marginBottom: 16 }}>
          {[{ id: 'ar', l: t('arabic') }, { id: 'en', l: t('english') }].map(o => (
            <button key={o.id} onClick={() => setLang(o.id)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, background: lang === o.id ? 'linear-gradient(135deg,#8B6914,#F0C040)' : 'transparent', color: lang === o.id ? '#07090A' : 'rgba(240,237,229,.6)', transition: 'all .2s' }}>{o.l}</button>
          ))}
        </div>

        {/* Preferences */}
        <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(240,237,229,.5)', margin: '4px 4px 8px' }}>{t('settings')}</div>
        <Row icon="🔊" label={t('sound')}><Toggle on={sound} onChange={v => toggle('sound', v, setSound)} /></Row>
        <Row icon="📳" label={t('haptics')}><Toggle on={haptics} onChange={v => toggle('haptics', v, setHaptics)} /></Row>
        <Row icon="🔔" label={t('notifications')}><Toggle on={notif} onChange={v => toggle('notifications', v, setNotif)} /></Row>

        {/* Account */}
        <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(240,237,229,.5)', margin: '16px 4px 8px' }}>{t('account')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 15, background: 'rgba(16,26,18,.85)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, marginBottom: 9 }}>
          <span style={{ fontSize: 30 }}>{profile?.avatar || '🧔'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{profile?.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(240,237,229,.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.uid}</div>
          </div>
        </div>
        <div onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 15, background: 'rgba(231,76,60,.08)', border: '1px solid rgba(231,76,60,.2)', borderRadius: 14, marginBottom: 16, cursor: 'pointer' }}>
          <span style={{ fontSize: 20 }}>🚪</span>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#E74C3C' }}>{t('logout')}</div>
        </div>

        <div style={{ textAlign: 'center', color: 'rgba(240,237,229,.3)', fontSize: 10, marginTop: 8 }}>{t('appVersion')} 1.0.0</div>
      </div>
    </div>
  );
}
