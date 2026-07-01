import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import WishmailDashboard from './WishmailDashboard';
import React from 'react';
import * as AuthContext from '../AuthContext';

vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('WishmailDashboard Coverage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.window.location.hash = '';
  });

  it('handles empty wishId', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: null } as any);
    globalThis.window.location.hash = '#wishmail-dashboard?id=';
    render(<WishmailDashboard />);
    expect(screen.getByText('No wish ID provided.')).toBeInTheDocument();
  });

  it('handles invalid wishId format', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: null } as any);
    globalThis.window.location.hash = '#wishmail-dashboard?id=w1@!';
    render(<WishmailDashboard />);
    expect(screen.getByText('Invalid wish ID format.')).toBeInTheDocument();
  });

  it('handles delete failure', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: 'mock-token' } as any);
    globalThis.window.location.hash = '#wishmail-dashboard?id=w1';

    mockFetch.mockImplementation(async (url, options) => {
      if (url.endsWith('/mail') && (!options?.method || options.method === 'GET')) {
        return {
          ok: true,
          json: async () => [
            { id: 1, content: 'mail', created_at: '2023-01-01', return_contacts: [] },
          ],
        };
      }
      if (options && options.method === 'DELETE') {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<WishmailDashboard />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Wishmail' })).toBeInTheDocument()
    );

    // Confirm prompt and alert
    globalThis.window.confirm = vi.fn().mockReturnValue(true);
    globalThis.window.alert = vi.fn();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/wishes/w1/mail/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(globalThis.window.alert).toHaveBeenCalledWith('Failed to delete message.');
    });
  });
});
