
'use client';
import { db, ref, set, update, auth } from '@/lib/firebase';
import { User, Shield, Image as ImageIcon, Check, Plus, Trash2, ArrowLeft, Pencil, Play } from 'lucide-react';
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
                <button className={styles.actionLink} onClick={() => alert('ميزة تغيير البريد قريباً')}>تغيير البريد الإلكتروني</button>
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
                <button className={styles.actionLink}>تغيير الخطة</button>
              </div>
            </div>
          </section>
        )}

        {/* Playback Settings Section */}
        <section className={styles.settingsSection}>
           <div className={styles.sectionLabel}>إعدادات التشغيل</div>
           <div className={styles.sectionContent}>
             <div className={styles.settingRow}>
                <div className={styles.settingMeta}>
                   <h4>التشغيل التلقائي</h4>
                   <p>بدء الحلقة التالية تلقائياً في جميع الأجهزة.</p>
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

        {/* Profile & Parental Controls Section */}
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
                    </div>
                    <div className={styles.profileActions}>
                      <button className={styles.actionLink} onClick={() => window.location.href='/profile'}>تغيير</button>
                      
                      {/* ONLY Main Profile can delete other profiles */}
                      {activeProfile?.id === 'main' && p.id !== 'main' && (
                          <button 
                              className={`${styles.actionLink} ${styles.deleteLink}`} 
                              onClick={() => handleDeleteProfile(p.id)}
                              disabled={loading}
                          >
                              <Trash2 size={14} /> حذف
                          </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!showNewProfileForm ? (
                profiles.length < 5 && (
                  <button className={styles.addProfileBtn} onClick={() => setShowNewProfileForm(true)}>
                    <Plus size={18} /> إضافة بروفايل جديد
                  </button>
                )
              ) : (
                <div className={styles.newProfileForm}>
                  <h3>إضافة بروفايل جديد</h3>
                  <div className={styles.formRow}>
                    <div className={styles.avatarPicker}>
                      {AVATARS.map(av => (
                        <img 
                          key={av} 
                          src={av} 
                          className={selectedAvatar === av ? styles.activeAv : ''} 
                          onClick={() => setSelectedAvatar(av)}
                        />
                      ))}
                    </div>
                    <div className={styles.inputArea}>
                      <input 
                        value={newName} 
                        onChange={e => setNewName(e.target.value)} 
                        placeholder="اسم البروفايل..." 
                      />
                      <input 
                        type="text"
                        autoComplete="off"
                        data-lpignore="true"
                        maxLength={4}
                        value={newPin} 
                        onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} 
                        placeholder="رمز PIN (اختياري)..." 
                        className={styles.pinSecureInput}
                      />
                      <div className={styles.formActions}>
                        <button className={styles.confirmBtn} onClick={handleCreateProfile} disabled={loading}>إنشاء</button>
                        <button className={styles.cancelLink} onClick={() => setShowNewProfileForm(false)}>إلغاء</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </section>

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
