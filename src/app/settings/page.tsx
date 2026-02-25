
'use client';
import { db, ref, set, update, auth } from '@/lib/firebase';
import { User, Shield, Image as ImageIcon, Check, Plus, Trash2, ArrowLeft, Pencil, Play, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './settings.module.css';
import { useAuth } from '@/app/context/AuthContext';

const AVATARS = [
  '/api/proxy-image?url=' + encodeURIComponent('https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'),
  '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/366be133850498.56ba69ac36858.png'),
  '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/1bdc9a33850498.56ba69ac2ba5b.png'),
  '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/bf6e4a33850498.56ba69ac3064f.png'),
  '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/84c20033850498.56ba69ac2903c.png'),
  '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/64623633850498.56ba69ac2a6d7.png')
];

export default function SettingsPage() {
  const { user, profiles, activeProfile, refreshProfiles } = useAuth();
  const [autoplay, setAutoplay] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // New Profile State
  const [showNewProfileForm, setShowNewProfileForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  
  // PIN Management State
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [tempPin, setTempPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (activeProfile) {
      setAutoplay(activeProfile.settings?.autoplay ?? true);
    }
  }, [activeProfile]);

  const handleToggleAutoplay = async () => {
    if (!user || !activeProfile) return;
    const newAutoplay = !autoplay;
    setAutoplay(newAutoplay);
    
    try {
      // Use update to specifically target the autoplay field for the CURRENT profile
      await update(ref(db, `users/${user.uid}/profiles/${activeProfile.id}/settings`), {
        autoplay: newAutoplay
      });
      await refreshProfiles();
    } catch (e) {
      console.error(e);
      // Rollback UI if failed
      setAutoplay(!newAutoplay);
    }
  };

  const deleteAccount = async () => {
    if (!user || activeProfile?.id !== 'main') return;
    if (!confirm('تحذير: سيتم حذف حسابك بالكامل وجميع بياناتك! هل أنت متأكد؟')) return;
    
    try {
      setLoading(true);
      await set(ref(db, `users/${user.uid}`), null);
      await auth.currentUser?.delete();
      window.location.href = '/register';
    } catch (e) {
      alert('حدث خطأ أثناء حذف الحساب. قد تحتاج لتسجيل الدخول مرة أخرى قبل حذف الحساب لأسباب أمنية.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!user) return;
    if (profileId === 'main') {
        alert('لا يمكن حذف البروفايل الأساسي');
        return;
    }
    if (profiles.length <= 1) {
        alert('لا يمكن حذف آخر بروفايل متبقي');
        return;
    }

    if (!confirm('هل أنت متأكد من حذف هذا البروفايل؟ سيتم فقدان جميع سجلات المشاهدة الخاصة به.')) return;

    try {
        setLoading(true);
        // Clear profile data
        await set(ref(db, `users/${user.uid}/profiles/${profileId}`), null);
        
        // If the deleted profile was the active one, switch to main
        if (activeProfile?.id === profileId) {
            window.location.href = '/'; // This will trigger ProfileSelector
        } else {
            await refreshProfiles();
        }
    } catch (e) {
        console.error(e);
        alert('فشل حذف البروفايل');
    } finally {
        setLoading(false);
    }
  };

  const handleUpdatePin = async (newPinValue: string) => {
    if (!user || !activeProfile) return;
    try {
      setLoading(true);
      await update(ref(db, `users/${user.uid}/profiles/${activeProfile.id}`), {
        pin: newPinValue || null
      });
      await refreshProfiles();
      setShowPinDialog(false);
      setTempPin('');
    } catch (e) {
      console.error(e);
      alert('فشل تحديث رمز PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyClick = (num: string) => {
    if (tempPin.length < 4) {
      const nextPin = tempPin + num;
      setTempPin(nextPin);
      if (nextPin.length === 4) {
        handleUpdatePin(nextPin);
      }
    }
  };

  const handleCreateProfile = async () => {
    if (!user || !newName.trim()) return;
    if (profiles.length >= 5) {
      alert('الحد الأقصى هو 5 بروفايلات');
      return;
    }

    try {
      setLoading(true);
      const newId = 'profile_' + Date.now();
      const newProfile = {
        id: newId,
        name: newName,
        avatar: selectedAvatar,
        pin: newPin || null,
        settings: { autoplay: true }
      };

      await update(ref(db, `users/${user.uid}/profiles`), {
        [newId]: newProfile
      });
      
      setNewName('');
      setNewPin('');
      setShowNewProfileForm(false);
      await refreshProfiles();
    } catch (e) {
      alert('فشل إنشاء البروفايل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <h1 className={styles.title}>الحساب</h1>

        {/* Membership & Billing Section - Main Profile ONLY */}
        {activeProfile?.id === 'main' && (
          <section className={styles.settingsSection}>
            <div className={styles.sectionLabel}>العضوية والفواتير</div>
            <div className={styles.sectionContent}>
              <div className={styles.accountInfo}>
                <div className={styles.metaData}>
                    <div className={styles.emailText}>{user?.email}</div>
                    <div className={styles.passwordText}>كلمة المرور: ********</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Plan Details Section - Main Profile ONLY */}
        {activeProfile?.id === 'main' && (
          <section className={styles.settingsSection}>
            <div className={styles.sectionLabel}>تفاصيل الخطة</div>
            <div className={styles.sectionContent}>
              <div className={styles.planBox}>
                <div className={styles.planText}>
                    <span className={styles.planBadge}>FHD</span>
                    الخطة المميزة
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Playback Settings Section */}
        {activeProfile && (
          <section className={styles.settingsSection}>
            <div />
            <div className={styles.sectionContent}>
              <div className={styles.settingRow}>
                <div className={styles.settingMeta}>
                  <h4>التشغيل التلقائي</h4>
                  <p>تشغيل الحلقة التالية تلقائياً عند انتهاء الحالية.<br/>(يسري على البروفايل الحالي فقط)</p>
                </div>
                <button 
                  className={`${styles.toggle} ${autoplay ? styles.toggleOn : ''}`}
                  onClick={handleToggleAutoplay}
                >
                   <div className={styles.toggleDot} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Profile Lock Section */}
        {activeProfile && (
          <section className={styles.settingsSection}>
            <div />
            <div className={styles.sectionContent}>
              <div className={styles.profileManageRow} style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                <div className={styles.settingMeta}>
                  <h4>قفل الملف الشخصي</h4>
                  <p>تأمين ملفك الشخصي بطلب رمز PIN للدخول.</p>
                </div>
                <button 
                  className={styles.lockManageBtnMain}
                  onClick={() => {
                    if (activeProfile.pin) {
                      handleUpdatePin(''); // Remove PIN
                    } else {
                      setShowPinDialog(true);
                    }
                  }}
                >
                  {activeProfile.pin ? 'إزالة قفل الملف' : 'تفعيل قفل الملف'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Profiles List Section */}
        <section className={styles.settingsSection}>
          <div className={styles.sectionLabel}>الملفات الشخصية</div>
          <div className={styles.sectionContent}>
            <div className={styles.profilesList}>
              {profiles.map(p => (
                <div key={p.id} className={styles.profileItem}>
                  <img src={p.avatar} alt={p.name} className={styles.profileThumb} />
                  <div className={styles.profileName}>
                    {p.name}
                    {p.id === 'main' && <span className={styles.mainBadge}>الأساسي</span>}
                    {p.pin && <Lock size={14} color="#a0a0a0" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PIN Management Dialog */}
        {showPinDialog && (
          <div className={styles.pinOverlay}>
            <div className={styles.pinContent}>
              <h2 className={styles.pinSubtitle}>حماية الملف الشخصي</h2>
              <h1 className={styles.pinTitle}>أدخل 4 أرقام لإنشاء رمز PIN</h1>
              
              <div className={styles.pinDisplay}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`${styles.pinBox} ${tempPin.length === i ? styles.pinBoxActive : ''} ${tempPin.length > i ? styles.pinBoxFilled : ''}`}>
                    {tempPin.length > i ? <div className={styles.dot} /> : null}
                  </div>
                ))}
              </div>

              <div className={styles.keypad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((k, i) => (
                  <button 
                    key={i} 
                    className={`${styles.key} ${k === '' ? styles.keyEmpty : ''}`}
                    onClick={() => {
                      if (k === 'del') setTempPin(prev => prev.slice(0, -1));
                      else if (k !== '') handleKeyClick(k.toString());
                    }}
                    disabled={k === ''}
                  >
                    {k === 'del' ? <ArrowLeft size={24} /> : k}
                  </button>
                ))}
              </div>

              <button className={styles.pinCancel} onClick={() => { setShowPinDialog(false); setTempPin(''); }}>إلغاء</button>
            </div>
          </div>
        )}

        {/* Dangerous Zone Section */}
        {activeProfile?.id === 'main' && (
          <section className={styles.settingsSection}>
            <div className={styles.sectionLabel}>إجراءات الحساب</div>
            <div className={styles.sectionContent}>
                <button className={styles.cancelBtn} onClick={deleteAccount} disabled={loading}>
                   {loading ? 'جاري المعالجة...' : 'حذف الحساب بالكامل'}
                </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
