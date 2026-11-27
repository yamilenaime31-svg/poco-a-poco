// Questions of the companion's own questionnaire. Nothing here assumes the companion receives a treatment.
import type { Opt } from "@/src/onboarding/options";

const o = (label: string, icon: string): Opt => ({ label, icon });

export const CG = {
  who: [o("Mi pareja", "heart"), o("Mi mamá o papá", "users"), o("Mi hijo/a", "baby"), o("Mi hermano/a", "users-round"), o("Otro familiar", "house"), o("Un amigo/a", "smile"), o("Otra persona", "user-round")],
  mode: [o("Soy su acompañante principal", "star"), o("Comparto responsabilidades con otras personas", "users"), o("Acompaño en determinados días o actividades", "calendar-days"),
    o("Apoyo principalmente a distancia", "phone"), o("Mi participación varía según las necesidades", "shuffle"), o("Otra modalidad", "ellipsis")],
  duties: [o("Acompañar a consultas", "stethoscope"), o("Acompañar a tratamientos", "hospital"), o("Organizar citas", "calendar-plus"), o("Administrar horarios de medicamentos", "alarm-clock"),
    o("Coordinar traslados", "car"), o("Realizar compras", "shopping-bag"), o("Preparar alimentos", "utensils"), o("Organizar documentos", "folder"), o("Administrar gastos", "wallet"),
    o("Dar seguimiento a seguros y reembolsos", "file-check"), o("Preparar objetos para el hospital", "backpack"), o("Brindar compañía y apoyo emocional", "hand-heart"),
    o("Coordinar a otros acompañantes", "network"), o("Apoyar con actividades cotidianas", "house")],
  hard: [o("Recordar citas y horarios", "calendar-clock"), o("Coordinar mis actividades personales", "calendar-heart"), o("Organizar medicamentos", "pill"), o("Saber qué necesita la persona que acompaño", "message-circle-question"),
    o("Distribuir responsabilidades", "split"), o("Coordinar traslados", "car"), o("Administrar gastos", "wallet"), o("Realizar trámites", "file-text"), o("Organizar documentos médicos", "folder"),
    o("Preparar lo necesario para cada tratamiento", "backpack"), o("Comunicarme con otros acompañantes", "messages-square"), o("Encontrar tiempo para mí", "coffee"), o("Manejar la incertidumbre", "cloud")],
  organize: [o("Calendarios", "calendar"), o("Listas de pendientes", "list-checks"), o("Recordatorios", "bell"), o("Notificaciones anticipadas", "bell-ring"), o("Resúmenes diarios", "sun"),
    o("Resúmenes semanales", "calendar-range"), o("Tareas compartidas", "users"), o("Listas de preparación", "clipboard-list"), o("Prefiero consultar todo cuando lo necesite", "search")],
  at_hand: [o("Próximas citas", "calendar"), o("Horarios de medicamentos", "alarm-clock"), o("Tratamientos", "layers"), o("Pendientes", "list-checks"), o("Traslados", "car"), o("Gastos", "wallet"),
    o("Seguros y reembolsos", "file-check"), o("Señales rápidas del paciente", "bell"), o("Necesidades del paciente", "hand-helping"), o("Responsabilidades de otros acompañantes", "network")],
  when: [o("Entre semana", "briefcase"), o("Fines de semana", "sun"), o("Por las mañanas", "sunrise"), o("Por las tardes", "sunset"), o("Por las noches", "moon"),
    o("Tengo horarios variables", "shuffle"), o("Depende de mis responsabilidades", "scale"), o("Prefiero definirlo después", "clock")],
  goals: [o("Tener una mejor organización", "layout-grid"), o("Distribuir responsabilidades", "split"), o("Reducir la cantidad de cosas que debo recordar", "brain"), o("Encontrar tiempo para descansar", "bed"),
    o("Comunicarme mejor con la persona que acompaño", "message-circle-heart"), o("Tener mayor claridad sobre los pendientes", "list-checks"), o("Registrar cómo me siento", "smile"),
    o("Mantener mis actividades personales", "bike"), o("Pedir apoyo cuando lo necesite", "life-buoy")],
  interests: [o("Leer", "book-open"), o("Escuchar música", "music"), o("Caminar o hacer ejercicio", "footprints"), o("Ver películas o series", "tv"), o("Cocinar", "chef-hat"), o("Ver a mis amistades", "users"),
    o("Estar al aire libre", "trees"), o("Descansar", "bed"), o("Manualidades o arte", "palette"), o("Jugar", "gamepad-2")],
};

export const WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const CG_STEPS = ["welcome", "relation", "duties", "hard", "organize", "at_hand", "availability", "wellbeing", "link", "done"] as const;
export type CgStep = (typeof CG_STEPS)[number];

export type CgProfile = {
  who: string; mode: string; duties: string[]; hard: string[]; organize: string[]; at_hand: string[];
  availability: { when: string[]; slots: { days: string[]; date?: string; start: string; end: string }[] };
  goals: string[]; interests: string[];
};

export const emptyCg = (about?: any): CgProfile => ({ who: "", mode: "", duties: [], hard: [], organize: [], at_hand: [], availability: { when: [], slots: [] }, goals: [], interests: [], ...(about?.relation ? { who: about.relation } : {}) });
