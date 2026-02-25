
'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import styles from './profiles.module.css';
import { History, Heart, Play, Trash2, User, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { ProgressTracker, WatchProgress } from '@/lib/progress';
import { getFavorites, toggleFavorite } from '@/lib/userProfile';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { db, ref, set, update } from '@/lib/firebase';
import { Shield, Check, Pencil } from 'lucide-react';

const AVATARS = [
  '/api/proxy-image?url=' + encodeURIComponent('https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'),
  '/api/proxy-image?url=' + encodeURIComponent('https://64.media.tumblr.com/5f814915b8bb9345769d7ff7ec8440cf/30ae68ca211127d3-a7/s640x960/5dc1cddea75020609237ba79ca23cfa1de4c5e13.jpg'),
  '/api/proxy-image?url=' + encodeURIComponent('https://i.pinimg.com/originals/20/e9/af/20e9aff0f66998657bfa599f69785edf.jpg'),
  '/api/proxy-image?url=' + encodeURIComponent('https://64.media.tumblr.com/5fe39bf029365516a3ddf51bd5dc83d9/1b639ab913bcb07d-95/s400x600/5b80602b03c11a36e11407d1c30b6472ea18c6fc.jpg'),
  '/api/proxy-image?url=' + encodeURIComponent('https://preview.redd.it/daemon-targaryen-by-denis-maznev-v0-j5qrcy4cj3c91.jpg?width=640&crop=smart&auto=webp&s=190de713420379f8d98b28881c47b32f1727bff0'),
  '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/366be133850498.56ba69ac36858.png'),
  '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/1bdc9a33850498.56ba69ac2ba5b.png'),
  '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/bf6e4a33850498.56ba69ac3064f.png'),
  '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/84c20033850498.56ba69ac2903c.png'),
  '/api/proxy-image?url=' + encodeURIComponent('https://mir-s3-cdn-cf.behance.net/project_modules/disp/64623633850498.56ba69ac2a6d7.png')
];

export default function ProfilePage() {
  const { user, activeProfile, refreshProfiles } = useAuth();
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'favorites' | 'settings'>('history');
  
  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editPin, setEditPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user && activeProfile) {
      ProgressTracker.getAllProgress(activeProfile.id).then((data: WatchProgress[]) => {
        setHistory(data.sort((a: WatchProgress, b: WatchProgress) => b.lastUpdated - a.lastUpdated));
      });
      setFavorites(getFavorites(activeProfile.id));
      
      // Sync local edit state
      setEditName(activeProfile.name);
      setEditAvatar(activeProfile.avatar);
      setEditPin(activeProfile.pin || '');
    }
  }, [user, activeProfile]);

  const handleSaveProfile = async () => {
    if (!user || !activeProfile) return;
    setSaving(true);
    setMessage('');
    
    const updatedProfile = {
      ...activeProfile,
      name: editName || activeProfile.name,
      avatar: editAvatar || activeProfile.avatar,
      pin: editPin || null
    };

    try {
      await update(ref(db, `users/${user.uid}/profiles/${activeProfile.id}`), {
        name: editName || activeProfile.name,
        avatar: editAvatar || activeProfile.avatar,
        pin: editPin || null
      });
      await refreshProfiles();
      setMessage('تم تحديث البروفايل بنجاح!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      console.error(e);
      setMessage('فشل التحديث، يرجى المحاولة لاحقاً');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => auth.signOut();

  const handleRemoveFavorite = (item: any) => {
    toggleFavorite(item, activeProfile?.id);
    setFavorites(getFavorites(activeProfile?.id));
  };

  const formatPercent = (current: number, total: number) => {
    return Math.min(100, Math.floor((current / total) * 100));
  };

  if (!user) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.userSection}>
          <div className={styles.avatar}>
            {activeProfile ? <img src={activeProfile.avatar} alt={activeProfile.name} /> : <User size={60} />}
          </div>
          <div className={styles.userInfo}>
            <h1>{activeProfile?.name || user.displayName || 'مستخدم'}</h1>
            <p>{user.email}</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={18} /> تسجيل الخروج
          </button>
        </div>
      </header>

      <div className={styles.tabs}>
        <button 
          className={activeTab === 'history' ? styles.activeTab : ''} 
          onClick={() => setActiveTab('history')}
        >
          <History size={18} /> سجل المتابعة
        </button>
        <button 
          className={activeTab === 'favorites' ? styles.activeTab : ''} 
          onClick={() => setActiveTab('favorites')}
        >
          <Heart size={18} /> المفضلة
        </button>
        <button 
          className={activeTab === 'settings' ? styles.activeTab : ''} 
          onClick={() => setActiveTab('settings')}
        >
          <SettingsIcon size={18} /> تعديل البروفايل
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'history' && (
          <div className={styles.grid}>
            {history.length === 0 ? <p className={styles.empty}>لا يوجد سجل متابعة حالياً</p> : 
              history.map((item, idx) => (
                <Link href={`/${item.type === 'movie' ? 'movies' : 'episodes'}/${item.mediaId.split('_').pop()}`} key={idx}>
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={styles.historyCard}
                  >
                    <div className={styles.cardInfo}>
                      <h3>{item.title}</h3>
                      <div className={styles.progressText}>
                         توقفت عند {Math.floor(item.currentTime / 60)}:{(Math.floor(item.currentTime % 60)).toString().padStart(2, '0')}
                      </div>
                      <div className={styles.progressBar}>
                        <div 
                          className={styles.progressFill} 
                          style={{ width: `${formatPercent(item.currentTime, item.duration)}%` }} 
                        />
                      </div>
                    </div>
                    <div className={styles.playIcon}><Play size={20} fill="currentColor" /></div>
                  </motion.div>
                </Link>
              ))
            }
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className={styles.grid}>
             {favorites.length === 0 ? <p className={styles.empty}>قائمتك المفضلة فارغة</p> : 
              favorites.map((item, idx) => (
                <div key={idx} className={styles.favCard}>
                   <img src={`/api/proxy-image?url=${encodeURIComponent(item.poster)}`} alt={item.title} />
                   <div className={styles.favOverlay}>
                      <h3>{item.title}</h3>
                      <div className={styles.favActions}>
                        <Link href={item.link} className={styles.favPlayBtn}><Play size={16} fill="currentColor"/> مشاهدة</Link>
                        <button onClick={() => handleRemoveFavorite(item)} className={styles.favRemoveBtn}><Trash2 size={16}/></button>
                      </div>
                   </div>
                </div>
              ))
            }
          </div>
        )}

        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={styles.settingsSection}>
            <div className={styles.settingsGrid}>
              <div className={styles.formCol}>
                <div className={styles.inputGroup}>
                  <label>اسم البروفايل</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="الاسم..." />
                </div>
                
                <div className={styles.inputGroup}>
                  <label>رمز PIN (اختياري)</label>
                  <div className={styles.pinWrapper}>
                    <Shield size={18} />
                    <input 
                      value={editPin} 
                      onChange={(e) => setEditPin(e.target.value.replace(/\D/g,''))} 
                      maxLength={4} 
                      type="password" 
                      placeholder="4 أرقام" 
                    />
                  </div>
                </div>

                <div className={styles.saveWrap}>
                  <button onClick={handleSaveProfile} disabled={saving} className={styles.saveBtnUI}>
                    {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </button>
                  {message && <span className={styles.saveMsg}>{message}</span>}
                </div>
              </div>

              <div className={styles.avatarCol}>
                <label>تغيير الصورة</label>
                <div className={styles.avatarGrid}>
                  {AVATARS.map(a => (
                    <div 
                      key={a} 
                      className={`${styles.avatarOption} ${editAvatar === a ? styles.avatarActive : ''}`}
                      onClick={() => setEditAvatar(a)}
                    >
                      <img src={a} alt="avatar" />
                      {editAvatar === a && <div className={styles.avatarCheck}><Check size={14}/></div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
