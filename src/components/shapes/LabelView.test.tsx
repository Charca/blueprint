import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LabelView } from './LabelView';
import type { Label } from '../../model/types';

const tagLabel = (text: string): Label => ({
  text, style: 'tag', color: '#2A3242', orientation: 'right',
});

const textLabel = (text: string): Label => ({
  text, style: 'text', color: '#2A3242', orientation: 'left',
});

describe('LabelView', () => {
  it('uses fixed tag padding and keeps short tag geometry bounded', () => {
    const markup = renderToStaticMarkup(<svg><LabelView label={tagLabel('Label')} anchor={{ x: 60, y: 129 }} /></svg>);
    expect(markup).toContain('width="63"');
    expect(markup).toContain('height="28"');
    expect(markup).toContain('translate(41.5 0)');
    expect(markup).toContain('textLength="35"');
  });

  it('wraps long tag labels to at most two centered lines with bounded width', () => {
    const markup = renderToStaticMarkup(
      <svg><LabelView label={tagLabel('This is a very long label that should wrap neatly')} anchor={{ x: 0, y: 0 }} align="center" /></svg>,
    );
    expect(markup).toContain('translate(0 0)');
    expect(markup).toContain('width="182"');
    expect(markup).toContain('height="44"');
    expect((markup.match(/<tspan/g) ?? [])).toHaveLength(2);
    expect(markup).not.toContain('very long label that should wrap neatly');
  });

  it('wraps plain text labels to at most two centered lines', () => {
    const markup = renderToStaticMarkup(
      <svg><LabelView label={textLabel('This is a very long plain text label that should wrap neatly')} anchor={{ x: 20, y: 30 }} /></svg>,
    );
    expect((markup.match(/<tspan/g) ?? [])).toHaveLength(2);
    expect(markup).toContain('text-anchor="middle"');
    expect(markup).toContain('x="20"');
    expect(markup).not.toContain('plain text label that should wrap neatly');
  });
});
