import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { TabScreen } from "@/src/components/tab-screen";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, Row, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

type Item = { icon: string; title: string; href: any; tint?: string };

export default function Profile() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user, signOut, updateMe } = useAuth();
  const [switching, setSwitching] = useState(false);
  const isCg = user?.role === "caregiver";
  const tastes = user?.profile?.tastes?.activities || [];

  const space1: Item[] = isCg
    ? [
        { icon: "list-checks", title: "Mis pendientes", href: { pathname: "/records/[kind]", params: { kind: "tasks", assigned: "me" } }, tint: "coral" },
        { icon: "inbox", title: "Solicitudes recibidas", href: "/signals", tint: "lavender" },
        { icon: "users", title: "Personas vinculadas", href: "/network" },
        { icon: "calendar-heart", title: "Mi propia agenda", href: "/(tabs)/agenda", tint: "lavender" },
        { icon: "list-todo", title: "Mis propios pendientes", href: "/records/tasks", tint: "coral" },
        { icon: "wallet", title: "Mis gastos", href: "/records/expenses" },
      ]
    : [
        { icon: "sun", title: "Mi día", href: "/day", tint: "coral" },
        { icon: "layers", title: "Tratamientos y ciclos", href: "/records/treatments" },
        { icon: "pill", title: "Medicamentos registrados", href: "/records/medications", tint: "lavender" },
        { icon: "list-checks", title: "Pendientes", href: "/records/tasks", tint: "coral" },
        { icon: "car", title: "Traslados", href: "/records/transfers" },
        { icon: "wallet", title: "Gastos y pagos", href: "/records/expenses", tint: "lavender" },
        { icon: "radio", title: "Señales e historial", href: "/signals", tint: "coral" },
        { icon: "history", title: "Historial personal", href: "/history" },
        { icon: "users", title: "Mi red de apoyo", href: "/network", tint: "lavender" },
      ];

  const groups: { title: string; items: Item[] }[] = [
    { title: isCg ? "Acompañar" : "Mi espacio", items: space1 },
    {
      title: "Personalización",
      items: isCg
        ? [{ icon: "sliders-horizontal", title: "Cómo quiero ayudar", href: { pathname: "/onboarding", params: { edit: "1", step: "about" } } }]
        : [
            { icon: "layers", title: "Mi proceso", href: { pathname: "/onboarding", params: { edit: "1", step: "treatment" } } },
            { icon: "palette", title: "Gustos e identidad", href: { pathname: "/onboarding", params: { edit: "1", step: "tastes" } }, tint: "lavender" },
            { icon: "hand-helping", title: "Necesidades cotidianas", href: { pathname: "/onboarding", params: { edit: "1", step: "needs" } }, tint: "coral" },
          ],
    },
    {
      title: "Compras",
      items: [
        { icon: "package", title: "Mis kits", href: "/(tabs)/kits" },
        { icon: "heart", title: "Biblioteca y favoritos", href: "/favorites", tint: "coral" },
        { icon: "truck", title: "Mis pedidos e historial", href: "/orders", tint: "lavender" },
      ],
    },
    {
      title: "General",
      items: [
        { icon: "bell", title: "Notificaciones", href: "/notifications" },
        { icon: "settings", title: "Configuración y accesibilidad", href: "/settings" },
        { icon: "shield-check", title: "Privacidad y permisos", href: { pathname: "/settings", params: { section: "privacy" } } },
        { icon: "circle-help", title: "Ayuda", href: { pathname: "/info/[page]", params: { page: "help" } } },
        { icon: "info", title: "Sobre AMODO", href: { pathname: "/info/[page]", params: { page: "about" } } },
      ],
    },
  ];

  const switchRole = async () => {
    setSwitching(true);
    try {
      const role = isCg ? "patient" : "caregiver";
      await updateMe({ role });
      toast.show(role === "caregiver" ? "Ahora estás en modo acompañante" : "Ahora estás en modo paciente");
      router.replace("/(tabs)");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <TabScreen title="Perfil" testID="profile-screen">
      <Card tint={isCg ? "lavender" : "sage"} style={{ marginTop: space.sm }} testID="profile-card">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
            <Txt v="h2">{(user?.preferred_name || user?.name || "?").slice(0, 1).toUpperCase()}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="h2" testID="profile-name">
              {user?.preferred_name || user?.name}
            </Txt>
            <Txt v="caption" color={colors.onSurface}>
              {user?.email}
            </Txt>
          </View>
          <Badge label={isCg ? "Acompañante" : "Paciente"} tint="sand" testID="profile-role-badge" />
        </View>
        {tastes.length ? (
          <Txt v="caption" color={colors.onSurface} style={{ marginTop: space.md }}>
            Disfruta: {tastes.slice(0, 4).join(", ")}
          </Txt>
        ) : null}
        <Btn label={isCg ? "Cambiar a modo paciente" : "Cambiar a modo acompañante"} variant="secondary" small icon="repeat" loading={switching} onPress={switchRole} testID="profile-switch-role-button" style={{ marginTop: space.lg, alignSelf: "flex-start" }} />
      </Card>
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          {g.items.map((it, i) => (
            <Row key={it.title} icon={it.icon} tint={it.tint || "sand"} title={it.title} onPress={() => router.push(it.href)} testID={`profile-row-${it.title}`} last={i === g.items.length - 1} />
          ))}
        </Section>
      ))}
      <Btn
        label="Cerrar sesión"
        variant="ghost"
        icon="log-out"
        onPress={async () => {
          await signOut();
          router.replace("/landing");
        }}
        testID="profile-logout-button"
        style={{ marginTop: space.xxl }}
      />
    </TabScreen>
  );
}
