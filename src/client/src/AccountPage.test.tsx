import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const useAuthMock = vi.fn();

vi.mock('./AuthContext', () => ({
  useAuth: () => useAuthMock()
}));

import AccountPage from './AccountPage';

describe('AccountPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/users/exists')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders saved user identity attributes on the profile page', async () => {
    const refreshUser = vi.fn();
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-test',
        username: 'tester',
        role: 'user',
        identity_genders: ['woman'],
        identity_orientations: ['queer'],
        identity_roles: ['speaker']
      },
      token: 'fake-token',
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser
    });

    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    ));

    render(<AccountPage />);

    expect(screen.getByText('Welcome back, tester')).toBeInTheDocument();
    expect(screen.getByText('Genders:')).toBeInTheDocument();
    expect(screen.getByText('woman')).toBeInTheDocument();
    expect(screen.getByText('Orientations:')).toBeInTheDocument();
    expect(screen.getByText('queer')).toBeInTheDocument();
    expect(screen.getByText('Roles:')).toBeInTheDocument();
    expect(screen.getByText('speaker')).toBeInTheDocument();

    await screen.findByText('No wishes yet. Submit a new wish from the Enter a Wish page.');
  });

  it('submits register when in register mode with blank passphrase', async () => {
    const register = vi.fn().mockResolvedValue({ success: true, secret: 'auto-generated-secret' });
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      login: vi.fn(),
      register,
      logout: vi.fn(),
      refreshUser: vi.fn()
    });

    render(<AccountPage />);

    const registerButtons = screen.getAllByText('Register');
    const registerTabButton = registerButtons.find((button) => button.getAttribute('type') !== 'submit');
    const registerSubmitButton = registerButtons.find((button) => button.getAttribute('type') === 'submit');
    if (!registerTabButton || !registerSubmitButton) {
      throw new Error('Could not find register tab or submit button');
    }

    fireEvent.click(registerTabButton);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } });
    fireEvent.click(registerSubmitButton);

    expect(register).toHaveBeenCalledWith('newuser', undefined, {
      identities: { genders: '', orientations: '', roles: '' }
    });
    await screen.findByText(/Account created. Remember your passphrase:/);
  });

  it('auto-switches to login once the username already exists', async () => {
    const login = vi.fn().mockResolvedValue({ success: false, error: 'Invalid username or passphrase.' });
    const fetchMock = vi.fn((input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/users/exists')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: true }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal('fetch', fetchMock);

    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      login,
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn()
    });

    render(<AccountPage />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'existinguser' } });

    await waitFor(() => {
      const submitButtons = screen.getAllByRole('button');
      const submitButton = submitButtons.find((button) => button.getAttribute('type') === 'submit');
      expect(submitButton).toBeDefined();
      expect(submitButton).toHaveTextContent('Login');
    });
  });

  it('submits login when in login mode with provided passphrase', async () => {
    const login = vi.fn().mockResolvedValue({ success: false, error: 'Invalid username or passphrase.' });
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      login,
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn()
    });

    render(<AccountPage />);

    const loginTabButton = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(loginTabButton);

    const loginSubmitButton = screen.getAllByRole('button').find((button) => button.getAttribute('type') === 'submit');
    if (!loginSubmitButton) {
      throw new Error('Could not find login submit button');
    }

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'newpass' } });
    fireEvent.click(loginSubmitButton);

    expect(login).toHaveBeenCalledWith('newuser', 'newpass');
    await screen.findByText('Invalid username or passphrase.');
  });
});
