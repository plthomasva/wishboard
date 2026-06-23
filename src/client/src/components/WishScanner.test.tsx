import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WishScanner from './WishScanner';

// Mock OpenCV and tesseract
vi.mock('@techstark/opencv-js', () => ({
  default: {
    Mat: vi.fn(),
    imread: vi.fn(),
    cvtColor: vi.fn(),
    COLOR_RGBA2GRAY: 'COLOR_RGBA2GRAY',
    medianBlur: vi.fn(),
    adaptiveThreshold: vi.fn(),
    threshold: vi.fn(),
    THRESH_BINARY: 'THRESH_BINARY',
    THRESH_OTSU: 'THRESH_OTSU',
    findContours: vi.fn(),
    RETR_EXTERNAL: 'RETR_EXTERNAL',
    CHAIN_APPROX_SIMPLE: 'CHAIN_APPROX_SIMPLE',
    contourArea: vi.fn().mockReturnValue(100),
    boundingRect: vi.fn().mockReturnValue({ x: 0, y: 0, width: 100, height: 100 }),
    drawContours: vi.fn(),
    imshow: vi.fn(),
    approxPolyDP: vi.fn(),
    arcLength: vi.fn().mockReturnValue(10),
    getPerspectiveTransform: vi.fn(),
    warpPerspective: vi.fn(),
    matFromArray: vi.fn(),
    Size: vi.fn(),
    Point: vi.fn()
  }
}));

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
