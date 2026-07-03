import {
  Box, Boxes, Files, Layers, Network, Package, PcCase, Server,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const TOP_ICONS: Record<string, LucideIcon> = {
  'cube-plain': Box,
  'cube-server': Server,
  'cube-pc': PcCase,
  'cube-box': Package,
  'cube-documents': Files,
  'cube-monolith': Layers,
  'cube-infra': Boxes,
  'cube-infra-filled': Boxes,
  'cube-tree': Network,
};

export const iconFor = (assetId: string): LucideIcon => TOP_ICONS[assetId] ?? Box;
