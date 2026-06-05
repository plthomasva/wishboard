import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SearchPage from './SearchPage';

vi.mock('../AuthContext', () => ({
  useAuth: () => ({ user: null })
}));

describe('SearchPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'wish-1', content: 'Hello world', creator_genders: ['woman'], creator_orientations: ['queer'] }
      ]
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits search with manual query fields and renders results', async () => {
    render(<SearchPage />);

    fireEvent.change(screen.getByPlaceholderText(/Search existing wishes/i), { target: { value: 'hello' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. woman, cisgender man/i), { target: { value: 'woman' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. lesbian, bisexual/i), { target: { value: 'queer' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. top, bottom/i), { target: { value: 'top' } });

    fireEvent.click(screen.getByRole('button', { name: /Search/i }));

    await waitFor(() => expect(screen.getByText('Hello world')).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('searcher_genders=woman'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('searcher_orientations=queer'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('searcher_roles=top'));
  });
});
