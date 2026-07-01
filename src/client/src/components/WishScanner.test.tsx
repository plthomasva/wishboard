import { describe, expect, it, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WishScanner from './WishScanner';

// Global opencv and tesseract mocks are used from setupTests.ts

vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn().mockResolvedValue({ data: { text: 'Mocked OCR Text' } })
  }
}));

const originalMediaDevices = globalThis.navigator.mediaDevices;

Object.defineProperty(globalThis.navigator, 'mediaDevices', {
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
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(0), 16) as any;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id: number) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    if (originalMediaDevices) {
      Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: originalMediaDevices, writable: true, configurable: true });
    } else {
      delete (globalThis.navigator as any).mediaDevices;
    }
  });

  it('renders correctly and handles cancel', async () => {
    const onCancel = vi.fn();
    render(<WishScanner onCapture={vi.fn()} onCancel={onCancel} />);
    
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

});
