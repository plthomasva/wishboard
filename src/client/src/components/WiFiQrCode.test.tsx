import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import WiFiQrCode from './WiFiQrCode';

describe('WiFiQrCode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('initializes invisibly and waits for the initial delay', () => {
    const { container } = render(<WiFiQrCode />);
    expect(container.firstChild).toBeNull();
  });

  it('becomes visible after the initial delay', () => {
    render(<WiFiQrCode />);
    
    // Initial wait is 10000ms
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('Connect to Wishboard')).toBeInTheDocument();
    expect(screen.getByText('Wishboard_WiFi')).toBeInTheDocument();
  });

  it('hides itself after the display duration', () => {
    render(<WiFiQrCode />);
    
    // Initial show
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText('Connect to Wishboard')).toBeInTheDocument();

    // Hide duration is 30000ms
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    
    // Should be unmounted/invisible
    expect(screen.queryByText('Connect to Wishboard')).not.toBeInTheDocument();
  });

  it('displays the correct network credentials in the QR and text', () => {
    render(<WiFiQrCode />);
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Password verification
    expect(screen.getByText(/wishboard2026/i)).toBeInTheDocument();
    
    // Verify the URL hint is present
    expect(screen.getByText(/10\.42\.0\.1:3000/i)).toBeInTheDocument();
  });
});
