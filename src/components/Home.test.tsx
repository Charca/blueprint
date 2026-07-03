import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
});
