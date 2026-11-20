import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { useAuth } from "@/src/auth";
import { GuideInfo } from "@/src/components/guide-info";
import { Badge, Btn, Card, Chip, ChipRow, ErrorState, Field, Loading, ProductImage, Row, Screen, Sheet, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function KitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const q = useApi<any>(`/kits/${id}`);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { user } = useAuth();
  const net = useApi<any>("/network");
  const patients = (net.data?.as_caregiver || []).filter((l: any) => l.status === "active");
  const [gift, setGift] = useState(false);
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const k = q.data;
  const received = !!k && !k.template && k.owner_id !== user?.id;
  const target = to || patients[0]?.patient_id || "";

  const sendGift = async () => {
    setBusy(true);
    try {
      await api(`/kits/${id}/gift`, { method: "POST", body: { patient_id: target, message: msg } });
      invalidate();
      setGift(false);
      toast.show("Regalo listo en tu carrito. Le avisaremos cuando hagas el pedido.");
      router.push("/cart");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const addCart = async () => {
    setBusy(true);
    try {
      await api("/cart", { method: "POST", body: { type: "kit", ref_id: id, qty: 1 } });
      invalidate();
      toast.show("Kit agregado al carrito");
      router.push("/cart");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    await api(`/kits/${id}`, { method: "DELETE" });
    invalidate();
    setConfirm(false);
    toast.show("Kit eliminado");
    router.back();
  };

  return (
    <Screen
      title={k?.template ? "Kit sugerido" : received ? "Kit recibido" : "Mi kit"}
      testID="kit-detail-screen"
      footer={
        k && !received ? (
          <View style={{ gap: space.sm }}>
          {k.template && patients.length ? <Btn label="Regalar con un mensaje" icon="gift" onPress={() => setGift(true)} testID="kit-gift-button" /> : null}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {k.template ? (
              <Btn label="Personalizar" variant="secondary" icon="sliders-horizontal" onPress={() => router.push({ pathname: "/kit-builder", params: { template: id } })} testID="kit-customize-button" style={{ flex: 1 }} />
            ) : (
              <Btn label="Editar" variant="secondary" icon="pencil" onPress={() => router.push({ pathname: "/kit-builder", params: { id } })} testID="kit-edit-button" style={{ flex: 1 }} />
            )}
            <Btn label="Al carrito" icon="shopping-bag" loading={busy} onPress={addCart} testID="kit-add-cart-button" style={{ flex: 1 }} />
          </View>
          </View>
        ) : null
      }
      overlay={
        <>
        <Sheet visible={gift} onClose={() => setGift(false)} title="Regalar este kit" testID="kit-gift-sheet">
          <Txt v="caption" style={{ marginBottom: space.sm }}>¿Para quién es?</Txt>
          <ChipRow>{patients.map((l: any) => <Chip key={l.patient_id} label={l.patient_name} selected={target === l.patient_id} onPress={() => setTo(l.patient_id)} testID={`kit-gift-to-${l.patient_id}`} />)}</ChipRow>
          <Field label="Tu mensaje (opcional)" value={msg} onChangeText={setMsg} multiline maxLength={300} placeholder="Ej. Para que tus sesiones sean un poco más cómodas" testID="kit-gift-message" style={{ marginTop: space.md }} />
          <Txt v="caption" style={{ marginVertical: space.md }}>Lo agregamos a tu carrito. Cuando hagas el pedido, le avisaremos y verá tu mensaje.</Txt>
          <Btn label="Agregar regalo al carrito" icon="gift" loading={busy} disabled={!target} onPress={sendGift} testID="kit-gift-confirm" />
        </Sheet>
        <Sheet visible={confirm} onClose={() => setConfirm(false)} title="¿Eliminar este kit?" testID="kit-delete-sheet">
          <Txt style={{ marginBottom: space.xl }}>Los pedidos ya hechos no se verán afectados.</Txt>
          <Btn label="Sí, eliminar" variant="danger" onPress={remove} testID="kit-delete-confirm-button" />
        </Sheet>
        </>
      }
    >
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <Card style={{ backgroundColor: colors.sand }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {k.items.map((i: any) => (
                <ProductImage key={i.product_id} product={i.product} height={72} style={{ width: 72 }} />
              ))}
            </View>
          </Card>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xl }}>
            <Badge label={k.context || "Kit"} tint="sage" />
            <Badge label={k.size} tint="lavender" />
            {k.for_name ? <Badge label={`Para ${k.for_name}`} tint="coral" /> : null}
          </View>
          <Txt v="h1" style={{ marginTop: space.md }} testID="kit-name">
            {k.name}
          </Txt>
          {k.guide ? <Txt v="caption" style={{ marginTop: space.xs }}>Pensado para: {k.guide.label.toLowerCase()}</Txt> : null}
          {k.guide ? <View style={{ marginTop: space.md }}><GuideInfo guide={k.guide} testID="kit-guide-info" /></View>
            : !k.note && k.description ? <Txt style={{ marginTop: space.sm }}>{k.description}</Txt> : null}
          {k.note ? <Card style={{ marginTop: space.md }} testID="kit-note"><Txt v="label">{k.from_name ? `Mensaje de ${k.from_name}` : k.gift ? "Mensaje" : "Nota"}</Txt><Txt style={{ marginTop: 4 }}>{k.note}</Txt></Card> : null}
          <Txt v="label" style={{ marginTop: space.xl }}>
            {k.items.length} artículos
          </Txt>
          {k.items.map((i: any, idx: number) => (
            <Row key={i.product_id + idx} title={i.product.name} subtitle={[i.product.category, i.options?.color, i.options?.text ? `“${i.options.text}”` : null].filter(Boolean).join(" · ")} right={<Txt v="caption">{i.product.tier === "premium" ? `+${money(i.product.supplement)}` : "Incluido"}</Txt>} onPress={() => router.push(`/product/${i.product_id}`)} testID={`kit-item-${i.product_id}`} last={idx === k.items.length - 1} />
          ))}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: space.lg, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.onSurface }}>
            <Txt v="caption">{k.size_label} {money(k.base_price)}{k.supplements ? ` + suplementos ${money(k.supplements)}` : ""} · precios de ejemplo</Txt>
            <Txt v="h2" testID="kit-detail-total">
              {money(k.total)}
            </Txt>
          </View>
          {!k.template && !received ? <Btn label="Duplicar kit" variant="secondary" icon="copy" onPress={async () => { const r = await api(`/kits/${id}/duplicate`, { method: "POST" }); invalidate(); router.push(`/kit/${r.id}`); }} testID="kit-duplicate-button" style={{ marginTop: space.xl }} /> : null}
          {!k.template && !received ? <Btn label="Eliminar kit" variant="ghost" icon="trash-2" onPress={() => setConfirm(true)} testID="kit-delete-button" style={{ marginTop: space.xl }} /> : null}
        </>
      )}
    </Screen>
  );
}
