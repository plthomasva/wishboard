import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('renders the main navigation and invokes onNavigate when buttons are clicked', () => {
    const onNavigate = vi.fn();
    render(<HomePage onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /Admin/i }));
    expect(onNavigate).toHaveBeenCalledWith('admin');

    fireEvent.click(screen.getByRole('button', { name: /Enter a Wish/i }));
    expect(onNavigate).toHaveBeenCalledWith('enter');
  });
});
