import type { Doc, Element } from '../model/types';

const INDEX_KEY = 'blueprint:index';
const PREVIEW_SEED_UPDATED_AT = Date.UTC(2026, 6, 8, 12, 0, 0);
const PREVIEW_SEED_QUERY = 'bp-preview-seeds';

interface SeedOptions {
  enabled?: boolean;
}

interface LocationLike {
  hostname: string;
  search: string;
}

const docKey = (id: string) => `blueprint:doc:${id}`;

function asset(
  id: string,
  assetId: string,
  gridX: number,
  gridY: number,
  color: string,
  label: string,
  parentId?: string,
): Element {
  return {
    kind: 'asset',
    id,
    assetId,
    gridX,
    gridY,
    color,
    parentId,
    label: { text: label, style: 'tag', color, orientation: 'right' },
  };
}

function connector(
  id: string,
  fromId: string,
  toId: string,
  style: 'solid' | 'dashed' | 'dotted',
  color: string,
  label?: string,
): Element {
  return { kind: 'connector', id, fromId, toId, style, color, label };
}

export function isCloudflarePreviewEnvironment(location: LocationLike = window.location): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get(PREVIEW_SEED_QUERY) === '1') return true;

  const hostname = location.hostname.toLowerCase();
  const firstLabel = hostname.split('.')[0] ?? '';
  return hostname.endsWith('.workers.dev') &&
    firstLabel !== 'blueprint' &&
    firstLabel.endsWith('-blueprint');
}

export function createPreviewSeedDocs(): Doc[] {
  return [
    {
      id: 'preview-seed-architecture',
      name: 'PR Preview Architecture',
      schemaVersion: 1,
      view: { rotation: 0, mode: 'iso' },
      camera: { x: 0, y: 0, zoom: 0.9 },
      elements: [
        {
          kind: 'floor',
          id: 'arch-floor-platform',
          gridX: -5,
          gridY: -3,
          width: 11,
          depth: 8,
          corners: 'rounded',
          color: '#d9f0e6',
          label: { text: 'Preview platform', style: 'tag', color: '#2f8f68', orientation: 'left' },
        },
        asset('arch-web', 'cube-pc', -4, -1, '#3f7ef3', 'Web', 'arch-floor-platform'),
        asset('arch-api', 'cube-server', -1, -1, '#16a3a3', 'API', 'arch-floor-platform'),
        asset('arch-worker', 'cube-infra', 2, -1, '#7259d9', 'Worker', 'arch-floor-platform'),
        asset('arch-db', 'cube-documents', 4, 2, '#d97706', 'Docs', 'arch-floor-platform'),
        asset('arch-cache', 'cube-box', 1, 3, '#e24f73', 'Cache', 'arch-floor-platform'),
        asset('arch-observability', 'cube-tree', -3, 3, '#26966f', 'Events', 'arch-floor-platform'),
        connector('arch-c-web-api', 'arch-web', 'arch-api', 'solid', '#2563eb', 'HTTP'),
        connector('arch-c-api-worker', 'arch-api', 'arch-worker', 'dashed', '#7c3aed', 'QUEUE'),
        connector('arch-c-worker-db', 'arch-worker', 'arch-db', 'solid', '#ca8a04', 'WRITE'),
        connector('arch-c-worker-cache', 'arch-worker', 'arch-cache', 'dotted', '#db2777', 'CACHE'),
        connector('arch-c-api-events', 'arch-api', 'arch-observability', 'dashed', '#059669', 'TRACE'),
        {
          kind: 'tag',
          id: 'arch-tag-preview',
          attachedTo: 'arch-worker',
          gridX: 2,
          gridY: -3,
          text: 'PR preview',
          color: '#111827',
          style: 'bubble',
          icon: 'Rocket',
        },
        {
          kind: 'text',
          id: 'arch-callout',
          gridX: -4,
          gridY: 5,
          variant: 'callout',
          title: 'Ready to test',
          content: 'Seeded canvases cover assets, floors, labels, connectors, tags, and callouts without replacing saved work.',
        },
      ],
    },
    {
      id: 'preview-seed-topology',
      name: 'Service Topology',
      schemaVersion: 1,
      view: { rotation: 0, mode: 'iso' },
      camera: { x: 16, y: 24, zoom: 1 },
      elements: [
        {
          kind: 'floor',
          id: 'topo-floor-edge',
          gridX: -5,
          gridY: -4,
          width: 5,
          depth: 5,
          corners: 'pill',
          color: '#e7eefc',
          label: { text: 'Edge', style: 'text', color: '#334155', orientation: 'left' },
        },
        {
          kind: 'floor',
          id: 'topo-floor-core',
          gridX: 1,
          gridY: -3,
          width: 6,
          depth: 6,
          corners: 'rounded',
          color: '#f1e7ff',
          label: { text: 'Core services', style: 'tag', color: '#7c3aed', orientation: 'right' },
        },
        asset('topo-client', 'cube-pc', -4, -2, '#2563eb', 'Client', 'topo-floor-edge'),
        asset('topo-router', 'cube-infra-filled', -2, 0, '#0891b2', 'Router', 'topo-floor-edge'),
        asset('topo-auth', 'cube-server', 2, -1, '#7c3aed', 'Auth', 'topo-floor-core'),
        asset('topo-billing', 'cube-monolith', 4, 1, '#e11d48', 'Billing', 'topo-floor-core'),
        asset('topo-ledger', 'cube-documents', 2, 3, '#ca8a04', 'Ledger', 'topo-floor-core'),
        asset('topo-events', 'cube-tree', 6, -2, '#059669', 'Events', 'topo-floor-core'),
        connector('topo-c-client-router', 'topo-client', 'topo-router', 'solid', '#2563eb', 'TLS'),
        connector('topo-c-router-auth', 'topo-router', 'topo-auth', 'dashed', '#7c3aed', 'OIDC'),
        connector('topo-c-auth-billing', 'topo-auth', 'topo-billing', 'dotted', '#e11d48', 'JWT'),
        connector('topo-c-billing-ledger', 'topo-billing', 'topo-ledger', 'solid', '#ca8a04', 'POST'),
        connector('topo-c-billing-events', 'topo-billing', 'topo-events', 'dashed', '#059669', 'PUB'),
        {
          kind: 'tag',
          id: 'topo-tag-slo',
          gridX: 5,
          gridY: 4,
          text: '99.9 SLO',
          color: '#dcfce7',
          style: 'tips',
        },
        {
          kind: 'text',
          id: 'topo-note',
          gridX: -4,
          gridY: 3,
          content: 'Dashed paths show async or delegated calls.',
          variant: 'plain',
        },
      ],
    },
    {
      id: 'preview-seed-sampler',
      name: 'Design System Sampler',
      schemaVersion: 1,
      view: { rotation: 0, mode: 'iso' },
      camera: { x: -20, y: 10, zoom: 1 },
      elements: [
        {
          kind: 'floor',
          id: 'sampler-floor',
          gridX: -4,
          gridY: -3,
          width: 9,
          depth: 6,
          corners: 'sharp',
          color: '#fff1d6',
          label: { text: 'Color variants', style: 'tag', color: '#c2410c', orientation: 'left' },
        },
        asset('sampler-blue', 'cube-box', -3, -1, '#3258c2', 'Blue', 'sampler-floor'),
        asset('sampler-green', 'cube-server', -1, -1, '#15803d', 'Green', 'sampler-floor'),
        asset('sampler-pink', 'cube-infra', 1, -1, '#db2777', 'Pink', 'sampler-floor'),
        asset('sampler-amber', 'cube-documents', 3, -1, '#d97706', 'Amber', 'sampler-floor'),
        asset('sampler-tree', 'cube-tree', -2, 2, '#0f766e', 'Tree', 'sampler-floor'),
        asset('sampler-mono', 'cube-monolith', 2, 2, '#4f46e5', 'Mono', 'sampler-floor'),
        connector('sampler-c-blue-green', 'sampler-blue', 'sampler-green', 'solid', '#3258c2', 'SOLID'),
        connector('sampler-c-green-pink', 'sampler-green', 'sampler-pink', 'dashed', '#15803d', 'DASH'),
        connector('sampler-c-pink-amber', 'sampler-pink', 'sampler-amber', 'dotted', '#db2777', 'DOT'),
        connector('sampler-c-tree-mono', 'sampler-tree', 'sampler-mono', 'solid', '#0f766e'),
        {
          kind: 'tag',
          id: 'sampler-bubble',
          attachedTo: 'sampler-pink',
          gridX: 1,
          gridY: -3,
          text: 'Bubble tag',
          color: '#fbcfe8',
          style: 'bubble',
          icon: 'Sparkles',
        },
        {
          kind: 'tag',
          id: 'sampler-tip',
          attachedTo: 'sampler-tree',
          gridX: -3,
          gridY: 4,
          text: 'Tips tag',
          color: '#ccfbf1',
          style: 'tips',
        },
        {
          kind: 'text',
          id: 'sampler-callout',
          gridX: 4,
          gridY: 3,
          variant: 'callout',
          title: 'Sampler',
          content: 'Open this canvas to confirm labels, tags, connector styles, and recolored kit assets render correctly.',
        },
      ],
    },
  ];
}

export function seedPreviewDocsIfNeeded(options: SeedOptions = {}): boolean {
  const enabled = options.enabled ?? isCloudflarePreviewEnvironment();
  if (!enabled) return false;

  const currentIndex = localStorage.getItem(INDEX_KEY);
  if (currentIndex) {
    try {
      if ((JSON.parse(currentIndex) as unknown[]).length > 0) return false;
    } catch {
      return false;
    }
  }

  const docs = createPreviewSeedDocs();
  for (const doc of docs) {
    localStorage.setItem(docKey(doc.id), JSON.stringify(doc));
  }
  localStorage.setItem(INDEX_KEY, JSON.stringify(docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    updatedAt: PREVIEW_SEED_UPDATED_AT,
  }))));
  return true;
}
