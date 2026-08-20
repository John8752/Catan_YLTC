import type { GameCommand, GameView } from "@catan/protocol";
import type { KeyboardEvent } from "react";

export interface ConstructionTargetsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly buildMode: "road" | "settlement" | "city" | null;
  readonly layer: "roads" | "buildings";
  readonly coordinateScale: number;
  readonly onCommand: ((command: GameCommand) => void) | undefined;
}

export function ConstructionTargets({
  game,
  busy,
  buildMode,
  layer,
  coordinateScale,
  onCommand,
}: ConstructionTargetsProps) {
  const selectableVertices = new Set([
    ...game.interaction.vertexIds,
    ...(game.interaction.kind === "turn-action" && buildMode === "settlement" ? game.interaction.settlementVertexIds : []),
    ...(game.interaction.kind === "turn-action" && buildMode === "city" ? game.interaction.cityVertexIds : []),
  ]);
  const selectableEdges = new Set([
    ...game.interaction.edgeIds,
    ...(game.interaction.kind === "turn-action" && buildMode === "road" ? game.interaction.roadEdgeIds : []),
  ]);
  const vertexTargetKind = game.interaction.kind === "setup-settlement"
    ? "settlement"
    : game.interaction.kind === "turn-action" && (buildMode === "settlement" || buildMode === "city")
      ? buildMode
      : null;
  const isSetupSettlementTarget = game.interaction.kind === "setup-settlement";
  const edgeTargetKind = game.interaction.kind === "setup-road" || game.interaction.kind === "free-road"
    ? "road"
    : game.interaction.kind === "turn-action" && buildMode === "road"
      ? "road"
      : null;

  return (
    <g className="construction-targets" aria-label="可建造位置">
      {layer !== "roads" || edgeTargetKind === null ? null : game.map.edges.map((edge) => {
        if (!selectableEdges.has(edge.id)) return null;
        const [firstId, secondId] = edge.vertexIds;
        const first = game.map.vertices.find((vertex) => vertex.id === firstId);
        const second = game.map.vertices.find((vertex) => vertex.id === secondId);
        if (first === undefined || second === undefined) return null;
        const activate = () => {
          if (busy) return;
          onCommand?.(game.interaction.kind === "setup-road"
            ? { type: "PlaceInitialRoad", edgeId: edge.id }
            : game.interaction.kind === "free-road"
              ? { type: "BuildFreeRoad", edgeId: edge.id }
              : { type: "BuildRoad", edgeId: edge.id });
        };
        const label = game.interaction.kind === "setup-road"
          ? "在这里放置道路"
          : game.interaction.kind === "free-road"
            ? "在这里放置免费道路"
            : "在这里建造道路";
        return (
          <g
            key={edge.id}
            className="construction-target construction-target-road"
            data-build-target-kind="road"
            data-build-target-id={edge.id}
            role="button"
            tabIndex={busy ? -1 : 0}
            aria-disabled={busy}
            aria-label={label}
            onClick={activate}
            onKeyDown={(event) => activateOnKeyboard(event, activate)}
          >
            <line className="construction-target-hit" x1={first.x * coordinateScale} y1={first.y * coordinateScale} x2={second.x * coordinateScale} y2={second.y * coordinateScale} />
            <line className="construction-target-road-glow" x1={first.x * coordinateScale} y1={first.y * coordinateScale} x2={second.x * coordinateScale} y2={second.y * coordinateScale} />
            <circle className="construction-target-road-dot" cx={((first.x + second.x) / 2) * coordinateScale} cy={((first.y + second.y) / 2) * coordinateScale} r="4.5" />
          </g>
        );
      })}
      {layer !== "buildings" || vertexTargetKind === null ? null : game.map.vertices.map((vertex) => {
        if (!selectableVertices.has(vertex.id)) return null;
        const activate = () => {
          if (busy) return;
          onCommand?.(game.interaction.kind === "setup-settlement"
            ? { type: "PlaceInitialSettlement", vertexId: vertex.id }
            : vertexTargetKind === "city"
              ? { type: "BuildCity", vertexId: vertex.id }
              : { type: "BuildSettlement", vertexId: vertex.id });
        };
        const label = game.interaction.kind === "setup-settlement"
          ? "在这里放置定居点"
          : vertexTargetKind === "city"
            ? "在这里升级城市"
            : "在这里建造村庄";
        return (
          <g
            key={vertex.id}
            className={`construction-target construction-target-${vertexTargetKind}${isSetupSettlementTarget ? " construction-target-setup" : ""}`}
            data-build-target-kind={vertexTargetKind}
            data-build-target-context={isSetupSettlementTarget ? "setup" : "build"}
            data-build-target-id={vertex.id}
            transform={`translate(${vertex.x * coordinateScale} ${vertex.y * coordinateScale})`}
            role="button"
            tabIndex={busy ? -1 : 0}
            aria-disabled={busy}
            aria-label={label}
            onClick={activate}
            onKeyDown={(event) => activateOnKeyboard(event, activate)}
          >
            <circle className="construction-target-hit" r="19" />
            <circle
              className="construction-target-vertex-ring"
              r={vertexTargetKind === "city" ? 17 : isSetupSettlementTarget ? 7 : 12}
            />
            {vertexTargetKind === "city" ? (
              <g className="construction-target-upgrade-mark" transform="translate(13 -13)">
                <circle r="7" />
                <path d="M-3 1L0-2L3 1M0-2V4" />
              </g>
            ) : (
              <path className="construction-target-house-mark" d="M-5 4V-2L0-6L5-2V4Z" />
            )}
          </g>
        );
      })}
    </g>
  );
}

function activateOnKeyboard(event: KeyboardEvent<SVGElement>, action: () => void): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}
