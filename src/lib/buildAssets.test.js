import { describe, expect, it } from 'vitest';
import { transformSvg, titleCase } from '../../scripts/build-assets.mjs';

const FIXTURE = `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0 0h10" fill="#3258C2" stroke="#3258C2"/>
<rect width="5" height="5" fill="url(#paint0_linear_1_2)" mask="url(#mask0_1_2)"/>
<use href="#shape1"/>
<defs><linearGradient id="paint0_linear_1_2"><stop stop-color="#618AFF"/></linearGradient>
<mask id="mask0_1_2"/><path id="shape1"/></defs>
</svg>`;

describe('build-assets', () => {
  it('extracts viewBox and strips the svg wrapper', () => {
    const { viewBox, markup } = transformSvg(FIXTURE);
    expect(viewBox).toBe('0 0 120 120');
    expect(markup).not.toContain('<svg');
    expect(markup).not.toContain('</svg>');
  });

  it('namespaces ids and all references with the __BP__ token', () => {
    const { markup } = transformSvg(FIXTURE);
    expect(markup).toContain('id="__BP__paint0_linear_1_2"');
    expect(markup).toContain('url(#__BP__paint0_linear_1_2)');
    expect(markup).toContain('url(#__BP__mask0_1_2)');
    expect(markup).toContain('href="#__BP__shape1"');
    expect(markup).not.toMatch(/id="(?!__BP__)/);
  });

  it('title-cases kebab ids', () => {
    expect(titleCase('cube-infra-filled')).toBe('Cube Infra Filled');
  });
});
