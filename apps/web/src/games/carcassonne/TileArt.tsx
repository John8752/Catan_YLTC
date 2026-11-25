import { useId } from "react";
import { tileDefinition, type FeatureKind } from "@catan/game-core/carcassonne";
import { featureShape, rotatePoint } from "./tile-geometry.js";

export const FEATURE_LABELS: Readonly<Record<FeatureKind, string>> = { city: "城市", road: "道路", monastery: "修道院", field: "田地" };
/** Geometric miniature: beveled tiles, raised masonry and carved wooden pawns. */
export function TileArt({ type, rotation = 0, selectedFeatures = [], onFeature, children }: {
  readonly type: string; readonly rotation?: number; readonly selectedFeatures?: readonly string[];
  readonly onFeature?: (id: string) => void; readonly children?: React.ReactNode;
}) {
  const uid = useId().replaceAll(":", ""); const def = tileDefinition(type);
  const cityFeatures = def.features.filter((f) => f.kind === "city"), roads = def.features.filter((f) => f.kind === "road");
  const choose = (id: string) => onFeature ? { role: "button" as const, tabIndex: 0, "aria-label": `查看${FEATURE_LABELS[def.features.find((f) => f.id === id)!.kind]}`,
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onFeature(id); }, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFeature(id); } } } : {};
  return <g className="carc-tile-art">
    <defs>
      <linearGradient id={`${uid}grass`} x2=".8" y2="1"><stop stopColor="#afc182"/><stop offset=".48" stopColor="#86a367"/><stop offset="1" stopColor="#6a8b52"/></linearGradient>
      <linearGradient id={`${uid}stone`} x2=".4" y2="1"><stop stopColor="#ead9ad"/><stop offset="1" stopColor="#baa07c"/></linearGradient>
      <mask id={`${uid}field`}><rect width="100" height="100" fill="white"/>{cityFeatures.map((f) => { const s = featureShape(type, f); return <path key={f.id} d={s.path} transform={`rotate(${s.rotation} 50 50)`} fill="black"/>; })}{roads.map((f) => <path key={f.id} d={featureShape(type,f).path} stroke="black" strokeWidth="12" fill="none"/>)}</mask>
    </defs>
    <path d="M1 4H99V102H1Z" fill="#344532" opacity=".45"/>
    <rect x=".5" y=".5" width="99" height="99" rx="2" fill={`url(#${uid}grass)`} stroke="#c9c69b"/>
    <path d="M1 99H99" stroke="#4d5d36" strokeWidth="2"/><path d="M1 1H99" stroke="#e2e6b3" strokeWidth="1.5" opacity=".8"/>
    <g transform={`rotate(${rotation*90} 50 50)`}>
      {def.features.filter((f) => f.kind === "field").map((f) => <path key={f.id} data-feature-kind="field" d={featureShape(type,f).path} fill={selectedFeatures.includes(f.id) ? "#f2d36f" : "transparent"} fillOpacity={selectedFeatures.includes(f.id) ? .6 : 1} mask={`url(#${uid}field)`} {...choose(f.id)}/>)}
      {roads.map((f) => { const s = featureShape(type,f); return <g key={f.id} data-feature-kind="road" {...choose(f.id)}>
        <path d={s.path} fill="none" stroke="#4b623d" strokeWidth="15" opacity=".5" transform="translate(0 2)"/>
        <path data-road-surface="true" d={s.path} fill="none" stroke={selectedFeatures.includes(f.id) ? "#f6d465" : "#d4b987"} strokeWidth="12"/>
        <path d={s.path} fill="none" stroke="#f5e5bb" strokeWidth="1.6" strokeDasharray="3 5" opacity=".75"/>
        {onFeature && <path d={s.path} fill="none" stroke="transparent" strokeWidth="22"/>}
      </g>; })}
      {roads.length >= 3 && <g><ellipse cx="50" cy="52" rx="10" ry="8" fill="#64764c"/><path d="M40 44H59V57H40Z" fill="#dfcd9f"/><path d="M38 44L49 37L62 44L51 49Z" fill="#a95d3f"/><path d="M51 49L62 44V55L51 60Z" fill="#815035"/></g>}
      {cityFeatures.map((f) => { const s = featureShape(type,f); return <g key={f.id} data-feature-kind="city" transform={`rotate(${s.rotation} 50 50)`} {...choose(f.id)}>
        <path d={s.path} fill="#635a40" transform="translate(0 3)"/>
        <path data-city-surface="true" d={s.path} fill={selectedFeatures.includes(f.id) ? "#f4d479" : `url(#${uid}stone)`} stroke="#f3e5c2" strokeWidth="1.8"/>
        <g transform={`translate(${s.x} ${s.y})`} pointerEvents="none">
          <path d="M-10-6L2-11L13-5V9L0 15L-10 8Z" fill="#a68b68"/>
          <path d="M-10-6L0 0V15L-10 8Z" fill="#d9c69b"/>
          <path d="M0 0L13-5V9L0 15Z" fill="#aa8c66"/>
          <path d="M-13-7L0-18L16-7L2 0Z" fill="#ad543a"/><path d="M2 0L16-7L10-15L0-18Z" fill="#793e2c"/>
          <path d="M-7 2V7M5 2V7" stroke="#524d3a" strokeWidth="2.6"/>
          {f.shields > 0 && <g transform="translate(18 8)"><path d="M-6-7H6V1Q0 9-6 1Z" fill="#5075a1" stroke="#f5e6ae" strokeWidth="1.5"/><path d="M0-5V4M-4-1H4" stroke="#f5e6ae" strokeWidth="1.5"/></g>}
        </g>
      </g>; })}
      {def.features.some((f) => f.kind === "monastery") && <g {...choose("m0")}>
        <ellipse cx="52" cy="62" rx="24" ry="12" fill="#3a5738" opacity=".35"/>
        <path d="M30 43H64L73 52V69H30Z" fill={selectedFeatures.includes("m0") ? "#f4d479" : "#e3d4b1"}/>
        <path d="M64 43L73 52V69L64 62Z" fill="#a59370"/><path d="M26 43L45 28L67 43L47 52Z" fill="#aa6448"/>
        <path d="M47 52L67 43L56 33L45 28Z" fill="#7c4938"/>
        <path d="M51 28H62V56H51Z" fill="#e6d7b1"/><path d="M49 28L56 15L65 28Z" fill="#696b63"/>
        <path d="M56 19V11M53 14H59M36 55V63M56 35V41" stroke="#4b5142" strokeWidth="2.7"/>
      </g>}
    </g>
    {children}
  </g>;
}
export function MeepleArt({ color, farmer = false, label, selected = false }: { readonly color: string; readonly farmer?: boolean; readonly label?: string; readonly selected?: boolean }) {
  return <g role={label ? "img" : undefined} aria-label={label} className={selected ? "carc-pawn carc-pawn-selected" : "carc-pawn"}>
    <ellipse cy="10" rx="12" ry="5" fill="#152e25" opacity=".4"/>
    <g transform={farmer ? "rotate(90)" : undefined}>
      <path d="M-4-5Q-10-3-12 2L-6 5L-9 13H-2L0 8L2 13H9L6 5L12 2Q10-3 4-5Z" fill={color} stroke="#253e34" strokeWidth="1.2"/>
      <circle cy="-9" r="5.5" fill={color} stroke="#253e34" strokeWidth="1.2"/>
      <path d="M-3-11Q-1-14 2-12M-7 0L-4-2M-4 5L-6 10" fill="none" stroke="#fff7df" strokeWidth="2" strokeLinecap="round" opacity=".65"/>
      <path d="M5-3L9 1L5 3L7 11H3" fill="none" stroke="#1c302b" strokeWidth="2" opacity=".28"/>
    </g>
  </g>;
}
export function featureAnchor(type: string, featureId: string, rotation: number) {
  const f = tileDefinition(type).features.find((f) => f.id === featureId)!;
  const s = featureShape(type,f), own = rotatePoint(s.x,s.y,s.rotation/90);
  return rotatePoint(own.x, own.y, rotation);
}
