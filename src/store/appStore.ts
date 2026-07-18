import { create } from 'zustand';

interface AppState {
  docId: string | null;
  openDoc: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  docId: null,
  openDoc: (docId) => set({ docId }),
}));
