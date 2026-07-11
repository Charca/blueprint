import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { serializeBlueprint } from '../importExport/blueprint';
import { createDoc, listDocs, loadDoc, saveDoc } from '../storage/local';
import { useAppStore } from '../store/appStore';
import { Home } from './Home';

describe('Home', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useAppStore.setState({ docId: null });
  });

  afterEach(() => vi.restoreAllMocks());

  it('lists existing canvases', () => {
    createDoc('Payments infra');
    render(<Home />);
    expect(screen.getByText('Payments infra')).toBeTruthy();
  });

  it('creates and opens a new canvas', () => {
    render(<Home />);
    fireEvent.click(screen.getByText('New canvas'));
    expect(useAppStore.getState().docId).toBeTruthy();
  });

  it('opens a canvas on card click', () => {
    const doc = createDoc('Target');
    render(<Home />);
    fireEvent.click(screen.getByText('Target'));
    expect(useAppStore.getState().docId).toBe(doc.id);
  });

  it('imports a JSON file as a distinct new canvas and opens it', async () => {
    const source = createDoc('Imported topology');
    const file = new File([serializeBlueprint(source)], 'topology.blueprint.json', { type: 'application/json' });
    const { container } = render(<Home />);

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

    await waitFor(() => expect(useAppStore.getState().docId).toBeTruthy());
    expect(useAppStore.getState().docId).not.toBe(source.id);
  });

  it('persists and reopens imported canvas data', async () => {
    const source = {
      ...createDoc('Imported topology'),
      elements: [{ kind: 'floor' as const, id: 'floor', gridX: 1, gridY: 2, width: 3, depth: 4, corners: 'sharp' as const, color: '#ffffff' }],
    };
    saveDoc(source);
    const file = new File([serializeBlueprint(source)], 'topology.blueprint.json', { type: 'application/json' });
    localStorage.clear();
    const { container } = render(<Home />);

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

    await waitFor(() => expect(useAppStore.getState().docId).toBeTruthy());
    const importedId = useAppStore.getState().docId!;
    expect(loadDoc(importedId)).toMatchObject({ ...source, id: importedId });
    expect(listDocs()).toMatchObject([{ id: importedId, name: source.name }]);
  });

  it('creates fresh documents for repeated imports', async () => {
    const source = createDoc('Repeated import');
    const file = new File([serializeBlueprint(source)], 'topology.blueprint.json', { type: 'application/json' });
    localStorage.clear();
    const { container } = render(<Home />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(useAppStore.getState().docId).toBeTruthy());
    const firstId = useAppStore.getState().docId!;
    useAppStore.setState({ docId: null });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(useAppStore.getState().docId).toBeTruthy());
    const secondId = useAppStore.getState().docId!;

    expect(secondId).not.toBe(firstId);
    expect(listDocs()).toHaveLength(2);
    expect(loadDoc(firstId)).toBeTruthy();
    expect(loadDoc(secondId)).toBeTruthy();
  });

  it('shows an error and does not open a canvas when the import cannot be saved', async () => {
    const source = createDoc('Storage failure');
    const file = new File([serializeBlueprint(source)], 'topology.blueprint.json', { type: 'application/json' });
    localStorage.clear();
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith('blueprint:doc:')) throw new Error('storage unavailable');
      return setItem.call(this, key, value);
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { container } = render(<Home />);

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

    expect((await screen.findByRole('alert')).textContent).toContain('Could not save the imported canvas');
    expect(useAppStore.getState().docId).toBeNull();
  });

  it('shows an error and does not open a canvas for invalid JSON', async () => {
    const file = new File(['{broken'], 'bad.blueprint.json', { type: 'application/json' });
    const { container } = render(<Home />);

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

    expect((await screen.findByRole('alert')).textContent).toContain('not valid JSON');
    expect(useAppStore.getState().docId).toBeNull();
  });
});
