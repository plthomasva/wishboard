import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminPage from './AdminPage';

const loginMock = vi.fn();
const userMock = { id: 'admin-id', username: 'admin', role: 'admin', identity_genders: [], identity_orientations: [], identity_roles: [] };

vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: userMock,
    token: 'admin-token',
    login: loginMock
  })
}));

describe('AdminPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn((input) => {
      if (typeof input === 'string' && input.endsWith('/api/admin/flags')) {
        return Promise.resolve({ ok: true, json: async () => [{ id: 'flagged-1', content: 'Flagged wish', flagged: 1, user_id: null }] });
      }

      if (typeof input === 'string' && input.endsWith('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => [{ id: 'user-1', username: 'tester', role: 'user' }] });
      }

      if (typeof input === 'string' && input.endsWith('/api/admin/reset-demo')) {
        return Promise.resolve({ ok: true, json: async () => ({ stats: { usersCreated: 50, wishesCreated: 100 } }) });
      }

      return Promise.resolve({ ok: false, json: async () => ({ error: 'unknown' }) });
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    loginMock.mockReset();
  });

  it('renders admin dashboard and loads flags/users for an admin user', async () => {
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('Flagged wish')).toBeInTheDocument());
    expect(screen.getByText('tester')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/flags', expect.objectContaining({ headers: { Authorization: 'Bearer admin-token' } }));
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({ headers: { Authorization: 'Bearer admin-token' } }));
  });
});
