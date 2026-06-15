import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WishCard from './WishCard';
import React from 'react';

vi.mock('../hooks/useTextFit', () => ({
  useTextFit: () => ({
    containerRef: { current: null },
    contentRef: { current: null },
    isOverflowing: false
  })
}));

describe('WishCard', () => {
  it('renders content correctly', () => {
    const wish = { id: 'w1', content: 'Test content' };
    render(<WishCard wish={wish} />);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders contacts', () => {
    const wish = {
      id: 'w2',
      content: 'Hello',
      contacts: [{ type: 'Phone', value: '123' }, { type: 'Email', value: 'a@b.com' }]
    };
    render(<WishCard wish={wish} />);
    expect(screen.getByText('Phone:')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('Email:')).toBeInTheDocument();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
  });

  it('renders wishmail button and handles click', () => {
    const wish = {
      id: 'w3',
      content: 'Mail me',
      wishmail_enabled: true
    };
    const onSendMail = vi.fn();
    render(<WishCard wish={wish} onSendMail={onSendMail} />);
    
    const btn = screen.getByRole('button', { name: 'Send Wishmail' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onSendMail).toHaveBeenCalledWith('w3');
  });

  it('calls onSendMail only if provided', () => {
    const wish = {
      id: 'w4',
      content: 'Mail me',
      wishmail_enabled: true
    };
    render(<WishCard wish={wish} />);
    
    const btn = screen.getByRole('button', { name: 'Send Wishmail' });
    fireEvent.click(btn);
    // No crash means it handled missing onSendMail correctly
  });
});

