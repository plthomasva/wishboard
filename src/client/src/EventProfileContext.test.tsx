import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.unmock('./EventProfileContext');
import { EventProfileProvider, useEventProfile } from './EventProfileContext';

const TestComponent = () => {
  const profile = useEventProfile();
  return (
    <div>
      <span data-testid="profile-name">{profile.profile}</span>
      <span data-testid="contact-methods">{profile.contact_methods.join(',')}</span>
    </div>
  );
};

describe('EventProfileContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders loading state initially and then provider children on successful fetch', async () => {
    const mockData = {
      profile: 'professional',
      contact_methods: ['LinkedIn', 'Email'],
      categories: [],
      realtimeProvider: 'socketio',
      apIp: '127.0.0.1',
      isServerless: false,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockData),
      })
    );

    render(
      <EventProfileProvider>
        <TestComponent />
      </EventProfileProvider>
    );

    expect(screen.getByText('Loading application config...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('profile-name')).toHaveTextContent('professional');
    });

    expect(screen.getByTestId('contact-methods')).toHaveTextContent('LinkedIn,Email');
  });

  it('handles fetch failure gracefully and sets loaded to true', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(
      <EventProfileProvider>
        <TestComponent />
      </EventProfileProvider>
    );

    expect(screen.getByText('Loading application config...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading application config...')).not.toBeInTheDocument();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load event profile config:',
      expect.any(Error)
    );
    expect(screen.getByTestId('profile-name')).toHaveTextContent('');
    expect(screen.getByTestId('contact-methods')).toHaveTextContent('Phone,Email');
  });
});
