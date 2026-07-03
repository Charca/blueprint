import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useAppStore } from '../store/appStore';
import { Editor } from './Editor';

describe('Editor', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('falls back to home when the doc does not exist', () => {
    useAppStore.setState({ docId: 'missing' });
    render(<Editor docId="missing" />);
    expect(useAppStore.getState().docId).toBeNull();
  });
});
