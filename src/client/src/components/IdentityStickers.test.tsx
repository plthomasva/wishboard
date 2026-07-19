import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import IdentityStickers from './IdentityStickers';
import * as DomainContext from '../DomainContext';

vi.mock('../DomainContext', () => ({
  useDomain: vi.fn(),
}));

const mockDefaultDomain = {
  domain: 'default',
  categories: [],
  stickers: {
    orientation: {
      straight: { type: 'heart', class: 'flag-straight' },
      gay: { type: 'heart', class: 'flag-rainbow' },
      lesbian: { type: 'heart', class: 'flag-lesbian' },
      bi: { type: 'heart', class: 'flag-bisexual' },
      pan: { type: 'heart', class: 'flag-pansexual' },
      asexual: { type: 'heart', class: 'flag-asexual' },
      queer: { type: 'heart', class: 'flag-rainbow' },
    },
    gender: {
      trans: { type: 'flag', class: 'flag-trans' },
      nonbinary: { type: 'flag', class: 'flag-nonbinary' },
      woman: { type: 'icon', class: 'female-icon', iconType: 'female' },
      man: { type: 'icon', class: 'male-icon', iconType: 'male' },
    },
  },
  realtimeProvider: 'socketio',
  apIp: '',
  isServerless: false,
};

const mockAlternativeDomain = {
  domain: 'conference',
  categories: [],
  stickers: {
    role: {
      presenter: { type: 'image', src: '/assets/presenter.png' },
      attendee: { type: 'image', src: '/assets/attendee.png' },
    },
  },
  realtimeProvider: 'socketio',
  apIp: '',
  isServerless: false,
};

describe('IdentityStickers', () => {
  it('returns null if no stickers provided', () => {
    vi.mocked(DomainContext.useDomain).mockReturnValue(mockDefaultDomain);
    const { container } = render(<IdentityStickers />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all recognized orientations for default domain', () => {
    vi.mocked(DomainContext.useDomain).mockReturnValue(mockDefaultDomain);
    const orientations = ['straight', 'gay', 'lesbian', 'bi', 'pan', 'asexual', 'queer', 'unknown'];
    const { container } = render(<IdentityStickers orientations={orientations} />);
    expect(container.querySelectorAll('.sticker-heart-shadow')).toHaveLength(7);
  });

  it('renders all recognized genders for default domain', () => {
    vi.mocked(DomainContext.useDomain).mockReturnValue(mockDefaultDomain);
    const genders = ['trans', 'nonbinary', 'woman', 'man', 'unknown'];
    const { container } = render(<IdentityStickers genders={genders} />);
    expect(container.querySelectorAll('.sticker-flag')).toHaveLength(2);
    expect(container.querySelectorAll('.sticker-icon')).toHaveLength(2);
  });

  it('renders alternative domain stickers correctly', () => {
    vi.mocked(DomainContext.useDomain).mockReturnValue(mockAlternativeDomain);
    const attributes = { role: ['presenter', 'attendee', 'sponsor'] };
    const { container } = render(<IdentityStickers attributes={attributes} />);
    expect(container.querySelectorAll('.sticker-image')).toHaveLength(2);
    const imgs = container.querySelectorAll('img');
    expect(imgs[0].getAttribute('src')).toBe('/assets/presenter.png');
    expect(imgs[1].getAttribute('src')).toBe('/assets/attendee.png');
  });
});
