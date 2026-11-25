// AMODO graphic system: original organic shapes, mood figures and spot illustrations (react-native-svg).
// Expressive art lives here; functional icons stay in Lucide (ui.tsx → Ic).
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

import { useTheme } from "@/src/theme";

function burst(n: number, r1: number, r2: number) {
  const pts = Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  });
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const f = (p: number[]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  let d = `M${f(mid(pts[pts.length - 1], pts[0]))}`;
  pts.forEach((p, i) => (d += `Q${f(p)} ${f(mid(p, pts[(i + 1) % pts.length]))}`));
  return `${d}Z`;
}

export const SHAPES = {
  pebble: "M50 6C74 4 95 22 94 48C93 76 74 96 48 94C22 92 5 74 7 46C9 22 26 8 50 6Z",
  cloud: "M30 80C12 80 6 62 17 52C10 36 26 24 38 30C44 14 70 14 74 32C92 32 98 56 84 66C86 76 78 82 68 80Z",
  drop: "M50 6C70 28 90 46 88 66C86 84 70 95 50 95C30 95 14 84 12 66C10 46 30 28 50 6Z",
  squircle: "M50 5C80 5 95 20 95 50C95 80 80 95 50 95C20 95 5 80 5 50C5 20 20 5 50 5Z",
  scallop: "M50 8C62 8 70 16 70 28C82 28 92 38 92 50C92 62 82 72 70 72C70 84 62 92 50 92C38 92 30 84 30 72C18 72 8 62 8 50C8 38 18 28 30 28C30 16 38 8 50 8Z",
  arch: "M14 90C10 90 8 88 8 84V54C8 30 26 12 50 12C74 12 92 30 92 54V84C92 88 90 90 86 90Z",
  pillow: "M24 26H76C90 26 97 38 97 50C97 64 90 76 76 76H24C10 76 3 64 3 50C3 38 10 26 24 26Z",
  diamond: "M50 6C54 6 58 9 61 13L88 42C92 47 92 53 88 58L61 87C55 94 45 94 39 87L12 58C8 53 8 47 12 42L39 13C42 9 46 6 50 6Z",
  burst: burst(8, 47, 36),
  petal: "M50 4C78 4 96 22 96 50C96 78 78 96 50 96C50 70 30 50 4 50C4 22 22 4 50 4Z",
};
export type ShapeName = keyof typeof SHAPES;

/** A flat organic shape. */
export function Shape({ name, size = 48, color, rotate = 0, style }: { name: ShapeName; size?: number; color: string; rotate?: number; style?: any }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={[rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]}>
      <Path d={SHAPES[name]} fill={color} />
    </Svg>
  );
}

type Face = "calm" | "bright" | "tired" | "sleepy" | "tender" | "worried" | "uneasy" | "pain";
const dot = (x: number, y: number, ink: string) => <Circle cx={x} cy={y} r={3.4} fill={ink} />;
function FaceArt({ face, ink }: { face: Face; ink: string }) {
  const s = { stroke: ink, strokeWidth: 3.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  switch (face) {
    case "calm":
      return <><Path d="M32 47q6 -6 12 0M56 47q6 -6 12 0M42 61q8 6 16 0" {...s} /></>;
    case "bright":
      return <>{dot(38, 45, ink)}{dot(62, 45, ink)}<Path d="M41 58q9 9 18 0" {...s} /></>;
    case "tired":
      return <><Path d="M32 47h12M56 47h12M32 41q6 -3 12 0M56 41q6 -3 12 0M44 63h12" {...s} /></>;
    case "sleepy":
      return <><Path d="M30 46q6 6 12 0M58 46q6 6 12 0" {...s} /><Circle cx={50} cy={61} r={3.6} {...s} /></>;
    case "tender":
      return <>{dot(38, 46, ink)}{dot(62, 46, ink)}<Path d="M42 61q4 -4 8 0t8 0" {...s} /></>;
    case "worried":
      return <>{dot(38, 48, ink)}{dot(62, 48, ink)}<Path d="M31 39l10 -4M69 39l-10 -4M43 64q7 -5 14 0" {...s} /></>;
    case "uneasy":
      return <><Path d="M33 43l9 4l-9 4M67 43l-9 4l9 4M40 64l5 -4l5 4l5 -4l5 4" {...s} /></>;
    default:
      return <><Path d="M32 43l10 5M68 43l-10 5M43 64h14" {...s} /></>;
  }
}

export const MOOD_ART: Record<string, { shape: ShapeName; face: Face; tint: string; dy?: number }> = {
  "En calma": { shape: "pebble", face: "calm", tint: "sage" },
  "Con energía": { shape: "burst", face: "bright", tint: "butter" },
  "Cansado/a": { shape: "arch", face: "tired", tint: "sky", dy: 6 },
  "Con sueño": { shape: "pillow", face: "sleepy", tint: "lavender" },
  "Sensible": { shape: "drop", face: "tender", tint: "mauve", dy: 12 },
  "Preocupado/a": { shape: "cloud", face: "worried", tint: "sand", dy: 2 },
  "Con molestias": { shape: "scallop", face: "uneasy", tint: "coral" },
  "Con dolor": { shape: "diamond", face: "pain", tint: "butter" },
};

/** Mood figure: shape + minimal expression. Shapes differ so colour is never the only cue. */
export function MoodFigure({ mood, size = 56, color, selected }: { mood: string; size?: number; color: string; selected?: boolean }) {
  const { colors } = useTheme();
  const a = MOOD_ART[mood] || { shape: "squircle" as ShapeName, face: "calm" as Face };
  return (
    <Svg width={size} height={size} viewBox="-4 -4 108 108">
      <Path d={SHAPES[a.shape]} fill={color} stroke={selected ? colors.onSurface : "none"} strokeWidth={selected ? 4 : 0} strokeLinejoin="round" />
      <G transform={`translate(0 ${a.dy || 0})`}><FaceArt face={a.face} ink={colors.onSurface} /></G>
    </Svg>
  );
}

export type SpotName = "treatments" | "medications" | "tasks" | "transfers" | "expenses" | "network" | "kits" | "checklist" | "week" | "process" | "day" | "signals" | "history" | "style" | "ai" | "calendar" | "gift" | "heart";

/** Small original illustration for a tool or category. `ink` = dark, `paper` = light, `pop` = second pastel. */
export function Spot({ name, size = 52, pop }: { name: SpotName | string; size?: number; pop?: string }) {
  const { colors } = useTheme();
  const ink = colors.onSurface;
  const paper = colors.surfaceSecondary;
  const p = pop || colors.butter;
  const line = { stroke: ink, strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const art: Record<string, React.ReactNode> = {
    treatments: <><Circle cx={32} cy={34} r={19} fill={paper} /><Path d="M32 15a19 19 0 1 1 -16.5 9.5" {...line} /><Circle cx={15.5} cy={24.5} r={5} fill={ink} /><Circle cx={32} cy={34} r={6} fill={p} /></>,
    medications: <><G transform="rotate(-35 30 32)"><Rect x={8} y={22} width={44} height={20} rx={10} fill={paper} /><Path d="M30 22h12a10 10 0 0 1 0 20h-12z" fill={ink} /></G><Circle cx={50} cy={50} r={7} fill={p} /></>,
    tasks: <><Rect x={11} y={9} width={42} height={46} rx={10} fill={paper} /><Path d="M20 24l4 4l7 -8M20 42h6M36 24h9M34 42h11" {...line} /><Circle cx={50} cy={12} r={6} fill={p} /></>,
    transfers: <><Path d="M8 50C18 22 46 22 56 50" {...line} strokeDasharray="1 9" /><Path d="M32 8c8 0 13 6 13 12c0 9 -13 18 -13 18s-13 -9 -13 -18c0 -6 5 -12 13 -12z" fill={ink} /><Circle cx={32} cy={20} r={5} fill={p} /></>,
    expenses: <><Circle cx={26} cy={38} r={18} fill={paper} /><Circle cx={26} cy={38} r={9} {...line} /><Circle cx={45} cy={21} r={12} fill={ink} /><Circle cx={45} cy={21} r={4} fill={p} /></>,
    network: <><Circle cx={21} cy={25} r={12} fill={ink} /><Circle cx={43} cy={27} r={14} fill={paper} /><Ellipse cx={32} cy={48} rx={19} ry={9} fill={p} /></>,
    kits: <><Rect x={12} y={27} width={40} height={28} rx={6} fill={paper} /><Rect x={8} y={17} width={48} height={13} rx={5} fill={ink} /><Rect x={28} y={17} width={8} height={38} fill={p} /></>,
    checklist: <><Rect x={12} y={12} width={40} height={44} rx={9} fill={paper} /><Rect x={23} y={7} width={18} height={11} rx={5} fill={ink} /><Path d="M21 31l4 4l7 -8M21 46h22M38 31h5" {...line} /></>,
    week: <><Rect x={7} y={22} width={50} height={22} rx={11} fill={paper} />{[15, 26, 37].map((x) => <Circle key={x} cx={x} cy={33} r={3} fill={ink} />)}<Circle cx={49} cy={33} r={10} fill={ink} /><Circle cx={49} cy={33} r={4} fill={p} /></>,
    process: <><Rect x={10} y={36} width={12} height={20} rx={5} fill={paper} /><Rect x={26} y={24} width={12} height={32} rx={5} fill={ink} /><Rect x={42} y={10} width={12} height={46} rx={5} fill={paper} /><Circle cx={48} cy={18} r={3.5} fill={p} /></>,
    day: <><Path d="M12 42a20 20 0 0 1 40 0z" fill={paper} /><Path d="M6 48h52M32 8v6M10 20l4 4M54 20l-4 4" {...line} /><Circle cx={32} cy={56} r={3} fill={p} /></>,
    signals: <><Circle cx={32} cy={40} r={8} fill={ink} /><Path d="M17 30a18 18 0 0 1 30 0M9 22a29 29 0 0 1 46 0" {...line} /><Circle cx={32} cy={40} r={3} fill={p} /></>,
    history: <><Circle cx={32} cy={32} r={22} fill={paper} /><Path d="M32 19v13l9 6" {...line} /><Circle cx={50} cy={14} r={6} fill={p} /></>,
    style: <><Circle cx={24} cy={24} r={14} fill={ink} /><Circle cx={42} cy={28} r={14} fill={paper} /><Circle cx={30} cy={44} r={12} fill={p} /></>,
    ai: <><Path d="M30 6C32 22 38 28 54 30C38 32 32 38 30 54C28 38 22 32 6 30C22 28 28 22 30 6Z" fill={ink} /><Path d="M50 42C51 48 53 50 59 51C53 52 51 54 50 60C49 54 47 52 41 51C47 50 49 48 50 42Z" fill={p} /></>,
    calendar: <><Rect x={9} y={13} width={46} height={42} rx={10} fill={paper} /><Path d="M9 25h46v-2a10 10 0 0 0 -10 -10h-26a10 10 0 0 0 -10 10z" fill={ink} /><Circle cx={24} cy={39} r={4} fill={ink} /><Circle cx={40} cy={39} r={4} fill={p} /></>,
    gift: <><Rect x={11} y={26} width={42} height={30} rx={6} fill={paper} /><Path d="M32 26c-10 -18 -22 -6 -12 0zM32 26c10 -18 22 -6 12 0z" fill={ink} /><Rect x={28} y={26} width={8} height={30} fill={p} /></>,
    heart: <><Path d="M32 54C8 38 10 16 24 14c5 0 8 4 8 4s3 -4 8 -4c14 2 16 24 -8 40z" fill={paper} /><Circle cx={48} cy={46} r={8} fill={ink} /><Circle cx={48} cy={46} r={3} fill={p} /></>,
  };
  return <Svg width={size} height={size} viewBox="0 0 64 64">{art[name] ?? art.kits}</Svg>;
}

/** Group of shapes "keeping each other company": hero corners and empty states. */
export function Company({ size = 96, a, b, c }: { size?: number; a?: string; b?: string; c?: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size * 0.8} viewBox="0 0 120 96">
      <G transform="translate(0 20) scale(0.74)"><Path d={SHAPES.arch} fill={a || colors.lavender} /></G>
      <G transform="translate(48 2) scale(0.62)"><Path d={SHAPES.pebble} fill={b || colors.butter} /></G>
      <G transform="translate(62 44) scale(0.5)"><Path d={SHAPES.scallop} fill={c || colors.sage} /></G>
      <Path d="M24 60q5 5 10 0M40 60q5 5 10 0" stroke={colors.onSurface} strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** Open container with objects peeking out: 1 = Chico, 2 = Mediano, 3 = Grande. */
export function KitBox({ level, size = 72, color, selected }: { level: 1 | 2 | 3; size?: number; color: string; selected?: boolean }) {
  const { colors } = useTheme();
  const ink = colors.onSurface;
  const w = [34, 46, 58][level - 1];
  const x = 36 - w / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      {level >= 1 ? <Circle cx={x + 11} cy={30} r={9} fill={colors.butter} /> : null}
      {level >= 2 ? <Rect x={x + 22} y={16} width={13} height={24} rx={6} fill={colors.lavender} /> : null}
      {level >= 3 ? <G transform={`translate(${x + 37} 18) scale(0.2)`}><Path d={SHAPES.drop} fill={colors.coral} /></G> : null}
      <Rect x={x} y={34} width={w} height={[22, 26, 30][level - 1]} rx={7} fill={selected ? ink : color} />
      <Rect x={x + w / 2 - 7} y={42} width={14} height={5} rx={2.5} fill={selected ? colors.surfaceSecondary : ink} />
    </Svg>
  );
}

/** Kit capacity as small modules that fill up. */
export function Slots({ used, total, extra = 0 }: { used: number; total: number; extra?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }} accessibilityLabel={`${used} de ${total} espacios usados`}>
      {Array.from({ length: Math.max(total, used) + extra }, (_, i) => (
        <View key={i} style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: i < used ? colors.onSurface : "transparent", borderWidth: 1.5, borderColor: i < used ? colors.onSurface : colors.borderStrong, borderStyle: i >= total ? "dashed" : "solid" }} />
      ))}
    </View>
  );
}
