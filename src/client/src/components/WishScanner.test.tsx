import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import WishScanner from './WishScanner';

// Global opencv and tesseract mocks are used from setupTests.ts

vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn().mockResolvedValue({ data: { text: 'Mocked OCR Text' } })
  }
}));

const originalMediaDevices = global.navigator.mediaDevices;

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    }),
  },
  writable: true,
  configurable: true,
});

describe('WishScanner', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(0), 16) as any;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    if (originalMediaDevices) {
      Object.defineProperty(global.navigator, 'mediaDevices', { value: originalMediaDevices, writable: true, configurable: true });
    } else {
      delete (global.navigator as any).mediaDevices;
    }
  });

  it('renders correctly and handles cancel', () => {
    const onCancel = vi.fn();
    render(<WishScanner onCapture={vi.fn()} onCancel={onCancel} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

});
