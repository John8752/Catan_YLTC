/** One original, solid meeple silhouette for both the 3D piece and SVG fallback. */
export const CAMEL_OUTLINE = [
  ["M", -.84, .35],
  ["L", -.72, .62],
  ["Q", -.66, .99, -.36, 1.02],
  ["Q", -.10, 1.04, .05, .73],
  ["L", .29, .73],
  ["L", .43, 1.22],
  ["Q", .46, 1.36, .62, 1.36],
  ["L", .88, 1.30],
  ["Q", 1.00, 1.27, .99, 1.13],
  ["L", .78, 1.10],
  ["L", .69, .48],
  ["Q", .67, .37, .55, .34],
  ["L", .50, .05],
  ["L", .23, .05],
  ["L", .20, .34],
  ["L", -.39, .34],
  ["L", -.44, .05],
  ["L", -.71, .05],
  ["L", -.70, .35],
  ["Z"],
] as const;
export const CAMEL_SVG_PATH = CAMEL_OUTLINE.map(([command, ...points]) => `${command}${points.join(" ")}`).join(" ");
export const CAMEL_STACK_STEP = 1.03;
