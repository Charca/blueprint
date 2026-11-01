import { create } from 'zustand';

export interface LabelTuning {
  assetAnchorX: number;
  assetAnchorY: number;
  assetEdgeOffset: number;
  assetAwayX: number;
  assetAwayY: number;
  floorGap: number;
  floorOffsetX: number;
  floorOffsetY: number;
  tagInlinePadding: number;
  tagOneLineHeight: number;
  tagTwoLineHeight: number;
  tagOutlineWidth: number;
  tagTextBaseline: number;
  labelLineHeight: number;
  labelWrapAt: number;
  textBaseline: number;
}

export const DEFAULT_LABEL_TUNING: LabelTuning = {
  assetAnchorX: 60,
  assetAnchorY: 129,
  assetEdgeOffset: 25,
  assetAwayX: 5,
  assetAwayY: 8.7,
  floorGap: 42,
  floorOffsetX: 0,
  floorOffsetY: 0,
  tagInlinePadding: 14,
  tagOneLineHeight: 28,
  tagTwoLineHeight: 44,
  tagOutlineWidth: 3,
  tagTextBaseline: 4.5,
  labelLineHeight: 16,
  labelWrapAt: 24,
  textBaseline: 5,
};

interface LabelTuningState extends LabelTuning {
  setValue: (key: keyof LabelTuning, value: number) => void;
  reset: () => void;
}

const STORAGE_KEY = 'blueprint:dev:label-tuning';

function loadTuning(): LabelTuning {
  if (!import.meta.env.DEV || typeof localStorage === 'undefined') return DEFAULT_LABEL_TUNING;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<LabelTuning>;
    return Object.fromEntries(
      Object.entries(DEFAULT_LABEL_TUNING).map(([key, fallback]) => [
        key,
        typeof saved[key as keyof LabelTuning] === 'number' ? saved[key as keyof LabelTuning] : fallback,
      ]),
    ) as unknown as LabelTuning;
  } catch {
    return DEFAULT_LABEL_TUNING;
  }
}

export const useLabelTuningStore = create<LabelTuningState>((set) => ({
  ...loadTuning(),
  setValue: (key, value) => set({ [key]: value }),
  reset: () => set(DEFAULT_LABEL_TUNING),
}));

if (import.meta.env.DEV && typeof localStorage !== 'undefined') {
  useLabelTuningStore.subscribe((state) => {
    const values = Object.fromEntries(
      Object.keys(DEFAULT_LABEL_TUNING).map((key) => [key, state[key as keyof LabelTuning]]),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  });
}
