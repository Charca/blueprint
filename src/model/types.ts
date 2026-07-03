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
  label?: Label;
}

export interface FloorEl {
  kind: 'floor'; id: string;
  gridX: number; gridY: number;
  width: number; depth: number;
  corners: 'sharp' | 'rounded' | 'pill';
  color: string;
  label?: Label;
}

export interface ConnectorEl {
  kind: 'connector'; id: string;
  fromId: string; toId: string;
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
  label?: string;
}

export interface TagEl {
  kind: 'tag'; id: string;
  attachedTo?: string;
  gridX: number; gridY: number;
  text: string; color: string;
  style: 'bubble' | 'tips';
  icon?: string;
}

export interface TextEl {
  kind: 'text'; id: string;
  gridX: number; gridY: number;
  content: string;
  title?: string;
  variant: 'plain' | 'callout';
}

export type Element = AssetEl | FloorEl | ConnectorEl | TagEl | TextEl;
