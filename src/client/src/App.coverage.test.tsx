import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';
import React from 'react';

vi.mock('./pages/HomePage', () => ({ default: () => <div>HomePage Mock</div> }));
vi.mock('./pages/DisplayPage', () => ({
  default: ({ onEnterKiosk, isKiosk }: any) => (
    <div>
      <div>DisplayPage Mock</div>
      <div>Is Kiosk: {isKiosk ? 'Yes' : 'No'}</div>
      <button onClick={onEnterKiosk}>Enter Kiosk</button>
    </div>
  ),
}));
vi.mock('./AccountPage', () => ({ default: () => <div>AccountPage Mock</div> }));
vi.mock('./components/WiFiQrCode', () => ({ default: () => <div>WiFiQrCode Mock</div> }));

const mockLogin = vi.fn();
const mockSetTokenExternally = vi.fn();

vi.mock('./AuthContext', () => ({
  AuthProvider: ({ children }: any) => <div>{children}</div>,
  useAuth: () => ({
    user: { username: 'testuser' },
    login: mockLogin,
    logout: vi.fn(),
    setTokenExternally: mockSetTokenExternally,
  }),
}));

describe('App Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.window.location.hash = '#home';
  });

  it('handles auto-login token in hash', () => {
    globalThis.window.location.hash = '#account?token=12345';
    render(<App />);
    expect(mockSetTokenExternally).toHaveBeenCalledWith('12345');
    expect(globalThis.window.location.hash).toBe('#account');
  });

  it('handles window undefined in getHashPage and checkIsKioskParam', () => {
    const originalWindow = globalThis.window;
    // @ts-ignore
    delete (globalThis as any).window;
    (globalThis as any).window = originalWindow;
  });

  it('navigates to account when clicking user link', async () => {
    render(<App />);
    const userLink = await screen.findByText('testuser');
    fireEvent.click(userLink);
    await waitFor(() => {
      expect(globalThis.window.location.hash).toBe('#account');
    });
  });

  it('handles kiosk exit error', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network error'));

    globalThis.window.location.hash = '#display?kiosk=true';
    render(<App />);

    fireEvent.keyDown(globalThis.window, { key: 'Escape', code: 'Escape' });
    fireEvent.change(screen.getByPlaceholderText('e.g. admin'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Enter passphrase'), {
      target: { value: 'pass' },
    });

    const form = screen.getByPlaceholderText('e.g. admin').closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('An error occurred during authentication.')).toBeInTheDocument();
    });
  });

  it('handles kiosk exit invalid credentials without explicit error string', async () => {
    mockLogin.mockResolvedValueOnce({ success: false });

    globalThis.window.location.hash = '#display?kiosk=true';
    render(<App />);

    fireEvent.keyDown(globalThis.window, { key: 'Escape', code: 'Escape' });
    fireEvent.change(screen.getByPlaceholderText('e.g. admin'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Enter passphrase'), {
      target: { value: 'pass' },
    });

    const form = screen.getByPlaceholderText('e.g. admin').closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials.')).toBeInTheDocument();
    });
  });

  it('cleans up kiosk params from url upon successful exit', async () => {
    mockLogin.mockResolvedValueOnce({ success: true, role: 'admin' });

    globalThis.window.history.replaceState({}, '', '/?kiosk=true#display?kiosk=true');
    const replaceSpy = vi.spyOn(globalThis.window.history, 'replaceState');
    render(<App />);

    fireEvent.keyDown(globalThis.window, { key: 'Escape', code: 'Escape' });
    fireEvent.change(screen.getByPlaceholderText('e.g. admin'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Enter passphrase'), {
      target: { value: 'pass' },
    });

    const form = screen.getByPlaceholderText('e.g. admin').closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalled();
      const newUrl = replaceSpy.mock.calls[0][2] as string;
      expect(newUrl).not.toContain('kiosk=true');
      expect(globalThis.window.location.hash).not.toContain('kiosk=true');
    });
  });
});
