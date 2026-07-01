import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { io } from 'socket.io-client';
import SearchPage from './SearchPage';

vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

const getMockSocket = () => (io as ReturnType<typeof vi.fn>)();

// Helper: get the LAST registered handler for a given event.
// The wish:created effect re-registers when lastSearchParams changes,
// so we always want the most recently registered handler.
const getLastHandler = (socket: any, event: string) => {
  const calls = (socket.on as ReturnType<typeof vi.fn>).mock.calls.filter(([e]) => e === event);
  return calls[calls.length - 1]?.[1];
};

describe('SearchPage WebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'w1',
          content: 'Existing search result',
          creator_genders: [],
          creator_orientations: [],
        },
      ],
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prepends a matching new wish when wish:created is received after a search', async () => {
    render(<SearchPage />);

    // Perform a search to set lastSearchParams
    fireEvent.change(screen.getByPlaceholderText(/Search existing wishes/i), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));
    await waitFor(() => expect(screen.getByText('Existing search result')).toBeInTheDocument());

    // Now mock fetch to return the new wish when the handler re-queries
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'w2',
          content: 'Brand new matching wish',
          creator_genders: [],
          creator_orientations: [],
        },
        {
          id: 'w1',
          content: 'Existing search result',
          creator_genders: [],
          creator_orientations: [],
        },
      ],
    }) as any;

    const socket = getMockSocket();
    const wishCreatedHandler = getLastHandler(socket, 'wish:created');
    expect(wishCreatedHandler).toBeDefined();

    await act(async () => {
      await wishCreatedHandler({
        id: 'w2',
        content: 'Brand new matching wish',
        creator_genders: [],
        creator_orientations: [],
      });
    });

    await waitFor(() => expect(screen.getByText('Brand new matching wish')).toBeInTheDocument());
  });

  it('does not prepend a wish that does not match the current search', async () => {
    render(<SearchPage />);

    fireEvent.change(screen.getByPlaceholderText(/Search existing wishes/i), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));
    await waitFor(() => expect(screen.getByText('Existing search result')).toBeInTheDocument());

    // Mock fetch to NOT include the new wish (it doesn't match)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'w1',
          content: 'Existing search result',
          creator_genders: [],
          creator_orientations: [],
        },
      ],
    }) as any;

    const socket = getMockSocket();
    const wishCreatedHandler = getLastHandler(socket, 'wish:created');

    await act(async () => {
      await wishCreatedHandler({
        id: 'w-no-match',
        content: 'Non matching wish',
        creator_genders: [],
        creator_orientations: [],
      });
    });

    expect(screen.queryByText('Non matching wish')).not.toBeInTheDocument();
  });

  it('does not prepend a duplicate if wish is already in results', async () => {
    render(<SearchPage />);

    fireEvent.change(screen.getByPlaceholderText(/Search existing wishes/i), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));
    await waitFor(() => expect(screen.getByText('Existing search result')).toBeInTheDocument());

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'w1',
          content: 'Existing search result',
          creator_genders: [],
          creator_orientations: [],
        },
      ],
    }) as any;

    const socket = getMockSocket();
    const wishCreatedHandler = getLastHandler(socket, 'wish:created');

    await act(async () => {
      await wishCreatedHandler({
        id: 'w1',
        content: 'Existing search result',
        creator_genders: [],
        creator_orientations: [],
      });
    });

    expect(screen.getAllByText('Existing search result')).toHaveLength(1);
  });

  it('ignores wish:created if no search has been run yet', async () => {
    render(<SearchPage />);

    const socket = getMockSocket();
    // Use the first (early-return) handler deliberately — tests the early-exit branch
    const wishCreatedHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([e]) => e === 'wish:created'
    )?.[1];

    await act(async () => {
      await wishCreatedHandler?.({
        id: 'w-early',
        content: 'Too early wish',
        creator_genders: [],
        creator_orientations: [],
      });
    });

    expect(screen.queryByText('Too early wish')).not.toBeInTheDocument();
  });

  it('handles a failed re-fetch gracefully and does not crash', async () => {
    render(<SearchPage />);

    fireEvent.change(screen.getByPlaceholderText(/Search existing wishes/i), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));
    await waitFor(() => expect(screen.getByText('Existing search result')).toBeInTheDocument());

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    const socket = getMockSocket();
    const wishCreatedHandler = getLastHandler(socket, 'wish:created');

    // Should not throw — error is caught and logged via console.debug
    await expect(
      act(async () => {
        await wishCreatedHandler({
          id: 'w-err',
          content: 'Error wish',
          creator_genders: [],
          creator_orientations: [],
        });
      })
    ).resolves.not.toThrow();

    // The error wish should NOT have been added to the UI
    expect(screen.queryByText('Error wish')).not.toBeInTheDocument();
  });

  it('cleans up the wish:created listener on unmount', async () => {
    const { unmount } = render(<SearchPage />);

    const socket = getMockSocket();
    unmount();

    expect(socket.off).toHaveBeenCalledWith('wish:created', expect.any(Function));
  });
});
