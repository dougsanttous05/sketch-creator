import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { displayNumber } from './numeric.mjs';

// Keep the text being edited separate from the numeric drawing model.
export function NumericInput({ value, onChange, onBlur, onFocus, ...props }: InputHTMLAttributes<HTMLInputElement> & { value: number }) {
  const [draft, setDraft] = useState(() => displayNumber(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(displayNumber(value)); }, [value]);
  return <input {...props} type="number" value={draft}
    onFocus={e => { focused.current = true; onFocus?.(e); }}
    onChange={e => { setDraft(e.target.value); onChange?.(e); }}
    onBlur={e => { focused.current = false; setDraft(displayNumber(value)); onBlur?.(e); }} />;
}
