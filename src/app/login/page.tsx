
'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './auth.module.css';
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: any) {
      setError('خطأ في البريد الإلكتروني أو كلمة المرور');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.logoArea}>
          <h1 className={styles.logoText}>MJ <span>PRIME</span></h1>
          <p>أهلاً بك مجدداً في عالم الترفيه</p>
        </div>

        <form onSubmit={handleLogin} className={styles.authForm}>
          {error && <div className={styles.errorMsg}>{error}</div>}
          
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
            {loading ? <Loader2 className={styles.spin} /> : <><LogIn size={20} /> تسجيل الدخول</>}
          </button>
        </form>

        <div className={styles.authFooter}>
          <span>ليس لديك حساب؟</span>
          <Link href="/register">أنشئ حساباً الآن</Link>
        </div>
      </div>
    </div>
  );
}
