import { describe, expect, it } from 'vitest';
import { wrapText } from './wrap';

describe('wrapText', () => {
  it('keeps short text on one line', () => {
    expect(wrapText('hello world')).toEqual(['hello world']);
  });
  it('wraps greedily at the limit', () => {
    expect(wrapText('aaa bbb ccc', 7)).toEqual(['aaa bbb', 'ccc']);
  });
  it('does not split long single words', () => {
    expect(wrapText('supercalifragilistic', 5)).toEqual(['supercalifragilistic']);
  });
  it('returns empty array for empty text', () => {
    expect(wrapText('')).toEqual([]);
  });
});
