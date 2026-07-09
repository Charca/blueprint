import type { Rotation } from '../lib/projection';

export interface Camera { x: number; y: number; zoom: number }

export interface Doc {
  id: string;
  name: string;
  schemaVersion: 1;
  view: { rotation: Rotation; mode: 'iso' | 'top' };
  camera: Camera;
  elements: Element[];
}

export interface Label {
  text: string;
  style: 'text' | 'tag';
  color: string;                  // text color for 'text', pill color for 'tag'
  orientation: 'left' | 'right';  // rendered only for 'tag'
}

/** Back-compat alias — labels are shared across asset and floor elements. */
export type AssetLabel = Label;

export interface AssetEl {
  kind: 'asset'; id: string;
  gridX: number; gridY: number;
  assetId: string;
  color: string;
  parentId?: string;
  label?: Label;
}

export interface FloorEl {
  kind: 'floor'; id: string;
  gridX: number; gridY: number;
  width: number; depth: number;
  /** Missing values in existing documents are treated as 'auto'. */
  sizeMode?: 'auto' | 'manual';
  corners: 'sharp' | 'rounded' | 'pill';
  color: string;
  label?: Label;
}

export type ConnectorHead = 'none' | 'triangle' | 'arrow' | 'circle' | 'square';
export type ConnectorRoute = 'sharp' | 'elbow';

export interface ConnectorEl {
  kind: 'connector'; id: string;
  fromId: string; toId: string;
  style: 'solid' | 'dashed' | 'dotted';
  /** Missing values in existing documents are treated as 'none'. */
  startHead?: ConnectorHead;
  /** Missing values in existing documents are treated as the current arrow default. */
  endHead?: ConnectorHead;
  /** Missing values in existing documents are treated as 'sharp'. */
  route?: ConnectorRoute;
  color: string;
  label?: string;
}

export interface TagEl {
  kind: 'tag'; id: string;
  attachedTo?: string;
  gridX: number; gridY: number;
  text: string; color: string;
  style: 'bubble' | 'tips';
  parentId?: string;
  icon?: string;
}

export interface TextEl {
  kind: 'text'; id: string;
  gridX: number; gridY: number;
  content: string;
  title?: string;
  variant: 'plain' | 'callout';
  parentId?: string;
}

export type Element = AssetEl | FloorEl | ConnectorEl | TagEl | TextEl;
