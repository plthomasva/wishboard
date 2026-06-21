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

  it('handles update role', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { id: 'u1', username: 'user1', role: 'user' },
        { id: 'u2', username: 'user2', role: 'admin' }
      ])
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isProduction: true }) // loadConfig
    });

    const setMessage = vi.fn();
    render(<UserAccountsSection authHeader={{}} setMessage={setMessage} setError={vi.fn()} refreshCounter={0} triggerRefresh={vi.fn()} />);
    
    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    // Mock failure for promote
    mockFetch.mockResolvedValueOnce({ ok: false });
    fireEvent.click(screen.getAllByRole('button', { name: 'Promote' })[0]);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/role'), expect.any(Object)));

    // Mock success for demote
    mockFetch.mockResolvedValueOnce({ ok: true });
    // And loadUsers again
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([])
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Demote' })[0]);
    await waitFor(() => expect(setMessage).toHaveBeenCalledWith('Updated user role for u2'));
  });

  it('handles reset passphrase', async () => {
    globalThis.confirm = vi.fn(() => true);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ id: 'u1', username: 'user1', role: 'user' }])
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isProduction: true }) // loadConfig
    });

    const setMessage = vi.fn();
    render(<UserAccountsSection authHeader={{}} setMessage={setMessage} setError={vi.fn()} refreshCounter={0} triggerRefresh={vi.fn()} />);
    
    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    // Mock failure
    mockFetch.mockResolvedValueOnce({ ok: false });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/reset-password'), expect.any(Object)));

    // Mock success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ newPassphrase: 'new-passphrase-123' })
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    await waitFor(() => expect(setMessage).toHaveBeenCalledWith('Passphrase successfully reset! The new passphrase is: new-passphrase-123'));
    
    // Test confirm false
    globalThis.confirm = vi.fn(() => false);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    // Wait a tick to ensure fetch isn't called again
    await new Promise(r => setTimeout(r, 0));
  });

  it('handles cancel delete', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ id: 'u1', username: 'user1', role: 'user' }])
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isProduction: true }) // loadConfig
    });

    render(<UserAccountsSection authHeader={{}} setMessage={vi.fn()} setError={vi.fn()} refreshCounter={0} triggerRefresh={vi.fn()} />);
    
    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ wishesCount: 5, wishmailsCount: 0 })
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getByText(/This action is permanent and cannot be undone/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(/This action is permanent and cannot be undone/)).not.toBeInTheDocument());
  });
});
