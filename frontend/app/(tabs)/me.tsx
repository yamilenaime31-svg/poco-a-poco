import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { Shape, Spot } from "@/src/art";
import { useAuth } from "@/src/auth";
import { PlanCard } from "@/src/components/plan-card";
import { usePlus } from "@/src/components/plus-gate";
import { PlusUsage } from "@/src/components/plus-usage";
import { Avatar } from "@/src/components/avatar";
import { TabScreen } from "@/src/components/tab-screen";
import { useToast } from "@/src/toast";
import { Badge, Btn, Field, Ic, Row, Section, Sheet, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

type Item = { icon: string; title: string; href: any; tint?: string; plus?: string };
const edit = (step: string) => ({ pathname: "/onboarding", params: { edit: "1", step } });

export default function Me() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user, signOut, updateMe } = useAuth();
  const [info, setInfo] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [pref, setPref] = useState(user?.preferred_name || "");
  const isCg = user?.role === "caregiver";
  const { plus } = usePlus();

  const compras: Item[] = [
    { icon: "heart", title: "Biblioteca y favoritos", href: "/favorites", tint: "coral" },
    { icon: "truck", title: "Mis pedidos e historial", href: "/orders", tint: "sky" },
  ];
  const config = { title: "Configuración y privacidad", items: [
    { icon: "bell", title: "Notificaciones", href: "/notifications" },
    { icon: "shield-check", title: "Privacidad", href: { pathname: "/settings", params: { section: "privacy" } } },
    { icon: "accessibility", title: "Accesibilidad y cuenta", href: "/settings" },
    { icon: "circle-help", title: "Ayuda", href: { pathname: "/info/[page]", params: { page: "help" } } },
  ] as Item[] };
  const groups: { title: string; items: Item[] }[] = isCg ? [
    { title: "Mi identidad", items: [
      { icon: "smile", title: "Mi avatar", href: "/avatar", tint: "sky" },
      { icon: "heart", title: "Lo que disfruto en mi tiempo", href: edit("wellbeing"), tint: "coral" },
    ] },
    { title: "Mi experiencia como acompañante", items: [
      { icon: "users", title: "A quién acompaño y cómo", href: edit("relation"), tint: "lavender" },
      { icon: "list-checks", title: "Mis responsabilidades", href: edit("duties"), tint: "sage" },
      { icon: "cloud", title: "Lo que más me cuesta organizar", href: edit("hard"), tint: "mauve" },
      { icon: "clock", title: "Mi disponibilidad", href: edit("availability"), tint: "sky" },
      { icon: "layout-grid", title: "Mis preferencias de organización", href: edit("organize"), tint: "butter" },
      { icon: "star", title: "Lo que quiero tener a la mano", href: edit("at_hand"), tint: "coral" },
    ] },
    { title: "Mi bienestar", items: [
      { icon: "coffee", title: "Lo que necesito yo", href: edit("wellbeing"), tint: "butter" },
      { icon: "chart-no-axes-column", title: "Mi proceso como acompañante", href: "/process", tint: "sage" },
      { icon: "history", title: "Historial personal", href: "/history", tint: "lavender" },
    ] },
    { title: "Personas que acompaño", items: [
      { icon: "users", title: "Personas vinculadas, permisos y accesos", href: "/network", tint: "lavender" },
      { icon: "qr-code", title: "Vincularme con alguien", href: "/link", tint: "sage" },
      { icon: "inbox", title: "Solicitudes recibidas", href: "/signals", tint: "lavender" },
      { icon: "list-checks", title: "Tareas que me asignaron", href: { pathname: "/records/[kind]", params: { kind: "tasks", assigned: "me" } }, tint: "coral" },
      { icon: "clipboard-list", title: "Listas de preparación", href: "/checklists", tint: "sage" },
    ] },
    { title: "Compras", items: compras },
    config,
  ] : [
    { title: "Mi identidad", items: [
      { icon: "heart", title: "Mis gustos y actividades", href: edit("tastes"), tint: "coral" },
      { icon: "sparkles", title: "Mi estilo", href: edit("identity"), tint: "lavender" },
      { icon: "palette", title: "Identidad y estilo", plus: "Plus · propuestas visuales con tus colores", href: "/style", tint: "lavender" },
      { icon: "sliders-horizontal", title: "Mis preferencias", href: edit("needs"), tint: "butter" },
      { icon: "smile", title: "Mi avatar", href: "/avatar", tint: "sky" },
    ] },
    { title: "Mi experiencia", items: [
      { icon: "layers", title: "Tratamientos registrados", href: "/records/treatments", tint: "sage" },
      { icon: "hand-helping", title: "Necesidades cotidianas", href: edit("needs"), tint: "coral" },
      { icon: "layout-grid", title: "Preferencias de organización", href: edit("treatment"), tint: "sky" },
      { icon: "package", title: "Preferencias de kits", href: edit("kitprefs"), tint: "butter" },
      { icon: "shield", title: "Mi cobertura médica", href: "/coverage", tint: "lavender" },
      { icon: "chart-no-axes-column", title: "Mi proceso", href: "/process", tint: "sage" },
      { icon: "clipboard-list", title: "Listas de preparación", href: "/checklists", tint: "sage" },
      { icon: "history", title: "Historial personal", href: "/history", tint: "lavender" },
    ] },
    { title: "Mi red", items: [
      { icon: "users", title: "Personas vinculadas y permisos", href: "/network", tint: "lavender" },
      { icon: "qr-code", title: "Invitaciones", href: "/link", tint: "sage" },
    ] },
    { title: "Compras", items: [...compras, { icon: "file-text", title: "Reporte personal", plus: "Plus · tu resumen listo para compartir", href: "/report" }] },
    config,
  ];

  const saveInfo = async () => {
    await updateMe({ name, preferred_name: pref });
    setInfo(false);
    toast.show("Información actualizada");
  };
  const switchRole = async () => {
    const role = isCg ? "patient" : "caregiver";
    await updateMe({ role });
    toast.show(role === "caregiver" ? "Ahora estás en modo acompañante" : "Ahora estás en modo paciente");
    router.replace("/(tabs)");
  };

  return (
    <TabScreen title="Perfil" testID="profile-screen" overlay={() => (
      <Sheet visible={info} onClose={() => setInfo(false)} title="Editar información" testID="profile-info-sheet">
        <Field label="Nombre" value={name} onChangeText={setName} testID="profile-name-input" />
        <Field label="Nombre preferido" value={pref} onChangeText={setPref} testID="profile-pref-input" />
        <Btn label="Guardar" onPress={saveInfo} testID="profile-info-save" />
      </Sheet>
    )}>
      <View style={{ alignItems: "center", marginTop: space.sm, backgroundColor: colors.butter, borderRadius: 28, paddingVertical: space.xl, paddingHorizontal: space.lg, overflow: "hidden" }} testID="profile-card">
        <View style={{ position: "absolute", left: -26, top: -22 }} pointerEvents="none"><Shape name="scallop" size={110} color={colors.coral} /></View>
        <View style={{ position: "absolute", right: -30, bottom: -34 }} pointerEvents="none"><Shape name="pebble" size={130} color={colors.lavender} /></View>
        <Pressable onPress={() => router.push("/avatar")} testID="profile-avatar">
          <Avatar avatar={user?.profile?.avatar} name={user?.preferred_name} size={112} />
          <View style={{ position: "absolute", right: 0, bottom: 4, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" }}><Ic name="pencil" size={15} color={colors.onSurfaceInverse} /></View>
        </Pressable>
        <Txt v="h1" style={{ marginTop: space.md, textAlign: "center" }} testID="profile-name">{user?.preferred_name || user?.name}</Txt>
        <View style={{ alignItems: "center" }}><Badge label={isCg ? "Acompañante" : "Paciente"} tint="sand" testID="profile-role-badge" /></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm, marginTop: space.lg }}>
          <Btn label="Mi avatar" small icon="smile" onPress={() => router.push("/avatar")} testID="profile-edit-avatar" />
          <Btn label="Mis datos" small variant="secondary" icon="pencil" onPress={() => setInfo(true)} testID="profile-edit-info" />
        </View>
      </View>

      <View style={{ backgroundColor: colors.sage, borderRadius: 24, padding: space.lg, marginTop: space.sm, overflow: "hidden" }} testID="profile-link-card">
        <View style={{ position: "absolute", right: 8, top: 8 }} pointerEvents="none"><Spot name="network" size={72} /></View>
        <Txt v="h2" style={{ marginRight: 84 }}>{isCg ? "Vincúlate con alguien" : "Vincula con alguien"}</Txt>
        <Txt style={{ marginTop: 4, marginRight: 84 }}>{isCg ? "Escanea un QR, abre un enlace o escribe un código." : "Comparte lo que tú elijas con las personas que te acompañan."}</Txt>
        <Btn label={isCg ? "Vincularme" : "Vincular acompañante"} icon="qr-code" onPress={() => router.push("/link")} testID="profile-link-button" style={{ marginTop: space.lg }} />
      </View>

      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          {g.items.map((it, i) => <Row key={it.title} icon={it.icon} tint={it.tint || "sand"} title={it.title} subtitle={it.plus} onPress={() => router.push(it.href)} testID={`profile-row-${it.title}`} last={i === g.items.length - 1} />)}
        </Section>
      ))}
      <PlanCard />
      {plus ? <PlusUsage /> : null}
      {user?.is_admin ? (
        <Section title="Administración">
          <Row icon="shield" tint="sand" title="Panel de administración" subtitle="Catálogo, costos, inventario y códigos" onPress={() => router.push("/admin")} testID="profile-admin-row" last />
        </Section>
      ) : null}
      <Section title="Cuenta">
        <Row icon="repeat" tint="sand" title={isCg ? "Cambiar a modo paciente" : "Cambiar a modo acompañante"} onPress={switchRole} testID="profile-switch-role-button" />
        <Row icon="log-out" tint="sand" title="Cerrar sesión" onPress={async () => { await signOut(); router.replace("/landing"); }} testID="profile-logout-button" last />
      </Section>
    </TabScreen>
  );
}
