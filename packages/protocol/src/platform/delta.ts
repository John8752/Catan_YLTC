/** Transport value helpers. Game modules choose their own fields and keys. */
export interface EntityDelta<T> { readonly remove: readonly string[]; readonly upsert: readonly T[]; readonly order?: readonly string[] }
export const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
export function changedFields<T extends object>(before: T, after: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T)[]) if (!sameValue(before[key], after[key])) result[key] = after[key];
  return result;
}
export function entityDelta<T>(before: readonly T[], after: readonly T[], key: (item: T) => string): EntityDelta<T> | undefined {
  if (before === after) return undefined;
  const old = new Map(before.map(item => [key(item), item])), next = new Set(after.map(key));
  const remove = before.map(key).filter(id => !next.has(id)), upsert = after.filter(item => !old.has(key(item)) || !sameValue(old.get(key(item)), item));
  const natural = before.map(key).filter(id => next.has(id)).concat(upsert.map(key).filter(id => !old.has(id)));
  const order = sameValue(natural, after.map(key)) ? undefined : after.map(key);
  return remove.length || upsert.length || order ? { remove, upsert, ...(order ? { order } : {}) } : undefined;
}
export function applyEntities<T>(before: readonly T[], delta: EntityDelta<T> | undefined, key: (item: T) => string): readonly T[] {
  if (!delta) return before;
  const items = new Map(before.map(item => [key(item), item]));
  for (const id of delta.remove) items.delete(id);
  for (const item of delta.upsert) items.set(key(item), item);
  if (!delta.order) return [...items.values()];
  if (delta.order.length !== items.size || new Set(delta.order).size !== items.size || delta.order.some(id => !items.has(id))) throw new Error("Invalid entity ordering");
  return delta.order.map(id => items.get(id)!);
}
