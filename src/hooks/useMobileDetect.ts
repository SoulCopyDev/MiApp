import { useState, useEffect } from 'react';
import { DISMISS_KEY } from '../config/downloadConfig';

export type DevicePlatform = 'android' | 'ios' | 'desktop';

function detectPlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  return 'desktop';
}

function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function useMobileDetect() {
  const [platform, setPlatform] = useState<DevicePlatform>('desktop');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);

    if (isPWAStandalone()) return;
    if (isDismissed()) return;

    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setVisible(false);
  };

  return { platform, visible, dismiss };
}
