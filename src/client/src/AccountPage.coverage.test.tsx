import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import AccountPage from './AccountPage';
import * as AuthContext from './AuthContext';

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn()
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('AccountPage Coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch.mockReset();
    globalThis.window.location.hash = '';
  });

  afterEach(() => {
    act(() => { vi.runOnlyPendingTimers(); });
    vi.useRealTimers();
  });

  it('handles existing username check failure and active abort', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ user: null, token: null, login: vi.fn(), register: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() } as any);
    
    let resolveExists: any;
    const existsPromise = new Promise(r => { resolveExists = r; });
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/users/exists')) return existsPromise;
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    const { unmount } = render(<AccountPage />);
    
    // Trigger existing username check
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'someuser' } });
    act(() => { vi.advanceTimersByTime(300); });

    // Unmount before fetch resolves
    unmount();
    resolveExists({ ok: true, json: async () => ({ exists: true }) });

    // Test fetch failure
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    render(<AccountPage />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'erroruser' } });
    act(() => { vi.advanceTimersByTime(300); });
    // Wait for rejection
    await waitFor(() => {});
    
    // Test non-ok response
    mockFetch.mockResolvedValueOnce({ ok: false });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'baduser' } });
    act(() => { vi.advanceTimersByTime(300); });
  });

  it('handles load wishes error', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: {
        id: 'user1', username: 'test',
        identity_genders: [], identity_orientations: [], identity_roles: [],
        contacts: [], wishmail_enabled: false
      },
      token: 'mock-token',
      login: vi.fn(), register: vi.fn(), logout: vi.fn(), refreshUser: vi.fn()
    } as any);

    mockFetch.mockResolvedValueOnce({ ok: false }); // for loadWishes

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load your wishes.')).toBeInTheDocument();
    });
  });

  it('handles saveProfile failure', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: {
        id: 'user1', username: 'test',
        identity_genders: [], identity_orientations: [], identity_roles: [],
        contacts: [], wishmail_enabled: false
      },
      token: 'mock-token',
      login: vi.fn(), register: vi.fn(), logout: vi.fn(), refreshUser: vi.fn()
    } as any);

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // loadWishes

    render(<AccountPage />);

    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Bad profile' }) }); // saveProfile

    fireEvent.click(screen.getByRole('button', { name: 'Save attributes' }));

    await waitFor(() => {
      expect(screen.getByText('Bad profile')).toBeInTheDocument();
    });
  });

  it('handles registration failure from AuthContext', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ exists: false }) });
    const mockRegister = vi.fn().mockResolvedValue({ success: false, error: 'Registration failed from server' });
    vi.mocked(AuthContext.useAuth).mockReturnValue({ user: null, token: null, login: vi.fn(), register: mockRegister, logout: vi.fn(), refreshUser: vi.fn() } as any);

    render(<AccountPage />);
    
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'reguser' } });
    fireEvent.submit(screen.getByLabelText('Username').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Registration failed from server')).toBeInTheDocument();
    });
  });

  it('claims a wish successfully and handles errors', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: {
        id: 'user1', username: 'test',
        identity_genders: [], identity_orientations: [], identity_roles: [],
        contacts: [], wishmail_enabled: false
      },
      token: 'mock-token',
      login: vi.fn(), register: vi.fn(), logout: vi.fn(), refreshUser: vi.fn()
    } as any);

    mockFetch.mockResolvedValue({ ok: true, json: async () => [] }); // loadWishes

    render(<AccountPage />);

    const claimBtn = screen.getByRole('button', { name: 'Claim Wish' });
    
    // Empty submit
    fireEvent.click(claimBtn);
    expect(screen.getByText('Wish ID and Passphrase are required to claim a wish.')).toBeInTheDocument();

    // Successful claim
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const inputs = screen.getAllByRole('textbox');
    const idInput = inputs.find(i => i.getAttribute('placeholder') === 'e.g. abc123xy');
    const secretInput = inputs.find(i => i.getAttribute('placeholder') === 'e.g. CorrectHorseBatteryStaple');
    
    if (idInput && secretInput) {
      fireEvent.change(idInput, { target: { value: 'wish123' } });
      fireEvent.change(secretInput, { target: { value: 'secret' } });
      fireEvent.click(claimBtn);
      await waitFor(() => {
        expect(screen.getByText('Wish claimed successfully!')).toBeInTheDocument();
      });
    }

    // Failed claim
    if (idInput && secretInput) {
      mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Claim failed' }) });
      fireEvent.change(idInput, { target: { value: 'wish123' } });
      fireEvent.change(secretInput, { target: { value: 'wrong' } });
      fireEvent.click(claimBtn);
      await waitFor(() => {
        expect(screen.getByText('Claim failed')).toBeInTheDocument();
      });
    }
  });

  it('renders contacts list and can add/remove contacts', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: {
        id: 'user1', username: 'test',
        identity_genders: [], identity_orientations: [], identity_roles: [],
        contacts: [{ type: 'Phone', value: '123' }], wishmail_enabled: false
      },
      token: 'mock-token',
      login: vi.fn(), register: vi.fn(), logout: vi.fn(), refreshUser: vi.fn()
    } as any);

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // loadWishes

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText(/No wishes yet/)).toBeInTheDocument();
    });

    // Change existing contact
    const typeSelects = screen.getAllByRole('combobox');
    fireEvent.change(typeSelects[0], { target: { value: 'Email' } });
    
    const valueInputs = screen.getAllByPlaceholderText('Username, number, etc.');
    fireEvent.change(valueInputs[0], { target: { value: 'a@b.com' } });

    // Add new contact
    fireEvent.click(screen.getByRole('button', { name: '+ Add Contact Method' }));
    expect(screen.getAllByRole('combobox')).toHaveLength(2);

    // Remove contact
    fireEvent.click(screen.getAllByRole('button', { name: 'X' })[0]);
    expect(screen.getAllByRole('combobox')).toHaveLength(1);

    // Toggle wishmail
    const wishmailCb = screen.getByRole('checkbox', { name: /Enable Wishmail/ });
    fireEvent.click(wishmailCb);
    expect(wishmailCb).toBeChecked();
  });
  it('handles deactivate profile', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ 
      user: { id: 'u1', username: 'test', is_active: true, identity_genders: [], identity_orientations: [], identity_roles: [], contacts: [], wishmail_enabled: false },
      token: 'mock-token',
      refreshUser: vi.fn(),
      login: vi.fn(), register: vi.fn(), logout: vi.fn()
    } as any);
    
    mockFetch.mockImplementation(async (urlObj) => {
      const url = typeof urlObj === 'string' ? urlObj : (urlObj?.url || '');
      if (url.includes('wishes')) return { ok: true, json: async () => [] };
      if (url.includes('deactivate')) return { ok: true, json: async () => ({}) };
      return { ok: true, json: async () => ({}) };
    });

    render(<AccountPage />);
    await waitFor(() => expect(screen.getByText('Danger Zone')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Profile' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/users/me/deactivate', expect.any(Object));
      expect(screen.getByText('Profile deactivated successfully.')).toBeInTheDocument();
    });
  });

  it('handles delete account preview and confirmation', async () => {
    const mockLogout = vi.fn();
    vi.mocked(AuthContext.useAuth).mockReturnValue({ 
      user: { id: 'u1', username: 'test', is_active: true, identity_genders: [], identity_orientations: [], identity_roles: [], contacts: [], wishmail_enabled: false },
      token: 'mock-token',
      logout: mockLogout,
      login: vi.fn(), register: vi.fn(), refreshUser: vi.fn()
    } as any);
    
    mockFetch.mockImplementation(async (urlObj) => {
      const url = typeof urlObj === 'string' ? urlObj : (urlObj?.url || '');
      if (url.includes('delete-preview')) return { ok: true, json: async () => ({ wishesCount: 2, wishmailsCount: 5 }) };
      if (url.includes('delete')) return { ok: true, json: async () => ({}) };
      if (url.includes('wishes')) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => ({}) };
    });

    render(<AccountPage />);
    await waitFor(() => expect(screen.getByText('Danger Zone')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    
    // Let microtasks and promises resolve
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(screen.getByText('Delete Account Confirmation')).toBeInTheDocument();
      expect(screen.getByText((_, element) => element?.textContent === '2 wishes')).toBeInTheDocument();
      expect(screen.getByText((_, element) => element?.textContent === '5 wishmail messages')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete Account' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/users/me/delete', expect.any(Object));
      expect(mockLogout).toHaveBeenCalled();
    });
  });
});
