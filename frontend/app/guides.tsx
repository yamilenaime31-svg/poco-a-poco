import { useApi } from "@/src/api";
import { PlusTag } from "@/src/components/plus-gate";
import { GuideCard } from "@/src/components/guide-info";
import { ErrorState, Loading, Screen, Txt } from "@/src/ui";
import { space } from "@/src/theme";

export default function Guides() {
  const q = useApi<any>("/guided-kits");
  return (
    <Screen title="Kits según guías confiables" testID="guides-screen" refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Txt style={{ marginBottom: space.lg }}>
        Armados a partir de información general del Instituto Nacional del Cáncer, la American Cancer Society y MedlinePlus. Elige solo lo que te sirva y personalízalo a tu modo.
      </Txt>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          {q.data.plus ? <PlusTag why="Con tu membresía ves primero los temas de tu tratamiento y los que elegiste." testID="guides-plus" style={{ marginTop: 0, marginBottom: space.md }} /> : null}
          {!q.data.plus ? <Txt v="caption" style={{ marginBottom: space.md }} testID="guides-free-note">Con AMODO Plus, primero verás los temas relacionados con tu tratamiento y los que elijas.</Txt> : null}
          {q.data.kits.map((k: any) => <GuideCard key={k.id} k={k} />)}
        </>
      )}
    </Screen>
  );
}

