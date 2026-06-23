import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import EnterWishPage from './EnterWishPage';

import * as AuthContext from '../AuthContext';

vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(() => ({ token: null }))
}));

vi.mock('../components/WishScanner', () => ({
  default: () => <div data-testid="mock-wish-scanner">Mock WishScanner</div>
}));

describe('EnterWishPage', () => {
  beforeEach(() => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'wish-1', secret: 'secret-code' })
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('submits a wish and shows the success message', async () => {
    render(<EnterWishPage />);

    fireEvent.change(screen.getByPlaceholderText(/Type your wish here/i), { target: { value: 'I want a test.' } });
    fireEvent.change(screen.getByPlaceholderText(/Leave blank for automatic code phrase/i), { target: { value: 'super-secret' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit Wish/i }));

    await waitFor(() => expect(screen.getByText(/Wish saved! ID:/i)).toBeInTheDocument());
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/wishes', expect.objectContaining({ method: 'POST' }));

    // Flush any pending WishCard layout effects to prevent act() warnings
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  });



  it('shows error if API request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' })
    }));

    render(<EnterWishPage />);
    fireEvent.change(screen.getByPlaceholderText(/Type your wish here/i), { target: { value: 'test wish' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit Wish/i }));
    
    expect(await screen.findByText(/Server error/i)).toBeInTheDocument();

    // Flush any pending WishCard layout effects to prevent act() warnings
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  });

  it('toggles Advanced Match Criteria', async () => {
    render(<EnterWishPage />);
    
    // Initially hidden
    expect(screen.queryByText(/Desired genders/i)).not.toBeInTheDocument();
    
    // Click toggle
    const toggle = screen.getByText(/Advanced Match Criteria/i);
    fireEvent.click(toggle);
    
    // Now visible
    expect(screen.getByText(/Strictly required genders/i)).toBeInTheDocument();
  });

  it('allows uploading a handwritten wish image', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mocked-url');
    render(<EnterWishPage />);
    
    const fileInput = screen.getByLabelText(/Upload Image/i);
    const mockFile = new File(['mock content'], 'wish.jpg', { type: 'image/jpeg' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
    });

    expect(screen.getByText(/Handwritten wish attached/i)).toBeInTheDocument();

    // Verify remove functionality
    const removeBtn = screen.getByRole('button', { name: /Remove Image/i });
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    expect(screen.queryByText(/Handwritten wish attached/i)).not.toBeInTheDocument();
  });
  it('handles logged-in user UI appropriately', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({ token: 'mock-token' });
    render(<EnterWishPage />);
    expect(screen.getByText(/Your account identity attributes are applied automatically to this wish./i)).toBeInTheDocument();
  });

  it('allows capturing an image with camera', async () => {
    render(<EnterWishPage />);
    
    // Desktop view shows the Capture with Camera button
    const captureBtn = screen.getByRole('button', { name: /Capture with Camera/i });
    fireEvent.click(captureBtn);

    // Scanner should be rendered
    expect(await screen.findByTestId('mock-wish-scanner')).toBeInTheDocument();
  });
});
