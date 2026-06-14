import { render, screen, fireEvent, waitFor} from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ManageWishPage from './ManageWishPage';
import React from 'react';
import * as AuthContext from '../AuthContext';

vi.mock('../AuthContext', () => ({
  useAuth: vi.fn()
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('ManageWishPage Coverage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.window.location.hash = '';
  });

  it('handles empty wishId', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: null } as any);
    globalThis.window.location.hash = '#manage-wish?id=';
    render(<ManageWishPage />);
    expect(screen.getByText('No wish ID provided.')).toBeInTheDocument();
  });

  it('handles invalid wishId format', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: null } as any);
    globalThis.window.location.hash = '#manage-wish?id=w1@!';
    render(<ManageWishPage />);
    expect(screen.getByText('Invalid wish ID format.')).toBeInTheDocument();
  });

  it('handles update failure and token inclusion', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: 'mock-token' } as any);
    globalThis.window.location.hash = '#manage-wish?id=w1';
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'w1', content: 'Wish content', contacts: [{ type: 'Phone', value: '123' }, { type: 'Email', value: '' }] })
    });

    render(<ManageWishPage />);
    await waitFor(() => expect(screen.getByText('Manage Your Wish')).toBeInTheDocument());

    // Enter secret
    fireEvent.change(screen.getByPlaceholderText('Enter passphrase'), { target: { value: 'mysecret' } });

    // Mock failure for update
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Update failed from server' })
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/wishes/w1/manage', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
        body: expect.stringContaining('mysecret')
      }));
      expect(screen.getByText('Update failed from server')).toBeInTheDocument();
    });
  });

  it('handles delete failure and token inclusion', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: 'mock-token' } as any);
    globalThis.window.location.hash = '#manage-wish?id=w2';
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'w2', content: 'Wish content', contacts: [] })
    });

    render(<ManageWishPage />);
    await waitFor(() => expect(screen.getByText('Manage Your Wish')).toBeInTheDocument());

    // Confirm prompt
    globalThis.window.confirm = vi.fn().mockReturnValue(true);

    // Mock failure for delete
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({})
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Wish' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/wishes/w2/manage', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token' })
      }));
      expect(screen.getByText('Failed to delete wish.')).toBeInTheDocument();
    });
  });
});

