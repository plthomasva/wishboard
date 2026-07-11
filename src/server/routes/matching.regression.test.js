/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { isCompatible } from './wishes.js';
import defaultRules from '../defaultRules.js';

// Regression matrix for #199: the matching engine was over-matching (a "straight
// man" searcher was shown a "lesbian woman" wish). Matching is BIDIRECTIONAL —
// the searcher must want the creator AND the creator must want the searcher.
// These pin down orientation/gender pairings against the bundled default rules.

const wish = ({ g = [], o = [], r = [], dg = [], dorient = [], dr = [] }) => ({
  creator_genders: JSON.stringify(g),
  creator_orientations: JSON.stringify(o),
  creator_roles: JSON.stringify(r),
  desired_genders: JSON.stringify(dg),
  desired_orientations: JSON.stringify(dorient),
  desired_roles: JSON.stringify(dr),
});

const searcher = ({ g = [], o = [], r = [] }) => ({
  identity_genders: g,
  identity_orientations: o,
  identity_roles: r,
});

const match = (w, s) => isCompatible(w, s, defaultRules);

describe('#199 matching regression — bidirectional gender/orientation', () => {
  const straightMan = searcher({ g: ['man'], o: ['straight'] });
  const straightWoman = searcher({ g: ['woman'], o: ['straight'] });
  const lesbianWoman = searcher({ g: ['woman'], o: ['lesbian'] });
  const gayMan = searcher({ g: ['man'], o: ['gay'] });

  it('straight man ↛ lesbian woman (orientation stated, no desired)', () => {
    expect(match(wish({ g: ['woman'], o: ['lesbian'] }), straightMan)).toBe(false);
  });

  it('straight man ↛ lesbian woman (she explicitly desires women)', () => {
    expect(match(wish({ g: ['woman'], o: ['lesbian'], dg: ['woman'] }), straightMan)).toBe(false);
  });

  it('straight man ↛ a woman wish with no orientation and no desired (the loose case)', () => {
    // The suspected over-match: an empty orientation must not mean "wants everyone".
    expect(match(wish({ g: ['woman'] }), straightMan)).toBe(false);
  });

  it('straight man → straight woman (mutual)', () => {
    expect(match(wish({ g: ['woman'], o: ['straight'] }), straightMan)).toBe(true);
  });

  it('lesbian woman → lesbian woman (mutual)', () => {
    expect(match(wish({ g: ['woman'], o: ['lesbian'] }), lesbianWoman)).toBe(true);
  });

  it('gay man → gay man (mutual)', () => {
    expect(match(wish({ g: ['man'], o: ['gay'] }), gayMan)).toBe(true);
  });

  it('straight man ↛ gay man', () => {
    expect(match(wish({ g: ['man'], o: ['gay'] }), straightMan)).toBe(false);
  });

  it('lesbian woman ↛ straight man wish', () => {
    expect(match(wish({ g: ['man'], o: ['straight'] }), lesbianWoman)).toBe(false);
  });

  it('straight woman → straight man wish (mutual)', () => {
    expect(match(wish({ g: ['man'], o: ['straight'], dg: ['woman'] }), straightWoman)).toBe(true);
  });
});
