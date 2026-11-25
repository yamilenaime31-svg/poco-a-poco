import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { fmtDate } from "@/src/constants";
import { Row, Section, Txt } from "@/src/ui";

/** Preparation lists other people shared with me. `ownerId` narrows to one person; `hideEmpty` renders nothing when there are none. */
export function SharedLists({ ownerId, ownerName, hideEmpty }: { ownerId?: string; ownerName?: string; hideEmpty?: boolean }) {
  const router = useRouter();
  const q = useApi<any>("/checklists");
  const all: any[] = (q.data?.shared || []).filter((c: any) => !ownerId || c.owner_id === ownerId);
  // Unfinished first, then the nearest date.
  const lists = [...all].sort((a, b) => Number(a.done === a.total && a.total > 0) - Number(b.done === b.total && b.total > 0) || (a.date || "9999").localeCompare(b.date || "9999")).slice(0, 4);
  if (hideEmpty && lists.length === 0) return null;
  return (
    <Section title="Listas compartidas contigo" action={all.length ? "Ver todas" : undefined} onAction={() => router.push("/checklists")} testID="home-shared-lists">
      {lists.length === 0 ? (
        <Txt v="caption">{q.isLoading ? "Cargando…" : `${ownerName || "Nadie"} aún no comparte listas de preparación contigo.`}</Txt>
      ) : lists.map((c, i) => {
        const left = c.total - c.done;
        return (
          <Row key={c.id} icon={left === 0 && c.total ? "circle-check" : "clipboard-list"} tint="sand" title={c.title}
            subtitle={[ownerId ? "" : `De ${c.owner_name}`, c.date ? fmtDate(c.date) : "", c.total === 0 ? "Sin puntos todavía" : left === 0 ? "Todo listo" : `Falta${left === 1 ? "" : "n"} ${left} de ${c.total}`].filter(Boolean).join(" · ")}
            onPress={() => router.push(`/checklist/${c.id}`)} testID={`home-shared-list-${c.id}`} last={i === lists.length - 1} />
        );
      })}
    </Section>
  );
}
