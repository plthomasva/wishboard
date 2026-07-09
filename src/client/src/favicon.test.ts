import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = resolve(here, '../index.html');
const faviconSvg = resolve(here, '../public/favicon.svg');

describe('favicon', () => {
  it('is linked from index.html as an SVG icon', () => {
    const html = readFileSync(indexHtml, 'utf8');
    expect(html).toMatch(
      /<link[^>]+rel="icon"[^>]+type="image\/svg\+xml"[^>]+href="\/favicon\.svg"/
    );
  });

  it('ships a well-formed SVG of the pinned wish card', () => {
    expect(existsSync(faviconSvg)).toBe(true);
    const svg = readFileSync(faviconSvg, 'utf8');

    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.tagName.toLowerCase()).toBe('svg');

    // The identity of the mark: a cork board, a cream card, and the red pushpin.
    expect(svg).toContain('#d7ccc8'); // corkboard
    expect(svg).toContain('#fffdf3'); // wish card
    expect(doc.querySelector('#pin')).not.toBeNull(); // pushpin gradient
    expect(doc.querySelectorAll('rect').length).toBeGreaterThanOrEqual(2); // board + card
  });
});
