import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('./EnterWishPage', () => ({ default: () => <div>EnterWishPageMock</div> }));
vi.mock('./SearchPage', () => ({ default: () => <div>SearchPageMock</div> }));
vi.mock('./DisplayPage', () => ({ default: () => <div>DisplayPageMock</div> }));

import RemotePreview from './RemotePreview';

describe('RemotePreview', () => {
  it('toggles between kiosk modes and renders child previews', () => {
    render(<RemotePreview />);

    expect(screen.getByText('EnterWishPageMock')).toBeInTheDocument();
    expect(screen.getByText('DisplayPageMock')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Search/i }));
    expect(screen.getByText('SearchPageMock')).toBeInTheDocument();
  });
});
