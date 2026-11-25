import { tileDefinition, type FeatureDefinition } from "@catan/game-core/carcassonne";

export interface FeatureShape { readonly id: string; readonly path: string; readonly rotation: number; readonly x: number; readonly y: number }
const ends = [[50,0],[100,50],[50,100],[0,50]] as const;
/** Original drawing geometry. Connectivity and eligibility are never inferred here. */
export function featureShape(type: string, f: FeatureDefinition): FeatureShape {
  const definition = tileDefinition(type), city = definition.features.find((g) => g.kind === "city");
  if (f.kind === "monastery") return { id: f.id, path: "M35 35H65V67H35Z", rotation: 0, x: 50, y: 48 };
  if (f.kind === "city") {
    if (f.ports.length === 4) return { id: f.id, path: "M0 0H100V100H0Z", rotation: 0, x: 50, y: 48 };
    if (f.ports.length === 3) return { id: f.id, path: "M0 0H100V100H80Q50 54 20 100H0Z", rotation: 0, x: 50, y: 27 };
    if (f.ports.length === 2 && Math.abs(f.ports[0]! - f.ports[1]!) === 2) return { id: f.id, path: "M0 0Q50 46 100 0V100Q50 54 0 100Z", rotation: 0, x: 50, y: 49 };
    if (f.ports.length === 2) return { id: f.id, path: "M0 0H100V20Q43 43 20 100H0Z", rotation: 0, x: 27, y: 27 };
    return { id: f.id, path: "M0 0H100V15Q50 42 0 15Z", rotation: f.ports[0]! * 90, x: 50, y: 16 };
  }
  if (f.kind === "road") {
    const [a,b] = f.ports, p = ends[a!]!;
    const hasHorizontalCapRoad = type === "D";
    let path: string, x = 50, y = hasHorizontalCapRoad ? 60 : 50;
    if (hasHorizontalCapRoad) path = "M0 50Q50 70 100 50";
    else if (b !== undefined) {
      const q = ends[b]!;
      const corner = city?.ports.length === 2 && city.ports.includes(0) && city.ports.includes(3);
      const bend = corner ? 78 : 50;
      path = Math.abs(a! - b) === 2 ? `M${p[0]} ${p[1]}L${q[0]} ${q[1]}` : `M${p[0]} ${p[1]}Q${bend} ${bend} ${q[0]} ${q[1]}`;
      if (Math.abs(a! - b) !== 2) { x = (p[0] + 2*bend + q[0]) / 4; y = (p[1] + 2*bend + q[1]) / 4; }
    } else {
      const terminus = city?.ports.length === 3 ? [50,75] : type === "A" ? [50,65] : [50,50];
      path = `M${p[0]} ${p[1]}L${terminus[0]} ${terminus[1]}`;
      x = (p[0] + terminus[0]!) / 2; y = (p[1] + terminus[1]!) / 2;
    }
    return { id: f.id, path, rotation: 0, x, y };
  }
  const index = Number(f.id.slice(1)); let path = "M0 0H100V100H0Z";
  if (type === "D") path = index === 0 ? "M0 0H100V50Q50 70 0 50Z" : "M0 50Q50 70 100 50V100H0Z";
  if (["F","G"].includes(type)) path = index === 0 ? "M0 0H100V50H0Z" : "M0 50H100V100H0Z";
  if (["K","V"].includes(type)) path = index === 0 ? "M0 0H100V100H50Q50 50 0 50Z" : "M0 50Q50 50 50 100H0Z";
  if (["J","O","P"].includes(type)) { const q = ["O","P"].includes(type) ? 78 : 50; path = index === 0 ? `M0 0H100V50Q${q} ${q} 50 100H0Z` : `M100 50Q${q} ${q} 50 100H100Z`; }
  if (["L","W"].includes(type)) path = index === 0 ? "M0 0H100V50H0Z" : index === 1 ? "M50 50H100V100H50Z" : "M0 50H50V100H0Z";
  if (["S","T"].includes(type)) path = index === 0 ? "M50 0H100V100H50Z" : "M0 0H50V100H0Z";
  if (type === "U") path = index === 0 ? "M0 0H50V100H0Z" : "M50 0H100V100H50Z";
  if (type === "X") { const left = index === 0 || index === 3, top = index < 2; path = `M${left ? 0 : 50} ${top ? 0 : 50}h50v50h-50Z`; }
  const farmAnchors: Record<string, readonly (readonly [number,number])[]> = {
    A:[[22,30]], B:[[23,25]], D:[[50,42],[50,83]], E:[[50,70]], F:[[50,14],[50,86]], G:[[50,14],[50,86]], H:[[50,50]], I:[[67,67]],
    J:[[23,66],[84,85]], K:[[76,65],[16,85]], L:[[50,36],[80,80],[20,80]], M:[[69,70]], N:[[69,70]], O:[[60,60],[88,88]], P:[[60,60],[88,88]],
    Q:[[50,87]], R:[[50,87]], S:[[67,91],[33,91]], T:[[67,91],[33,91]], U:[[23,50],[77,50]], V:[[72,30],[18,84]], W:[[50,22],[80,80],[20,80]], X:[[22,22],[78,22],[78,78],[22,78]],
  };
  const anchor = farmAnchors[type]?.[index] ?? [50,75];
  return { id: f.id, path, rotation: 0, x: anchor[0], y: anchor[1] };
}
export function rotatePoint(x: number, y: number, rotation: number): { x: number; y: number } {
  for (let i = 0; i < rotation; i++) [x,y] = [100-y,x]; return { x, y };
}
