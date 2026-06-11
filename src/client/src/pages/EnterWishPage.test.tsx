import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EnterWishPage from './EnterWishPage';

vi.mock('../AuthContext', () => ({
  useAuth: () => ({ token: null })
}));

describe('EnterWishPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'wish-1', secret: 'secret-code' })
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits a wish and shows the success message', async () => {
    render(<EnterWishPage />);

    fireEvent.change(screen.getByPlaceholderText(/Type your wish here/i), { target: { value: 'I want a test.' } });
    fireEvent.change(screen.getByPlaceholderText(/Leave blank for automatic code phrase/i), { target: { value: 'super-secret' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit Wish/i }));

    await waitFor(() => expect(screen.getByText(/Wish saved! ID:/i)).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith('/api/wishes', expect.objectContaining({ method: 'POST' }));
  });



  it('shows error if API request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' })
    }) as any;

    render(<EnterWishPage />);
    fireEvent.change(screen.getByPlaceholderText(/Type your wish here/i), { target: { value: 'test wish' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit Wish/i }));
    
    expect(await screen.findByText(/Server error/i)).toBeInTheDocument();
  });
});
