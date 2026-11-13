import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { fmtDate } from "@/src/constants";
import { Empty, Loading, Row, Screen } from "@/src/ui";

const META: Record<string, { icon: string; tint: string }> = {
  events: { icon: "calendar", tint: "sage" },
  journal: { icon: "notebook-pen", tint: "lavender" },
  signal: { icon: "radio", tint: "coral" },
  order: { icon: "truck", tint: "sand" },
};

export default function History() {
  const router = useRouter();
  const q = useApi<any[]>("/history");
  const open = (h: any) => {
    if (h.kind === "events") router.push(`/event/${h.id}`);
    else if (h.kind === "order") router.push(`/order/${h.id}`);
    else if (h.kind === "signal") router.push("/signals");
    else router.push({ pathname: "/record-form", params: { kind: "journal", id: h.id } });
  };
  return (
    <Screen title="Historial personal" subtitle="Lo que has vivido y registrado" testID="history-screen" refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isLoading ? <Loading /> : (q.data || []).length === 0 ? (
        <Empty icon="history" title="Tu historial está en blanco" text="Aquí aparecerán eventos pasados, registros, señales y pedidos." testID="history-empty" />
      ) : (
        q.data!.map((h, i) => <Row key={`${h.kind}-${h.id}`} icon={META[h.kind]?.icon} tint={META[h.kind]?.tint} title={h.title} subtitle={`${fmtDate(h.date)}${h.subtitle ? ` · ${h.subtitle}` : ""}`} onPress={() => open(h)} testID={`history-${h.id}`} last={i === q.data!.length - 1} />)
      )}
    </Screen>
  );
}
