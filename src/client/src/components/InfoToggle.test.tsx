import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import InfoToggle from './InfoToggle';
import React from 'react';

describe('InfoToggle', () => {
  it('renders children only after toggle is clicked', () => {
    render(<InfoToggle>My secret info</InfoToggle>);

    // Should not be visible initially
    expect(screen.queryByText('My secret info')).not.toBeInTheDocument();

    // Click to expand
    const button = screen.getByRole('button', { name: /more information/i });
    fireEvent.click(button);

    // Should be visible now
    expect(screen.getByText('My secret info')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(button);
    expect(screen.queryByText('My secret info')).not.toBeInTheDocument();
  });
});
