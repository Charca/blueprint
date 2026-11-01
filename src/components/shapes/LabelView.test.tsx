import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Label } from '../../model/types';
import { LabelView } from './LabelView';

const longText = 'With a longer name that is very long';

function label(style: Label['style']): Label {
  return { text: longText, style, color: '#2A3242', orientation: 'left' };
}

describe('LabelView', () => {
  it.each(['tag', 'text'] as const)('wraps long %s labels over two lines', (style) => {
    const markup = renderToStaticMarkup(
      <svg><LabelView label={label(style)} anchor={{ x: 60, y: 129 }} align="center" /></svg>,
    );
    expect(markup).toContain('With a longer name');
    expect(markup).toContain('that is very long');
    expect(markup.match(/<tspan/g)).toHaveLength(2);
  });

  it('sizes a tag from its longest wrapped line with constant padding', () => {
    const markup = renderToStaticMarkup(
      <svg><LabelView label={label('tag')} anchor={{ x: 60, y: 129 }} align="center" /></svg>,
    );
    expect(markup).not.toContain('textLength');
    expect(markup).not.toContain('lengthAdjust');
  });
});
