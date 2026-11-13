import type { ThemeColors } from "@/src/theme";

export type FieldType = "text" | "multiline" | "date" | "time" | "select" | "number" | "switch" | "assignee";
export type FieldDef = { key: string; label: string; type: FieldType; options?: string[]; placeholder?: string; required?: boolean };

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
      { key: "schedule", label: "Horario", type: "text", placeholder: "Ej. Mañana y noche" },
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
  { type: "traslado", label: "Necesito un traslado", icon: "car", tint: "lavender" },
  { type: "comida", label: "Algo de comer", icon: "utensils", tint: "coral" },
  { type: "descanso", label: "Quiero descansar", icon: "moon", tint: "lavender" },
  { type: "hablar", label: "Quiero hablar", icon: "message-circle", tint: "sage" },
  { type: "compras", label: "Ayuda con compras", icon: "shopping-basket", tint: "coral" },
  { type: "llamada", label: "Llámame", icon: "phone", tint: "sage" },
  { type: "espacio", label: "Necesito espacio", icon: "leaf", tint: "lavender" },
] as const;

export const URGENCY = ["Cuando puedas", "Hoy", "Ahora"];
export const QUICK_REPLIES = ["Voy para allá", "Lo resuelvo hoy", "Te llamo en un momento", "Entendido, aquí estoy"];

export const KIT_CONTEXTS = [
  { label: "Sesión de tratamiento", icon: "armchair", text: "Para las horas en sala." },
  { label: "Hospitalización", icon: "bed", text: "Para estancias de varios días." },
  { label: "Descanso en casa", icon: "house", text: "Para días tranquilos." },
  { label: "Traslados", icon: "car", text: "Lo práctico para moverte." },
  { label: "Regalo para alguien", icon: "gift", text: "Para acompañar a distancia." },
];

export const KIT_SIZES = [
  { label: "Pequeño", max: 4, base: 149, text: "Hasta 4 artículos" },
  { label: "Mediano", max: 7, base: 219, text: "Hasta 7 artículos" },
  { label: "Grande", max: 10, base: 289, text: "Hasta 10 artículos" },
];

export const CATEGORIES = [
  { label: "Comodidad", icon: "armchair", tint: "sage" },
  { label: "Entretenimiento", icon: "book-open", tint: "lavender" },
  { label: "Cuidado personal", icon: "sparkles", tint: "coral" },
  { label: "Apariencia e identidad", icon: "shirt", tint: "lavender" },
  { label: "Hidratación y snacks", icon: "cup-soda", tint: "sage" },
  { label: "Organización", icon: "folder", tint: "coral" },
  { label: "Detalles", icon: "gift", tint: "sage" },
];

export function tintOf(colors: ThemeColors, tint?: string) {
  if (tint === "lavender") return { bg: colors.lavenderSoft, fg: colors.onSurface, accent: colors.lavender };
  if (tint === "coral") return { bg: colors.coralSoft, fg: colors.onSurface, accent: colors.coral };
  if (tint === "sand") return { bg: colors.sand, fg: colors.onSurface, accent: colors.borderStrong };
  return { bg: colors.sageSoft, fg: colors.onSurface, accent: colors.sage };
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

export const SHARE_KEYS: { key: string; label: string }[] = [
  { key: "events", label: "Agenda" },
  { key: "tasks", label: "Pendientes" },
  { key: "transfers", label: "Traslados" },
  { key: "expenses", label: "Gastos y pagos" },
  { key: "treatments", label: "Tratamientos y ciclos" },
  { key: "medications", label: "Medicamentos registrados" },
  { key: "journal", label: "Registro cotidiano" },
  { key: "signals", label: "Recibe mis señales rápidas" },
  { key: "edit", label: "Puede agregar y editar" },
];

// ---------------------------------------------------------------- formatting
const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

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
  const s = Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${s} MXN`;
}
export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
