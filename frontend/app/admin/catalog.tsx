import { useState } from "react";
import { Linking, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { API_BASE, api, authHeader, invalidate } from "@/src/api";
import { AdminScreen } from "@/src/components/admin-ui";
import { useToast } from "@/src/toast";
import { uploadForm } from "@/src/utils/upload";
import { Btn, Card, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

/** Export the full catalogue (every active item and variant) and import researched acquisition costs with a preview. */
export default function AdminCatalog() {
  const toast = useToast();
  const { colors } = useTheme();
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (format: "csv" | "xlsx") => {
    setBusy(format);
    try {
      const r = await api(`/admin/catalog/export-link?format=${format}`, { method: "POST" });
      await Linking.openURL(API_BASE.replace(/\/api$/, "") + r.path);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const send = async (confirm: boolean, asset = file) => {
    if (!asset) return;
    setBusy(confirm ? "confirm" : "preview");
    try {
      const r = await uploadForm(`${API_BASE}/admin/catalog/import`, {
        files: { file: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType || undefined } },
        fields: { confirm: confirm ? "true" : "false" },
        headers: authHeader(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "No pudimos leer el archivo");
      setPreview(data);
      if (confirm) {
        invalidate();
        toast.show(`Costos actualizados en ${data.applied} artículo(s)`);
      }
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "*/*"], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    setFile(res.assets[0]);
    setPreview(null);
    send(false, res.assets[0]);
  };

  return (
    <AdminScreen title="Catálogo y costos" subtitle="Precios actuales: provisionales" testID="admin-catalog">
      <Section title="Exportar">
        <Txt v="caption" style={{ marginBottom: space.sm }}>Incluye todos los artículos activos y cada variante, con columnas para proveedor, mayoreo, impuestos y costo final. Las columnas de investigación salen vacías: no inventamos proveedores ni precios.</Txt>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Btn label="Excel (.xlsx)" icon="file-spreadsheet" loading={busy === "xlsx"} onPress={() => download("xlsx")} testID="admin-export-xlsx" style={{ flex: 1 }} />
          <Btn label="CSV" variant="secondary" icon="file-text" loading={busy === "csv"} onPress={() => download("csv")} testID="admin-export-csv" style={{ flex: 1 }} />
        </View>
      </Section>
      <Section title="Importar costos investigados">
        <Txt v="caption" style={{ marginBottom: space.sm }}>Sube el archivo exportado con tus datos. Primero verás una vista previa; nada se guarda hasta que confirmes. Los precios públicos y suplementos nunca cambian solos.</Txt>
        <Btn label={file ? `Cambiar archivo (${file.name})` : "Elegir archivo"} variant="secondary" icon="upload" loading={busy === "preview"} onPress={pick} testID="admin-import-pick" />
        {preview ? (
          <Card style={{ marginTop: space.md }} testID="admin-import-preview">
            <Txt v="title">{preview.confirmed ? "Importación aplicada" : "Vista previa"}</Txt>
            <Txt v="caption">{preview.rows} fila(s) · {preview.changes.length} con cambios · {preview.errors.length} con errores</Txt>
            {preview.errors.slice(0, 8).map((e: any) => <Txt key={e.row} v="caption" color={colors.onError}>Fila {e.row}: {e.error}</Txt>)}
            {preview.changes.slice(0, 12).map((c: any, i: number) => (
              <Txt key={i} v="caption" color={colors.onSurface} style={{ marginTop: 4 }}>
                {c.sku} · {c.variant}: {Object.entries(c.fields).map(([k, v]: any) => `${k} ${v.old || "—"} → ${v.new}`).join(", ")}
              </Txt>
            ))}
            {preview.changes.length > 12 ? <Txt v="caption">…y {preview.changes.length - 12} más</Txt> : null}
            <Txt v="caption" style={{ marginTop: space.sm }}>{preview.note}</Txt>
            {!preview.confirmed ? (
              <Btn label="Confirmar importación" disabled={!!preview.errors.length || !preview.changes.length} loading={busy === "confirm"} onPress={() => send(true)} testID="admin-import-confirm" style={{ marginTop: space.md }} />
            ) : null}
            {preview.errors.length ? <Txt v="caption" style={{ marginTop: space.sm }}>Corrige los errores en el archivo y vuelve a subirlo.</Txt> : null}
          </Card>
        ) : null}
      </Section>
    </AdminScreen>
  );
}
