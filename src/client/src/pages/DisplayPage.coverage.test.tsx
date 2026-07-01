import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DisplayPage from './DisplayPage';
import React from 'react';
import * as AuthContext from '../AuthContext';

vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('DisplayPage Coverage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('opens and closes SendWishmailModal', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: 'mock-token' } as any);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'w1', content: 'Wish content', wishmail_enabled: true }],
    });

    render(<DisplayPage />);

    await waitFor(() => expect(screen.getByText('Wish content')).toBeInTheDocument());

    const sendMailBtn = screen.getByRole('button', { name: 'Send Wishmail' });
    fireEvent.click(sendMailBtn);

    await waitFor(() => expect(screen.getByText('Send Wishmail')).toBeInTheDocument());

    const closeBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(closeBtn);

    await waitFor(() => expect(screen.queryByText('Send Wishmail')).not.toBeInTheDocument());
  });
});
