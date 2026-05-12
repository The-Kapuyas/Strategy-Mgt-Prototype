import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

/**
 * A useState wrapper that persists state to sessionStorage.
 * On mount, initializes from sessionStorage if available; on change, writes back.
 * Fails silently if sessionStorage is unavailable.
 */
export function useSessionState<T>(
  key: string,
  defaultValue: T,
  options?: {
    serialize?: (value: T) => unknown;
    deserialize?: (raw: unknown) => T;
  },
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored === null) return defaultValue;
      const parsed = JSON.parse(stored);
      return options?.deserialize ? options.deserialize(parsed) : parsed;
    } catch {
      return defaultValue;
    }
  });

  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip writing on initial mount to avoid overwriting with the same value
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      const toStore = options?.serialize ? options.serialize(state) : state;
      sessionStorage.setItem(key, JSON.stringify(toStore));
    } catch {
      // sessionStorage full or unavailable — fail silently
    }
  }, [key, state, options]);

  return [state, setState];
}
