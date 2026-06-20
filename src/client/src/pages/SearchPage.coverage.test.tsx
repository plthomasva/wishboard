import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearchPage from './SearchPage';
import React from 'react';
import * as AuthContext from '../AuthContext';

vi.mock('../AuthContext', () => ({
  useAuth: vi.fn()
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('SearchPage Coverage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('opens and closes SendWishmailModal', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ user: null } as any);
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ id: 'w1', content: 'Wish content', wishmail_enabled: true }])
    });

    render(<SearchPage />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(screen.getByText('Wish content')).toBeInTheDocument());

    const sendMailBtn = screen.getByRole('button', { name: 'Send Wishmail' });
    fireEvent.click(sendMailBtn);

    await waitFor(() => expect(screen.getByText('Send Wishmail')).toBeInTheDocument());

    const closeBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(closeBtn);

    await waitFor(() => expect(screen.queryByText('Send Wishmail')).not.toBeInTheDocument());
  });
  it('handles search fetch failure gracefully', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ user: null } as any);
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Search failed' }) });
    render(<SearchPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(screen.getByText('Unable to perform search.')).toBeInTheDocument());
  });

  it('performs temporary search with attributes when unauthenticated', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ user: null } as any);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ([{ id: 'w2', content: 'Attribute Wish', wishmail_enabled: false }])
    });

    render(<SearchPage />);
    fireEvent.change(screen.getByPlaceholderText('e.g. woman, cisgender man'), { target: { value: 'man' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('sg=man')));
  });

});

