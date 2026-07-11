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

  it('falls back to the current host when no domain is configured', () => {
    setConfig(undefined);
    render(<PosterPage />);
    // jsdom serves the page at localhost — the browser is already at the right host.
    expect(screen.getByText(globalThis.location.host)).toBeInTheDocument();
  });
});
