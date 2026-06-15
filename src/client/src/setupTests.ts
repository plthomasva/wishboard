import '@testing-library/jest-dom';
import ResizeObserver from 'resize-observer-polyfill';

globalThis.ResizeObserver = ResizeObserver;
if (typeof window !== 'undefined') {
  globalThis.window.ResizeObserver = ResizeObserver;
}
