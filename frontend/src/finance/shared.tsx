// Shared pieces for coverage / expenses: option lists, collapsible section and private document attachments.
import React, { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { API_BASE, api, authHeader, useApi } from "@/src/api";
import { PlusTag } from "@/src/components/plus-gate";
import { useToast } from "@/src/toast";
import { uploadForm } from "@/src/utils/upload";
import { Btn, Chip, ChipRow, Ic, IconBtn, Sheet, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export const CATEGORIES = ["Consultas médicas", "Tratamientos", "Hospitalización", "Cirugías", "Medicamentos", "Estudios de laboratorio", "Estudios de imagen", "Material médico", "Rehabilitación", "Apoyo psicológico",
  "Traslados", "Estacionamiento", "Hospedaje", "Alimentación", "Cuidado personal", "Productos de comodidad", "Accesorios de identidad y apariencia", "Kits AMODO", "Otros gastos"];
export const MODES = ["Pago directo de la aseguradora", "Pago mío con solicitud de reembolso", "Cobertura parcial", "Apoyo económico institucional", "Sin cobertura", "Pendiente de confirmar"];
export const OTHER_SOURCES = ["Recursos propios", "Apoyo familiar", "Otra fuente", "Aún no lo sé"];
export const METHODS = ["Efectivo", "Tarjeta", "Transferencia", "Otro"];
export const DOC_CATS = ["Factura CFDI en PDF", "Archivo XML del CFDI", "Comprobante de pago", "Recibo de honorarios", "Receta médica", "Informe médico", "Resultados de estudios", "Formato de reclamación",
  "Carta de autorización", "Estado de cuenta del trámite", "Comprobante de reembolso", "Otros documentos"];
export const COVERAGE_DOCS = ["Póliza", "Credencial del seguro", "Condiciones generales", "Condiciones particulares", "Carta de autorización", "Endoso", "Otros documentos"];
export const fileUrl = (path: string) => API_BASE.replace(/\/api$/, "") + path;

/** Progressive section: closed by default so long forms stay short. */
export function Fold({ title, hint, open: initial, children, testID, tint = "surfaceSecondary" }: { title: string; hint?: string; open?: boolean; children: React.ReactNode; testID: string; tint?: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(!!initial);
  return (
    <View style={{ backgroundColor: (colors as any)[tint], borderRadius: radius.lg, marginBottom: space.sm, paddingHorizontal: space.lg }}>
      <Pressable onPress={() => setOpen(!open)} testID={testID} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: "row", alignItems: "center", minHeight: 60, gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Txt v="title">{title}</Txt>
          {hint ? <Txt v="caption" color={colors.onSurface}>{hint}</Txt> : null}
        </View>
        <Ic name={open ? "chevron-up" : "chevron-down"} size={18} />
      </Pressable>
      {open ? <View style={{ paddingBottom: space.lg }}>{children}</View> : null}
    </View>
  );
}

/** Attach, open and remove private documents for an expense or a coverage. `onExtract` (Plus) reads one with AI after consent. */
export function Docs({ refId, refType = "expense", cats, canAttach = true, plus, extractKind, onExtract }: { refId: string; refType?: "expense" | "coverage"; cats: string[]; canAttach?: boolean; plus?: boolean; extractKind?: "receipt" | "policy"; onExtract?: (fields: any) => void }) {
  const toast = useToast();
  const q = useApi<any[]>(`/finance/docs?ref_id=${refId}&ref_type=${refType}`);
  const [cat, setCat] = useState("");
  const [busy, setBusy] = useState("");
  const [consent, setConsent] = useState<any>(null);

  const attach = async (category: string) => {
    setCat("");
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*", "text/xml", "application/xml"], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setBusy("up");
    try {
      const r = await uploadForm(`${API_BASE}/finance/docs`, { headers: authHeader(), fields: { ref_id: refId, ref_type: refType, category }, files: { file: { uri: a.uri, name: a.name, mimeType: a.mimeType || undefined } } });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || "No pudimos subir el archivo");
      toast.show("Documento guardado de forma privada");
      q.refetch();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy("");
    }
  };
  const open = async (id: string) => {
    try {
      await Linking.openURL(fileUrl((await api(`/finance/docs/${id}/link`, { method: "POST" })).path));
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  const remove = async (id: string) => { await api(`/finance/docs/${id}`, { method: "DELETE" }).catch((e) => toast.show(e.message, "error")); q.refetch(); };
  const extract = async () => {
    const d = consent;
    setConsent(null);
    setBusy(d.id);
    try {
      const r = await api(`/finance/docs/${d.id}/extract`, { method: "POST", body: { kind: extractKind, consent: true } });
      onExtract?.(r.fields);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <View testID="finance-docs">
      {(q.data || []).map((d) => (
        <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 52 }}>
          <Pressable onPress={() => open(d.id)} testID={`doc-open-${d.id}`} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48 }}>
            <Ic name="file-text" size={18} />
            <View style={{ flex: 1 }}>
              <Txt v="medium" numberOfLines={1} style={{ fontSize: 14 }}>{d.category}</Txt>
              <Txt v="caption" numberOfLines={1}>{d.name} · {d.created_by}</Txt>
            </View>
          </Pressable>
          {plus && onExtract && d.mime !== "text/xml" && d.mime !== "application/xml" ? <IconBtn icon={busy === d.id ? "loader" : "sparkles"} onPress={() => (busy ? undefined : setConsent(d))} testID={`doc-extract-${d.id}`} /> : null}
          {canAttach ? <IconBtn icon="trash-2" onPress={() => remove(d.id)} testID={`doc-delete-${d.id}`} /> : null}
        </View>
      ))}
      {q.data && q.data.length === 0 ? <Txt v="caption" style={{ marginBottom: space.sm }}>Sin documentos todavía. Se guardan de forma privada y solo se abren con un enlace temporal.</Txt> : null}
      {canAttach ? <Btn label="Adjuntar documento" small variant="secondary" icon="paperclip" loading={busy === "up"} onPress={() => setCat("pick")} testID="docs-attach" style={{ alignSelf: "flex-start" }} /> : null}
      {onExtract && plus ? <PlusTag why="Toca ✦ en un documento y la IA te propone los datos para revisar." testID="docs-plus" /> : null}
      {onExtract && !plus ? <Txt v="caption" style={{ marginTop: space.sm }}>Con AMODO Plus puedes pedir a la IA que lea un comprobante y te proponga los datos para revisar.</Txt> : null}
      <Sheet visible={!!cat} onClose={() => setCat("")} title="¿Qué documento es?" testID="docs-category-sheet">
        <ChipRow>{cats.map((c) => <Chip key={c} label={c} onPress={() => attach(c)} testID={`docs-cat-${c}`} />)}</ChipRow>
        <Txt v="caption" style={{ marginTop: space.md }}>PDF, imagen o XML de hasta 12 MB.</Txt>
      </Sheet>
      <Sheet visible={!!consent} onClose={() => setConsent(null)} title="Leer con IA" testID="docs-consent-sheet">
        <Txt>Enviaremos solo este documento a un modelo de IA para proponerte sus datos. Nada se guarda hasta que lo revises y confirmes, y cuenta como una interacción del asistente.</Txt>
        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
          <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={() => setConsent(null)} testID="docs-consent-cancel" />
          <Btn label="Autorizo leerlo" style={{ flex: 1.3 }} onPress={extract} testID="docs-consent-ok" />
        </View>
      </Sheet>
    </View>
  );
}
