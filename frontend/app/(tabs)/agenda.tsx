import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { TabScreen } from "@/src/components/tab-screen";
import { fmtDate, today } from "@/src/constants";
import { Chip, Empty, ErrorState, Fab, Loading, Row, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function Agenda() {
  const router = useRouter();
  const params = useLocalSearchParams<{ owner?: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const net = useApi<any>("/network");
  const [owner, setOwner] = useState<string | null>(params.owner || null);
  const [past, setPast] = useState(false);
  const linked = (net.data?.as_caregiver || []).filter((l: any) => l.status === "active");
  const ownerId = owner || user?.id;
  const ownerLink = linked.find((l: any) => l.patient_id === owner);
  const q = useApi<any[]>(`/records/events${owner ? `?owner_id=${owner}` : ""}`);
  const t = today();
  const list = (q.data || []).filter((e) => (past ? (e.date || "") < t : (e.date || "9999") >= t));
  if (past) list.reverse();
  const groups: Record<string, any[]> = {};
  list.forEach((e) => (groups[e.date || "Sin fecha"] = [...(groups[e.date || "Sin fecha"] || []), e]));
  const canEdit = !owner || ownerLink?.permissions?.edit;

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 56, flexGrow: 0, borderBottomWidth: 0.5, borderBottomColor: colors.divider }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, alignItems: "center" }}>
      <Chip label="Próximos" selected={!past} onPress={() => setPast(false)} testID="agenda-upcoming-chip" />
      <Chip label="Anteriores" selected={past} onPress={() => setPast(true)} testID="agenda-past-chip" />
      {linked.length > 0 ? (
        <>
          <View style={{ width: 1, height: 24, backgroundColor: colors.divider }} />
          <Chip label="Mi agenda" selected={!owner} onPress={() => setOwner(null)} testID="agenda-owner-me" />
          {linked.map((l: any) => (
            <Chip key={l.id} label={l.patient_name} selected={owner === l.patient_id} onPress={() => setOwner(l.patient_id)} testID={`agenda-owner-${l.patient_id}`} />
          ))}
        </>
      ) : null}
    </ScrollView>
  );

  return (
    <TabScreen
      title="Agenda"
      testID="agenda-screen"
      sticky={chips}
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      overlay={(bc) =>
        canEdit ? <Fab bottom={bc + 16} label="Evento" onPress={() => router.push({ pathname: "/record-form", params: { kind: "events", owner_id: owner || "" } })} testID="agenda-add-button" /> : null
      }
    >
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <Empty icon="calendar" title={past ? "Nada en el pasado" : "Agenda libre"} text="Agrega citas, sesiones, estudios o actividades que disfrutes." testID="agenda-empty" />
      ) : (
        Object.entries(groups).map(([date, items]) => (
          <View key={date} style={{ marginTop: space.lg }}>
            <Txt v="label" style={{ marginBottom: space.xs }}>
              {fmtDate(date)}
            </Txt>
            {items.map((e, i) => (
              <Row
                key={e.id}
                icon={e.type === "Actividad personal" ? "sun" : e.type === "Traslado" ? "car" : "calendar"}
                tint={e.type === "Sesión de tratamiento" ? "sage" : e.type === "Actividad personal" ? "coral" : "lavender"}
                title={e.title}
                subtitle={[e.time, e.type, e.location].filter(Boolean).join(" · ")}
                onPress={() => router.push({ pathname: "/event/[id]", params: { id: e.id, owner_id: owner || "" } })}
                testID={`agenda-event-${e.id}`}
                last={i === items.length - 1}
              />
            ))}
          </View>
        ))
      )}
      {owner && ownerId !== user?.id ? (
        <Txt v="caption" style={{ marginTop: space.xl }}>
          Ves la agenda que {ownerLink?.patient_name} decidió compartir contigo.
        </Txt>
      ) : null}
    </TabScreen>
  );
}
