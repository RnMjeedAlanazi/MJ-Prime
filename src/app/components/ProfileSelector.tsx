
'use client';
import { useAuth, Profile } from '@/app/context/AuthContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './profileSelector.module.css';
import { Plus, Lock, User as UserIcon, Check, ArrowLeft, Shield, Pencil } from 'lucide-react';
import { db, ref, update } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfileSelector({ onSelect }: { onSelect?: () => void }) {
  const { user, profiles, setActiveProfile, activeProfile, refreshProfiles } = useAuth();
  const router = useRouter(); 
  const [showPinInput, setShowPinInput] = useState<Profile | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // New Profile Form State
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png');
  const [loading, setLoading] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');

  const AVATARS = [
    '/api/proxy-image?url=' + encodeURIComponent('https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'),
    '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/366be133850498.56ba69ac36858.png'),
    '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/1bdc9a33850498.56ba69ac2ba5b.png'),
    '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/bf6e4a33850498.56ba69ac3064f.png'),
    '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/84c20033850498.56ba69ac2903c.png')
  ];

  const handleSelect = (p: Profile) => {
    if (isManaging) {
      router.push(`/settings?edit=${p.id}`);
      return;
    }
    if (p.pin) {
      setShowPinInput(p);
      setPin('');
      setErr('');
    } else {
      setActiveProfile(p);
      window.location.href = '/'; // Hard reload to clear old state and load fresh profile data
    }
  };

  const verifyPin = () => {
    if (showPinInput && pin === showPinInput.pin) {
      setActiveProfile(showPinInput);
      setShowPinInput(null);
      window.location.href = '/'; // Hard reload to ensure fresh data for the new profile
    } else {
      setErr('رمز PIN خاطئ');
    }
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
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
      
      await refreshProfiles();
      setIsAdding(false);
      setNewName('');
      setNewPin('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        {!isAdding ? (
          <>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }} 
              animate={{ opacity: 1, y: 0 }}
              className={styles.title}
            >
              {isManaging ? 'إدارة البروفايلات' : 'من الذي يشاهد؟'}
            </motion.h1>
            
            <div className={styles.profilesGrid}>
              {profiles.map((p, idx) => (
                <motion.div 
                  key={p.id} 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className={styles.profileItem} 
                  onClick={() => handleSelect(p)}
                >
                  <div className={`${styles.avatarWrapper} ${activeProfile?.id === p.id && !isManaging ? styles.active : ''}`}>
                    <img src={p.avatar} alt={p.name} />
                    {p.pin && !isManaging && <div className={styles.lockBadge}><Lock size={14} /></div>}
                    {isManaging && (
                      <div className={styles.editOverlay}>
                        <div className={styles.editIconWrapper}><Pencil size={24} /></div>
                      </div>
                    )}
                    <div className={styles.avatarHoverBorder} />
                  </div>
                  <span className={styles.profileName}>{p.name}</span>
                </motion.div>
              ))}
              
              {profiles.length < 5 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: profiles.length * 0.1 }}
                  className={styles.profileItem} 
                  onClick={() => {
                    setNewName('');
                    setNewPin('');
                    setIsAdding(true);
                  }}
                >
                  <div className={styles.addBtn}>
                    <Plus size={40} />
                  </div>
                  <span className={styles.profileName}>إضافة بروفايل</span>
                </motion.div>
              )}
            </div>

            <motion.button 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={isManaging ? styles.doneBtn : styles.manageBtn}
              onClick={() => setIsManaging(!isManaging)}
            >
              {isManaging ? 'تم' : 'إدارة البروفايلات'}
            </motion.button>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={styles.addForm}>
            <div className={styles.backBtn} onClick={() => setIsAdding(false)}>
              <ArrowLeft size={24} />
            </div>
            <h1 className={styles.title}>إضافة ملف شخصي</h1>
            <p className={styles.subtitle}>أضف ملفاً شخصياً لشخص آخر يستخدم بوس الواوا.</p>
            
            <div className={styles.formContent}>
              <div 
                className={styles.avatarLarge} 
                onClick={() => setShowAvatarPicker(true)}
              >
                <img src={selectedAvatar} alt="selected" />
                <div className={styles.avatarEditHint}>
                   <Pencil size={20} />
                </div>
              </div>
              
              <div className={styles.inputWrap}>
                <input 
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="الاسم"
                  className={styles.nameInput}
                />
              </div>

              <div className={styles.inputWrap}>
                <div className={styles.pinInputContainer}>
                   <Shield size={18} />
                   <input 
                    type="text"
                    autoComplete="off"
                    data-lpignore="true"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="رمز PIN (4 أرقام - اختياري)"
                    className={`${styles.nameInput} ${styles.pinSecure}`}
                  />
                </div>
              </div>

              <AnimatePresence>
                {showAvatarPicker && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }} 
                    className={styles.avatarPickerOverlay}
                    onClick={() => setShowAvatarPicker(false)}
                  >
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className={styles.avatarPickerModal}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className={styles.avatarPickerHeader}>
                        <h3>اختر أفاتار</h3>
                        <button onClick={() => setShowAvatarPicker(false)}><Plus style={{ transform: 'rotate(45deg)' }} /></button>
                      </div>
                      <div className={styles.avatarGrid}>
                        {AVATARS.map(av => (
                          <div 
                            key={av} 
                            className={`${styles.avOpt} ${selectedAvatar === av ? styles.avActive : ''}`}
                            onClick={() => {
                              setSelectedAvatar(av);
                              setShowAvatarPicker(false);
                            }}
                          >
                            <img src={av} alt="avatar" />
                            {selectedAvatar === av && <div className={styles.avCheck}><Check size={12}/></div>}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={styles.formActionsUI}>
                <button 
                  className={`${styles.saveBtn} ${newName.trim().length >= 2 ? styles.saveBtnActive : ''}`} 
                  disabled={loading || !newName.trim()} 
                  onClick={handleCreate}
                >
                  {loading ? 'جاري الإنشاء...' : 'متابعة'}
                </button>
                <button className={styles.cancelLink} onClick={() => setIsAdding(false)}>إلغاء</button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showPinInput && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.pinModal}>
            <div className={styles.pinBox}>
               <h3>أدخل رمز PIN لبروفايل {showPinInput.name}</h3>
               <input 
                 type="text"
                 autoComplete="off"
                 data-lpignore="true"
                 maxLength={4} 
                 value={pin} 
                 onChange={(e) => setPin(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
                 autoFocus
                 className={styles.pinSecure}
               />
               {err && <p className={styles.err}>{err}</p>}
               <div className={styles.pinActions}>
                 <button onClick={verifyPin} className={styles.confirmBtn}>دخول</button>
                 <button onClick={() => setShowPinInput(null)} className={styles.cancelBtn}>إلغاء</button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
