'use client';
import { useEffect } from 'react';

export default function IOSActiveStateFix() {
  useEffect(() => {
    // Enable :active CSS states on iOS Safari
    document.body.addEventListener('touchstart', () => {}, { passive: true });
  }, []);

  return null;
}
