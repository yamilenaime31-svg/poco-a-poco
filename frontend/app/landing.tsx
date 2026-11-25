import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MoodFigure, Shape } from "@/src/art";
import { CATEGORIES, tintOf } from "@/src/constants";
import { Btn, Ic, Logo, ProductImage, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const MODULES = [
  { icon: "calendar", title: "Organiza tus días", text: "Agenda, citas, pendientes y traslados.", tint: "sky" },
  { icon: "users", title: "Conecta con tu red", text: "Comparte actividades y comunica necesidades.", tint: "sage" },
  { icon: "package", title: "Arma tus kits", text: "Elige artículos según el momento, tus gustos y tus preferencias.", tint: "coral" },
  { icon: "leaf", title: "Hazlo a tu ritmo", text: "Personaliza la experiencia y cambia lo que necesites.", tint: "butter" },
];

const FOOTER = [
  { label: "Sobre AMODO", page: "about" },
  { label: "Preguntas frecuentes", page: "faq" },
  { label: "Ayuda", page: "help" },
  { label: "Privacidad", page: "privacy" },
  { label: "Términos", page: "terms" },
  { label: "Contacto", page: "contact" },
];

export default function Landing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="landing-screen">
      <Animated.ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <View style={[styles.hero, { backgroundColor: colors.lavender, paddingTop: insets.top + space.md }]}>
          <View style={styles.heroTop}>
            <Logo size={30} />
            <Pressable onPress={() => router.push("/login")} testID="landing-login-link" hitSlop={10} style={[styles.login, { backgroundColor: colors.surfaceSecondary }]}>
              <Txt v="label" color={colors.onSurface}>Iniciar sesión</Txt>
            </Pressable>
          </View>
          <View style={styles.heroArt} pointerEvents="none">
            <View style={{ position: "absolute", left: -30, top: 6 }}><Shape name="scallop" size={150} color={colors.butter} /></View>
            <View style={{ position: "absolute", right: -24, top: -6 }}><Shape name="pebble" size={170} color={colors.coral} /></View>
            <View style={{ position: "absolute", left: 96, top: 62 }}><MoodFigure mood="En calma" size={130} color={colors.sage} /></View>
            <View style={{ position: "absolute", right: 46, top: 132 }}><Shape name="drop" size={64} color={colors.sky} /></View>
          </View>
          <Animated.View entering={FadeInDown.duration(300)}>
            <Txt v="display" style={{ fontSize: 38, lineHeight: 42 }}>Un día a la vez,{"\n"}a tu modo.</Txt>
            <Txt style={{ marginTop: space.md }}>
              Un espacio para organizar tus días, conectar con quienes te acompañan y preparar lo que necesitas en cada etapa.
            </Txt>
            <View style={{ gap: space.sm, marginTop: space.xl }}>
              <Btn label="Comenzar" onPress={() => router.push("/welcome")} testID="landing-start-button" />
              <Btn label="Conocer AMODO" variant="ghost" icon="arrow-right" onPress={() => router.push("/info/about")} testID="landing-about-button" />
            </View>
          </Animated.View>
        </View>

        <View style={styles.pad}>
          <Txt v="label">¿Qué puedes hacer?</Txt>
          <Txt v="h1" style={{ marginTop: space.sm, marginBottom: space.xl }}>
            Un sistema físico-digital que se adapta a ti.
          </Txt>
          <View style={styles.grid}>
            {MODULES.map((m, i) => (
              <Animated.View key={m.title} entering={FadeInDown.delay(80 * i)} style={[styles.module, { backgroundColor: tintOf(colors, m.tint).bg }]}>
                <Ic name={m.icon} size={22} />
                <Txt v="title" style={{ marginTop: space.lg }}>
                  {m.title}
                </Txt>
                <Txt v="caption" color={colors.onSurface} style={{ marginTop: 4 }}>
                  {m.text}
                </Txt>
              </Animated.View>
            ))}
          </View>
        </View>

        <View style={styles.pad}>
          <Txt v="label">Cómo funciona</Txt>
          {["Crea tu espacio.", "Personaliza lo que necesitas.", "Organiza, comparte y prepara tus kits."].map((s, i) => (
            <View key={s} style={[styles.step, { borderBottomColor: colors.divider }]}>
              <Txt v="display" color={colors.lavenderDeep} style={{ width: 48 }}>
                {i + 1}
              </Txt>
              <Txt v="title" style={{ flex: 1 }}>
                {s}
              </Txt>
            </View>
          ))}
          <Btn label="Ver cómo funciona" variant="secondary" small onPress={() => router.push("/info/how")} testID="landing-how-button" style={{ marginTop: space.lg, alignSelf: "flex-start" }} />
        </View>

        <View style={styles.pad}>
          <Txt v="label">Kits</Txt>
          <Txt v="h1" style={{ marginTop: space.sm }}>
            Lo que te acompaña, elegido por ti.
          </Txt>
          <Txt v="caption" style={{ marginTop: space.sm, marginBottom: space.lg }}>
            Comodidad, entretenimiento, cuidado personal e identidad. Para ti o para alguien más.
          </Txt>
          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
            {CATEGORIES.slice(0, 6).map((c) => (
              <Pressable key={c.label} onPress={() => router.push({ pathname: "/catalog", params: { category: c.label } })} style={{ width: 140 }} testID={`landing-category-${c.label}`}>
                <ProductImage product={{ category: c.label }} height={150} />
                <Txt v="medium" style={{ marginTop: space.sm }} numberOfLines={1}>
                  {c.label}
                </Txt>
              </Pressable>
            ))}
          </Animated.ScrollView>
          <Btn label="Explorar catálogo" icon="arrow-right" onPress={() => router.push("/catalog")} testID="landing-catalog-button" style={{ marginTop: space.xl }} />
        </View>

        <View style={[styles.pad]}>
          <View style={[styles.care, { backgroundColor: colors.sage }]}>
            <Ic name="hand-heart" size={24} />
            <Txt v="h2" style={{ marginTop: space.md }}>
              Para quienes acompañan
            </Txt>
            <Txt style={{ marginTop: space.sm }}>
              Familiares, amistades y cuidadores pueden organizar tareas, traslados, gastos y kits, siempre con los permisos que la persona acompañada decida.
            </Txt>
            <Btn label="Soy acompañante" variant="primary" small onPress={() => router.push({ pathname: "/register", params: { role: "caregiver" } })} testID="landing-caregiver-button" style={{ marginTop: space.lg, alignSelf: "flex-start" }} />
          </View>
        </View>

        <View style={[styles.pad, styles.footer, { borderTopColor: colors.divider }]}>
          <Logo size={22} />
          <Txt v="caption" style={{ marginTop: space.sm }}>
            Un día a la vez, a tu modo. AMODO no ofrece diagnósticos, tratamientos ni recomendaciones médicas.
          </Txt>
          <View style={styles.footerLinks}>
            {FOOTER.map((f) => (
              <Pressable key={f.page} onPress={() => router.push({ pathname: "/info/[page]", params: { page: f.page } })} testID={`footer-${f.page}-link`} style={{ paddingVertical: 8, width: "50%" }}>
                <Txt v="medium" style={{ fontSize: 14 }}>
                  {f.label}
                </Txt>
              </Pressable>
            ))}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.xl, paddingBottom: space.xl, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  login: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: 22, justifyContent: "center" },
  heroArt: { height: 226, marginTop: space.md },
  pad: { paddingHorizontal: space.xl, paddingTop: space.xxxl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  module: { width: "47.5%", flexGrow: 1, borderRadius: radius.lg, padding: space.lg, minHeight: 160 },
  step: { flexDirection: "row", alignItems: "center", paddingVertical: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  care: { borderRadius: radius.lg, padding: space.xl },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.xxxl, paddingTop: space.xl },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", marginTop: space.lg },
});
