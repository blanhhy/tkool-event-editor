import { useEffect, useRef, type RefObject } from 'react';

export function useClickOutside<T extends HTMLElement>(onOutside: () => void): RefObject<T> {
  const ref = useRef<T>(null);
  const handlerRef = useRef(onOutside);
  handlerRef.current = onOutside;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const el = ref.current;
      if (!el) return;
      if (!el.contains(event.target as Node)) handlerRef.current();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return ref;
}
