import '@testing-library/jest-dom';
import ResizeObserver from 'resize-observer-polyfill';

global.ResizeObserver = ResizeObserver;
if (typeof window !== 'undefined') {
  window.ResizeObserver = ResizeObserver;
}
