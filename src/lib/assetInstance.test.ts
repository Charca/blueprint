import { describe, expect, it } from 'vitest';
import type { AssetDef } from '../generated/assets';
import { instanceMarkup } from './assetInstance';

const def: AssetDef = {
  id: 'demo', name: 'Demo', category: 'graphics', viewBox: '0 0 120 120',
  markup: '<path fill="#3258C2" stroke="url(#__BP__g1)"/><linearGradient id="__BP__g1"><stop stop-color="#618AFF"/></linearGradient>',
};

describe('instanceMarkup', () => {
  it('prefixes ids with the instance id', () => {
    const m = instanceMarkup(def, 'el42', '#618AFF');
    expect(m).toContain('id="el42-g1"');
    expect(m).toContain('url(#el42-g1)');
    expect(m).not.toContain('__BP__');
  });

  it('recolors the kit palette from the base color', () => {
    const m = instanceMarkup(def, 'el42', '#E05252');
    expect(m).not.toContain('#3258C2');
    expect(m).not.toContain('#618AFF');
  });

  it('keeps kit colors when base is the kit blue', () => {
    const m = instanceMarkup(def, 'el43', '#618AFF');
    expect(m.toLowerCase()).toContain('#618aff');
  });
});
