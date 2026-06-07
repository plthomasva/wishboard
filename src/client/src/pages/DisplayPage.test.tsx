import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import DisplayPage from './DisplayPage';

// Mock ResizeObserver for jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('DisplayPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'wish-1', content: 'Big screen wish', creator_genders: ['man'], creator_orientations: ['straight'] }
      ]
    }) as any;
    global.setInterval = vi.fn(() => 1) as any;
    global.clearInterval = vi.fn() as any;
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and renders wishes from the random endpoint with default limit=12 when not in kiosk mode', async () => {
    render(<DisplayPage isKiosk={false} />);

    await waitFor(() => expect(screen.getByText('Big screen wish')).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith('/api/wishes/random?limit=12');
  });

  it('displays an error message when the API fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure')) as any;
    
    render(<DisplayPage />);
    
    await waitFor(() => expect(screen.getByText('Network failure')).toBeInTheDocument());
  });

  it('displays a generic error if the response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false
    }) as any;
    
    render(<DisplayPage />);
    
    await waitFor(() => expect(screen.getByText('Unable to load wishes.')).toBeInTheDocument());
  });

  it('calculates dynamic limit using ResizeObserver bounds when in Kiosk Mode', async () => {
    // We mock the clientWidth and clientHeight to force a specific calculation
    // gap: 24, cardWidth: 240, cardHeight: 144
    // width: 800 -> cols: floor(824/264) = 3
    // height: 600 -> rows: floor((600+24-10)/168) = 3
    // capacity = 9
    
    const originalClientWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
    const originalClientHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
    const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

    Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, value: 600 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });

    let observerCallback: ResizeObserverCallback | null = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { observerCallback = callback; }
      observe() {}
      disconnect() {}
    });

    render(<DisplayPage isKiosk={true} />);

    // Trigger the observer manually
    act(() => {
      if (observerCallback) observerCallback([], {} as ResizeObserver);
    });

    // We should expect a fetch with limit=9 due to the 3x3 grid
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/wishes/random?limit=9');
    });

    // Cleanup prototype overrides
    if (originalClientWidth) Object.defineProperty(Element.prototype, 'clientWidth', originalClientWidth);
    if (originalClientHeight) Object.defineProperty(Element.prototype, 'clientHeight', originalClientHeight);
    if (originalInnerWidth) Object.defineProperty(window, 'innerWidth', originalInnerWidth);
  });
});
