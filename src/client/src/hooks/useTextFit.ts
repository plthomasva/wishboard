import { useLayoutEffect, useRef, useState } from 'react';

interface UseTextFitProps {
  minFontSize?: number;
  maxFontSize?: number;
  step?: number;
}

export function useTextFit<T extends HTMLElement = any, U extends HTMLElement = any>(
  { minFontSize = 12, maxFontSize = 24, step = 1 }: UseTextFitProps = {},
  deps: React.DependencyList = []
) {
  const containerRef = useRef<T>(null);
  const contentRef = useRef<U>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || !content) return;

    const performFit = () => {
      let currentFontSize = maxFontSize;
      content.style.fontSize = `${currentFontSize}px`;

      // Synchronously scale down until it fits
      while (
        // NOSONAR
        currentFontSize > minFontSize &&
        (container.scrollHeight > container.clientHeight ||
          container.scrollWidth > container.clientWidth)
      ) {
        currentFontSize -= step;
        content.style.fontSize = `${currentFontSize}px`;
      }

      // Check if it still overflows at minFontSize
      const isStillOverflowing =
        container.scrollHeight > container.clientHeight ||
        container.scrollWidth > container.clientWidth;

      setIsOverflowing(isStillOverflowing);
      setFontSize(currentFontSize);
    };

    performFit();

    // Use ResizeObserver to respond only to container layout changes
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          performFit();
          break;
        }
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [minFontSize, maxFontSize, step, ...deps]);

  return { containerRef, contentRef, fontSize, isOverflowing };
}
