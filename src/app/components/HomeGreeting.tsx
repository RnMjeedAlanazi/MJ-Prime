
'use client';
import { useAuth } from '@/app/context/AuthContext';
import styles from '../page.module.css';
import { motion } from 'framer-motion';

export default function HomeGreeting() {
  const { activeProfile } = useAuth();

  if (!activeProfile) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={styles.greeting}
    >
      <div className={styles.greetingContent}>
        <img src={activeProfile.avatar} alt={activeProfile.name} className={styles.greetingAvatar} />
        <div className={styles.greetingText}>
          <h2>أهلاً، {activeProfile.name}</h2>
          <p>ماذا ترغب بمشاهدته اليوم؟</p>
        </div>
      </div>
    </motion.div>
  );
}
