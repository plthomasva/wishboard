import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WishCard from './WishCard';
import React from 'react';

import { useTextFit } from '../hooks/useTextFit';

vi.mock('../hooks/useTextFit', () => ({
  useTextFit: vi.fn(() => ({
    containerRef: { current: null },
    contentRef: { current: null },
    isOverflowing: false
  }))
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

  it('renders text-overflow-hint when overflowing and isEditorPreview is true', () => {
    vi.mocked(useTextFit).mockReturnValueOnce({
      containerRef: { current: null },
      contentRef: { current: null },
      isOverflowing: true
    } as unknown as ReturnType<typeof useTextFit>);
    
    const wish = { id: 'w5', content: 'Overflowing' };
    render(<WishCard wish={wish} isEditorPreview={true} />);
    
    const article = screen.getByRole('article');
    expect(article).toHaveClass('text-overflow-hint');
  });

  it('renders FlagButton when showFlag and onFlag are provided', () => {
    const wish = { id: 'w6', content: 'Flag me' };
    const onFlag = vi.fn();
    render(<WishCard wish={wish} showFlag={true} onFlag={onFlag} />);
    
    const flagBtn = screen.getByTitle('Flag as inappropriate');
    expect(flagBtn).toBeInTheDocument();
    fireEvent.click(flagBtn);
    expect(onFlag).toHaveBeenCalledWith('w6');
  });

  it('calls onOverflowChange when provided', () => {
    vi.mocked(useTextFit).mockReturnValueOnce({
      containerRef: { current: null },
      contentRef: { current: null },
      isOverflowing: true
    } as unknown as ReturnType<typeof useTextFit>);
    
    const wish = { id: 'w7', content: 'Overflowing' };
    const onOverflowChange = vi.fn();
    render(<WishCard wish={wish} onOverflowChange={onOverflowChange} />);
    
    expect(onOverflowChange).toHaveBeenCalledWith(true);
  });

  it('renders image when image_url or image_id is provided', () => {
    const wish = {
      id: 'w8',
      content: 'This text should be hidden',
      image_id: 'test-image.png'
    };
    render(<WishCard wish={wish} />);
    
    const img = screen.getByRole('img', { name: 'This text should be hidden' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/images/test-image.png');
    
    const textNode = screen.getByText('This text should be hidden');
    expect(textNode).toHaveClass('sr-only');
  });

  it('renders Admin Delete button when onAdminDelete is provided', () => {
    const wish = { id: 'w8', content: 'Admin delete me' };
    const onAdminDelete = vi.fn();
    render(<WishCard wish={wish} onAdminDelete={onAdminDelete} />);
    
    const deleteBtn = screen.getByTitle('Admin Delete Wish');
    expect(deleteBtn).toBeInTheDocument();
    fireEvent.click(deleteBtn);
    expect(onAdminDelete).toHaveBeenCalledWith('w8');
  });
});

