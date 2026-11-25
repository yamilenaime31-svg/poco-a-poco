// AMODO date & time pickers: a compact month calendar and a wheel time picker, both in a bottom sheet.
// Values stay in the formats the app already stores: dates "YYYY-MM-DD" (local calendar day, no timezone shift) and times "HH:MM" (24 h).
import React, { useEffect, useRef, useState } from "react";
import { Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { DAYS_LONG, MONTHS_LONG, addDays, isDate, isTime, isoDate, today } from "@/src/constants";
import { Btn, Chip, Ic, IconBtn, Txt, tap } from "@/src/ui";
import { fonts, radius, space, useTheme } from "@/src/theme";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n: number) => String(n).padStart(2, "0");
const parseDate = (d: string) => { const [y, m, day] = d.split("-").map(Number); return new Date(y, m - 1, day); };

/** "miércoles, 25 de noviembre de 2026" */
export function fmtFullDate(d?: string) {
  if (!d || !isDate(d)) return "";
  const x = parseDate(d);
  return `${DAYS_LONG[x.getDay()]}, ${x.getDate()} de ${MONTHS_LONG[x.getMonth()]} de ${x.getFullYear()}`;
}
/** "8:30 AM" or "08:30" depending on the person's choice. */
export function fmtTime(t?: string, h24?: boolean) {
  if (!t || !isTime(t)) return t || "";
  if (h24) return t;
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}
export function use24h() {
  const { user } = useAuth();
  return !!user?.settings?.time_24h;
}

function PickerSheet({ visible, onClose, title, children, testID }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; testID: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 720; // computers: a centred card instead of a full-width bottom sheet
  return (
    <Modal visible={visible} transparent animationType={wide ? "fade" : "slide"} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} testID={`${testID}-backdrop`} accessibilityLabel="Cancelar" />
      <View pointerEvents="box-none" style={wide ? styles.center : styles.bottom}>
        <View style={[styles.sheet, wide ? { borderRadius: 28, width: 400 } : { paddingBottom: insets.bottom + space.lg }, { backgroundColor: colors.surface }]} testID={testID}>
          <View style={styles.head}>
            <Txt v="h2" style={{ flex: 1 }}>{title}</Txt>
            <IconBtn icon="x" onPress={onClose} testID={`${testID}-close`} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** The pressable "field" that shows the chosen value. */
function ValueField({ label, icon, text, placeholder, onPress, testID, error, compact }: { label?: string; icon: string; text: string; placeholder: string; onPress: () => void; testID: string; error?: string; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: compact ? 0 : space.lg, flex: compact ? 1 : undefined, minWidth: 0 }}>
      {label ? <Txt v="label" color={colors.onSurface} style={{ marginBottom: 6 }}>{label}</Txt> : null}
      <Pressable onPress={() => { tap(); onPress(); }} testID={testID} accessibilityRole="button" accessibilityLabel={`${label || placeholder}: ${text || "sin elegir"}`}
        style={({ pressed }) => [styles.field, compact && { minHeight: 44, paddingHorizontal: space.md }, { backgroundColor: colors.surfaceSecondary, borderColor: error ? colors.onError : colors.border, opacity: pressed ? 0.8 : 1 }]}>
        <Ic name={icon} size={18} />
        <Txt style={{ flex: 1, fontSize: compact ? 14 : 15 }} color={text ? colors.onSurface : colors.muted} numberOfLines={compact ? 1 : 2}>{text || placeholder}</Txt>
        {compact ? null : <Ic name="chevron-down" size={16} color={colors.muted} />}
      </Pressable>
      {error ? <Txt v="caption" color={colors.onError} style={{ marginTop: 4 }}>{error}</Txt> : null}
    </View>
  );
}

// ---------------------------------------------------------------- calendar
const WD = ["L", "M", "M", "J", "V", "S", "D"];

export function DateSheet({ visible, value, onConfirm, onClose, title = "Elige la fecha", testID, clearable = true, quick = true }: { visible: boolean; value: string; onConfirm: (v: string) => void; onClose: () => void; title?: string; testID: string; clearable?: boolean; quick?: boolean }) {
  const { colors } = useTheme();
  const t = today();
  const [sel, setSel] = useState("");
  const [ym, setYm] = useState({ y: 2026, m: 0 });
  const [mode, setMode] = useState<"days" | "months">("days");
  useEffect(() => {
    if (!visible) return;
    const base = isDate(value) ? value : t;
    setSel(isDate(value) ? value : "");
    setYm({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
    setMode("days");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pick = (d: string) => { tap(); setSel(d); setYm({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1 }); setMode("days"); };
  const move = (n: number) => setYm(({ y, m }) => { const x = new Date(y, m + n, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const first = new Date(ym.y, ym.m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const count = new Date(ym.y, ym.m + 1, 0).getDate(); // handles 28–31 and leap years
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <PickerSheet visible={visible} onClose={onClose} title={title} testID={`${testID}-sheet`}>
      <View style={styles.calHead}>
        <IconBtn icon="chevron-left" onPress={() => (mode === "days" ? move(-1) : setYm({ ...ym, y: ym.y - 1 }))} testID={`${testID}-prev`} />
        <Pressable onPress={() => setMode(mode === "days" ? "months" : "days")} testID={`${testID}-header`} accessibilityRole="button" accessibilityLabel="Cambiar mes y año" style={[styles.calTitle, { backgroundColor: colors.surfaceTertiary }]}>
          <Txt v="title">{mode === "days" ? `${cap(MONTHS_LONG[ym.m])} ${ym.y}` : String(ym.y)}</Txt>
          <Ic name={mode === "days" ? "chevron-down" : "chevron-up"} size={16} />
        </Pressable>
        <IconBtn icon="chevron-right" onPress={() => (mode === "days" ? move(1) : setYm({ ...ym, y: ym.y + 1 }))} testID={`${testID}-next`} />
      </View>

      {mode === "months" ? (
        <View testID={`${testID}-months`}>
          <View style={styles.yearRow}>
            {[-10, -5, 5, 10].map((n) => <Chip key={n} label={`${n > 0 ? "+" : "−"}${Math.abs(n)} años`} onPress={() => setYm({ ...ym, y: ym.y + n })} testID={`${testID}-year${n}`} />)}
          </View>
          <View style={styles.monthGrid}>
            {MONTHS_LONG.map((name, i) => {
              const on = i === ym.m;
              return (
                <Pressable key={name} onPress={() => { tap(); setYm({ ...ym, m: i }); setMode("days"); }} testID={`${testID}-month-${i + 1}`} accessibilityState={{ selected: on }}
                  style={[styles.month, { backgroundColor: on ? colors.lavender : colors.surfaceSecondary, borderColor: on ? colors.onSurface : "transparent" }]}>
                  <Txt v={on ? "label" : "caption"} color={colors.onSurface}>{cap(name)}</Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.week}>{WD.map((w, i) => <Txt key={i} v="caption" style={styles.wd}>{w}</Txt>)}</View>
          {Array.from({ length: cells.length / 7 }, (_, r) => (
            <View key={r} style={styles.week}>
              {cells.slice(r * 7, r * 7 + 7).map((n, i) => {
                if (!n) return <View key={i} style={styles.day} />;
                const d = `${ym.y}-${pad(ym.m + 1)}-${pad(n)}`;
                const on = d === sel;
                const isToday = d === t;
                return (
                  <Pressable key={i} onPress={() => pick(d)} testID={`${testID}-day-${d}`} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${fmtFullDate(d)}${isToday ? ", hoy" : ""}${on ? ", seleccionado" : ""}`} style={styles.day}>
                    <View style={[styles.dayDot, on && { backgroundColor: colors.lavender, borderColor: colors.onSurface, borderWidth: 2 }]}>
                      <Txt v={on ? "title" : "body"} style={{ fontSize: 15, lineHeight: 20 }}>{n}</Txt>
                    </View>
                    <View style={[styles.todayMark, { backgroundColor: isToday ? colors.onSurface : "transparent" }]} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {quick || clearable ? (
        <View style={styles.quick}>
          {quick ? <Chip label="Hoy" selected={sel === t} onPress={() => pick(t)} testID={`${testID}-today`} /> : null}
          {quick ? <Chip label="Mañana" selected={sel === addDays(1)} onPress={() => pick(addDays(1))} testID={`${testID}-tomorrow`} /> : null}
          {clearable && sel ? <Chip label="Sin fecha" icon="x" onPress={() => setSel("")} testID={`${testID}-clear`} /> : null}
        </View>
      ) : null}
      <Txt v="caption" style={{ marginTop: space.sm, minHeight: 18 }} testID={`${testID}-preview`}>{sel ? cap(fmtFullDate(sel)) : "Sin fecha elegida"}</Txt>
      <View style={styles.actions}>
        <Btn label="Cancelar" variant="ghost" onPress={onClose} testID={`${testID}-cancel`} style={{ flex: 1 }} />
        <Btn label="Confirmar fecha" onPress={() => { onConfirm(sel); onClose(); }} disabled={!sel && !clearable} testID={`${testID}-confirm`} style={{ flex: 1.4 }} />
      </View>
    </PickerSheet>
  );
}

export function DateField({ label, value, onChange, testID, error, compact, clearable = true }: { label?: string; value: string; onChange: (v: string) => void; testID: string; error?: string; compact?: boolean; clearable?: boolean }) {
  const [open, setOpen] = useState(false);
  const x = isDate(value) ? parseDate(value) : null;
  const text = !x ? (value || "") : compact ? `${x.getDate()} ${MONTHS_LONG[x.getMonth()].slice(0, 3)} ${x.getFullYear()}` : cap(fmtFullDate(value));
  return (
    <>
      <ValueField label={label} icon="calendar" text={text} placeholder="Elegir fecha" onPress={() => setOpen(true)} testID={testID} error={error} compact={compact} />
      <DateSheet visible={open} value={value} onConfirm={onChange} onClose={() => setOpen(false)} title={label || "Elige la fecha"} testID={testID} clearable={clearable} />
    </>
  );
}

// ---------------------------------------------------------------- wheel
const ITEM = 44;
const VISIBLE = 5;

function Wheel({ values, index, onChange, testID, label, width = 76 }: { values: string[]; index: number; onChange: (i: number) => void; testID: string; label: string; width?: number }) {
  const { colors } = useTheme();
  const ref = useRef<any>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cur = useRef(index);
  const [shown, setShown] = useState(index);
  const clamp = (i: number) => Math.max(0, Math.min(values.length - 1, i));

  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollTo({ y: index * ITEM, animated: false }), 0);
    return () => { clearTimeout(id); if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (i: number, animated = true) => {
    const n = clamp(i);
    cur.current = n;
    setShown(n);
    ref.current?.scrollTo({ y: n * ITEM, animated });
    onChange(n);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const n = clamp(Math.round(y / ITEM));
    if (n !== cur.current) { cur.current = n; setShown(n); onChange(n); }
    // Snap to the nearest value once scrolling stops (covers mouse wheel and browsers without native snapping).
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (Math.abs(y - cur.current * ITEM) > 0.5) ref.current?.scrollTo({ y: cur.current * ITEM, animated: true }); }, 140);
  };

  return (
    <View style={{ width, alignItems: "center" }} testID={testID} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: values[shown] }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={(e) => settle(shown + (e.nativeEvent.actionName === "increment" ? 1 : -1))}>
      <Pressable onPress={() => settle(shown - 1)} testID={`${testID}-up`} accessibilityLabel={`${label}: anterior`} style={styles.step}><Ic name="chevron-up" size={18} color={colors.muted} /></Pressable>
      <View style={{ height: ITEM * VISIBLE, width }}>
        <ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={ITEM} decelerationRate="fast" scrollEventThrottle={16} onScroll={onScroll} nestedScrollEnabled
          contentContainerStyle={{ paddingVertical: ITEM * 2 }} style={Platform.OS === "web" ? ({ scrollSnapType: "y mandatory" } as any) : undefined}>
          {values.map((v, i) => {
            const dist = Math.abs(i - shown);
            return (
              <Pressable key={v} onPress={() => settle(i)} testID={`${testID}-item-${v}`} accessibilityElementsHidden importantForAccessibility="no" style={[styles.wheelItem, Platform.OS === "web" ? ({ scrollSnapAlign: "center" } as any) : null]}>
                <Txt style={{ fontFamily: dist === 0 ? fonts.displayBold : fonts.bodyMedium, fontSize: dist === 0 ? 26 : 21, lineHeight: 32, opacity: dist === 0 ? 1 : dist === 1 ? 0.5 : 0.22 }}>{v}</Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <Pressable onPress={() => settle(shown + 1)} testID={`${testID}-down`} accessibilityLabel={`${label}: siguiente`} style={styles.step}><Ic name="chevron-down" size={18} color={colors.muted} /></Pressable>
    </View>
  );
}

const H12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const H24 = Array.from({ length: 24 }, (_, i) => pad(i));
const MIN = Array.from({ length: 60 }, (_, i) => pad(i));
const AMPM = ["AM", "PM"];

export function TimeSheet({ visible, value, onConfirm, onClose, title = "Elige el horario", testID, clearable }: { visible: boolean; value: string; onConfirm: (v: string) => void; onClose: () => void; title?: string; testID: string; clearable?: boolean }) {
  const { colors } = useTheme();
  const { updateMe } = useAuth();
  const saved24 = use24h();
  const [h24, setH24] = useState(saved24);
  const [hm, setHm] = useState({ h: 8, m: 0 });
  const [round, setRound] = useState(0); // remounts the wheels when the sheet opens or the format changes
  useEffect(() => {
    if (!visible) return;
    const [h, m] = isTime(value) ? value.split(":").map(Number) : [8, 0];
    setHm({ h, m });
    setH24(saved24);
    setRound((r) => r + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const out = `${pad(hm.h)}:${pad(hm.m)}`;
  const pm = hm.h >= 12;
  const setFormat = (v: boolean) => { setH24(v); setRound((r) => r + 1); updateMe({ settings: { time_24h: v } }).catch(() => {}); };

  return (
    <PickerSheet visible={visible} onClose={onClose} title={title} testID={`${testID}-sheet`}>
      <View style={styles.wheels} key={round}>
        <View pointerEvents="none" style={[styles.band, { backgroundColor: colors.lavender }]} />
        {h24 ? (
          <Wheel values={H24} index={hm.h} onChange={(i) => setHm((p) => ({ ...p, h: i }))} testID={`${testID}-hour`} label="Hora" />
        ) : (
          <Wheel values={H12} index={(hm.h % 12 || 12) - 1} onChange={(i) => setHm((p) => ({ ...p, h: ((i + 1) % 12) + (p.h >= 12 ? 12 : 0) }))} testID={`${testID}-hour`} label="Hora" />
        )}
        <Txt style={styles.colon}>:</Txt>
        <Wheel values={MIN} index={hm.m} onChange={(i) => setHm((p) => ({ ...p, m: i }))} testID={`${testID}-minute`} label="Minutos" />
        {h24 ? null : <Wheel values={AMPM} index={pm ? 1 : 0} onChange={(i) => setHm((p) => ({ ...p, h: (p.h % 12) + (i ? 12 : 0) }))} testID={`${testID}-period`} label="Periodo" />}
      </View>
      <View style={styles.quick}>
        <Chip label="12 h (AM/PM)" selected={!h24} onPress={() => setFormat(false)} testID={`${testID}-format-12`} />
        <Chip label="24 h" selected={h24} onPress={() => setFormat(true)} testID={`${testID}-format-24`} />
        {clearable && value ? <Chip label="Sin horario" icon="x" onPress={() => { onConfirm(""); onClose(); }} testID={`${testID}-clear`} /> : null}
      </View>
      <Txt v="caption" style={{ marginTop: space.sm }} testID={`${testID}-preview`}>Horario elegido: {fmtTime(out, h24)}</Txt>
      <View style={styles.actions}>
        <Btn label="Cancelar" variant="ghost" onPress={onClose} testID={`${testID}-cancel`} style={{ flex: 1 }} />
        <Btn label="Confirmar horario" onPress={() => { onConfirm(out); onClose(); }} testID={`${testID}-confirm`} style={{ flex: 1.4 }} />
      </View>
    </PickerSheet>
  );
}

export function TimeField({ label, value, onChange, testID, error, compact, clearable = true }: { label?: string; value: string; onChange: (v: string) => void; testID: string; error?: string; compact?: boolean; clearable?: boolean }) {
  const [open, setOpen] = useState(false);
  const h24 = use24h();
  return (
    <>
      <ValueField label={label} icon="clock" text={fmtTime(value, h24)} placeholder="Elegir horario" onPress={() => setOpen(true)} testID={testID} error={error} compact={compact} />
      <TimeSheet visible={open} value={value} onConfirm={onChange} onClose={() => setOpen(false)} title={label || "Elige el horario"} testID={testID} clearable={clearable} />
    </>
  );
}

/** Several times ("08:00, 14:00, 20:00"): each one can be edited or removed on its own. Nothing is suggested or generated. */
export function TimesField({ label, value, onChange, testID, error }: { label?: string; value: string; onChange: (v: string) => void; testID: string; error?: string }) {
  const { colors } = useTheme();
  const h24 = use24h();
  const [editing, setEditing] = useState<number | null>(null); // index, or -1 for a new one
  const list = (value || "").split(/[,;\s]+/).filter(Boolean);
  const write = (next: string[]) => onChange([...new Set(next)].sort().join(", "));
  return (
    <View style={{ marginBottom: space.lg }} testID={testID}>
      {label ? <Txt v="label" color={colors.onSurface} style={{ marginBottom: 6 }}>{label}</Txt> : null}
      {list.map((t, i) => (
        <View key={`${t}-${i}`} style={[styles.timeRow, { backgroundColor: colors.surfaceSecondary }]}>
          <Pressable onPress={() => setEditing(i)} testID={`${testID}-item-${i}`} accessibilityRole="button" accessibilityLabel={`Editar horario ${fmtTime(t, h24)}`} style={styles.timePress}>
            <Ic name="clock" size={18} />
            <Txt v="title" style={{ flex: 1 }}>{fmtTime(t, h24)}</Txt>
            <Ic name="pencil" size={15} color={colors.muted} />
          </Pressable>
          <IconBtn icon="trash-2" onPress={() => write(list.filter((_, j) => j !== i))} testID={`${testID}-remove-${i}`} />
        </View>
      ))}
      <Pressable onPress={() => { tap(); setEditing(-1); }} testID={`${testID}-add`} accessibilityRole="button" style={[styles.addTime, { backgroundColor: colors.surfaceTertiary }]}>
        <Ic name="plus" size={16} />
        <Txt v="label" color={colors.onSurface}>Agregar horario</Txt>
      </Pressable>
      {error ? <Txt v="caption" color={colors.onError} style={{ marginTop: 4 }}>{error}</Txt> : null}
      <TimeSheet visible={editing !== null} value={editing !== null && editing >= 0 ? list[editing] : ""} title={editing === -1 ? "Nuevo horario" : "Editar horario"} testID={`${testID}-picker`}
        onClose={() => setEditing(null)} onConfirm={(t) => write(editing === -1 ? [...list, t] : list.map((x, j) => (j === editing ? t : x)))} />
    </View>
  );
}

export { isoDate };

const styles = StyleSheet.create({
  bottom: { flex: 1, justifyContent: "flex-end" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.lg },
  head: { flexDirection: "row", alignItems: "center", marginBottom: space.sm },
  field: { minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", gap: space.sm },
  calHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm },
  calTitle: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: space.lg, borderRadius: 22 },
  week: { flexDirection: "row" },
  wd: { flex: 1, textAlign: "center", paddingVertical: 4 },
  day: { flex: 1, height: 46, alignItems: "center", justifyContent: "center" },
  dayDot: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  todayMark: { width: 5, height: 5, borderRadius: 3, marginTop: -1 },
  yearRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, justifyContent: "center", marginBottom: space.md },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  month: { width: "31%", flexGrow: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  wheels: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  band: { position: "absolute", left: 0, right: 0, height: ITEM + 4, borderRadius: radius.md, top: "50%", marginTop: -(ITEM + 4) / 2 },
  wheelItem: { height: ITEM, alignItems: "center", justifyContent: "center" },
  step: { height: 32, width: 64, alignItems: "center", justifyContent: "center" },
  colon: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32 },
  timeRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, paddingLeft: space.lg, paddingRight: 4, marginBottom: space.sm, minHeight: 52 },
  timePress: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 52 },
  addTime: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, alignSelf: "flex-start" },
});
