import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EnterWishPage from './EnterWishPage';
import React from 'react';
import * as AuthContext from '../AuthContext';

vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('EnterWishPage Coverage', () => {
  it('handles fallback logic in previewWish for anonymous users', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: null, user: null } as any);

    render(<EnterWishPage />);

    const genderInput = screen.getByLabelText(/Creator Genders?.*\(anonymous only\)/i);
    fireEvent.change(genderInput, { target: { value: 'man, non-binary ' } });

    const orientationInput = screen.getByLabelText(/Creator Orientations?.*\(anonymous only\)/i);
    fireEvent.change(orientationInput, { target: { value: ' gay, queer ' } });

    // Check if the preview card reflects the mapped array
    // IdentityStickers uses titles
    expect(screen.getByTitle('man')).toBeInTheDocument();
    expect(screen.getByTitle('non-binary')).toBeInTheDocument();
    expect(screen.getByTitle('gay')).toBeInTheDocument();
    expect(screen.getByTitle('queer')).toBeInTheDocument();
  });
});
