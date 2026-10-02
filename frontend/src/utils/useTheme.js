import { useEffect, useState } from 'react';

// Returns 'light' or 'dark', and updates when the theme button is clicked
export default function useTheme() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');

  useEffect(() => {
    const observer = new MutationObserver(() =>
      setTheme(document.documentElement.dataset.theme || 'light')
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}