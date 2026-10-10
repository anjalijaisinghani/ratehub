import { useEffect, useState } from 'react';

// Returns the value only after it has stopped changing for `delay` ms.
// Typing "coffee" then sends ONE request instead of six.
export default function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}