import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import AdminPage from './AdminPage';

let mockUser: any = null;
let mockToken: any = null;
const loginMock = vi.fn();

vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    token: mockToken,
    login: loginMock
  })
}));

describe('AdminPage', () => {
  beforeEach(() => {
    mockUser = null;
    mockToken = null;
    loginMock.mockReset();
    
    globalThis.fetch = vi.fn().mockImplementation((input, options) => {
      const url = typeof input === 'string' ? input : '';
      
      if (url.endsWith('/api/admin/flags')) {
        if (!mockToken) {
          return Promise.resolve({ ok: false, status: 401 });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'flagged-1', content: 'Flagged wish', flagged: 1, user_id: 'user-2' }]
        });
      }

      if (url.endsWith('/api/admin/users')) {
        if (!mockToken) {
          return Promise.resolve({ ok: false, status: 401 });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'user-1', username: 'tester', role: 'user' },
            { id: 'admin-2', username: 'other-admin', role: 'admin' }
          ]
        });
      }

      if (url.endsWith('/api/admin/logs')) {
        if (!mockToken) {
          return Promise.resolve({ ok: false, status: 401 });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ logs: 'Test logs output' })
        });
      }

      if (url.endsWith('/api/admin/metrics-ticket')) {
        if (!mockToken) {
          return Promise.resolve({ ok: false, status: 401 });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ticket: 'mock-ticket-123' })
        });
      }

      if (url.endsWith('/api/admin/reset-demo')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ stats: { usersCreated: 50, wishesCreated: 100 } })
        });
      }

      if (url.includes('/api/admin/wishes/') && url.endsWith('/remove')) {
        return Promise.resolve({ ok: true });
      }

      if (url.includes('/api/admin/wishes/') && url.endsWith('/clear-flag')) {
        return Promise.resolve({ ok: true });
      }

      if (url.endsWith('/api/admin/wishes/clear-all-flags')) {
        return Promise.resolve({ ok: true });
      }

      if (url.includes('/api/admin/users/') && url.endsWith('/role')) {
        return Promise.resolve({ ok: true });
      }

      if (url.includes('/api/admin/users/') && url.endsWith('/delete')) {
        return Promise.resolve({ ok: true });
      }

      return Promise.resolve({ ok: false, json: async () => ({ error: 'unknown' }) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders login form when user is not admin', async () => {
    render(<AdminPage />);
    expect(screen.getByText('Admin username')).toBeInTheDocument();
    expect(screen.getByText('Admin passphrase')).toBeInTheDocument();
  });

  it('handles login form submission successfully', async () => {
    loginMock.mockResolvedValueOnce({ success: true, role: 'admin' });
    render(<AdminPage />);

    fireEvent.change(screen.getByLabelText(/Admin username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/Admin passphrase/i), { target: { value: 'pass' } });
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Login as Admin/i }));
    });

    expect(loginMock).toHaveBeenCalledWith('admin', 'pass');
    await waitFor(() => {
      expect(screen.getByText('Admin login successful.')).toBeInTheDocument();
    });
  });

  it('handles non-admin login role restriction', async () => {
    loginMock.mockResolvedValueOnce({ success: true, role: 'user' });
    render(<AdminPage />);

    fireEvent.change(screen.getByLabelText(/Admin username/i), { target: { value: 'user1' } });
    fireEvent.change(screen.getByLabelText(/Admin passphrase/i), { target: { value: 'pass' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Login as Admin/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Logged in successfully, but this account is not an admin.')).toBeInTheDocument();
    });
  });

  it('handles login errors', async () => {
    loginMock.mockResolvedValueOnce({ success: false, error: 'Wrong password' });
    render(<AdminPage />);

    fireEvent.change(screen.getByLabelText(/Admin username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/Admin passphrase/i), { target: { value: 'wrong' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Login as Admin/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Wrong password')).toBeInTheDocument();
    });
  });

  it('renders dashboard when logged in as admin', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Flagged wish')).toBeInTheDocument();
    });
    expect(screen.getByText('tester')).toBeInTheDocument();
    expect(screen.getByText('other-admin')).toBeInTheDocument();
  });

  it('can remove a flagged wish', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('Flagged wish')).toBeInTheDocument());
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Remove/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Removed wish flagged-1')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/wishes/flagged-1/remove', expect.any(Object));
  });

  it('can promote and demote a user', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('tester')).toBeInTheDocument());

    // Promote tester to admin
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Promote/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Updated user role for user-1')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/users/user-1/role', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ role: 'admin' })
    }));

    // Demote other-admin to user
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Demote/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Updated user role for admin-2')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/users/admin-2/role', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ role: 'user' })
    }));
  });

  it('can delete a user', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('tester')).toBeInTheDocument());

    // Delete tester
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Deleted user user-1')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/users/user-1/delete', expect.any(Object));
  });

  it('can reset a user password', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    globalThis.fetch = vi.fn().mockImplementation((input) => {
      const url = typeof input === 'string' ? input : '';
      if (url.endsWith('/api/admin/flags')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.endsWith('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => [{ id: 'user-1', username: 'tester', role: 'user' }] });
      }
      if (url.endsWith('/api/admin/logs')) {
        return Promise.resolve({ ok: true, json: async () => ({ logs: 'logs' }) });
      }
      if (url.endsWith('/api/admin/metrics-ticket')) {
        return Promise.resolve({ ok: true, json: async () => ({ ticket: 'mock-ticket-123' }) });
      }
      if (url.includes('/api/admin/users/') && url.endsWith('/reset-password')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, newPassphrase: 'new-password-123' }) });
      }
      return Promise.resolve({ ok: false });
    });

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('tester')).toBeInTheDocument());

    const resetButtons = screen.getAllByRole('button', { name: /Reset Password/i });
    await act(async () => {
      fireEvent.click(resetButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Passphrase successfully reset! The new passphrase is: new-password-123')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/users/user-1/reset-password', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('can run demo seeder', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('Demo Seeder')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Seeder/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Seeder completed: 50 users and 100 wishes created.')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/reset-demo', expect.any(Object));
  });

  it('handles fetch errors gracefully when loading dashboard', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load flagged wishes. Please login as admin.')).toBeInTheDocument();
    });
  });

  it('handles failure when running seeder, deleting, promoting or removing wishes', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';

    globalThis.fetch = vi.fn().mockImplementation((input) => {
      const url = typeof input === 'string' ? input : '';
      if (url.endsWith('/api/admin/flags')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.endsWith('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => [{ id: 'user-1', username: 'tester', role: 'user' }] });
      }
      if (url.endsWith('/api/admin/logs')) {
        return Promise.resolve({ ok: true, json: async () => ({ logs: 'logs' }) });
      }
      if (url.endsWith('/api/admin/metrics-ticket')) {
        return Promise.resolve({ ok: true, json: async () => ({ ticket: 'mock-ticket-123' }) });
      }
      return Promise.resolve({ ok: false });
    });

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('tester')).toBeInTheDocument());

    // Try run seeder
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Seeder/i }));
    });
    await waitFor(() => expect(screen.getByText('Failed to run seeder.')).toBeInTheDocument());

    // Try delete
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    });
    await waitFor(() => expect(screen.getByText('Failed to delete user.')).toBeInTheDocument());

    // Try promote
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Promote/i }));
    });
    await waitFor(() => expect(screen.getByText('Failed to update role.')).toBeInTheDocument());
  });

  it('can clear flag on a single wish', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('Flagged wish')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Clear Flag/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Cleared flag for wish flagged-1')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/wishes/flagged-1/clear-flag', expect.any(Object));
  });

  it('can clear all flags in bulk', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('Flagged wish')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Clear All Flags/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Cleared all flags successfully.')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/wishes/clear-all-flags', expect.any(Object));
  });

  it('can view logs and toggle tailing', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('tester')).toBeInTheDocument());

    await waitFor(() => {
      expect(screen.getByText('Test logs output')).toBeInTheDocument();
    });

    // Toggle live tail
    const toggleButton = screen.getByRole('button', { name: /Pause Tailing/i });
    await act(async () => {
      fireEvent.click(toggleButton);
    });
    expect(screen.getByRole('button', { name: /Resume Tailing/i })).toBeInTheDocument();
  });

  it('can view metrics iframe', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('tester')).toBeInTheDocument());

    await waitFor(() => {
      expect(screen.getByTitle('System Metrics')).toBeInTheDocument();
    });
  });

  it('handles fetch exceptions during initial load', async () => {
    mockUser = { id: 'admin-id', username: 'admin', role: 'admin' };
    mockToken = 'admin-token';
    globalThis.fetch = vi.fn().mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : '';
      if (url.endsWith('/api/admin/metrics-ticket') || url.endsWith('/api/admin/logs')) {
        throw new Error('Network fail');
      }
      return { ok: true, json: async () => [] };
    });
    
    render(<AdminPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load logs.')).toBeInTheDocument();
    });
  });
});
