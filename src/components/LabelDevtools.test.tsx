import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_LABEL_TUNING, useLabelTuningStore } from '../store/labelTuningStore';
import { LabelDevtools } from './LabelDevtools';

describe('LabelDevtools', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useLabelTuningStore.getState().reset();
  });

  it('opens from a compact toggle and edits exact tuning values', () => {
    const { container } = render(<LabelDevtools />);
    fireEvent.click(screen.getByRole('button', { name: 'Open label tuning' }));
    expect(screen.getByText('Local development only')).toBeTruthy();

    const anchorX = container.querySelector(
      '.bp-label-devtools-control input[type="number"]',
    ) as HTMLInputElement;
    fireEvent.change(anchorX, { target: { value: '64.5' } });
    expect(useLabelTuningStore.getState().assetAnchorX).toBe(64.5);
    expect(localStorage.getItem('blueprint:dev:label-tuning')).toContain('64.5');
  });

  it('restores all defaults', () => {
    useLabelTuningStore.getState().setValue('floorGap', 75);
    render(<LabelDevtools />);
    fireEvent.click(screen.getByRole('button', { name: 'Open label tuning' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset label tuning' }));
    expect(useLabelTuningStore.getState().floorGap).toBe(DEFAULT_LABEL_TUNING.floorGap);
  });
});
