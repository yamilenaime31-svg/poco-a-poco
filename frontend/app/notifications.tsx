import { useEffect } from "react";
import { useRouter } from "expo-router";

import { api, useApi } from "@/src/api";
import { fmtDateTime } from "@/src/constants";
import { Empty, Loading, Row, Screen } from "@/src/ui";

const ICONS: Record<string, string> = { signal: "radio", network: "users", order: "truck", tasks: "list-checks", records: "calendar" };

export default function Notifications() {
  const router = useRouter();
  const q = useApi<any[]>("/notifications");
  useEffect(() => {
    if (q.data?.some((n) => !n.read)) api("/notifications/read-all", { method: "POST" }).catch(() => {});
  }, [q.data]);
  return (
    <Screen title="Notificaciones" testID="notifications-screen" refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isLoading ? <Loading /> : (q.data || []).length === 0 ? (
        <Empty icon="bell" title="Todo en calma" text="Aquí verás respuestas de tu red, invitaciones y el estado de tus pedidos." testID="notifications-empty" />
      ) : (
        q.data!.map((n, i) => (
          <Row
            key={n.id}
            icon={ICONS[n.kind] || "bell"}
            tint={n.read ? "sand" : "coral"}
            title={n.title}
            subtitle={`${n.body ? `${n.body} · ` : ""}${fmtDateTime(n.created_at)}`}
            onPress={n.link ? () => router.push(n.link) : undefined}
            testID={`notification-${n.id}`}
            last={i === q.data!.length - 1}
          />
        ))
      )}
    </Screen>
  );
}
