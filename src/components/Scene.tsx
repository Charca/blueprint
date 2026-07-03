import type { PointerEvent, ReactNode } from 'react';
import { depth } from '../lib/projection';
import type { ViewState } from '../lib/projection';
import { anchorOf } from '../model/ops';
import type { Element } from '../model/types';
import { AssetShape } from './shapes/AssetShape';

export interface SceneProps {
  elements: Element[];
  view: ViewState;
  selection?: Set<string>;
  onElementPointerDown?: (e: PointerEvent, id: string) => void;
  onElementDoubleClick?: (id: string) => void;
  ghost?: ReactNode;
}

export function Scene({
  elements, view, selection, onElementPointerDown, onElementDoubleClick, ghost,
}: SceneProps) {
  const assets = elements
    .filter((e) => e.kind === 'asset')
    .sort((a, b) => depth(anchorOf(a)!, view.rotation) - depth(anchorOf(b)!, view.rotation));
  const shared = {
    view,
    onPointerDown: onElementPointerDown,
    onDoubleClick: onElementDoubleClick,
  };
  return (
    <>
      {assets.map((el) => (
        <AssetShape key={el.id} el={el} selected={selection?.has(el.id)} {...shared} />
      ))}
      {ghost}
    </>
  );
}
