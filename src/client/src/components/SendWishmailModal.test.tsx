import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SendWishmailModal from './SendWishmailModal';
import React from 'react';
import * as AuthContext from '../AuthContext';

vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('SendWishmailModal', () => {
  beforeEach(() => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: 'mock-token' } as any);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders form and handles submission successfully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const onClose = vi.fn();
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    render(<SendWishmailModal wishId="w1" onClose={onClose} />);

    expect(screen.getByRole('heading', { name: 'Send Wishmail' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Add Return Contact' }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Phone' } });

    const inputs = screen.getAllByPlaceholderText('Username, number, etc.');
    fireEvent.change(inputs[0], { target: { value: '555-1234' } });

    fireEvent.change(
      screen.getByPlaceholderText('What would you like to say to the wish creator?'),
      { target: { value: 'Hello there' } }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    expect(mockFetch).toHaveBeenCalledWith('/api/wishes/w1/mail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-token',
      },
      body: JSON.stringify({
        content: 'Hello there',
        return_contacts: [{ type: 'Phone', value: '555-1234' }],
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('Message sent successfully!')).toBeInTheDocument();
    });

    // Check that setTimeout was called with onClose
    expect(setTimeoutSpy).toHaveBeenCalledWith(onClose, 2000);
  });

  it('handles error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Error sending message' }),
    });

    render(<SendWishmailModal wishId="w1" onClose={vi.fn()} />);

    fireEvent.change(
      screen.getByPlaceholderText('What would you like to say to the wish creator?'),
      { target: { value: 'Hello there' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    await waitFor(() => {
      expect(screen.getByText('Error sending message')).toBeInTheDocument();
    });
  });

  it('removes contact', () => {
    render(<SendWishmailModal wishId="w1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Return Contact' }));

    expect(screen.getAllByRole('combobox').length).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'X' }));

    expect(screen.queryAllByRole('combobox').length).toBe(0);
  });
  it('submits successfully without auth token', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: null } as any);
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    render(<SendWishmailModal wishId="w2" onClose={vi.fn()} />);

    fireEvent.change(
      screen.getByPlaceholderText('What would you like to say to the wish creator?'),
      { target: { value: 'Anon msg' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/wishes/w2/mail',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await waitFor(() => {
      expect(screen.getByText('Message sent successfully!')).toBeInTheDocument();
    });
  });

  it('handles default error message if error payload is empty', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<SendWishmailModal wishId="w3" onClose={vi.fn()} />);

    fireEvent.change(
      screen.getByPlaceholderText('What would you like to say to the wish creator?'),
      { target: { value: 'Bad msg' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send message.')).toBeInTheDocument();
    });
  });
});
