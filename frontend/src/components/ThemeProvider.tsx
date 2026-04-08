// Hermes WebUI — Theme Provider
// Syncs theme state from the Zustand store to the DOM and localStorage.
// Defaults to 'dark'. Applies 'dark' class to <html> for Tailwind dark mode.

import { useEffect } from 'react';
import { useAppStore } from '../store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return <>{children}</>;
}
