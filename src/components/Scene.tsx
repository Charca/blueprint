import type { PointerEvent, ReactNode } from 'react';
import { depth } from '../lib/projection';
import type { ViewState } from '../lib/projection';
import { anchorOfElement } from '../model/ops';
import type { Element } from '../model/types';
import { AssetShape } from './shapes/AssetShape';
import { ConnectorShape } from './shapes/ConnectorShape';
import { FloorShape } from './shapes/FloorShape';
import type { FloorResizeSide } from './shapes/FloorShape';
import { TagShape } from './shapes/TagShape';
import { TextShape } from './shapes/TextShape';

export interface SceneProps {
  elements: Element[];
  view: ViewState;
  selection?: Set<string>;
  highlightedFloorId?: string | null;
  onElementPointerDown?: (e: PointerEvent, id: string) => void;
  onFloorResizePointerDown?: (e: PointerEvent, id: string, side: FloorResizeSide) => void;
  onConnectorElbowPointerDown?: (e: PointerEvent, id: string) => void;
  onElementDoubleClick?: (id: string) => void;
  ghost?: ReactNode;
}

export function Scene({
  elements, view, selection, highlightedFloorId, onElementPointerDown, onFloorResizePointerDown, onConnectorElbowPointerDown, onElementDoubleClick, ghost,
}: SceneProps) {
  const assets = elements
    .filter((e) => e.kind === 'asset')
    .sort((a, b) => depth(anchorOfElement(a, elements)!, view.rotation) - depth(anchorOfElement(b, elements)!, view.rotation));
  const shared = {
    view,
    onPointerDown: onElementPointerDown,
    onDoubleClick: onElementDoubleClick,
  };
  return (
    <>
      {elements.filter((e) => e.kind === 'floor').map((el) => (
        <FloorShape key={el.id} el={el} elements={elements} selected={selection?.has(el.id)}
          highlighted={highlightedFloorId === el.id}
          onResizePointerDown={onFloorResizePointerDown} {...shared} />
      ))}
      {elements.filter((e) => e.kind === 'connector').map((el) => (
        <ConnectorShape key={el.id} el={el} elements={elements}
          selected={selection?.has(el.id)} onElbowPointerDown={onConnectorElbowPointerDown} {...shared} />
      ))}
      {assets.map((el) => (
        <AssetShape key={el.id} el={el} selected={selection?.has(el.id)} {...shared} />
      ))}
      {elements.filter((e) => e.kind === 'tag').map((el) => (
        <TagShape key={el.id} el={el} selected={selection?.has(el.id)} {...shared} />
      ))}
      {elements.filter((e) => e.kind === 'text').map((el) => (
        <TextShape key={el.id} el={el} selected={selection?.has(el.id)} {...shared} />
      ))}
      {ghost}
    </>
  );
}
