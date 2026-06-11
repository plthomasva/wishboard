import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import IdentityStickers from './IdentityStickers';

describe('IdentityStickers', () => {
  it('returns null if no stickers provided', () => {
    const { container } = render(<IdentityStickers />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all recognized orientations', () => {
    const orientations = ['straight', 'gay', 'lesbian', 'bi', 'pan', 'asexual', 'queer', 'unknown'];
    const { container } = render(<IdentityStickers orientations={orientations} />);
    expect(container.querySelectorAll('.sticker-heart-shadow').length).toBe(7);
  });

  it('renders all recognized genders', () => {
    const genders = ['trans', 'nonbinary', 'woman', 'man', 'unknown'];
    const { container } = render(<IdentityStickers genders={genders} />);
    expect(container.querySelectorAll('.sticker-flag').length).toBe(2);
    expect(container.querySelectorAll('.sticker-icon').length).toBe(2);
  });
});
