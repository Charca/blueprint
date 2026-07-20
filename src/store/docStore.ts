import { create } from 'zustand';
import { loadDoc, markDocOpened, saveDoc } from '../storage/local';
import type { Camera, Doc, Element } from '../model/types';
import type { ViewState } from '../lib/projection';

export type Tool = 'select' | 'pan' | 'connect';

interface DocState {
  doc: Doc | null;
  selection: string[];
  placing: string | null;
  tool: Tool;
  connectFrom: string | null;
  past: Element[][];
  future: Element[][];
  snapshot: Element[] | null;
  openDoc: (id: string) => void;
  closeDoc: (save?: boolean) => void;
  setName: (name: string) => void;
  setView: (view: ViewState) => void;
  setCamera: (camera: Camera) => void;
  apply: (fn: (els: Element[]) => Element[]) => void;
  applyTransient: (fn: (els: Element[]) => Element[]) => void;
  beginTransient: () => void;
  commitTransient: () => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  setPlacing: (placing: string | null) => void;
  setTool: (tool: Tool) => void;
  setConnectFrom: (id: string | null) => void;
}

const HISTORY_CAP = 50;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingDoc: Doc | null = null;

function persistSoon(doc: Doc): void {
  clearTimeout(saveTimer);
  pendingDoc = doc;
  saveTimer = setTimeout(() => {
    pendingDoc = null;
    saveDoc(doc);
  }, 300);
}

function flushPendingSave(): void {
  clearTimeout(saveTimer);
  if (pendingDoc) {
    saveDoc(pendingDoc);
    pendingDoc = null;
  }
}

function cancelPendingSave(): void {
  clearTimeout(saveTimer);
  pendingDoc = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPendingSave);
}

export const useDocStore = create<DocState>((set, get) => ({
  doc: null,
  selection: [],
  placing: null,
  tool: 'select',
  connectFrom: null,
  past: [],
  future: [],
  snapshot: null,

  openDoc: (id) => {
    flushPendingSave();
    const doc = loadDoc(id);
    if (doc) markDocOpened(id);
    return set({
      doc, selection: [], placing: null, tool: 'select',
      connectFrom: null, past: [], future: [], snapshot: null,
    });
  },

  closeDoc: (save = true) => {
    if (save) flushPendingSave();
    else cancelPendingSave();
    const { doc } = get();
    if (save && doc) saveDoc(doc);
    set({ doc: null, selection: [], past: [], future: [], snapshot: null });
  },

  setName: (name) => {
    const { doc } = get();
    if (!doc) return;
    const next = { ...doc, name };
    persistSoon(next);
    set({ doc: next });
  },

  setView: (view) => {
    const { doc } = get();
    if (!doc) return;
    const next = { ...doc, view };
    persistSoon(next);
    set({ doc: next });
  },

  setCamera: (camera) => {
    const { doc } = get();
    if (!doc) return;
    const next = { ...doc, camera };
    persistSoon(next);
    set({ doc: next });
  },

  apply: (fn) => {
    const { doc } = get();
    if (!doc) return;
    const elements = fn(doc.elements);
    if (elements === doc.elements) return;
    const next = { ...doc, elements };
    persistSoon(next);
    set((s) => ({ doc: next, past: [...s.past.slice(-(HISTORY_CAP - 1)), doc.elements], future: [] }));
  },

  applyTransient: (fn) => {
    const { doc } = get();
    if (!doc) return;
    const next = { ...doc, elements: fn(doc.elements) };
    persistSoon(next);
    set({ doc: next });
  },

  beginTransient: () => set((s) => ({ snapshot: s.doc?.elements ?? null })),

  commitTransient: () => set((s) => {
    const { snapshot } = s;
    if (!snapshot || !s.doc || snapshot === s.doc.elements) return { snapshot: null };
    return {
      snapshot: null,
      past: [...s.past.slice(-(HISTORY_CAP - 1)), snapshot],
      future: [],
    };
  }),

  undo: () => set((s) => {
    if (!s.doc || s.past.length === 0) return {};
    const prev = s.past[s.past.length - 1];
    const doc = { ...s.doc, elements: prev };
    persistSoon(doc);
    return { doc, past: s.past.slice(0, -1), future: [s.doc.elements, ...s.future], selection: [] };
  }),

  redo: () => set((s) => {
    if (!s.doc || s.future.length === 0) return {};
    const next = s.future[0];
    const doc = { ...s.doc, elements: next };
    persistSoon(doc);
    return { doc, past: [...s.past, s.doc.elements], future: s.future.slice(1), selection: [] };
  }),

  select: (selection) => set({ selection }),
  setPlacing: (placing) => set({ placing, tool: 'select', connectFrom: null }),
  setTool: (tool) => set({ tool, placing: null, connectFrom: null }),
  setConnectFrom: (connectFrom) => set({ connectFrom }),
}));
