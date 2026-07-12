import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ManageWishPage from './ManageWishPage';
import React from 'react';

// Setup fetch mock
globalThis.fetch = vi.fn();

vi.mock('../AuthContext', () => ({
  useAuth: () => ({ token: null }),
}));

describe('ManageWishPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.window.location.hash = '';
  });

  it('shows error if no wish ID is provided', () => {
    render(<ManageWishPage />);
    expect(screen.getByText('No wish ID provided.')).toBeInTheDocument();
  });

  it('fetches wish data on load and pre-fills the secret', async () => {
    globalThis.window.location.hash = '#manage-wish?id=w1&secret=mysec';
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'w1', content: 'Wish content' }),
    } as any);

    render(<ManageWishPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Manage Your Wish')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Wish content')).toBeInTheDocument();
    expect(screen.getByDisplayValue('mysec')).toBeInTheDocument();
  });

  it('shows error if wish is not found', async () => {
    globalThis.window.location.hash = '#manage-wish?id=w2';
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Not found' }),
    } as any);

    render(<ManageWishPage />);

    await waitFor(() => {
      expect(screen.getByText('Wish not found')).toBeInTheDocument();
    });
  });

  it('updates wish content on form submit', async () => {
    globalThis.window.location.hash = '#manage-wish?id=w3&secret=sec';
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'w3', content: 'Old content' }),
    } as any);

    render(<ManageWishPage />);
    await waitFor(() => {
      expect(screen.getByText('Manage Your Wish')).toBeInTheDocument();
    });

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as any);

    const textarea = screen.getByRole('textbox', { name: /What is your wish\?/i });
    fireEvent.change(textarea, { target: { value: 'New content' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/wishes/w3/manage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            secret: 'sec',
            content: 'New content',
            contacts: [],
            wishmail_enabled: false,
            new_passphrase: 'sec',
            action: 'update',
          }),
        })
      );
      expect(screen.getByText('Wish updated successfully!')).toBeInTheDocument();
    });
  });

  it('deletes wish on delete button click', async () => {
    globalThis.window.location.hash = '#manage-wish?id=w4&secret=sec';
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'w4', content: 'Old content' }),
    } as any);

    render(<ManageWishPage />);
    await waitFor(() => {
      expect(screen.getByText('Manage Your Wish')).toBeInTheDocument();
    });

    globalThis.window.confirm = vi.fn().mockReturnValueOnce(true);
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as any);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Wish' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/wishes/w4/manage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ secret: 'sec', action: 'delete' }),
        })
      );
      expect(screen.getByText('Wish deleted successfully.')).toBeInTheDocument();
    });
  });
});
