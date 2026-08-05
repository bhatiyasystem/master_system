import { useEffect, useRef } from 'react';
import { runBirthdayCheck } from '../services/greetingsService';

const STORAGE_KEY = 'birthday_check_date';

// Invisible background component — mounts once per session and fires the
// daily birthday check. Uses localStorage to ensure it only runs once per day
// regardless of how many times the component mounts.
export default function BirthdayScheduler({ onCheckComplete }) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const today = new Date().toISOString().split('T')[0];
    const lastChecked = localStorage.getItem(STORAGE_KEY);
    if (lastChecked === today) return;

    const run = async () => {
      try {
        const result = await runBirthdayCheck();
        localStorage.setItem(STORAGE_KEY, today);
        if (onCheckComplete) onCheckComplete(result);
        if (result.sent > 0) {
          console.log(`🎂 Birthday scheduler: ${result.sent} greeting(s) sent today.`);
        }
      } catch (err) {
        console.error('Birthday scheduler error:', err);
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
