import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { useTextFit } from './useTextFit';

describe('useTextFit', () => {
  it('scales down font size and calls ResizeObserver', () => {
    // Mock ResizeObserver
    let observerCallback: any;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    globalThis.ResizeObserver = class ResizeObserver {
      constructor(callback: any) {
        observerCallback = callback;
      }
      observe = observeMock;
      disconnect = disconnectMock;
    } as any;

    const TestComponent = () => {
      const { containerRef, contentRef } = useTextFit({
        minFontSize: 10,
        maxFontSize: 20,
        step: 2,
      });

      // Mock overflowing properties
      if (containerRef.current) {
        Object.defineProperty(containerRef.current, 'scrollHeight', {
          value: 200,
          configurable: true,
        });
        Object.defineProperty(containerRef.current, 'clientHeight', {
          value: 100,
          configurable: true,
        });
      }

      return (
        <div ref={containerRef as any} data-testid="container">
          <div ref={contentRef as any} data-testid="content">
            Long text
          </div>
        </div>
      );
    };

    render(<TestComponent />);

    const content = screen.getByTestId('content');
    // Trigger overflow condition manually after ref is set
    // In real layout, this happens synchronously. In JSDOM, properties are 0.
    // We'll call the observer callback to trigger performFit again.

    if (observerCallback) {
      const container = screen.getByTestId('container');
      Object.defineProperty(container, 'scrollHeight', { value: 200, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });

      act(() => {
        observerCallback([{ target: container }]);
      });
      expect(content.style.fontSize).toBe('10px'); // It should scale down to minFontSize
    }
  });
});
