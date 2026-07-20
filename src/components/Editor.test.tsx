import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { loadDoc } from '../storage/local';
import { useAppStore } from '../store/appStore';
import { Editor } from './Editor';

describe('Editor', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useAppStore.setState({ docId: null });
  });

  it('creates and opens a canvas when the requested doc does not exist', () => {
    useAppStore.setState({ docId: 'missing' });
    render(<Editor docId="missing" />);
    const docId = useAppStore.getState().docId;
    expect(docId).toBeTruthy();
    expect(docId).not.toBe('missing');
    expect(loadDoc(docId!)).toBeTruthy();
  });
});
