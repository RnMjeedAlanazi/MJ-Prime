
'use client';
import { db, ref, set, update, auth } from '@/lib/firebase';
import { User, Shield, Image as ImageIcon, Check, Plus, Trash2, ArrowLeft, Pencil, Play, Lock, Mail, Key } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
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
  
  // Account Management State
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPassDialog, setShowPassDialog] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [emailToUpdate, setEmailToUpdate] = useState('');
  const [newPassToUpdate, setNewPassToUpdate] = useState('');
  const [accountStatus, setAccountStatus] = useState({ text: '', type: '' });
  
  // Account Deletion State
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [usersCode, setUsersCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isEmailFailed, setIsEmailFailed] = useState(false);
  const [codeExpiry, setCodeExpiry] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // PIN Management State
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [tempPin, setTempPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (activeProfile) {
      setAutoplay(activeProfile.settings?.autoplay ?? true);
    }
  }, [activeProfile]);

  useEffect(() => {
    if (!codeExpiry || !isCodeSent) return;
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((codeExpiry - Date.now()) / 1000));
      setTimeLeft(remaining);
      
      if (remaining === 0) {
        setAccountStatus({ text: 'انتهت صلاحية الرمز. يرجى طلب رمز جديد.', type: 'error' });
        setGeneratedCode(null);
        setIsCodeSent(false);
        alert('انتهت صلاحية رمز التحقق (5 دقائق). يرجى طلب رمز جديد.');
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [codeExpiry, isCodeSent]);

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

  const triggerDeleteAccount = async () => {
    // Check if we HAVE a valid code that hasn't expired yet
    const isStillValid = isCodeSent && generatedCode && codeExpiry && Date.now() < codeExpiry;

    if (!isStillValid) {
        setAccountStatus({ text: '', type: '' });
        setIsCodeSent(false);
        setUsersCode('');
        setGeneratedCode(null);
        setCodeExpiry(null);
    } else {
        // If it's still valid, we keep the isCodeSent state as it is
        // and show a message informing the user the code was already sent
        setAccountStatus({ 
          text: 'لقد أرسلنا الرمز بالفعل إلى بريدك الإلكتروني، يرجى إدخاله للمتابعة', 
          type: 'success' 
        });
    }

    setShowDeleteDialog(true);
  };

  const sendDeletionCode = async () => {
    if (!user?.email) return;
    try {
      setLoading(true);
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedCode(code);
      setCodeExpiry(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      
      // Call the API to send the actual email
      const response = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: user.email, 
          code: code,
          type: 'delete'
        })
      });

      const result = await response.json();
      
      setIsCodeSent(true);
      if (result.success) {
        setIsEmailFailed(false);
        setAccountStatus({ 
          text: `تم إرسال الرمز بنجاح! يرجى تفقد بريدك الإلكتروني: ${user.email}`, 
          type: 'success' 
        });
      } else {
        setIsEmailFailed(true);
        setAccountStatus({ 
          text: `تنبيه: فشل الإرسال التلقائي (تأكد من إعدادات SMTP). الرمز للمعاينة هو: ${code}`, 
          type: 'error' 
        });
      }
    } catch (e) {
      console.error('Send code error:', e);
      setAccountStatus({ text: 'حدث خطأ أثناء محاولة إرسال الرمز', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFinalDelete = async () => {
    if (!user || usersCode !== generatedCode) {
      setAccountStatus({ text: 'رمز التأكيد غير صحيح', type: 'error' });
      return;
    }

    if (codeExpiry && Date.now() > codeExpiry) {
      alert('عذراً، لقد انتهت صلاحية هذا الرمز. يرجى طلب رمز جديد لمتابعة الحذف.');
      setAccountStatus({ text: 'انتهت صلاحية الرمز (5 دقائق). يرجى طلب رمز جديد.', type: 'error' });
      setGeneratedCode(null);
      setIsCodeSent(false);
      return;
    }
    
    try {
      setLoading(true);
      // Note: Re-auth is usually required by Firebase for deletion. 
      // If we don't have the password, we might hit an error if the session is old.
      
      await set(ref(db, `users/${user.uid}`), null);
      await user.delete();
      window.location.href = '/register';
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/requires-recent-login') {
        setAccountStatus({ text: 'للأمان، يرجى تسجيل الخروج والعودة مجدداً قبل حذف الحساب', type: 'error' });
      } else {
        setAccountStatus({ text: 'حدث خطأ أثناء الحذف', type: 'error' });
      }
    } finally {
      setLoading(false);
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

  const handleUpdateEmail = async () => {
    if (!auth.currentUser || !emailToUpdate || !currentPass) return;
    try {
      setLoading(true);
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPass);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updateEmail(auth.currentUser, emailToUpdate);
      setAccountStatus({ text: 'تم تحديث البريد الإلكتروني بنجاح', type: 'success' });
      
      // Send notification
      fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUpdate, type: 'change_email' })
      }).catch(e => console.error('Email change notification failed', e));

      setShowEmailDialog(false);
      setCurrentPass('');
    } catch (e: any) {
      console.error(e);
      setAccountStatus({ text: e.code === 'auth/wrong-password' ? 'كلمة المرور الحالية خاطئة' : 'حدث خطأ أثناء التحديث', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!auth.currentUser || !newPassToUpdate || !currentPass) return;
    try {
      setLoading(true);
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPass);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassToUpdate);
      setAccountStatus({ text: 'تم تحديث كلمة المرور بنجاح', type: 'success' });

      // Send notification
      if (user?.email) {
        fetch('/api/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, type: 'change_password' })
        }).catch(e => console.error('Password change notification failed', e));
      }

      setShowPassDialog(false);
      setCurrentPass('');
      setNewPassToUpdate('');
    } catch (e: any) {
      console.error(e);
      setAccountStatus({ text: e.code === 'auth/wrong-password' ? 'كلمة المرور الحالية خاطئة' : 'حدث خطأ أثناء التحديث', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPass = async () => {
    if (!auth.currentUser?.email) return;
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      setAccountStatus({ text: 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني', type: 'success' });
    } catch (e) {
      setAccountStatus({ text: 'فشل إرسال البريد', type: 'error' });
    }
  };

  const handleCreateProfile = async () => {
    if (!user || !newName.trim()) return;
    if (profiles.length >= 3) {
      alert('الحد الأقصى هو 3 بروفايلات');
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

        {/* Membership & Billing Section */}
        <section className={styles.settingsSection}>
          <div className={styles.sectionLabel}>العضوية والفواتير</div>
          <div className={styles.sectionContent}>
            <div className={styles.accountInfo}>
              <div className={styles.metaData}>
                  <div className={styles.emailText}>{user?.email}</div>
                  <div className={styles.passwordText}>كلمة المرور: ********</div>
              </div>
              <div className={styles.accountActions}>
                  <button className={styles.actionLink} onClick={() => { setShowEmailDialog(true); setAccountStatus({text:'', type:''}); }}>تغيير البريد</button>
                  <button className={styles.actionLink} onClick={() => { setShowPassDialog(true); setAccountStatus({text:'', type:''}); }}>تغيير كلمة المرور</button>
              </div>
            </div>
            {accountStatus.text && (
              <div className={`${styles.statusMsg} ${accountStatus.type === 'error' ? styles.statusError : styles.statusSuccess}`}>
                {accountStatus.text}
              </div>
            )}
          </div>
        </section>

        {/* Plan Details Section */}
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

        <h1 className={styles.title}>الإعدادات</h1>

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
                  <div className={styles.profileName}>
                    <img src={p.avatar} alt={p.name} className={styles.profileThumb} />
                    <span className={styles.pNameText}>{p.name}</span>
                    {p.pin && <Lock size={14} className={styles.lockIcon} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PIN Management Dialog */}
        {showPinDialog && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h1 className={styles.modalTitle}>حماية الملف الشخصي</h1>
              <p className={styles.modalSubtitle}>أدخل 4 أرقام لإنشاء رمز PIN</p>
              
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

               <button className={styles.pinCancel} style={{ marginTop: '20px' }} onClick={() => { setShowPinDialog(false); setTempPin(''); }}>إلغاء</button>
            </div>
          </div>
        )}

        {/* Dangerous Zone Section */}
        <section className={styles.settingsSection}>
          <div className={styles.sectionLabel}>إجراءات الحساب</div>
          <div className={styles.sectionContent}>
              <button className={styles.cancelBtn} onClick={triggerDeleteAccount} disabled={loading}>
                 {loading ? 'جاري المعالجة...' : 'حذف الحساب بالكامل'}
              </button>
          </div>
        </section>
        {/* Email Change Dialog */}
        {showEmailDialog && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h1 className={styles.modalTitle}>تغيير البريد الإلكتروني</h1>
              <div style={{ background: 'rgba(0, 242, 255, 0.05)', padding: '15px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', color: '#ccc', lineHeight: '1.6', textAlign: 'right' }}>
                <p style={{ margin: '0 0 10px 0', color: '#00f2ff', fontWeight: 'bold' }}>معلومات هامة:</p>
                <ul style={{ paddingRight: '20px', margin: '0' }}>
                  <li>هذا البريد سيكون وسيلتك الأساسية لتسجيل الدخول مستقبلاً.</li>
                  <li>ستصلك كافة إشعارات الأمان واستعادة الحساب على البريد الجديد.</li>
                  <li>سيتم إرسال إشعار تأكيد فور إتمام العملية.</li>
                </ul>
              </div>
              
              {accountStatus.text && (
                 <div className={`${styles.statusMsg} ${accountStatus.type === 'error' ? styles.statusError : styles.statusSuccess}`}>
                   {accountStatus.text}
                 </div>
              )}

              <div className={styles.inputArea}>
                <input 
                  type="email" 
                  placeholder="البريد الإلكتروني الجديد" 
                  value={emailToUpdate} 
                  onChange={(e) => setEmailToUpdate(e.target.value)}
                />
                <input 
                  type="password" 
                  placeholder="كلمة المرور الحالية للتأكيد" 
                  value={currentPass} 
                  onChange={(e) => setCurrentPass(e.target.value)}
                />
              </div>
              <div className={styles.formActions}>
                <button className={styles.confirmBtn} onClick={handleUpdateEmail} disabled={loading}>
                  {loading ? 'جاري التحديث...' : 'تحديث البريد'}
                </button>
                <button className={styles.cancelLink} onClick={() => { setShowEmailDialog(false); setCurrentPass(''); }}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {/* Password Change Dialog */}
        {showPassDialog && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h1 className={styles.modalTitle}>تغيير كلمة المرور</h1>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '15px', textAlign: 'right' }}>
                يرجى إدخال كلمة المرور الحالية ثم الجديدة. تأكد من حفظها جيداً.
              </p>

              {accountStatus.text && (
                 <div className={`${styles.statusMsg} ${accountStatus.type === 'error' ? styles.statusError : styles.statusSuccess}`}>
                   {accountStatus.text}
                 </div>
              )}

              <div className={styles.inputArea}>
                <input 
                  type="password" 
                  placeholder="كلمة المرور الحالية" 
                  value={currentPass} 
                  onChange={(e) => setCurrentPass(e.target.value)}
                />
                <input 
                  type="password" 
                  placeholder="كلمة المرور الجديدة" 
                  value={newPassToUpdate} 
                  onChange={(e) => setNewPassToUpdate(e.target.value)}
                />
                <button className={styles.forgotPassBtn} onClick={handleForgotPass} disabled={loading}>
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className={styles.formActions}>
                <button className={styles.confirmBtn} onClick={handleUpdatePassword} disabled={loading}>
                  {loading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                </button>
                <button className={styles.cancelLink} onClick={() => { setShowPassDialog(false); setCurrentPass(''); setNewPassToUpdate(''); }}>إلغاء</button>
              </div>
            </div>
          </div>
        )}
        {/* Delete Account Dialog */}
        {showDeleteDialog && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ borderColor: 'rgba(255, 68, 68, 0.3)' }}>
              <h1 className={styles.modalTitle} style={{ color: '#ff4444' }}>حذف الحساب نهائياً</h1>
              <p className={styles.modalSubtitle}>سيتم حذف كافة بياناتك وبروفايلاتك وسجل المشاهدة. لا يمكن التراجع عن هذه الخطوة.</p>

              {accountStatus.text && (
                 <div className={`${styles.statusMsg} ${accountStatus.type === 'error' ? styles.statusError : styles.statusSuccess}`}>
                   {accountStatus.text}
                 </div>
              )}

              {!isCodeSent ? (
                <div className={styles.inputArea} style={{ alignItems: 'center' }}>
                  <button 
                    className={styles.confirmBtn} 
                    style={{ background: '#333', color: '#fff', width: '100%' }}
                    onClick={sendDeletionCode}
                    disabled={loading}
                  >
                    {loading ? 'جاري الإرسال...' : 'إرسال رمز التأكيد إلى الإيميل'}
                  </button>
                </div>
              ) : (
                <div className={styles.inputArea} style={{ width: '100%' }}>
                  <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px', textAlign: 'center' }}>أدخل الرمز المكون من 4 أرقام:</p>
                  
                  {timeLeft !== null && (
                    <div style={{ color: timeLeft < 30 ? '#ff4444' : '#00f2ff', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px', textAlign: 'center' }}>
                      تنتهي صلاحية الرمز خلال: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                  )}

                  {isEmailFailed && generatedCode && (
                    <div style={{ background: 'rgba(0, 242, 255, 0.1)', border: '1px dashed var(--accent-cyan)', padding: '10px', borderRadius: '10px', marginBottom: '15px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                      الرمز الحالي للمعاينة: {generatedCode}
                    </div>
                  )}

                  <input 
                    type="text" 
                    maxLength={4}
                    placeholder="0000" 
                    value={usersCode} 
                    onChange={(e) => setUsersCode(e.target.value.replace(/\D/g, ''))}
                    style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }}
                  />
                  <button 
                    className={styles.confirmBtn} 
                    style={{ background: '#ff4444', color: '#fff', marginTop: '15px' }} 
                    onClick={handleFinalDelete} 
                    disabled={loading || usersCode.length !== 4}
                  >
                    {loading ? 'جاري الحذف...' : 'تأكيد الحذف النهائي'}
                  </button>
                </div>
              )}

              <button className={styles.cancelLink} onClick={() => setShowDeleteDialog(false)}>إلغاء</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
