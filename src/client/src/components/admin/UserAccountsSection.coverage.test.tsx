import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserAccountsSection from './UserAccountsSection';
import React from 'react';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('UserAccountsSection Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ([])
    });
  });

  it('handles user loading and successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ id: 'u1', username: 'user1', role: 'user' }])
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isProduction: true }) // loadConfig
    });

    render(<UserAccountsSection authHeader={{}} setMessage={vi.fn()} setError={vi.fn()} refreshCounter={0} triggerRefresh={vi.fn()} />);
    
    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());
  });

  it('handles delete preview fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ id: 'u1', username: 'user1', role: 'user' }])
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isProduction: true }) // loadConfig
    });

    const setError = vi.fn();
    render(<UserAccountsSection authHeader={{}} setMessage={vi.fn()} setError={setError} refreshCounter={0} triggerRefresh={vi.fn()} />);
    
    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    // Mock fetch for delete preview to fail
    mockFetch.mockResolvedValueOnce({ ok: false });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(setError).toHaveBeenCalledWith('Failed to fetch delete preview.'));
  });

  it('handles confirm delete flow', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ id: 'u1', username: 'user1', role: 'user' }])
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isProduction: true }) // loadConfig
    });

    render(<UserAccountsSection authHeader={{}} setMessage={vi.fn()} setError={vi.fn()} refreshCounter={0} triggerRefresh={vi.fn()} />);
    
    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    // Mock fetch for delete preview to succeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ wishesCount: 5, wishmailsCount: 0 })
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getByText(/This action is permanent and cannot be undone/)).toBeInTheDocument());

    // Mock fetch for actual delete to succeed
    mockFetch.mockResolvedValueOnce({ ok: true });
    // And then loadUsers is called again
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([])
    });

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete Account' }));

    await waitFor(() => expect(screen.queryByText('user1')).not.toBeInTheDocument());
  });
});
