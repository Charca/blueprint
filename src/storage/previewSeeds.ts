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
      id: 'preview-seed-screenshot',
      name: 'Screenshot Layout',
      schemaVersion: 1,
      view: { rotation: 0, mode: 'iso' },
      camera: { x: 0, y: 0, zoom: 1 },
      elements: [
        {
          kind: 'floor',
          id: 'shot-floor',
          gridX: -3,
          gridY: -2,
          width: 7,
          depth: 5,
          corners: 'rounded',
          color: '#dbeafe',
          label: { text: 'Main system', style: 'tag', color: '#2563eb', orientation: 'left' },
        },
        asset('shot-app', 'cube-pc', -2, -1, '#3258c2', 'App', 'shot-floor'),
        asset('shot-api', 'cube-server', 0, 0, '#16a3a3', 'API', 'shot-floor'),
        asset('shot-data', 'cube-documents', 2, -1, '#d97706', 'Data', 'shot-floor'),
        asset('shot-jobs', 'cube-infra', 1, 2, '#7c3aed', 'Jobs', 'shot-floor'),
        connector('shot-c-app-api', 'shot-app', 'shot-api', 'solid', '#2563eb', 'HTTP'),
        connector('shot-c-api-data', 'shot-api', 'shot-data', 'solid', '#d97706', 'SQL'),
        connector('shot-c-api-jobs', 'shot-api', 'shot-jobs', 'dashed', '#7c3aed', 'QUEUE'),
        {
          kind: 'tag',
          id: 'shot-tag',
          attachedTo: 'shot-api',
          gridX: 0,
          gridY: -2,
          text: 'Preview',
          color: '#cffafe',
          style: 'bubble',
          icon: 'Sparkles',
        },
      ],
    },
    {
      id: 'preview-seed-release',
      name: 'Release Flow',
      schemaVersion: 1,
      view: { rotation: 0, mode: 'iso' },
      camera: { x: 10, y: 8, zoom: 1 },
      elements: [
        {
          kind: 'floor',
          id: 'release-floor',
          gridX: -4,
          gridY: -2,
          width: 8,
          depth: 5,
          corners: 'pill',
          color: '#dcfce7',
          label: { text: 'Deploy path', style: 'tag', color: '#16a34a', orientation: 'right' },
        },
        asset('release-src', 'cube-box', -3, 0, '#16a34a', 'Source', 'release-floor'),
        asset('release-build', 'cube-infra-filled', -1, -1, '#0891b2', 'Build', 'release-floor'),
        asset('release-worker', 'cube-server', 1, 0, '#7c3aed', 'Worker', 'release-floor'),
        asset('release-edge', 'cube-tree', 3, 1, '#ea580c', 'Edge', 'release-floor'),
        connector('release-c-src-build', 'release-src', 'release-build', 'solid', '#16a34a', 'PUSH'),
        connector('release-c-build-worker', 'release-build', 'release-worker', 'dashed', '#7c3aed', 'CI'),
        connector('release-c-worker-edge', 'release-worker', 'release-edge', 'solid', '#ea580c', 'LIVE'),
        {
          kind: 'text',
          id: 'release-note',
          gridX: -3,
          gridY: 3,
          variant: 'plain',
          content: 'Small seed for checking labels, arrows, and floor membership.',
        },
      ],
    },
    {
      id: 'preview-seed-support',
      name: 'Support Map',
      schemaVersion: 1,
      view: { rotation: 0, mode: 'iso' },
      camera: { x: -12, y: 6, zoom: 1 },
      elements: [
        {
          kind: 'floor',
          id: 'support-floor',
          gridX: -3,
          gridY: -3,
          width: 7,
          depth: 6,
          corners: 'sharp',
          color: '#fae8ff',
          label: { text: 'Support loop', style: 'tag', color: '#c026d3', orientation: 'left' },
        },
        asset('support-user', 'cube-pc', -2, -1, '#db2777', 'User', 'support-floor'),
        asset('support-help', 'cube-monolith', 0, -1, '#9333ea', 'Help', 'support-floor'),
        asset('support-docs', 'cube-documents', 2, 0, '#ca8a04', 'Docs', 'support-floor'),
        asset('support-team', 'cube-server', 0, 2, '#0f766e', 'Team', 'support-floor'),
        connector('support-c-user-help', 'support-user', 'support-help', 'solid', '#db2777', 'ASK'),
        connector('support-c-help-docs', 'support-help', 'support-docs', 'dotted', '#ca8a04', 'FIND'),
        connector('support-c-help-team', 'support-help', 'support-team', 'dashed', '#0f766e', 'ESC'),
        {
          kind: 'tag',
          id: 'support-tag',
          attachedTo: 'support-team',
          gridX: -1,
          gridY: 3,
          text: 'SLA',
          color: '#ccfbf1',
          style: 'tips',
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
