import { describe, expect, it } from 'vitest';
import { LABEL_INLINE_PADDING, estimateLabelLineWidth, labelLines, labelWidth } from './labelLayout';

describe('label layout', () => {
  it('keeps short labels on one line and balances long labels over two', () => {
    expect(labelLines('Short label')).toEqual(['Short label']);
    expect(labelLines('With a longer name that is very long')).toEqual([
      'With a longer name', 'that is very long',
    ]);
  });

  it('splits a long unbroken label over two lines', () => {
    expect(labelLines('abcdefghijklmnopqrstuvwxyz')).toEqual(['abcdefghijklm', 'nopqrstuvwxyz']);
  });

  it('uses fixed inline padding independent of label length', () => {
    expect(labelWidth(['A']) - estimateLabelLineWidth('A')).toBe(LABEL_INLINE_PADDING * 2);
    expect(labelWidth(['A much longer line']) - estimateLabelLineWidth('A much longer line'))
      .toBe(LABEL_INLINE_PADDING * 2);
  });

  it('accounts for proportional glyph widths without changing the text itself', () => {
    expect(estimateLabelLineWidth('WWW')).toBeGreaterThan(estimateLabelLineWidth('iii'));
  });
});
