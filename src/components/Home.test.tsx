import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { serializeBlueprint } from '../importExport/blueprint';
import { createDoc } from '../storage/local';
import { useAppStore } from '../store/appStore';
import { Home } from './Home';

describe('Home', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useAppStore.setState({ docId: null });
  });

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

  it('shows an error and does not open a canvas for invalid JSON', async () => {
    const file = new File(['{broken'], 'bad.blueprint.json', { type: 'application/json' });
    const { container } = render(<Home />);

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

    expect((await screen.findByRole('alert')).textContent).toContain('not valid JSON');
    expect(useAppStore.getState().docId).toBeNull();
  });
});
