import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Btn, Card, Ic, Screen, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

type Page = { title: string; blocks: { h?: string; p: string }[]; faq?: { q: string; a: string }[] };

const PAGES: Record<string, Page> = {
  about: {
    title: "Sobre AMODO",
    blocks: [
      { p: "AMODO es un sistema físico-digital de acompañamiento para personas que atraviesan tratamientos oncológicos y para quienes las acompañan." },
      { h: "A tu modo", p: "Cada persona tiene gustos, necesidades, rutinas y preferencias distintas. El acompañamiento se adapta a ella." },
      { h: "Acomodar", p: "Ayudamos a organizar las actividades, responsabilidades, objetos y decisiones cotidianas que aparecen durante el tratamiento." },
      { h: "Poco a poco", p: "Una etapa y un día a la vez. Puedes avanzar a tu ritmo, cambiar de opinión, descansar, pedir apoyo o reorganizar tus planes cuando lo necesites." },
      { h: "Lo que no es", p: "AMODO no es una herramienta de diagnóstico, tratamiento ni recomendaciones médicas. Funciona con cualquier tipo de tratamiento y para cualquier persona." },
    ],
  },
  how: {
    title: "Cómo funciona",
    blocks: [
      { h: "1. Crea tu espacio", p: "Elige si eres paciente o acompañante. Completa solo lo que quieras; todo se puede cambiar después." },
      { h: "2. Personaliza lo que necesitas", p: "Cuéntanos tus gustos, lo que te hace sentir cómodo/a y en qué te vendría bien apoyo." },
      { h: "3. Organiza, comparte y prepara tus kits", p: "Agenda, pendientes, traslados y gastos en un solo lugar. Comparte con tu red lo que decidas y arma kits físicos para cada momento." },
      { h: "Para acompañantes", p: "Vincúlate con un código o una solicitud. Verás únicamente lo que la persona acompañada decida compartir." },
    ],
  },
  faq: {
    title: "Preguntas frecuentes",
    blocks: [],
    faq: [
      { q: "¿AMODO me dice qué hacer con mi tratamiento?", a: "No. AMODO solo organiza lo que tú registras. Las decisiones médicas siempre son con tu equipo de salud." },
      { q: "¿Quién puede ver mi información?", a: "Solo tú. Tus acompañantes ven únicamente las secciones que actives para cada persona, y puedes cambiarlo cuando quieras." },
      { q: "¿Tengo que registrar algo todos los días?", a: "No. No hay rachas ni metas. Registra cuando te sirva." },
      { q: "¿Cómo funcionan los kits?", a: "Eliges el contexto, el tamaño y los artículos. Puedes personalizarlos, guardarlos y pedirlos para ti o para alguien más." },
      { q: "¿Los pagos son reales?", a: "Por ahora el pago es una simulación: puedes completar y seguir tu pedido, pero no se realiza ningún cargo." },
      { q: "¿Puedo ser paciente y acompañante?", a: "Sí. Desde tu perfil puedes cambiar de modo cuando lo necesites." },
    ],
  },
  help: {
    title: "Ayuda",
    blocks: [
      { h: "Primeros pasos", p: "Desde Inicio encontrarás tu día, señales rápidas y accesos a todas las secciones." },
      { h: "Señales rápidas", p: "Envía a tu red una necesidad concreta con un toque: compañía, un traslado, algo de comer o simplemente espacio." },
      { h: "Si algo urgente ocurre", p: "AMODO no es un servicio de emergencias. Si te sientes en riesgo, comunícate con tu equipo médico o con los servicios de emergencia de tu localidad." },
      { h: "Contacto", p: "Escríbenos a hola@amodo.app. Respondemos con calma, en días hábiles." },
    ],
  },
  privacy: {
    title: "Privacidad",
    blocks: [
      { p: "Tu información es tuya. Guardamos solo lo que decides registrar y la usamos para que la app funcione para ti." },
      { h: "Compartir", p: "Nada se comparte automáticamente. Tú eliges, por persona, qué secciones puede ver o editar cada acompañante." },
      { h: "Control", p: "Puedes quitar a una persona de tu red, cambiar permisos o borrar registros en cualquier momento." },
    ],
  },
  terms: {
    title: "Términos",
    blocks: [
      { p: "Al usar AMODO aceptas que es una herramienta de organización y acompañamiento, no un servicio médico." },
      { h: "Compras", p: "Los pedidos en esta versión usan un pago simulado sin cargo real." },
      { h: "Uso responsable", p: "Comparte solo información de otras personas con su consentimiento." },
    ],
  },
  contact: {
    title: "Contacto",
    blocks: [
      { h: "Correo", p: "hola@amodo.app" },
      { h: "Kits y pedidos", p: "pedidos@amodo.app" },
      { h: "Horario", p: "Lunes a viernes, 9:00 a 18:00 (hora del centro de México)." },
    ],
  },
};

export default function InfoPage() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const data = PAGES[page || "about"] || PAGES.about;
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen title={data.title} testID={`info-${page}-screen`}>
      {data.blocks.map((b, i) => (
        <View key={i} style={{ marginBottom: space.xl }}>
          {b.h ? (
            <Txt v="h2" style={{ marginBottom: space.sm }}>
              {b.h}
            </Txt>
          ) : null}
          <Txt>{b.p}</Txt>
        </View>
      ))}
      {data.faq?.map((f, i) => (
        <Pressable key={f.q} onPress={() => setOpen(open === i ? null : i)} testID={`faq-item-${i}`} style={{ paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
          <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
            <Txt v="title" style={{ flex: 1 }}>
              {f.q}
            </Txt>
            <Ic name={open === i ? "minus" : "plus"} size={18} />
          </View>
          {open === i ? <Txt style={{ marginTop: space.sm }}>{f.a}</Txt> : null}
        </Pressable>
      ))}
      <Card tint="sage" style={{ marginTop: space.xl }}>
        <Txt v="title">Un espacio para organizar, elegir y compartir.</Txt>
        <Btn label="Explorar kits" variant="secondary" small onPress={() => router.push("/catalog")} testID="info-catalog-button" style={{ marginTop: space.md, alignSelf: "flex-start" }} />
      </Card>
    </Screen>
  );
}
