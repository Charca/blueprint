import { derivePalette } from './color';
import type { AssetDef } from '../generated/assets';

const cache = new Map<string, string>();

export function instanceMarkup(def: AssetDef, instanceId: string, color: string): string {
  const key = `${def.id}|${instanceId}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let m = def.markup.replaceAll('__BP__', `${instanceId}-`);
  for (const [ref, out] of Object.entries(derivePalette(color))) {
    m = m.replace(new RegExp(ref, 'gi'), out);
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, m);
  return m;
}
