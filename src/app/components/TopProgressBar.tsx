
'use client';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
           initial={{ scaleX: 0, opacity: 1 }}
           animate={{ scaleX: 1, opacity: 1 }}
           exit={{ opacity: 0 }}
           transition={{ duration: 0.8, ease: "easeOut" }}
           style={{
             position: 'fixed',
             top: 0,
             left: 0,
             right: 0,
             height: '3px',
             background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))',
             zIndex: 99999,
             transformOrigin: '0%',
             boxShadow: '0 0 10px rgba(0, 240, 255, 0.5)'
           }}
        />
      )}
    </AnimatePresence>
  );
}
