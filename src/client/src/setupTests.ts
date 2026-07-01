import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('@techstark/opencv-js', () => ({
  default: {
    Mat: vi.fn().mockImplementation(() => ({
      delete: vi.fn(),
      rows: 4,
      data32S: [0, 0, 800, 0, 800, 600, 0, 600],
    })),
    MatVector: vi.fn().mockImplementation(() => ({
      delete: vi.fn(),
      size: () => 1,
      get: () => ({ delete: vi.fn() }),
    })),
    imread: vi.fn().mockReturnValue({ delete: vi.fn() }),
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
    contourArea: vi.fn().mockReturnValue(500000),
    boundingRect: vi.fn().mockReturnValue({ x: 0, y: 0, width: 100, height: 100 }),
    drawContours: vi.fn(),
    imshow: vi.fn(),
    approxPolyDP: vi.fn(),
    arcLength: vi.fn().mockReturnValue(10),
    getPerspectiveTransform: vi.fn().mockReturnValue({ delete: vi.fn() }),
    warpPerspective: vi.fn(),
    matFromArray: vi.fn().mockReturnValue({ delete: vi.fn() }),
    Size: vi.fn(),
    Point: vi.fn(),
    GaussianBlur: vi.fn(),
    Canny: vi.fn(),
    BORDER_DEFAULT: 'BORDER_DEFAULT',
    RETR_LIST: 'RETR_LIST',
  },
}));

vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn().mockResolvedValue({ data: { text: 'Mocked OCR Text' } }),
  },
}));
import ResizeObserver from 'resize-observer-polyfill';

// Mock socket.io-client so component tests don't try to open a real WebSocket
vi.mock('socket.io-client', () => {
  const socket = {
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    default: { io: vi.fn(() => socket) },
    io: vi.fn(() => socket),
  };
});

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn() as any;
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (
    this: HTMLCanvasElement,
    callback: BlobCallback
  ) {
    callback(new Blob(['mock data'], { type: 'image/jpeg' }));
  }) as any;
}

globalThis.ResizeObserver = ResizeObserver;
if (globalThis.window !== undefined) {
  Object.defineProperty(globalThis.window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
