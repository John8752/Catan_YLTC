import type { Group, Object3D } from "three";
import { release } from "./models.js";

/** Retain GPU resources for unchanged pawns/targets between scene updates. */
export class KeyedObjects {
  private readonly objects = new Map<string, { signature: string; object: Group }>();
  private seen = new Set<string>();
  created = 0;
  constructor(private parent: Object3D, private removed: (object: Group) => void = () => {}) {}
  begin() { this.seen.clear(); }
  use(key: string, signature: string, create: () => Group): Group {
    this.seen.add(key);
    const old = this.objects.get(key);
    if (old?.signature === signature) return old.object;
    if (old) { this.removed(old.object); release(old.object); }
    const object = create(); this.parent.add(object); this.created++;
    this.objects.set(key, { signature, object }); return object;
  }
  end() {
    for (const [key, entry] of this.objects) if (!this.seen.has(key)) { this.removed(entry.object); release(entry.object); this.objects.delete(key); }
  }
}
