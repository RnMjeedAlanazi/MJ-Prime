
'use client';
import ProfileSelector from '../../components/ProfileSelector';
import styles from './profiles.module.css';

export default function ProfilesSelectorPage() {
  return (
    <div className={styles.container}>
      <ProfileSelector noOverlay={true} />
    </div>
  );
}
