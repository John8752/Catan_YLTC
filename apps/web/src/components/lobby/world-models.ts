import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const mat = (color: string, roughness = .7) => new T.MeshStandardMaterial({ color, roughness, metalness: .02 });
export function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) {
  const result = new T.Mesh(geometry, material);
  result.position.set(x, y, z); result.castShadow = true; result.receiveShadow = true; parent.add(result); return result;
}
export function box(parent: T.Object3D, size: [number, number, number], color: string, x = 0, y = 0, z = 0, radius = .08) {
  return mesh(parent, new RoundedBoxGeometry(...size, 2, radius), mat(color), x, y, z);
}
export function disc(parent: T.Object3D, radius: number, height: number, color: string, x = 0, y = 0, z = 0, sides = 64) {
  return mesh(parent, new T.CylinderGeometry(radius, radius, height, sides), mat(color), x, y, z);
}
export function tree(parent: T.Object3D, x: number, z: number, scale = 1, base = .5) {
  const group = new T.Group(); parent.add(group); group.position.set(x, base, z); group.scale.setScalar(scale);
  disc(group, .065, .45, "#9c7149", 0, .2);
  for (let i = 0; i < 3; i++) mesh(group, new T.ConeGeometry(.32 - i * .06, .55, 7), mat(i % 2 ? "#538b6a" : "#2b6653"), 0, .45 + i * .22);
}
export function house(parent: T.Object3D, x: number, z: number, color: string, scale = 1, base = .55) {
  const group = new T.Group(); parent.add(group); group.position.set(x, base, z); group.scale.setScalar(scale);
  box(group, [.48, .45, .5], "#f3dfb0", 0, .23);
  const roof = mesh(group, new T.CylinderGeometry(.42, .42, .63, 3), mat(color), 0, .55); roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
  box(group, [.12, .25, .025], "#745845", 0, .15, .26, .01);
}
export function die(parent: T.Object3D, x: number, z: number, color = "#fff1cf", angle = .2) {
  const g = new T.Group(); parent.add(g); g.position.set(x, .75, z); g.rotation.y = angle;
  box(g, [.6, .6, .6], color, 0, 0, 0, .08);
  for (const [px, pz] of [[-.15, -.15], [.15, .15], [.15, -.15], [-.15, .15]]) disc(g, .042, .008, "#38534d", px, .305, pz, 12);
  return g;
}
export function release(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    geometries.add(object.geometry);
    for (const m of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(m); if (m instanceof T.MeshStandardMaterial && m.map) textures.add(m.map); }
  });
  geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose());
}
