import { useState } from "react";
import { Share } from "react-native";

import { api } from "@/src/api";
import { PlusGate } from "@/src/components/plus-gate";
import { today } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Card, Screen, Txt } from "@/src/ui";
import { space } from "@/src/theme";

export default function Report() {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try {
      setText((await api<any>(`/report?today=${today()}`)).text);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Reporte personal" subtitle="Un resumen de tus próximos 30 días para compartir con quien elijas" testID="report-screen">
      <PlusGate why="Incluido en tu membresía: tu agenda y medicamentos en un resumen listo para compartir." title="Reportes exportables con AMODO Plus" text="Genera un resumen de tu agenda y medicamentos registrados para compartirlo o guardarlo. Tus datos siguen disponibles en Agenda con cualquier plan."
        preview={<Card><Txt v="caption">AMODO · Resumen personal{"\n"}AGENDA{"\n"}- 25 nov · Sesión de tratamiento…</Txt></Card>}>
        <Btn label="Generar reporte" icon="file-text" loading={busy} onPress={make} testID="report-generate" />
        {text ? (
          <>
            <Card style={{ marginTop: space.lg }} testID="report-text"><Txt v="caption" selectable>{text}</Txt></Card>
            <Btn label="Compartir o guardar" variant="secondary" icon="share-2" onPress={() => Share.share({ message: text })} testID="report-share" style={{ marginTop: space.md }} />
          </>
        ) : null}
      </PlusGate>
    </Screen>
  );
}
