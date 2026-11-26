import { expect, it, vi } from "vitest";
import * as T from "three";
import { KeyedObjects } from "./keyed-objects.js";
import { pawnModel } from "./models.js";
it("retains pawn geometry across updates and disposes only removed/replaced objects", () => {
  const parent = new T.Group(), removed = vi.fn(), pool = new KeyedObjects(parent, removed);
  const create = vi.fn(() => pawnModel("#334455"));
  pool.begin(); const a = pool.use("a", "blue", create), b = pool.use("b", "blue", create); pool.end();
  const geometry = (a.children[0] as T.Mesh).geometry, dispose = vi.spyOn(geometry, "dispose");
  for (let i = 0; i < 20; i++) { pool.begin(); expect(pool.use("a", "blue", create)).toBe(a); expect(pool.use("b", "blue", create)).toBe(b); pool.end(); }
  expect(create).toHaveBeenCalledTimes(2); expect(dispose).not.toHaveBeenCalled();
  pool.begin(); pool.use("b", "blue", create); pool.end(); expect(dispose).toHaveBeenCalledOnce(); expect(parent.children).toEqual([b]);
  pool.begin(); expect(pool.use("b", "red", create)).not.toBe(b); pool.end(); expect(removed).toHaveBeenCalledTimes(2);
  pool.begin(); pool.end(); expect(parent.children).toEqual([]);
});
