import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createDoc } from '../storage/local';
import { useAppStore } from '../store/appStore';
import { Home } from './Home';

describe('Home', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    window.history.pushState({}, '', '/');
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

  it('lists preview seed canvases for an empty preview workspace', () => {
    window.history.pushState({}, '', '/?bp-preview-seeds=1');
    render(<Home />);
    expect(screen.getByText('PR Preview Architecture')).toBeTruthy();
    expect(screen.getByText('Service Topology')).toBeTruthy();
    expect(screen.getByText('Design System Sampler')).toBeTruthy();
  });
});
