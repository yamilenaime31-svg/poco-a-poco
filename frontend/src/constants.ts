import type { ThemeColors } from "@/src/theme";

export type FieldType = "text" | "multiline" | "date" | "time" | "times" | "select" | "number" | "switch" | "assignee";
export type FieldDef = { key: string; label: string; type: FieldType; options?: string[]; placeholder?: string; required?: boolean; showIf?: (v: Record<string, any>) => boolean };

export type KindDef = {
  label: string;
  singular: string;
  icon: string;
  titleKey: string;
  fields: FieldDef[];
  note?: string;
  empty: string;
};

export const KINDS: Record<string, KindDef> = {
  events: {
    label: "Agenda",
    singular: "evento",
    icon: "calendar",
    titleKey: "title",
    empty: "Aún no hay eventos. Agrega citas, sesiones o actividades que quieras recordar.",
    fields: [
      { key: "title", label: "Nombre", type: "text", required: true, placeholder: "Ej. Sesión de tratamiento" },
      { key: "type", label: "Tipo", type: "select", options: ["Cita médica", "Sesión de tratamiento", "Estudio", "Actividad personal", "Traslado", "Otro"] },
      { key: "date", label: "Fecha", type: "date", required: true },
      { key: "time", label: "Hora", type: "time" },
      { key: "location", label: "Lugar", type: "text", placeholder: "Hospital, consultorio, casa…" },
      { key: "notes", label: "Notas", type: "multiline", placeholder: "Lo que quieras recordar" },
    ],
  },
  treatments: {
    label: "Tratamientos y ciclos",
    singular: "tratamiento",
    icon: "layers",
    titleKey: "name",
    empty: "Registra tus tratamientos cuando quieras. Puedes dejar campos en blanco.",
    note: "Solo registras lo que tu equipo te indicó. AMODO no calcula ni sugiere tratamientos.",
    fields: [
      { key: "name", label: "Tipo de tratamiento", type: "select", required: true, options: ["Quimioterapia", "Radioterapia", "Inmunoterapia", "Cirugía", "Terapia dirigida", "Terapia hormonal", "Otro"] },
      { key: "custom_name", label: "¿Qué tratamiento quieres registrar?", type: "text", placeholder: "Escribe el nombre del tratamiento", showIf: (v) => v.name === "Otro" || !!v._custom },
      { key: "status", label: "Estado", type: "select", options: ["Por comenzar", "En curso", "En pausa", "Finalizado"] },
      { key: "date", label: "Fecha de inicio", type: "date" },
      { key: "frequency", label: "Frecuencia", type: "text", placeholder: "Ej. Cada 21 días · Mi calendario cambia" },
      { key: "cycle_current", label: "Ciclo actual (si aplica)", type: "number" },
      { key: "cycles_total", label: "Ciclos totales (si aplica)", type: "number" },
      { key: "next_session", label: "Próxima sesión", type: "date" },
      { key: "center", label: "Hospital o centro", type: "text" },
      { key: "notes", label: "Notas", type: "multiline" },
    ],
  },
  medications: {
    label: "Medicamentos registrados",
    singular: "medicamento",
    icon: "pill",
    titleKey: "name",
    empty: "Aquí puedes anotar los medicamentos que te indicaron, para tenerlos a la mano.",
    note: "Es solo un registro personal. Sigue siempre las indicaciones de tu equipo médico.",
    fields: [
      { key: "name", label: "Nombre", type: "text", required: true },
      { key: "dose", label: "Indicación (como te la dieron)", type: "text", placeholder: "Ej. 1 tableta" },
      { key: "times", label: "Horarios indicados (para recordatorios)", type: "times" },
      { key: "schedule", label: "Indicación de horario (como te la dieron)", type: "text", placeholder: "Ej. Mañana y noche, con alimentos" },
      { key: "start_date", label: "Desde", type: "date" },
      { key: "end_date", label: "Hasta (opcional)", type: "date" },
      { key: "prescribed_by", label: "Indicado por", type: "text" },
      { key: "notes", label: "Notas", type: "multiline" },
    ],
  },
  tasks: {
    label: "Pendientes",
    singular: "pendiente",
    icon: "list-checks",
    titleKey: "title",
    empty: "Sin pendientes por ahora. Agrega lo que quieras recordar o delegar.",
    fields: [
      { key: "title", label: "¿Qué hay que hacer?", type: "text", required: true },
      { key: "date", label: "Para cuándo (opcional)", type: "date" },
      { key: "assignee_id", label: "¿Quién se encarga?", type: "assignee" },
      { key: "notes", label: "Notas", type: "multiline" },
      { key: "done", label: "Hecho", type: "switch" },
    ],
  },
  transfers: {
    label: "Traslados",
    singular: "traslado",
    icon: "car",
    titleKey: "title",
    empty: "Organiza cómo llegar a tus citas y quién te acompaña.",
    fields: [
      { key: "title", label: "Nombre", type: "text", required: true, placeholder: "Ej. Ida a sesión" },
      { key: "date", label: "Fecha", type: "date", required: true },
      { key: "time", label: "Hora de salida", type: "time" },
      { key: "origin", label: "Desde", type: "text" },
      { key: "destination", label: "Hacia", type: "text" },
      { key: "mode", label: "Cómo", type: "select", options: ["Acompañante lleva", "Auto propio", "Taxi o app", "Transporte público", "Otro"] },
      { key: "driver", label: "¿Quién acompaña o lleva?", type: "text" },
      { key: "confirmed", label: "Traslado confirmado", type: "switch" },
      { key: "notes", label: "Notas", type: "multiline" },
    ],
  },
  expenses: {
    label: "Gastos y pagos",
    singular: "gasto",
    icon: "wallet",
    titleKey: "title",
    empty: "Lleva un registro sencillo de gastos y de quién los cubre.",
    fields: [
      { key: "title", label: "Concepto", type: "text", required: true },
      { key: "amount", label: "Monto (MXN)", type: "number", required: true },
      { key: "category", label: "Categoría", type: "select", options: ["Transporte", "Medicamentos", "Consultas", "Alimentos", "Kits y artículos", "Hospedaje", "Otro"] },
      { key: "date", label: "Fecha", type: "date" },
      { key: "paid_by", label: "Pagado por", type: "text" },
      { key: "status", label: "Estado", type: "select", options: ["Pendiente", "Pagado"] },
      { key: "shared", label: "Gasto compartido", type: "switch" },
      { key: "notes", label: "Notas", type: "multiline" },
    ],
  },
  journal: {
    label: "Registro cotidiano",
    singular: "registro",
    icon: "notebook-pen",
    titleKey: "date",
    empty: "Tus registros aparecerán aquí. Registrar es opcional.",
    fields: [
      { key: "date", label: "Fecha", type: "date", required: true },
      { key: "energy", label: "¿Cómo está tu energía?", type: "select", options: ["Con energía", "Normal", "Cansancio", "Prefiero no decir"] },
      { key: "note", label: "Nota", type: "multiline" },
    ],
  },
};

export const SIGNALS = [
  { type: "compania", label: "Necesito compañía", icon: "users", tint: "sage" },
  { type: "solo", label: "Quiero estar a solas", icon: "leaf", tint: "lavender" },
  { type: "descanso", label: "Quiero descansar", icon: "moon", tint: "sky" },
  { type: "venir", label: "¿Puedes venir?", icon: "door-open", tint: "coral" },
  { type: "ayuda", label: "Necesito ayuda", icon: "life-buoy", tint: "butter" },
  { type: "traslado", label: "Necesito un traslado", icon: "car", tint: "lavender" },
  { type: "comida", label: "Algo de comer", icon: "utensils", tint: "coral" },
  { type: "hablar", label: "Quiero hablar", icon: "message-circle", tint: "sage" },
  { type: "compras", label: "Ayuda con compras", icon: "shopping-basket", tint: "butter" },
  { type: "llamada", label: "Llámame", icon: "phone", tint: "sky" },
] as const;
export const TREATMENT_TYPES = ["Quimioterapia", "Radioterapia", "Inmunoterapia", "Cirugía", "Terapia dirigida", "Terapia hormonal", "Otro"];
export const AGENDA_CATS: Record<string, { label: string; icon: string; tint: string }> = {
  treatments: { label: "Tratamientos", icon: "layers", tint: "lavender" },
  appointments: { label: "Consultas", icon: "stethoscope", tint: "sky" },
  studies: { label: "Estudios", icon: "microscope", tint: "mauve" },
  medications: { label: "Medicamentos programados", icon: "pill", tint: "coral" },
  transfers: { label: "Traslados", icon: "car", tint: "butter" },
  tasks: { label: "Pendientes", icon: "list-checks", tint: "sage" },
  payments: { label: "Pagos", icon: "wallet", tint: "sand" },
  personal: { label: "Actividades y otros", icon: "sun", tint: "sky" },
};
export const DEMO_PRICE = "precio de ejemplo";
export const DEFAULT_FAV_SIGNALS = ["compania", "solo", "descanso", "venir", "ayuda"];
export const MOODS = ["En calma", "Con energía", "Cansado/a", "Con sueño", "Sensible", "Preocupado/a", "Con molestias", "Con dolor"];

export const URGENCY = ["Cuando puedas", "Hoy", "Ahora"];
export const QUICK_REPLIES = ["Voy para allá", "Lo resuelvo hoy", "Te llamo en un momento", "Entendido, aquí estoy"];

export const KIT_CONTEXTS = [
  { label: "Antes del tratamiento", icon: "calendar-clock" },
  { label: "Durante el tratamiento", icon: "armchair" },
  { label: "Después del tratamiento", icon: "sunrise" },
  { label: "Hospital", icon: "bed" },
  { label: "Consulta", icon: "stethoscope" },
  { label: "Casa", icon: "house" },
  { label: "Otro", icon: "pencil" },
];

export const KIT_SIZES = [
  { label: "Chico", max: 4, base: 299, text: "4 artículos" },
  { label: "Mediano", max: 6, base: 499, text: "6 artículos" },
  { label: "Grande", max: 10, base: 799, text: "Hasta 10 artículos" },
];

export const CATEGORIES = [
  { label: "Comodidad", icon: "armchair", tint: "coral" },
  { label: "Identidad y estilo", icon: "sparkles", tint: "butter" },
  { label: "Entretenimiento", icon: "book-open", tint: "mauve" },
  { label: "Organización", icon: "folder", tint: "sky" },
  { label: "Antojos y preferencias", icon: "cup-soda", tint: "sage" },
  { label: "Cuidado personal", icon: "hand-heart", tint: "lavender" },
  { label: "Detalles", icon: "gift", tint: "mauve" },
];

export const IDENTITY = {
  explore: ["Sí", "Tal vez", "No por ahora"],
  accessories: ["Pañuelos", "Gorros", "Bandas", "Pelucas", "Accesorios para el cabello", "Aretes", "Lentes", "Arreglo personal", "Ninguno"],
  styles: ["Minimalista", "Clásico", "Divertido", "Deportivo", "Artesanal", "Colorido", "Elegante"],
  comfort: ["Telas suaves", "Sin costuras", "Ligero", "Ajustable", "Fácil de poner"],
  avoid: ["Pelucas", "Maquillaje", "Aromas fuertes", "Colores brillantes"],
  budget: [
    { label: "Sin límite", v: 0 },
    { label: "Hasta $300", v: 300 },
    { label: "Hasta $600", v: 600 },
    { label: "Hasta $1,000", v: 1000 },
  ],
};

export function tintOf(colors: ThemeColors, tint?: string) {
  const c = colors as any;
  if (tint === "sand" || !tint) return { bg: colors.sand, soft: colors.surfaceTertiary, fg: colors.onSurface, accent: colors.muted };
  const k = c[tint] ? tint : "sage";
  return { bg: c[k] as string, soft: c[`${k}Soft`] as string, fg: colors.onSurface, accent: c[`${k}Deep`] as string };
}

export function categoryOf(label?: string) {
  return CATEGORIES.find((c) => c.label === label) || { label: label || "", icon: "package", tint: "sand" };
}

export const PATIENT_TASTES = {
  activities: ["Leer", "Escuchar música", "Dibujar", "Tejer", "Jugar", "Ver películas o series", "Descansar", "Escribir", "Cocinar", "Caminar", "Meditar", "Conversar"],
  objects: ["Audífonos", "Libro", "Cobija", "Botella de agua", "Cargador", "Cuaderno", "Snacks", "Crema", "Gorro o pañoleta", "Almohada"],
  comfort: ["Ropa suave", "Silencio", "Música", "Compañía", "Aromas suaves", "Calidez", "Luz tenue"],
  colors: ["Neutros", "Tierra", "Verdes", "Lavanda", "Coral", "Azules", "Negro", "Brillantes"],
  styles: ["Minimalista", "Clásico", "Divertido", "Deportivo", "Artesanal"],
  dislikes: ["Aromas fuertes", "Texturas ásperas", "Dulces", "Colores brillantes", "Mensajes motivacionales"],
};

export const NEEDS = ["Traslados", "Comidas", "Compras", "Tareas del hogar", "Cuidado de hijos o mascotas", "Trámites", "Compañía en citas", "Organizar papeles", "Gastos"];
export const ASK_WAYS = ["Señales rápidas", "Mensajes", "Llamadas", "Prefiero decidir cada vez"];
export const CAREGIVER_SUPPORT = ["Traslados", "Comidas", "Compras", "Compañía", "Trámites", "Gastos", "Tareas del hogar", "Organizar la agenda"];
export const RELATIONS = ["Pareja", "Madre o padre", "Hijo/a", "Hermano/a", "Amistad", "Cuidador/a", "Otro"];

// Visibility is decided item by item ("Compartir con…"); these are the only person-level permissions.
export const SHARE_KEYS: { key: string; label: string }[] = [
  { key: "signals", label: "Recibe mis señales rápidas" },
  { key: "edit", label: "Puede agregar cosas en mi espacio y editar lo compartido" },
];

// ---------------------------------------------------------------- formatting
const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function isoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const today = () => isoDate(new Date());
export const addDays = (n: number) => isoDate(new Date(Date.now() + n * 86400000));

function parse(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}
export function fmtDate(d?: string) {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return d || "Sin fecha";
  if (d.slice(0, 10) === today()) return "Hoy";
  if (d.slice(0, 10) === addDays(1)) return "Mañana";
  const x = parse(d.slice(0, 10));
  return `${DAYS[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]}`;
}
export function fmtLongDate(d: string) {
  const x = parse(d);
  return `${DAYS_LONG[x.getDay()]} ${x.getDate()} de ${MONTHS_LONG[x.getMonth()]}`;
}
export function fmtDateTime(iso: string) {
  const x = new Date(iso);
  return `${x.getDate()} ${MONTHS[x.getMonth()]} · ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}
export function money(n: number) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const [int, dec] = Math.abs(v).toFixed(2).split(".");
  const s = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${v < 0 ? "-" : ""}$${s}${dec !== "00" ? `.${dec}` : ""} MXN`;
}
export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export const FREE_FEATURES = ["Agenda, citas, tratamientos, medicamentos y estudios", "Recordatorios, pendientes, gastos y traslados", "Acompañantes, señales rápidas y control de privacidad", "Avatar, registro de bienestar y preferencias", "Catálogo completo, kits, favoritos y seguimiento de pedidos", "Asistente de IA con interacciones limitadas al mes"];
export const PLUS_FEATURES = ["Todo lo de AMODO Gratis", "Registra lo que pasó en tu consulta sin llenar cada formulario por separado", "Prepárate para tus próximas citas sin tener que recordar todo", "Recomendaciones de kits que explican por qué aparecen", "Organiza el apoyo de las personas que te acompañan", "Cada mes recibes $20 para personalizar tus próximos kits", "10% de descuento en el precio base de los kits"];
export const PLUS_BENEFITS = (c: any) => [
  { i: "wand-sparkles", t: "Registra lo que pasó en tu consulta", s: "Escribe o dicta lo que te dijeron y revisa cada registro antes de guardarlo." },
  { i: "calendar-range", t: "Prepárate sin tener que recordar todo", s: "Una vista de tu próxima semana con lo que puedes preparar." },
  { i: "users", t: "Organiza el apoyo de quien te acompaña", s: "Tus acompañantes participan sin pagar otra membresía." },
  { i: "sparkles", t: "Recomendaciones que explican por qué", s: "Según lo que registras y lo que te gusta, siempre con precauciones." },
  { i: "wallet", t: `Cada mes recibes $${c.monthly_credit} para tus kits`, s: "Se acumulan y los usas cuando quieras." },
  { i: "percent", t: `${c.plus_kit_discount_pct}% de descuento en kits`, s: "Sobre el precio base; no aplica a suplementos premium." },
];
