
'use client';
import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/auth.module.css';
import { Mail, Lock, User, UserPlus, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      router.push('/');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('هذا البريد الإلكتروني مستخدم بالفعل');
      } else {
        setError('حدث خطأ أثناء إنشاء الحساب');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.logoArea}>
          <h1 className={styles.logoText}>بوس <span>الواوا</span></h1>
          <p>انضم إلينا وابدأ المشاهدة فوراً</p>
        </div>

        <form onSubmit={handleRegister} className={styles.authForm}>
          {error && <div className={styles.errorMsg}>{error}</div>}
          
          <div className={styles.inputGroup}>
            <User className={styles.inputIcon} size={20} />
            <input 
              type="text" 
              placeholder="الاسم الكامل" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <Mail className={styles.inputIcon} size={20} />
            <input 
              type="email" 
              placeholder="البريد الإلكتروني" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <Lock className={styles.inputIcon} size={20} />
            <input 
              type="password" 
              placeholder="كلمة المرور" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <Loader2 className={styles.spin} /> : <><UserPlus size={20} /> إنشاء حساب</>}
          </button>
        </form>

        <div className={styles.authFooter}>
          <span>لديك حساب بالفعل؟</span>
          <Link href="/login">تسجيل الدخول</Link>
        </div>
      </div>
    </div>
  );
}
