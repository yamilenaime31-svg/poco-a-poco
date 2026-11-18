import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import { View } from "react-native";

import { Txt } from "@/src/ui";
import { useTheme } from "@/src/theme";

export type AvatarData = Record<string, string>;

// Options are identity-neutral: nothing here is tied to a gender, and hair/headwear changes are just choices.
export const AVATAR_OPTIONS: Record<string, { label: string; values: string[]; colors?: boolean }> = {
  skin: { label: "Tono de piel", values: ["#FBE3CF", "#F1C9A0", "#E0AC69", "#C68642", "#8D5524", "#5C3A21"], colors: true },
  face: { label: "Rostro", values: ["Redondo", "Ovalado", "Cuadrado"] },
  eyes: { label: "Ojos", values: ["Puntos", "Sonrientes", "Abiertos", "Tranquilos"] },
  brows: { label: "Cejas", values: ["Suaves", "Rectas", "Arqueadas", "Sin cejas"] },
  mouth: { label: "Boca", values: ["Sonrisa", "Neutral", "Abierta", "Pequeña"] },
  hair: { label: "Cabello", values: ["Sin cabello", "Rapado", "Corto", "Rizado", "Melena", "Largo", "Chongo"] },
  hairColor: { label: "Color de cabello", values: ["#2B2B2B", "#5A3825", "#A0522D", "#D9B26F", "#BDBDBD", "#9B7BD4", "#E98A6B"], colors: true },
  headwear: { label: "Pañuelos y gorros", values: ["Ninguno", "Pañuelo", "Gorro", "Banda", "Turbante"] },
  headColor: { label: "Color del accesorio", values: ["#A8DDB5", "#D4C2F4", "#FFC5AB", "#FFE49B", "#B9DDF7", "#292929"], colors: true },
  glasses: { label: "Lentes", values: ["Sin lentes", "Redondos", "Cuadrados"] },
  accessory: { label: "Detalles", values: ["Ninguno", "Aretes", "Pecas", "Lunar", "Vello facial"] },
  clothes: { label: "Ropa", values: ["Cuello redondo", "Cuello V", "Sudadera"] },
  clothColor: { label: "Color de ropa", values: ["#A8DDB5", "#D4C2F4", "#FFC5AB", "#FFE49B", "#B9DDF7", "#292929", "#FFFFFF"], colors: true },
  bg: { label: "Fondo", values: ["#E3F5E8", "#F0E8FD", "#FFE9DF", "#FFF4CF", "#E6F3FD"], colors: true },
};

export const DEFAULT_AVATAR: AvatarData = Object.fromEntries(Object.entries(AVATAR_OPTIONS).map(([k, o]) => [k, o.values[k === "hair" ? 2 : 0]]));

const INK = "#292929";

// Zoomed viewBoxes so option thumbnails focus on the feature they change.
export const AVATAR_CROPS = { full: "0 0 100 100", head: "12 4 76 76", face: "22 18 56 56", eyes: "30 28 40 40", mouth: "32 40 36 36" };

export function AvatarSvg({ a, size = 96, crop = "full" }: { a: AvatarData; size?: number; crop?: keyof typeof AVATAR_CROPS }) {
  const v = { ...DEFAULT_AVATAR, ...a };
  const skin = v.skin;
  const hc = v.hairColor;
  const head = v.face === "Cuadrado" ? <Rect x={30} y={22} width={40} height={44} rx={15} fill={skin} /> : <Ellipse cx={50} cy={44} rx={v.face === "Ovalado" ? 18 : 20.5} ry={v.face === "Ovalado" ? 24 : 22} fill={skin} />;
  const covered = v.headwear !== "Ninguno" && v.headwear !== "Banda";
  return (
    <Svg width={size} height={size} viewBox={AVATAR_CROPS[crop]}>
      <Circle cx={50} cy={50} r={50} fill={v.bg} />
      {!covered && (v.hair === "Largo" || v.hair === "Melena") ? <Path d={v.hair === "Largo" ? "M28 40 Q26 80 36 86 L64 86 Q74 80 72 40 Z" : "M28 40 Q27 64 34 68 L66 68 Q73 64 72 40 Z"} fill={hc} /> : null}
      <Path d={v.clothes === "Sudadera" ? "M12 100 Q12 70 50 68 Q88 70 88 100 Z" : "M16 100 Q16 73 50 71 Q84 73 84 100 Z"} fill={v.clothColor} stroke={v.clothColor === "#FFFFFF" ? "#E0D2BC" : "none"} />
      <Rect x={44} y={58} width={12} height={15} rx={5} fill={skin} />
      {v.clothes === "Cuello V" ? <Path d="M42 71 L50 82 L58 71 Z" fill={skin} /> : v.clothes === "Sudadera" ? <Path d="M34 72 Q50 84 66 72" stroke={INK} strokeOpacity={0.15} strokeWidth={4} fill="none" /> : <Path d="M42 71 Q50 76 58 71" stroke={INK} strokeOpacity={0.12} strokeWidth={2} fill="none" />}
      <Circle cx={30} cy={46} r={4} fill={skin} />
      <Circle cx={70} cy={46} r={4} fill={skin} />
      {head}
      {!covered && v.hair === "Rapado" ? <Path d="M30 38 Q32 20 50 19 Q68 20 70 38 Q60 28 50 28 Q40 28 30 38 Z" fill={hc} opacity={0.55} /> : null}
      {!covered && ["Corto", "Melena", "Largo", "Chongo"].includes(v.hair) ? <Path d="M28 42 Q27 17 50 17 Q73 17 72 42 Q66 30 56 28 Q44 33 30 40 Z" fill={hc} /> : null}
      {!covered && v.hair === "Chongo" ? <Circle cx={50} cy={13} r={8} fill={hc} /> : null}
      {!covered && v.hair === "Rizado" ? (
        <G fill={hc}>
          {[30, 37, 44, 51, 58, 65, 70].map((x, i) => (
            <Circle key={x} cx={x} cy={i % 2 ? 21 : 27} r={7.5} />
          ))}
          <Circle cx={28} cy={36} r={6} />
          <Circle cx={72} cy={36} r={6} />
        </G>
      ) : null}
      {v.headwear === "Pañuelo" ? (
        <G fill={v.headColor}>
          <Path d="M27 44 Q25 15 50 15 Q75 15 73 44 Q62 33 50 33 Q38 33 27 44 Z" />
          <Circle cx={73} cy={38} r={5} />
          <Path d="M73 40 L82 54 L76 56 Z" />
        </G>
      ) : null}
      {v.headwear === "Gorro" ? (
        <G>
          <Path d="M27 38 Q27 12 50 12 Q73 12 73 38 Z" fill={v.headColor} />
          <Rect x={25} y={33} width={50} height={9} rx={4.5} fill={v.headColor} stroke={INK} strokeOpacity={0.12} />
        </G>
      ) : null}
      {v.headwear === "Turbante" ? (
        <G fill={v.headColor}>
          <Path d="M26 42 Q22 10 50 11 Q78 10 74 42 Q62 30 50 31 Q38 30 26 42 Z" />
          <Path d="M36 22 Q50 34 64 22" stroke={INK} strokeOpacity={0.15} strokeWidth={2} fill="none" />
        </G>
      ) : null}
      {v.headwear === "Banda" ? <Rect x={29} y={29} width={42} height={6} rx={3} fill={v.headColor} /> : null}
      {v.brows !== "Sin cejas" ? (
        <G stroke={covered ? INK : hc === "#BDBDBD" ? "#8A8A8A" : hc} strokeWidth={2} strokeLinecap="round" fill="none">
          {v.brows === "Rectas" ? (
            <>
              <Line x1={38} y1={37} x2={45} y2={37} />
              <Line x1={55} y1={37} x2={62} y2={37} />
            </>
          ) : (
            <>
              <Path d={v.brows === "Arqueadas" ? "M38 38 Q41.5 33 45 37" : "M38 37.5 Q41.5 35.5 45 37"} />
              <Path d={v.brows === "Arqueadas" ? "M55 37 Q58.5 33 62 38" : "M55 37 Q58.5 35.5 62 37.5"} />
            </>
          )}
        </G>
      ) : null}
      {v.eyes === "Sonrientes" ? (
        <G stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none">
          <Path d="M39 45 Q41.5 42 44 45" />
          <Path d="M56 45 Q58.5 42 61 45" />
        </G>
      ) : v.eyes === "Tranquilos" ? (
        <G stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none">
          <Path d="M39 44 Q41.5 46.5 44 44" />
          <Path d="M56 44 Q58.5 46.5 61 44" />
        </G>
      ) : v.eyes === "Abiertos" ? (
        <G>
          <Circle cx={41.5} cy={44} r={3.6} fill="#FFFFFF" />
          <Circle cx={58.5} cy={44} r={3.6} fill="#FFFFFF" />
          <Circle cx={42} cy={44.5} r={2} fill={INK} />
          <Circle cx={59} cy={44.5} r={2} fill={INK} />
        </G>
      ) : (
        <G fill={INK}>
          <Circle cx={41.5} cy={44} r={2.3} />
          <Circle cx={58.5} cy={44} r={2.3} />
        </G>
      )}
      {v.glasses !== "Sin lentes" ? (
        <G stroke={INK} strokeWidth={1.6} fill="none">
          {v.glasses === "Redondos" ? (
            <>
              <Circle cx={41.5} cy={44} r={6} />
              <Circle cx={58.5} cy={44} r={6} />
            </>
          ) : (
            <>
              <Rect x={35} y={39} width={13} height={10} rx={2.5} />
              <Rect x={52} y={39} width={13} height={10} rx={2.5} />
            </>
          )}
          <Line x1={47.5} y1={44} x2={52.5} y2={44} />
        </G>
      ) : null}
      {v.accessory === "Pecas" ? (
        <G fill="#A0522D" opacity={0.45}>
          {[[37, 51], [40, 53], [43, 51], [57, 51], [60, 53], [63, 51]].map(([x, y]) => (
            <Circle key={`${x}${y}`} cx={x} cy={y} r={0.9} />
          ))}
        </G>
      ) : null}
      {v.accessory === "Lunar" ? <Circle cx={61} cy={54} r={1.3} fill={INK} /> : null}
      {v.accessory === "Aretes" ? (
        <G fill="#E3B341">
          <Circle cx={30} cy={52} r={2} />
          <Circle cx={70} cy={52} r={2} />
        </G>
      ) : null}
      {v.accessory === "Vello facial" ? <Path d="M37 54 Q50 72 63 54 Q58 62 50 62 Q42 62 37 54 Z" fill={hc} opacity={0.85} /> : null}
      {v.mouth === "Neutral" ? (
        <Line x1={45} y1={56} x2={55} y2={56} stroke={INK} strokeWidth={2} strokeLinecap="round" />
      ) : v.mouth === "Abierta" ? (
        <Ellipse cx={50} cy={56.5} rx={4} ry={3} fill={INK} />
      ) : v.mouth === "Pequeña" ? (
        <Path d="M47 55.5 Q50 58 53 55.5" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      ) : (
        <Path d="M43 54 Q50 61 57 54" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      )}
      <Circle cx={36} cy={52} r={3} fill="#FF8A80" opacity={0.18} />
      <Circle cx={64} cy={52} r={3} fill="#FF8A80" opacity={0.18} />
    </Svg>
  );
}

/** Shows the saved avatar, or a soft initial when none has been created (avatar is optional). */
export function Avatar({ avatar, name, size = 48, testID }: { avatar?: AvatarData | null; name?: string; size?: number; testID?: string }) {
  const { colors } = useTheme();
  if (avatar && Object.keys(avatar).length)
    return (
      <View testID={testID} style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
        <AvatarSvg a={avatar} size={size} />
      </View>
    );
  return (
    <View testID={testID} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.lavenderSoft, alignItems: "center", justifyContent: "center" }}>
      <Txt v="title" style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }}>
        {(name || "?").slice(0, 1).toUpperCase()}
      </Txt>
    </View>
  );
}
