import { useState } from 'react';

const WORDS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// Five clickable stars. Works with the mouse and the keyboard (Tab, then Enter or Space).
export default function StarPicker({ value, onChange, disabled = false }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="star-picker" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={n <= shown ? 'star-btn on' : 'star-btn'}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
      <span className="muted">{shown ? WORDS[shown - 1] : 'Choose a rating'}</span>
    </div>
  );
}