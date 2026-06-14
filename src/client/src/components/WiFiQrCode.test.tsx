import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import WiFiQrCode from './WiFiQrCode';

describe('WiFiQrCode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
  // Tell React: "Hey, I'm about to do something that will trigger state changes"
  act(() => {
    vi.runOnlyPendingTimers();
  });
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
    expect(screen.getByText(/Wishboard_WiFi/)).toBeInTheDocument();
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
    const domain = import.meta.env.VITE_WISHBOARD_DOMAIN || import.meta.env.VITE_WISHBOARD_AP_IP || '10.42.0.1:3000';
    const parsed = new URL(domain.includes('://') ? domain : `http://${domain}`);
    const hostname = parsed.hostname.toLowerCase();
    const isPainlessDomain =
      hostname === 'painless-computing.com' || hostname.endsWith('.painless-computing.com');
    const url = isPainlessDomain ? `https://${domain}` : `http://${domain}`;
    expect(screen.getByText(url)).toBeInTheDocument();
  });

  it('displays https URL for painless-computing.com domains', () => {
    const originalDomain = import.meta.env.VITE_WISHBOARD_DOMAIN;
    import.meta.env.VITE_WISHBOARD_DOMAIN = 'wishboard.painless-computing.com';
    
    render(<WiFiQrCode />);
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('https://wishboard.painless-computing.com')).toBeInTheDocument();
    
    import.meta.env.VITE_WISHBOARD_DOMAIN = originalDomain;
  });
});
