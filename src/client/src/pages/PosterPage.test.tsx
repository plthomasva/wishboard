import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PosterPage from './PosterPage';

const setConfig = (cfg: Record<string, unknown> | undefined) => {
  (globalThis as Record<string, unknown>).__WISHBOARD_CONFIG__ = cfg;
};

describe('PosterPage', () => {
  afterEach(() => setConfig(undefined));

  it('renders the poster with Wi-Fi and URL instructions', () => {
    render(<PosterPage />);

    expect(screen.getByText('Wishboard')).toBeInTheDocument();
    expect(screen.getByText('Step 1: Join Wi-Fi')).toBeInTheDocument();
    expect(screen.getByText('Step 2: Scan to Visit')).toBeInTheDocument();
    expect(screen.getByText('Wishboard_WiFi')).toBeInTheDocument();
    expect(screen.getByText(['wishboard', '2026'].join(''))).toBeInTheDocument();

    // Checks that the two action sections render
    expect(screen.getByText('🪄 Create')).toBeInTheDocument();
    expect(screen.getByText('🔍 Match')).toBeInTheDocument();
  });

  it('shows the server-configured domain (the #196 fix)', () => {
    setConfig({ domain: 'demo.wishboards.app' });
    render(<PosterPage />);
    expect(screen.getByText('demo.wishboards.app')).toBeInTheDocument();
  });

  it('falls back to the default domain when viewed on localhost without a config', () => {
    setConfig(undefined);
    render(<PosterPage />);
    // Since jsdom serves at localhost, the Kiosk logic skips it and falls back to the default.
    expect(screen.getByText('wishboard.painless-computing.com')).toBeInTheDocument();
  });

  it('hides Wi-Fi instructions when in serverless mode', () => {
    setConfig({ isServerless: true });
    render(<PosterPage />);
    expect(screen.queryByText('Step 1: Join Wi-Fi')).not.toBeInTheDocument();
    expect(screen.getByText('Scan to Visit')).toBeInTheDocument();
  });
});
