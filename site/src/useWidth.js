import { useEffect, useRef, useState } from 'react';

export default function useWidth(initialWidth = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initialWidth);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
