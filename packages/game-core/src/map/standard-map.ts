import {
  createSeededRandom,
  shuffled,
  type EdgeId,
  type HexId,
  type VertexId,
} from "../primitives/index.js";
import { RESOURCE_TYPES, type ResourceType } from "../resources/index.js";
import { EXTENDED_COORDINATES, STANDARD_COORDINATES } from "./standard-board.js";
import type {
  AxialCoordinate,
  BoardHex,
  GameMap,
  MapEdge,
  MapPort,
  MapVertex,
  TerrainType,
} from "./types.js";

const DIRECTIONS: readonly AxialCoordinate[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

const STANDARD_TERRAIN_DECK: readonly TerrainType[] = [
  "lumber", "lumber", "lumber", "lumber",
  "wool", "wool", "wool", "wool",
  "grain", "grain", "grain", "grain",
  "brick", "brick", "brick",
  "ore", "ore", "ore",
  "desert",
];

const STANDARD_NUMBER_TOKENS: readonly number[] = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const EXTENDED_TERRAIN_DECK: readonly TerrainType[] = [
  ...Array<TerrainType>(6).fill("lumber"),
  ...Array<TerrainType>(6).fill("wool"),
  ...Array<TerrainType>(6).fill("grain"),
  ...Array<TerrainType>(5).fill("brick"),
  ...Array<TerrainType>(5).fill("ore"),
  "desert",
  "desert",
];
const EXTENDED_NUMBER_TOKENS: readonly number[] = [
  2, 2,
  3, 3, 3,
  4, 4, 4,
  5, 5, 5,
  6, 6, 6,
  8, 8, 8,
  9, 9, 9,
  10, 10, 10,
  11, 11, 11,
  12, 12,
];
const GENERIC_PORT = "generic" as const;
const STANDARD_PORT_DECK: readonly (ResourceType | typeof GENERIC_PORT)[] = [
  ...RESOURCE_TYPES,
  GENERIC_PORT,
  GENERIC_PORT,
  GENERIC_PORT,
  GENERIC_PORT,
];
const EXTENDED_PORT_DECK: readonly (ResourceType | typeof GENERIC_PORT)[] = [
  ...STANDARD_PORT_DECK,
  "wool",
  GENERIC_PORT,
];

interface TopologyHex {
  readonly id: HexId;
  readonly q: number;
  readonly r: number;
  readonly adjacentHexIds: readonly HexId[];
  readonly vertexIds: readonly VertexId[];
  readonly edgeIds: readonly EdgeId[];
}

interface BoardTopology {
  readonly hexes: readonly TopologyHex[];
  readonly vertices: readonly MapVertex[];
  readonly edges: readonly MapEdge[];
}

const STANDARD_TOPOLOGY = createTopology(STANDARD_COORDINATES);
const EXTENDED_TOPOLOGY = createTopology(EXTENDED_COORDINATES);

export function createStandardMap(seed: number): GameMap {
  return createMap(seed, STANDARD_TOPOLOGY, STANDARD_TERRAIN_DECK, STANDARD_NUMBER_TOKENS, STANDARD_PORT_DECK);
}

export function createExtendedMap(seed: number): GameMap {
  return createMap(seed, EXTENDED_TOPOLOGY, EXTENDED_TERRAIN_DECK, EXTENDED_NUMBER_TOKENS, EXTENDED_PORT_DECK);
}

function createMap(
  seed: number,
  topology: BoardTopology,
  terrainDeck: readonly TerrainType[],
  numberTokens: readonly number[],
  portDeck: readonly (ResourceType | typeof GENERIC_PORT)[],
): GameMap {
  const terrains = shuffled(terrainDeck, createSeededRandom(seed ^ 0x4d415000));
  const terrainByHex = new Map<HexId, TerrainType>();
  let desertHexId: HexId | undefined;

  topology.hexes.forEach((hex, index) => {
    const terrain = terrains[index];

    if (terrain === undefined) throw new Error("Terrain deck is incomplete");
    terrainByHex.set(hex.id, terrain);
    if (terrain === "desert") desertHexId = hex.id;
  });

  if (desertHexId === undefined) throw new Error("Map requires a desert");

  const numberByHex = assignFairNumbers(topology, terrainByHex, numberTokens, seed);
  const hexes: BoardHex[] = topology.hexes.map((hex) => ({
    ...hex,
    terrain: requireValue(terrainByHex.get(hex.id), `Missing terrain for ${hex.id}`),
    numberToken: numberByHex.get(hex.id) ?? null,
  }));

  return {
    generationVersion: 1,
    hexes,
    vertices: topology.vertices,
    edges: topology.edges,
    ports: createPorts(topology, portDeck, seed),
    robberHexId: desertHexId,
  };
}

function createTopology(coordinates: readonly AxialCoordinate[]): BoardTopology {
  const coordinateSet = new Set(coordinates.map((coordinate) => coordinateKey(coordinate)));
  const vertexPositionByKey = new Map<string, { x: number; y: number }>();
  const cornerKeysByHex = new Map<HexId, readonly string[]>();

  for (const coordinate of coordinates) {
    const keys = Array.from({ length: 6 }, (_, corner) => {
      const key = cornerKey(coordinate, corner);
      const center = axialPosition(coordinate);
      const angle = ((60 * corner - 30) * Math.PI) / 180;
      vertexPositionByKey.set(key, {
        x: rounded(center.x + Math.cos(angle)),
        y: rounded(center.y + Math.sin(angle)),
      });
      return key;
    });
    cornerKeysByHex.set(hexId(coordinate), keys);
  }

  const vertexIdByKey = new Map(
    [...vertexPositionByKey.keys()].sort().map((key, index) => [key, `vertex_${String(index).padStart(2, "0")}`]),
  );
  const edgeDrafts = new Map<string, { vertexIds: [VertexId, VertexId]; adjacentHexIds: Set<HexId> }>();
  const edgeKeysByHex = new Map<HexId, readonly string[]>();

  for (const coordinate of coordinates) {
    const id = hexId(coordinate);
    const cornerKeys = requireValue(cornerKeysByHex.get(id), `Missing corners for ${id}`);
    const edgeKeys = Array.from({ length: 6 }, (_, edgeIndex) => {
      const first = requireValue(vertexIdByKey.get(requireValue(cornerKeys[edgeIndex], "Missing corner")), "Missing vertex");
      const nextCorner = (edgeIndex + 1) % 6;
      const second = requireValue(vertexIdByKey.get(requireValue(cornerKeys[nextCorner], "Missing corner")), "Missing vertex");
      const vertexIds: [VertexId, VertexId] = first < second ? [first, second] : [second, first];
      const key = vertexIds.join("|");
      const draft = edgeDrafts.get(key) ?? { vertexIds, adjacentHexIds: new Set<HexId>() };
      draft.adjacentHexIds.add(id);
      edgeDrafts.set(key, draft);
      return key;
    });
    edgeKeysByHex.set(id, edgeKeys);
  }

  const edgeIdByKey = new Map(
    [...edgeDrafts.keys()].sort().map((key, index) => [key, `edge_${String(index).padStart(2, "0")}`]),
  );
  const edges: MapEdge[] = [...edgeDrafts.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, draft]) => ({
      id: requireValue(edgeIdByKey.get(key), `Missing edge id for ${key}`),
      vertexIds: draft.vertexIds,
      adjacentHexIds: [...draft.adjacentHexIds].sort(),
    }));

  const adjacentVertices = new Map<VertexId, Set<VertexId>>();
  const edgeIdsByVertex = new Map<VertexId, Set<EdgeId>>();
  const adjacentHexesByVertex = new Map<VertexId, Set<HexId>>();

  for (const edge of edges) {
    const [first, second] = edge.vertexIds;
    addToSet(adjacentVertices, first, second);
    addToSet(adjacentVertices, second, first);
    addToSet(edgeIdsByVertex, first, edge.id);
    addToSet(edgeIdsByVertex, second, edge.id);

    for (const adjacentHexId of edge.adjacentHexIds) {
      addToSet(adjacentHexesByVertex, first, adjacentHexId);
      addToSet(adjacentHexesByVertex, second, adjacentHexId);
    }
  }

  const keyByVertexId = new Map([...vertexIdByKey.entries()].map(([key, id]) => [id, key]));
  const vertices: MapVertex[] = [...keyByVertexId.keys()].sort().map((id) => {
    const key = requireValue(keyByVertexId.get(id), `Missing key for ${id}`);
    const position = requireValue(vertexPositionByKey.get(key), `Missing position for ${id}`);
    return {
      id,
      ...position,
      adjacentHexIds: [...(adjacentHexesByVertex.get(id) ?? [])].sort(),
      adjacentVertexIds: [...(adjacentVertices.get(id) ?? [])].sort(),
      edgeIds: [...(edgeIdsByVertex.get(id) ?? [])].sort(),
    };
  });

  const hexes: TopologyHex[] = coordinates.map((coordinate) => {
    const id = hexId(coordinate);
    const cornerKeys = requireValue(cornerKeysByHex.get(id), `Missing corners for ${id}`);
    const edgeKeys = requireValue(edgeKeysByHex.get(id), `Missing edges for ${id}`);
    return {
      id,
      ...coordinate,
      adjacentHexIds: DIRECTIONS
        .map((direction) => ({ q: coordinate.q + direction.q, r: coordinate.r + direction.r }))
        .filter((candidate) => coordinateSet.has(coordinateKey(candidate)))
        .map((candidate) => hexId(candidate)),
      vertexIds: cornerKeys.map((key) => requireValue(vertexIdByKey.get(key), `Missing vertex for ${key}`)),
      edgeIds: edgeKeys.map((key) => requireValue(edgeIdByKey.get(key), `Missing edge for ${key}`)),
    };
  });

  return { hexes, vertices, edges };
}

function assignFairNumbers(
  topology: BoardTopology,
  terrainByHex: ReadonlyMap<HexId, TerrainType>,
  numberTokens: readonly number[],
  seed: number,
): ReadonlyMap<HexId, number> {
  const producingHexes = topology.hexes.filter((hex) => terrainByHex.get(hex.id) !== "desert");
  const random = createSeededRandom(seed ^ 0x4e554d00);

  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const tokens = shuffled(numberTokens, random);
    const assignment = new Map<HexId, number>();
    producingHexes.forEach((hex, index) => {
      assignment.set(hex.id, requireValue(tokens[index], "Number token deck is incomplete"));
    });

    const fair = producingHexes.every((hex) => {
      const token = assignment.get(hex.id);
      if (token !== 6 && token !== 8) return true;
      return hex.adjacentHexIds.every((neighborId) => {
        const neighbor = assignment.get(neighborId);
        return neighbor !== 6 && neighbor !== 8;
      });
    });

    if (fair) return assignment;
  }

  throw new Error("Unable to generate a fair number-token layout");
}

function createPorts(
  topology: BoardTopology,
  portDeck: readonly (ResourceType | typeof GENERIC_PORT)[],
  seed: number,
): readonly MapPort[] {
  const vertexById = new Map(topology.vertices.map((vertex) => [vertex.id, vertex]));
  const coastline = topology.edges
    .filter((edge) => edge.adjacentHexIds.length === 1)
    .map((edge) => {
      const [firstId, secondId] = edge.vertexIds;
      const first = requireValue(vertexById.get(firstId), `Missing vertex ${firstId}`);
      const second = requireValue(vertexById.get(secondId), `Missing vertex ${secondId}`);
      return { edge, angle: Math.atan2((first.y + second.y) / 2, (first.x + second.x) / 2) };
    })
    .sort((first, second) => first.angle - second.angle);
  const portTypes = shuffled(portDeck, createSeededRandom(seed ^ 0x504f5254));

  return portTypes.map((portType, index): MapPort => {
    const coastIndex = Math.floor((index * coastline.length) / portTypes.length);
    const coast = requireValue(coastline[coastIndex], "Missing coastline edge for port");
    const shared = {
      id: `port_${index}`,
      edgeId: coast.edge.id,
      vertexIds: coast.edge.vertexIds,
    };

    return portType === GENERIC_PORT
      ? { ...shared, kind: "generic", resource: null }
      : { ...shared, kind: "resource", resource: portType };
  });
}

function cornerKey(coordinate: AxialCoordinate, corner: number): string {
  const previousDirection = requireValue(DIRECTIONS[(corner + 5) % 6], "Missing previous direction");
  const nextDirection = requireValue(DIRECTIONS[corner % 6], "Missing next direction");
  return [
    coordinate,
    { q: coordinate.q + previousDirection.q, r: coordinate.r + previousDirection.r },
    { q: coordinate.q + nextDirection.q, r: coordinate.r + nextDirection.r },
  ]
    .map(coordinateKey)
    .sort()
    .join("|");
}

function axialPosition(coordinate: AxialCoordinate): { x: number; y: number } {
  return {
    x: Math.sqrt(3) * (coordinate.q + coordinate.r / 2),
    y: 1.5 * coordinate.r,
  };
}

function coordinateKey(coordinate: AxialCoordinate): string {
  return `${coordinate.q},${coordinate.r}`;
}

function hexId(coordinate: AxialCoordinate): HexId {
  return `hex_${coordinate.q}_${coordinate.r}`;
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function addToSet<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const values = map.get(key) ?? new Set<V>();
  values.add(value);
  map.set(key, values);
}

function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}
