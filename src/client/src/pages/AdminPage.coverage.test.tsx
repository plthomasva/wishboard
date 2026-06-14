import { render, screen, fireEvent, waitFor} from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AdminPage from './AdminPage';
import React from 'react';
import * as AuthContext from '../AuthContext';

vi.mock('../AuthContext', () => ({
  useAuth: vi.fn()
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('AdminPage Coverage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('handles removeWish failure', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ user: { role: 'admin' }, token: 'mock-token' } as any);
    
    // Initial load
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'w1', content: 'flagged', user_id: 'u1' }]) }); // loadFlags
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ([]) }); // loadUsers

    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText('Remove')).toBeInTheDocument());

    // Click remove and mock failure
    mockFetch.mockResolvedValueOnce({ ok: false }); // removeWish
    fireEvent.click(screen.getByText('Remove'));

    await waitFor(() => {
      expect(screen.getByText('Failed to remove wish.')).toBeInTheDocument();
    });
  });

  it('handles clearFlag failure', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ user: { role: 'admin' }, token: 'mock-token' } as any);
    
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'w1', content: 'flagged', user_id: 'u1' }]) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ([]) });

    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText('Clear Flag')).toBeInTheDocument());

    mockFetch.mockResolvedValueOnce({ ok: false });
    fireEvent.click(screen.getByText('Clear Flag'));

    await waitFor(() => {
      expect(screen.getByText('Failed to clear flag.')).toBeInTheDocument();
    });
  });

  it('handles clearAllFlags cancel and failure', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ user: { role: 'admin' }, token: 'mock-token' } as any);
    
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'w1', content: 'flagged', user_id: 'u1' }]) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ([]) });

    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText('Clear All Flags')).toBeInTheDocument());

    // Cancel confirm
    globalThis.window.confirm = vi.fn().mockReturnValueOnce(false);
    fireEvent.click(screen.getByText('Clear All Flags'));
    expect(mockFetch).not.toHaveBeenCalledWith('/api/admin/wishes/clear-all-flags', expect.anything());

    // Proceed and fail
    globalThis.window.confirm = vi.fn().mockReturnValueOnce(true);
    mockFetch.mockResolvedValueOnce({ ok: false });
    fireEvent.click(screen.getByText('Clear All Flags'));

    await waitFor(() => {
      expect(screen.getByText('Failed to clear all flags.')).toBeInTheDocument();
    });
  });

  it('handles resetPassphrase cancel and failure', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ user: { role: 'admin' }, token: 'mock-token' } as any);
    
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ([]) }); // loadFlags
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'u1', username: 'testuser', role: 'user' }]) }); // loadUsers

    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText('Reset Password')).toBeInTheDocument());

    // Cancel confirm
    globalThis.window.confirm = vi.fn().mockReturnValueOnce(false);
    fireEvent.click(screen.getByText('Reset Password'));
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('reset-password'), expect.anything());

    // Proceed and fail
    globalThis.window.confirm = vi.fn().mockReturnValueOnce(true);
    mockFetch.mockResolvedValueOnce({ ok: false });
    fireEvent.click(screen.getByText('Reset Password'));

    await waitFor(() => {
      expect(screen.getByText('Failed to reset passphrase.')).toBeInTheDocument();
    });
  });
});

