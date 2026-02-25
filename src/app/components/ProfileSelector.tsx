
'use client';
import { useAuth, Profile } from '@/app/context/AuthContext';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './profileSelector.module.css';
import { Plus, Lock, User as UserIcon, Check, ArrowLeft, Shield, Pencil, Trash2, AlertCircle, X } from 'lucide-react';
import { db, ref, update, remove } from '@/lib/firebase';
import { motion, AnimatePresence, Variants } from 'framer-motion';

export default function ProfileSelector({ onSelect, noOverlay = false }: { onSelect?: () => void, noOverlay?: boolean }) {
  const { user, profiles, setActiveProfile, activeProfile, refreshProfiles } = useAuth();
  const router = useRouter(); 
  const [showPinInput, setShowPinInput] = useState<Profile | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png');
  const [loading, setLoading] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [tempAvatar, setTempAvatar] = useState(selectedAvatar);

  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  const screenVariants: Variants = {
    initial: (direction: number) => ({ 
      opacity: 0, 
      x: direction > 0 ? 100 : -100 
    }),
    animate: { 
      opacity: 1, 
      x: 0, 
      transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } 
    },
    exit: (direction: number) => ({ 
      opacity: 0, 
      x: direction > 0 ? -100 : 100,
      transition: { duration: 0.4, ease: [0.4, 0, 1, 1] }
    })
  };

  useEffect(() => {
    if (profiles.length === 0) setIsAdding(true);
  }, [profiles.length]);

  const containerClass = noOverlay ? styles.pageWrapper : styles.overlay;

  const AVATARS = [
    '/api/proxy-image?url=' + encodeURIComponent('https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'),
    '/api/proxy-image?url=' + encodeURIComponent('https://64.media.tumblr.com/5f814915b8bb9345769d7ff7ec8440cf/30ae68ca211127d3-a7/s640x960/5dc1cddea75020609237ba79ca23cfa1de4c5e13.jpg'),
    '/api/proxy-image?url=' + encodeURIComponent('https://i.pinimg.com/originals/20/e9/af/20e9aff0f66998657bfa599f69785edf.jpg'),
    '/api/proxy-image?url=' + encodeURIComponent('https://64.media.tumblr.com/5fe39bf029365516a3ddf51bd5dc83d9/1b639ab913bcb07d-95/s400x600/5b80602b03c11a36e11407d1c30b6472ea18c6fc.jpg'),
    '/api/proxy-image?url=' + encodeURIComponent('https://preview.redd.it/daemon-targaryen-by-denis-maznev-v0-j5qrcy4cj3c91.jpg?width=640&crop=smart&auto=webp&s=190de713420379f8d98b28881c47b32f1727bff0'),
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
    
    if (activeProfile?.id === p.id) {
       window.location.href = '/';
       return;
    }

    if (p.pin) {
      setDirection(1);
      setShowPinInput(p);
      setPin('');
      setErr('');
    } else {
      setActiveProfile(p);
      window.location.href = '/';
    }
  };

  const verifyPin = (currentPin: string) => {
    if (showPinInput && currentPin === showPinInput.pin) {
      if (activeProfile?.id === showPinInput.id) {
        setShowPinInput(null);
        window.location.href = '/';
        return;
      }
      setActiveProfile(showPinInput);
      setShowPinInput(null);
      window.location.href = '/'; 
    } else if (currentPin.length === 4) {
      setErr('رمز PIN خاطئ');
      setPin('');
    }
  };

  const handleKeyClick = (num: string) => {
    if (isSettingPin) {
      if (newPin.length < 4) {
        const newerPin = newPin + num;
        setNewPin(newerPin);
        if (newerPin.length === 4) {
          setIsSettingPin(false); // Finished setting
        }
      }
      return;
    }
    
    if (pin.length < 4) {
      const newPinVal = pin + num;
      setPin(newPinVal);
      if (newPinVal.length === 4) {
        verifyPin(newPinVal);
      }
    }
  };

  const handleDeleteKey = () => {
    if (isSettingPin) {
      setNewPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
      setErr('');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || profiles.length <= 1) return;
    try {
      setDeleteId(null);
      await remove(ref(db, `users/${user.uid}/profiles/${id}`));
      if (activeProfile?.id === id) setActiveProfile(null);
      await refreshProfiles();
    } catch (e) {
      console.error('Error deleting profile:', e);
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
      
      const isFirstProfile = profiles.length === 0;
      await refreshProfiles();
      
      if (isFirstProfile) {
        setActiveProfile(newProfile);
        window.location.href = '/'; 
      } else {
        setDirection(-1);
        setIsAdding(false);
        setNewName('');
        setNewPin('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={containerClass}>
      <AnimatePresence mode="wait" custom={direction}>
        {(showPinInput || isSettingPin) ? (
          <motion.div 
            key="pin-overlay"
            custom={direction}
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={styles.pinOverlay}
          >
            <div className={styles.pinContent}>
               <h2 className={styles.pinSubtitle}>
                 {isSettingPin ? 'إعداد رمز الحماية' : 'قفل الملف الشخصي قيد التشغيل.'}
               </h2>
               <h1 className={styles.pinTitle}>
                 {isSettingPin ? 'أنشئ رمز PIN للملف الشخصي الجديد.' : 'أدخل رمز PIN للوصول إلى هذا الملف الشخصي.'}
               </h1>
               
               <div className={styles.pinDisplay}>
                 {[0, 1, 2, 3].map(i => {
                   const val = isSettingPin ? newPin : pin;
                   return (
                    <div key={i} className={`${styles.pinBox} ${val.length === i ? styles.pinBoxActive : ''} ${val.length > i ? styles.pinBoxFilled : ''}`}>
                      {val.length > i ? <div className={styles.dot} /> : null}
                    </div>
                   );
                 })}
               </div>

               {err && !isSettingPin && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.pinErr}>{err}</motion.p>}

               <div className={styles.keypad}>
                 {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((k, i) => (
                   <button 
                    key={i} 
                    className={`${styles.key} ${k === '' ? styles.keyEmpty : ''} ${k === 'del' ? styles.keyDel : ''}`}
                    onClick={() => {
                      if (k === 'del') handleDeleteKey();
                      else if (k !== '') handleKeyClick(k.toString());
                    }}
                    disabled={k === ''}
                   >
                     {k === 'del' ? <ArrowLeft size={24} /> : k}
                   </button>
                 ))}
               </div>

               <button className={styles.pinCancel} onClick={() => {
                 setDirection(-1);
                 if (isSettingPin) {
                    setIsSettingPin(false);
                    setNewPin('');
                 } else {
                    setShowPinInput(null);
                 }
               }}>إلغاء</button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="main-container"
            custom={direction}
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={styles.container}
          >
            <AnimatePresence mode="wait" custom={direction}>
              {!isAdding ? (
                <motion.div 
                  key="profile-list"
                  custom={direction}
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <h1 className={styles.title}>
                    {isManaging ? 'إدارة البروفايلات' : 'من الذي يشاهد؟'}
                  </h1>
                  
                  <div className={styles.profilesGrid}>
                    {profiles.map((p) => (
                      <div 
                        key={p.id} 
                        className={styles.profileItem} 
                        onClick={() => handleSelect(p)}
                      >
                        <div className={`${styles.avatarWrapper} ${activeProfile?.id === p.id && !isManaging ? styles.active : ''}`}>
                          <img src={p.avatar} alt={p.name} />
                          <AnimatePresence>
                            {isManaging && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className={styles.editOverlay}
                              >
                                <div className={styles.editIconWrapper}><Pencil size={24} /></div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className={styles.avatarHoverBorder} />
                        </div>
                        <AnimatePresence>
                          {isManaging && profiles.length > 1 && (
                            <motion.button 
                              initial={{ opacity: 0, scale: 0, rotate: -45 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              exit={{ opacity: 0, scale: 0, rotate: -45 }}
                              className={styles.deleteBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteId(p.id);
                              }}
                            >
                              <X size={18} />
                            </motion.button>
                          )}
                        </AnimatePresence>
                        <span className={styles.profileName}>
                          {p.name}
                          {p.pin && !isManaging && <Lock size={16} className={styles.nameLockIcon} />}
                        </span>
                      </div>
                    ))}
                    
                    {profiles.length < 5 && (
                      <div 
                        className={styles.profileItem} 
                        onClick={() => {
                          setDirection(1);
                          setIsSettingPin(false);
                          setNewName('');
                          setNewPin('');
                          setIsAdding(true);
                        }}
                      >
                        <div className={styles.addBtn}>
                          <Plus size={40} />
                        </div>
                        <span className={styles.profileName}>إضافة بروفايل</span>
                      </div>
                    )}
                  </div>

                  {profiles.length > 0 && (
                    <button 
                      className={isManaging ? styles.doneBtn : styles.manageBtn}
                      onClick={() => setIsManaging(!isManaging)}
                    >
                      {isManaging ? 'تم' : 'إدارة البروفايلات'}
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="add-profile-form"
                  custom={direction}
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={styles.addForm}
                >
                  {profiles.length > 0 && (
                    <div className={styles.backBtn} onClick={() => {
                      setDirection(-1);
                      setIsAdding(false);
                    }}>
                      <ArrowLeft size={24} />
                    </div>
                  )}
                  <h1 className={styles.title}>إضافة ملف شخصي</h1>
                  <p className={styles.subtitle}>أضف ملفاً شخصياً لشخص آخر يستخدم MJ Prime.</p>
                  
                  <div className={styles.formContent}>
                    <div className={styles.avatarLarge} onClick={() => {
                        setTempAvatar(selectedAvatar);
                        setShowAvatarPicker(true);
                      }}>
                      <img src={selectedAvatar} alt="selected" />
                      <div className={styles.avatarEditHint}><Pencil size={20} /></div>
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
                      {!newPin ? (
                        <button 
                          className={styles.addPinToggle} 
                          onClick={() => {
                            setDirection(1);
                            setIsSettingPin(true);
                          }}
                        >
                          <Lock size={16} />
                          <span>إضافة رمز PIN للبروفايل</span>
                        </button>
                      ) : (
                        <div className={styles.pinSetIndicator}>
                           <div className={styles.pinSetInfo}>
                             <Lock size={16} className={styles.pinLockedIcon} />
                             <span>تم تعيين رمز PIN بنجاح</span>
                           </div>
                           <button 
                             className={styles.removePinBtn} 
                             onClick={() => setNewPin('')}
                           >
                             إزالة القفل
                           </button>
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {showAvatarPicker && (
                        <motion.div 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                          className={styles.avatarPickerOverlay}
                          onClick={() => setShowAvatarPicker(false)}
                        >
                          <motion.div 
                            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                            className={styles.avatarPickerModal}
                            onClick={e => e.stopPropagation()}
                          >
                            <div className={styles.avatarPickerHeader}>
                              <h3>اختر أفاتار</h3>
                              <button onClick={() => setShowAvatarPicker(false)}><X size={24} /></button>
                            </div>

                            <div className={styles.avatarCarouselContainer}>
                              <div className={styles.avatarSlider}>
                                {AVATARS.map(av => (
                                  <motion.div 
                                    key={av} 
                                    whileTap={{ scale: 0.95 }}
                                    className={`${styles.avCircleOpt} ${tempAvatar === av ? styles.avCircleActive : ''}`}
                                    onClick={() => setTempAvatar(av)}
                                  >
                                    <img src={av} alt="avatar" />
                                  </motion.div>
                                ))}
                              </div>
                            </div>

                            <button 
                              className={styles.avatarConfirmBtn}
                              onClick={() => {
                                setSelectedAvatar(tempAvatar);
                                setShowAvatarPicker(false);
                              }}
                            >
                              اختيار
                            </button>
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
                      {profiles.length > 0 && (
                        <button className={styles.cancelLink} onClick={() => { setDirection(-1); setIsAdding(false); }}>إلغاء</button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.pinModal}>
            <div className={styles.pinBoxModal}>
               <AlertCircle size={40} color="#ff3b30" style={{ marginBottom: '15px' }} />
               <h3>هل أنت متأكد من حذف هذا البروفايل؟</h3>
               <p style={{ color: '#888', marginBottom: '25px' }}>سيتم حذف كافة سجلات المشاهدة والمفضلة الخاصة بهذا البروفايل نهائياً.</p>
               <div className={styles.pinActions}>
                 <button onClick={() => handleDelete(deleteId)} className={styles.confirmBtn} style={{ background: '#ff3b30', color: '#fff' }}>حذف نهائي</button>
                 <button onClick={() => setDeleteId(null)} className={styles.cancelBtn}>إلغاء</button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
