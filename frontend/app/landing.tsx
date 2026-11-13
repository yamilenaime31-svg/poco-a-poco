import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORIES, tintOf } from "@/src/constants";
import { Btn, Ic, Logo, ProductImage, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1583329550487-0fa300a4cd1a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

const MODULES = [
  { icon: "calendar", title: "Organiza tus días", text: "Agenda, citas, pendientes y traslados.", tint: "sage" },
  { icon: "users", title: "Conecta con tu red", text: "Comparte actividades y comunica necesidades.", tint: "lavender" },
  { icon: "package", title: "Arma tus kits", text: "Elige artículos según el momento, tus gustos y tus preferencias.", tint: "coral" },
  { icon: "leaf", title: "Hazlo a tu ritmo", text: "Personaliza la experiencia y cambia lo que necesites.", tint: "sand" },
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
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
          <LinearGradient colors={["rgba(37,37,37,0.05)", "rgba(37,37,37,0.75)"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroTop, { paddingTop: insets.top + space.lg }]}>
            <Logo size={30} color={colors.onSurfaceInverse} />
            <Pressable onPress={() => router.push("/login")} testID="landing-login-link" hitSlop={10}>
              <Txt v="medium" color={colors.onSurfaceInverse}>
                Iniciar sesión
              </Txt>
            </Pressable>
          </View>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.heroBottom}>
            <Txt v="display" color={colors.onSurfaceInverse} style={{ fontSize: 40, lineHeight: 46 }}>
              A tu manera,{"\n"}poco a poco.
            </Txt>
            <Txt color={colors.onSurfaceInverse} style={{ marginTop: space.md, opacity: 0.92 }}>
              Un espacio para organizar tus días, conectar con quienes te acompañan y preparar lo que necesitas en cada etapa.
            </Txt>
            <View style={{ gap: space.sm, marginTop: space.xl }}>
              <Btn label="Comenzar" variant="accent" onPress={() => router.push("/welcome")} testID="landing-start-button" />
              <Btn label="Conocer AMODO" variant="secondary" onPress={() => router.push("/info/about")} testID="landing-about-button" />
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
                <Txt v="caption" color={colors.onSurface} style={{ marginTop: 4, opacity: 0.75 }}>
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
              <Txt v="display" color={colors.sage} style={{ width: 48 }}>
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
          <View style={[styles.care, { backgroundColor: colors.lavenderSoft }]}>
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
  hero: { height: 620, justifyContent: "space-between" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: space.xl },
  heroBottom: { padding: space.xl, paddingBottom: space.xxl },
  pad: { paddingHorizontal: space.xl, paddingTop: space.xxxl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  module: { width: "47.8%", borderRadius: radius.lg, padding: space.lg, minHeight: 160 },
  step: { flexDirection: "row", alignItems: "center", paddingVertical: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  care: { borderRadius: radius.lg, padding: space.xl },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.xxxl, paddingTop: space.xl },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", marginTop: space.lg },
});
