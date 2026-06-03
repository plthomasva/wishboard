import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
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
    refreshUser: vi.fn()
  })
}));

import AccountPage from './AccountPage';

describe('AccountPage', () => {
  it('renders saved user identity attributes on the profile page', async () => {
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
});
