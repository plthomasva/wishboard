import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PosterPage from './PosterPage';

describe('PosterPage', () => {
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
});
