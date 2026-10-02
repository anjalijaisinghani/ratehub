import { useEffect, useRef, useState } from 'react';

export default function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  const previous = useRef(0); // where the animation starts from

  useEffect(() => {
    const from = previous.current;
    const start = performance.now();
    let frame;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(from + (target - from) * progress));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        previous.current = target;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}