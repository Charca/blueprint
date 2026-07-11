import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Doc } from '../model/types';
import { useDocStore } from '../store/docStore';
import { TopBar } from './TopBar';

const { download } = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('../export/png', () => ({ download, svgToPngBlob: vi.fn() }));

const doc: Doc = {
  id: 'local',
  name: 'Production network',
  schemaVersion: 1,
  view: { mode: 'iso', rotation: 0 },
  camera: { x: 0, y: 0, zoom: 1 },
  elements: [],
};

describe('TopBar JSON export', () => {
  beforeEach(() => {
    download.mockReset();
    useDocStore.setState({ doc });
  });

  it('downloads the portable JSON envelope', async () => {
    render(<TopBar />);
    fireEvent.click(screen.getByTitle('Export JSON'));
    const [filename, blob] = download.mock.calls[0] as [string, Blob];
    expect(filename).toBe('Production network.blueprint.json');
    expect(blob.type).toBe('application/json');
    expect(JSON.parse(await blob.text())).toMatchObject({
      format: 'blueprint',
      formatVersion: 1,
      document: { name: doc.name, view: doc.view, camera: doc.camera },
    });
  });
});
