import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { Avatar } from "@/src/components/avatar";
import { TabScreen } from "@/src/components/tab-screen";
import { useToast } from "@/src/toast";
import { Badge, Btn, Field, Ic, Row, Section, Sheet, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

type Item = { icon: string; title: string; href: any; tint?: string };
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

  const groups: { title: string; items: Item[] }[] = [
    { title: "Mi identidad", items: [
      { icon: "heart", title: "Mis gustos y actividades", href: edit("tastes"), tint: "coral" },
      { icon: "sparkles", title: "Mi estilo", href: edit("identity"), tint: "lavender" },
      { icon: "sliders-horizontal", title: "Mis preferencias", href: edit(isCg ? "about" : "needs"), tint: "butter" },
      { icon: "smile", title: "Mi avatar", href: "/avatar", tint: "sky" },
    ] },
    { title: "Mi experiencia", items: isCg ? [
      { icon: "list-checks", title: "Mis pendientes asignados", href: { pathname: "/records/[kind]", params: { kind: "tasks", assigned: "me" } }, tint: "coral" },
      { icon: "inbox", title: "Solicitudes recibidas", href: "/signals", tint: "lavender" },
      { icon: "wallet", title: "Mis gastos", href: "/records/expenses", tint: "butter" },
    ] : [
      { icon: "layers", title: "Tratamientos registrados", href: "/records/treatments", tint: "sage" },
      { icon: "hand-helping", title: "Necesidades cotidianas", href: edit("needs"), tint: "coral" },
      { icon: "layout-grid", title: "Preferencias de organización", href: edit("treatment"), tint: "sky" },
      { icon: "package", title: "Preferencias de kits", href: edit("identity"), tint: "butter" },
      { icon: "history", title: "Historial personal", href: "/history", tint: "lavender" },
    ] },
    { title: "Mi red", items: [
      { icon: "users", title: "Personas vinculadas y permisos", href: "/network", tint: "lavender" },
      { icon: "qr-code", title: "Invitaciones", href: "/link", tint: "sage" },
    ] },
    { title: "Compras", items: [
      { icon: "heart", title: "Biblioteca y favoritos", href: "/favorites", tint: "coral" },
      { icon: "truck", title: "Mis pedidos e historial", href: "/orders", tint: "sky" },
    ] },
    { title: "Configuración", items: [
      { icon: "bell", title: "Notificaciones", href: "/notifications" },
      { icon: "shield-check", title: "Privacidad", href: { pathname: "/settings", params: { section: "privacy" } } },
      { icon: "accessibility", title: "Accesibilidad y cuenta", href: "/settings" },
      { icon: "circle-help", title: "Ayuda", href: { pathname: "/info/[page]", params: { page: "help" } } },
    ] },
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
      <View style={{ alignItems: "center", marginTop: space.md }} testID="profile-card">
        <Pressable onPress={() => router.push("/avatar")} testID="profile-avatar">
          <Avatar avatar={user?.profile?.avatar} name={user?.preferred_name} size={112} />
          <View style={{ position: "absolute", right: 0, bottom: 4, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" }}><Ic name="pencil" size={15} color={colors.onSurfaceInverse} /></View>
        </Pressable>
        <Txt v="h1" style={{ marginTop: space.md }} testID="profile-name">{user?.preferred_name || user?.name}</Txt>
        <View style={{ alignItems: "center" }}><Badge label={isCg ? "Acompañante" : "Paciente"} tint={isCg ? "lavender" : "sage"} testID="profile-role-badge" /></View>
        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
          <Btn label="Editar avatar" small variant="secondary" icon="smile" onPress={() => router.push("/avatar")} testID="profile-edit-avatar" />
          <Btn label="Editar información" small variant="secondary" icon="pencil" onPress={() => setInfo(true)} testID="profile-edit-info" />
        </View>
      </View>

      <View style={{ backgroundColor: colors.lavenderSoft, borderRadius: radius.lg, padding: space.xl, marginTop: space.xl, overflow: "hidden" }} testID="profile-link-card">
        <View style={{ position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: colors.lavender, right: -30, top: -40, opacity: 0.6 }} />
        <Ic name="link" size={22} />
        <Txt v="h2" style={{ marginTop: space.sm }}>{isCg ? "Vincúlate con alguien" : "Vincula con alguien"}</Txt>
        <Txt style={{ marginTop: 4 }}>{isCg ? "Escanea un QR, abre un enlace o escribe un código." : "Comparte lo que tú elijas con las personas que te acompañan."}</Txt>
        <Btn label={isCg ? "Vincularme" : "Vincular acompañante"} icon="qr-code" onPress={() => router.push("/link")} testID="profile-link-button" style={{ marginTop: space.lg }} />
      </View>

      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          {g.items.map((it, i) => <Row key={it.title} icon={it.icon} tint={it.tint || "sand"} title={it.title} onPress={() => router.push(it.href)} testID={`profile-row-${it.title}`} last={i === g.items.length - 1} />)}
        </Section>
      ))}
      <Section title="Cuenta">
        <Row icon="repeat" tint="sand" title={isCg ? "Cambiar a modo paciente" : "Cambiar a modo acompañante"} onPress={switchRole} testID="profile-switch-role-button" />
        <Row icon="log-out" tint="sand" title="Cerrar sesión" onPress={async () => { await signOut(); router.replace("/landing"); }} testID="profile-logout-button" last />
      </Section>
    </TabScreen>
  );
}
