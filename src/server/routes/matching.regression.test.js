/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { isCompatible } from './wishes.js';
import defaultRules from '../defaultRules.js';

// Regression matrix for the matching engine (#199 and follow-up semantics review).
//
// Matching is BIDIRECTIONAL: the searcher must want the wish creator AND the wish
// creator must want the searcher. When a "desired" field is blank the engine infers
// the preference from that party's ORIENTATION (the implicit path); an explicit
// desired value overrides it.
//
// The expected results below encode deliberate product decisions (confirmed with the
// maintainer), not just current behavior:
//   • Unspecified orientation + no desired gender => NO match (was the #199 over-match).
//   • Bisexual matches binary genders only; pansexual is gender-blind (bi≠pan by design).
//   • Trans people are matched via gender (trans woman = woman) — inclusive by default.
//   • A nonbinary person with a binary orientation matches nobody implicitly (no basis
//     to infer their preference); they must set an explicit desired gender / broad search.
//   • Roles cross-match complementary pairs (handler↔pet, top↔bottom) with expansion
//     (pet→pup,kitten).

const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const wish = ({ g, o, r, dg, dorient, dr } = {}) => ({
  creator_genders: JSON.stringify(arr(g)),
  creator_orientations: JSON.stringify(arr(o)),
  creator_roles: JSON.stringify(arr(r)),
  desired_genders: JSON.stringify(arr(dg)),
  desired_orientations: JSON.stringify(arr(dorient)),
  desired_roles: JSON.stringify(arr(dr)),
});
const searcher = ({ g, o, r } = {}) => ({
  identity_genders: arr(g),
  identity_orientations: arr(o),
  identity_roles: arr(r),
});
const match = (w, s) => isCompatible(w, s, defaultRules);

describe('matching: core orientation × gender (bidirectional, implicit)', () => {
  it('straight man ↔ straight woman match', () => {
    expect(match(wish({ g: 'woman', o: 'straight' }), searcher({ g: 'man', o: 'straight' }))).toBe(
      true
    );
    expect(match(wish({ g: 'man', o: 'straight' }), searcher({ g: 'woman', o: 'straight' }))).toBe(
      true
    );
  });

  it('gay man ↔ gay man match; lesbian woman ↔ lesbian woman match', () => {
    expect(match(wish({ g: 'man', o: 'gay' }), searcher({ g: 'man', o: 'gay' }))).toBe(true);
    expect(match(wish({ g: 'woman', o: 'lesbian' }), searcher({ g: 'woman', o: 'lesbian' }))).toBe(
      true
    );
  });

  it('straight man ↛ lesbian woman (she does not want men)', () => {
    expect(match(wish({ g: 'woman', o: 'lesbian' }), searcher({ g: 'man', o: 'straight' }))).toBe(
      false
    );
  });

  it('straight man ↛ gay man; straight woman ↛ lesbian woman', () => {
    expect(match(wish({ g: 'man', o: 'gay' }), searcher({ g: 'man', o: 'straight' }))).toBe(false);
    expect(match(wish({ g: 'woman', o: 'lesbian' }), searcher({ g: 'woman', o: 'straight' }))).toBe(
      false
    );
  });

  it('bisexual matches both binary directions', () => {
    // bi man ↔ straight woman, bi man ↔ gay man, bi woman ↔ straight man, bi woman ↔ lesbian
    expect(match(wish({ g: 'woman', o: 'straight' }), searcher({ g: 'man', o: 'bisexual' }))).toBe(
      true
    );
    expect(match(wish({ g: 'man', o: 'gay' }), searcher({ g: 'man', o: 'bisexual' }))).toBe(true);
    expect(match(wish({ g: 'man', o: 'straight' }), searcher({ g: 'woman', o: 'bisexual' }))).toBe(
      true
    );
    expect(match(wish({ g: 'woman', o: 'lesbian' }), searcher({ g: 'woman', o: 'bisexual' }))).toBe(
      true
    );
  });
});

describe('matching: unspecified orientation (#199)', () => {
  it('a wish with a gender but no orientation and no desired gender matches nobody', () => {
    expect(match(wish({ g: 'woman' }), searcher({ g: 'man', o: 'straight' }))).toBe(false);
    expect(match(wish({ g: 'man' }), searcher({ g: 'woman', o: 'straight' }))).toBe(false);
  });

  it('but an explicit desired gender still matches even with no orientation', () => {
    expect(match(wish({ g: 'woman', dg: 'man' }), searcher({ g: 'man', o: 'straight' }))).toBe(
      true
    );
  });

  it('a searcher with no orientation matches nobody implicitly (broad search is the escape hatch)', () => {
    expect(match(wish({ g: 'woman', o: 'straight' }), searcher({ g: 'man' }))).toBe(false);
  });
});

describe('matching: bisexual is binary-only, pansexual is gender-blind (bi ≠ pan by design)', () => {
  it('bisexual does NOT implicitly match a nonbinary person', () => {
    expect(match(wish({ g: 'nonbinary', o: 'pan' }), searcher({ g: 'man', o: 'bisexual' }))).toBe(
      false
    );
    expect(
      match(wish({ g: 'nonbinary', o: 'queer' }), searcher({ g: 'woman', o: 'bisexual' }))
    ).toBe(false);
  });

  it('pan/queer nonbinary people match each other', () => {
    expect(
      match(wish({ g: 'nonbinary', o: 'pan' }), searcher({ g: 'nonbinary', o: 'queer' }))
    ).toBe(true);
    expect(
      match(wish({ g: 'nonbinary', o: 'queer' }), searcher({ g: 'nonbinary', o: 'pan' }))
    ).toBe(true);
  });

  it('a pan person ↛ a straight man (bidirectional: the straight man does not want nonbinary)', () => {
    expect(match(wish({ g: 'man', o: 'straight' }), searcher({ g: 'nonbinary', o: 'pan' }))).toBe(
      false
    );
  });
});

describe('matching: trans inclusion (kept — a trans woman is a woman)', () => {
  it('straight man ↔ straight trans woman match', () => {
    expect(
      match(wish({ g: 'trans-woman', o: 'straight' }), searcher({ g: 'man', o: 'straight' }))
    ).toBe(true);
    expect(
      match(wish({ g: 'man', o: 'straight' }), searcher({ g: 'trans-woman', o: 'straight' }))
    ).toBe(true);
  });

  it('gay man ↔ gay trans man match', () => {
    expect(match(wish({ g: 'trans-man', o: 'gay' }), searcher({ g: 'man', o: 'gay' }))).toBe(true);
  });

  it('lesbian woman ↔ lesbian trans woman match', () => {
    expect(
      match(wish({ g: 'trans-woman', o: 'lesbian' }), searcher({ g: 'woman', o: 'lesbian' }))
    ).toBe(true);
  });
});

describe('matching: nonbinary + a binary orientation matches nobody implicitly (leave as-is)', () => {
  it('nonbinary/straight has no implicit preference to derive', () => {
    expect(
      match(wish({ g: 'man', o: 'straight' }), searcher({ g: 'nonbinary', o: 'straight' }))
    ).toBe(false);
    expect(
      match(wish({ g: 'woman', o: 'straight' }), searcher({ g: 'nonbinary', o: 'straight' }))
    ).toBe(false);
  });
});

describe('matching: explicit desired overrides implicit orientation', () => {
  it('a lesbian woman who explicitly desires a man matches a straight man', () => {
    // She stated who she wants (a man); he wants a woman and she is one. Mutual.
    expect(
      match(wish({ g: 'woman', o: 'lesbian', dg: 'man' }), searcher({ g: 'man', o: 'straight' }))
    ).toBe(true);
  });
});

describe('matching: roles (cross-match + expansion)', () => {
  // Gender/orientation are held compatible (straight man ↔ straight woman) so these
  // isolate the role dimension.
  const straightWomanWanting = (dr) => wish({ g: 'woman', o: 'straight', dr });
  const straightManWithRole = (r) => searcher({ g: 'man', o: 'straight', r });

  it('a wish desiring a handler matches a pet (and pup/kitten/puppy/kitty/pony via expansion)', () => {
    expect(match(straightWomanWanting('handler'), straightManWithRole('pet'))).toBe(true);
    expect(match(straightWomanWanting('handler'), straightManWithRole('pup'))).toBe(true);
    expect(match(straightWomanWanting('handler'), straightManWithRole('kitten'))).toBe(true);
    expect(match(straightWomanWanting('handler'), straightManWithRole('puppy'))).toBe(true);
    expect(match(straightWomanWanting('handler'), straightManWithRole('kitty'))).toBe(true);
    expect(match(straightWomanWanting('handler'), straightManWithRole('pony'))).toBe(true);
  });

  it('a wish desiring a pet matches a handler (cross-match is bidirectional)', () => {
    expect(match(straightWomanWanting('pet'), straightManWithRole('handler'))).toBe(true);
  });

  it('top ↔ bottom cross-match both ways', () => {
    expect(match(straightWomanWanting('top'), straightManWithRole('bottom'))).toBe(true);
    expect(match(straightWomanWanting('bottom'), straightManWithRole('top'))).toBe(true);
  });

  it('an unrelated role does not satisfy a role desire', () => {
    expect(match(straightWomanWanting('handler'), straightManWithRole('top'))).toBe(false);
  });

  it('no desired role means the role dimension does not constrain the match', () => {
    expect(match(straightWomanWanting([]), straightManWithRole('pet'))).toBe(true);
  });
});

describe('matching: roles — switch cross-match (top ↔ switch ↔ bottom)', () => {
  const straightWomanWanting = (dr) => wish({ g: 'woman', o: 'straight', dr });
  const straightManWithRole = (r) => searcher({ g: 'man', o: 'straight', r });

  it('a switch searcher matches a wish desiring a top', () => {
    expect(match(straightWomanWanting('top'), straightManWithRole('switch'))).toBe(true);
  });

  it('a switch searcher matches a wish desiring a bottom', () => {
    expect(match(straightWomanWanting('bottom'), straightManWithRole('switch'))).toBe(true);
  });

  it('a top searcher matches a wish desiring a switch', () => {
    expect(match(straightWomanWanting('switch'), straightManWithRole('top'))).toBe(true);
  });

  it('a bottom searcher matches a wish desiring a switch', () => {
    expect(match(straightWomanWanting('switch'), straightManWithRole('bottom'))).toBe(true);
  });

  it('switch does not match an unrelated role like handler', () => {
    expect(match(straightWomanWanting('handler'), straightManWithRole('switch'))).toBe(false);
  });
});

describe('matching: roles — D/s (dominant ↔ submissive) with synonym expansions', () => {
  const straightWomanWanting = (dr) => wish({ g: 'woman', o: 'straight', dr });
  const straightManWithRole = (r) => searcher({ g: 'man', o: 'straight', r });

  it('dominant ↔ submissive cross-match both ways', () => {
    expect(match(straightWomanWanting('dominant'), straightManWithRole('submissive'))).toBe(true);
    expect(match(straightWomanWanting('submissive'), straightManWithRole('dominant'))).toBe(true);
  });

  it('wish desiring dominant also matches dom, domme, master, mistress', () => {
    expect(match(straightWomanWanting('dominant'), straightManWithRole('dom'))).toBe(true);
    expect(match(straightWomanWanting('dominant'), straightManWithRole('domme'))).toBe(true);
    expect(match(straightWomanWanting('dominant'), straightManWithRole('master'))).toBe(true);
    expect(match(straightWomanWanting('dominant'), straightManWithRole('mistress'))).toBe(true);
  });

  it('wish desiring submissive also matches sub, slave, service-sub, little', () => {
    expect(match(straightWomanWanting('submissive'), straightManWithRole('sub'))).toBe(true);
    expect(match(straightWomanWanting('submissive'), straightManWithRole('slave'))).toBe(true);
    expect(match(straightWomanWanting('submissive'), straightManWithRole('service-sub'))).toBe(true);
    expect(match(straightWomanWanting('submissive'), straightManWithRole('little'))).toBe(true);
  });

  it('wish desiring sub (synonym) also expands to the full submissive set', () => {
    expect(match(straightWomanWanting('sub'), straightManWithRole('submissive'))).toBe(true);
    expect(match(straightWomanWanting('sub'), straightManWithRole('slave'))).toBe(true);
  });

  it('wish desiring dom (synonym) also expands to the full dominant set', () => {
    expect(match(straightWomanWanting('dom'), straightManWithRole('dominant'))).toBe(true);
    expect(match(straightWomanWanting('dom'), straightManWithRole('domme'))).toBe(true);
  });
});

describe('matching: roles — complementary pairs (master/slave, owner/property, rigger/rope-bunny, sadist/masochist, caregiver/little, brat-tamer/brat)', () => {
  const straightWomanWanting = (dr) => wish({ g: 'woman', o: 'straight', dr });
  const straightManWithRole = (r) => searcher({ g: 'man', o: 'straight', r });

  it('master ↔ slave cross-match both ways', () => {
    expect(match(straightWomanWanting('master'), straightManWithRole('slave'))).toBe(true);
    expect(match(straightWomanWanting('slave'), straightManWithRole('master'))).toBe(true);
  });

  it('owner ↔ property cross-match both ways', () => {
    expect(match(straightWomanWanting('owner'), straightManWithRole('property'))).toBe(true);
    expect(match(straightWomanWanting('property'), straightManWithRole('owner'))).toBe(true);
  });

  it('rigger ↔ rope-bunny cross-match both ways', () => {
    expect(match(straightWomanWanting('rigger'), straightManWithRole('rope-bunny'))).toBe(true);
    expect(match(straightWomanWanting('rope-bunny'), straightManWithRole('rigger'))).toBe(true);
  });

  it('sadist ↔ masochist cross-match both ways', () => {
    expect(match(straightWomanWanting('sadist'), straightManWithRole('masochist'))).toBe(true);
    expect(match(straightWomanWanting('masochist'), straightManWithRole('sadist'))).toBe(true);
  });

  it('caregiver ↔ little cross-match both ways', () => {
    expect(match(straightWomanWanting('caregiver'), straightManWithRole('little'))).toBe(true);
    expect(match(straightWomanWanting('little'), straightManWithRole('caregiver'))).toBe(true);
  });

  it('wish desiring caregiver also matches daddy, mommy, mummy', () => {
    expect(match(straightWomanWanting('caregiver'), straightManWithRole('daddy'))).toBe(true);
    expect(match(straightWomanWanting('caregiver'), straightManWithRole('mommy'))).toBe(true);
    expect(match(straightWomanWanting('caregiver'), straightManWithRole('mummy'))).toBe(true);
  });

  it('brat-tamer ↔ brat cross-match both ways', () => {
    expect(match(straightWomanWanting('brat-tamer'), straightManWithRole('brat'))).toBe(true);
    expect(match(straightWomanWanting('brat'), straightManWithRole('brat-tamer'))).toBe(true);
  });

  it('unrelated role pairs do not cross-match', () => {
    expect(match(straightWomanWanting('rigger'), straightManWithRole('sadist'))).toBe(false);
    expect(match(straightWomanWanting('owner'), straightManWithRole('slave'))).toBe(false);
  });
});

describe('matching: roles — vers/versatile synonym expansion', () => {
  const straightWomanWanting = (dr) => wish({ g: 'woman', o: 'straight', dr });
  const straightManWithRole = (r) => searcher({ g: 'man', o: 'straight', r });

  it('vers and versatile are synonyms and match each other', () => {
    expect(match(straightWomanWanting('vers'), straightManWithRole('versatile'))).toBe(true);
    expect(match(straightWomanWanting('versatile'), straightManWithRole('vers'))).toBe(true);
  });
});
