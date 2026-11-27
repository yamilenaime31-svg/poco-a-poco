// Perfil: what the Plus membership gave this month, counted from the account's real activity.
import { View } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { PlusTag } from "@/src/components/plus-gate";
import { MONTHS_LONG, money } from "@/src/constants";
import { Row, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export function PlusUsage() {
  const { colors } = useTheme();
  const router = useRouter();
  const q = useApi<any>("/me/plus-usage");
  const d = q.data;
  if (!d) return null;
  const used = d.reports || d.credits_received || d.kit_savings || d.ai || d.inspirations;
  const rows: { icon: string; tint: string; title: string; sub: string; href: string; k: string }[] = [
    { k: "reports", icon: "file-text", tint: "butter", title: `${d.reports} reporte${d.reports === 1 ? "" : "s"} creado${d.reports === 1 ? "" : "s"}`, sub: "De Mi proceso y de Gastos", href: "/process-report" },
    { k: "credits", icon: "calendar-check", tint: "sand", title: `${money(d.credits_received)} en créditos recibidos`, sub: d.credits_used ? `Usaste ${money(d.credits_used)} en pedidos` : "Disponibles para tus kits", href: "/credits" },
    { k: "savings", icon: "package", tint: "sage", title: `${money(d.kit_savings)} de ahorro en kits`, sub: d.kit_orders ? `Descuento Plus en ${d.kit_orders} pedido${d.kit_orders === 1 ? "" : "s"}` : "El descuento Plus se aplica al pagar un kit", href: "/orders" },
    ...(d.ai ? [{ k: "ai", icon: "sparkles", tint: "lavender", title: `${d.ai} interacci${d.ai === 1 ? "ón" : "ones"} con el asistente`, sub: "Para organizar tratamientos y documentos", href: "/treatment-assistant" }] : []),
    ...(d.inspirations ? [{ k: "style", icon: "palette", tint: "mauve", title: `${d.inspirations} ${d.inspirations === 1 ? "imagen" : "imágenes"} de inspiración`, sub: "En Identidad y estilo", href: "/style" }] : []),
  ];
  return (
    <View style={{ backgroundColor: colors.lavenderSoft, borderRadius: radius.lg, padding: space.lg, marginTop: space.md }} testID="plus-usage-card">
      <Txt v="title">Tu Plus en {MONTHS_LONG[Number(d.month.slice(5)) - 1]}</Txt>
      <PlusTag why="Lo que tu membresía te ha dado este mes." testID="plus-usage-tag" style={{ marginTop: 4, marginBottom: space.sm }} />
      {rows.map((r, i) => <Row key={r.k} icon={r.icon} tint={r.tint} title={r.title} subtitle={r.sub} onPress={() => router.push(r.href as any)} testID={`plus-usage-${r.k}`} last={i === rows.length - 1} />)}
      {d.value > 0 ? (
        <Txt v="caption" color={colors.onSurface} style={{ marginTop: space.sm }} testID="plus-usage-value">
          Entre créditos y ahorro: {money(d.value)} este mes.{d.by_institution ? " Tu institución cubre tu membresía." : ` Tu membresía: ${money(d.price)} al mes (demostración, sin cobro).`}
        </Txt>
      ) : null}
      {d.unused?.length ? (
        <View style={{ marginTop: space.lg }} testID="plus-unused">
          <Txt v="label" color={colors.onSurface}>Aún por descubrir · {d.unused.length} de {d.tools}</Txt>
          <Txt v="caption" style={{ marginBottom: 4 }}>Sin prisa: son parte de tu membresía y están aquí para cuando te sirvan.</Txt>
          {d.unused.map((u: any, i: number) => <Row key={u.key} icon="sparkles" tint="lavender" title={u.title} subtitle={u.why} onPress={() => router.push(u.href)} testID={`plus-unused-${u.key}`} last={i === d.unused.length - 1} />)}
        </View>
      ) : d.unused ? <Txt v="caption" style={{ marginTop: space.md }} testID="plus-unused-none">Ya probaste todas las herramientas de tu membresía.</Txt> : null}
      {!used ? <Txt v="caption" style={{ marginTop: space.sm }}>Aún no has usado tus beneficios este mes. Están aquí para cuando los necesites.</Txt> : null}
    </View>
  );
}
