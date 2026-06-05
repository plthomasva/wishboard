import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DisplayPage from './DisplayPage';

describe('DisplayPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'wish-1', content: 'Big screen wish', creator_genders: ['man'], creator_orientations: ['straight'] }
      ]
    }) as any;
    global.setInterval = vi.fn(() => 1) as any;
    global.clearInterval = vi.fn() as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and renders wishes from the random endpoint', async () => {
    render(<DisplayPage />);

    await waitFor(() => expect(screen.getByText('Big screen wish')).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith('/api/wishes/random?limit=12');
  });
});
