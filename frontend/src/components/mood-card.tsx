import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { ZoomIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { api, invalidate } from "@/src/api";
import { LiveMood, MOOD_ART } from "@/src/art";
import { MOODS, tintOf } from "@/src/constants";
import { useMotionAllowed } from "@/src/motion";
import { useToast } from "@/src/toast";
import { Btn, Chip, Ic, Txt, tap } from "@/src/ui";
import { fonts, radius, space, useTheme } from "@/src/theme";

function Mood({ mood, on, onPress, index }: { mood: string; on: boolean; onPress: () => void; index: number }) {
  const { colors } = useTheme();
  const still = !useMotionAllowed();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable testID={`home-mood-${mood}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={mood} style={styles.mood}
      onPress={() => {
        if (!still) s.value = withSequence(withTiming(1.14, { duration: 110 }), withTiming(1, { duration: 130 }));
        onPress();
      }}>
      <Animated.View style={anim}>
        <LiveMood mood={mood} size={60} color={tintOf(colors, MOOD_ART[mood]?.tint).bg} selected={on} play={on ? "loop" : "once"} delay={on ? 0 : 400 + index * 260} />
        {on ? <Animated.View entering={still ? undefined : ZoomIn.duration(180)} style={[styles.tick, { backgroundColor: colors.surfaceInverse, borderColor: colors.surface }]}><Ic name="check" size={11} color={colors.onSurfaceInverse} /></Animated.View> : null}
      </Animated.View>
      <Txt v={on ? "label" : "caption"} color={colors.onSurface} style={styles.moodLabel}>{mood}</Txt>
    </Pressable>
  );
}

/** Optional, private mood check-in: several feelings and/or a free note, editable any time. No interpretation, no good/bad. */
export function MoodCard({ journal, date }: { journal: any; date: string }) {
  const { colors } = useTheme();
  const toast = useToast();
  const saved: string[] = journal?.moods || (journal?.mood ? [journal.mood] : []);
  const [moods, setMoods] = useState<string[]>(saved);
  const [note, setNote] = useState<string>(journal?.mood_note || "");
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMoods(journal?.moods || (journal?.mood ? [journal.mood] : []));
    setNote(journal?.mood_note || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal?.id, journal?.updated_at]);

  // Saves run one after another so quick taps never create two entries for the same day.
  const journalId = useRef<string | null>(journal?.id || null);
  const queue = useRef<Promise<any>>(Promise.resolve());
  useEffect(() => {
    if (journal?.id) journalId.current = journal.id;
  }, [journal?.id]);

  const persist = (nextMoods: string[], nextNote: string) => {
    const body = { moods: nextMoods, mood: nextMoods[0] || "", mood_note: nextNote };
    const run = queue.current.catch(() => {}).then(async () => {
      if (journalId.current) await api(`/records/journal/${journalId.current}`, { method: "PUT", body });
      else journalId.current = (await api("/records/journal", { method: "POST", body: { date, ...body } })).id;
      invalidate();
    });
    queue.current = run;
    return run;
  };

  const toggle = async (m: string) => {
    tap();
    const prev = moods;
    const next = moods.includes(m) ? moods.filter((x) => x !== m) : [...moods, m];
    setMoods(next);
    try {
      await persist(next, note);
      toast.show("Lo guardamos solo para ti");
    } catch (e: any) {
      setMoods(prev);
      toast.show(e.message, "error");
    }
  };

  const saveNote = async (value: string) => {
    setSaving(true);
    try {
      await persist(moods, value);
      setNote(value);
      setWriting(false);
      toast.show(value ? "Lo guardamos solo para ti" : "Quitamos tu nota");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const others = moods.filter((m) => !MOODS.includes(m)); // states saved before, still removable

  return (
    <View style={styles.wrapAll} testID="home-mood-card">
      <View style={styles.head}>
        <Txt v="section" style={{ flex: 1 }}>¿Cómo te sientes hoy?</Txt>
        <Txt v="caption">Opcional</Txt>
      </View>
      <View style={styles.grid}>
        {MOODS.map((m, i) => <Mood key={m} mood={m} index={i} on={moods.includes(m)} onPress={() => toggle(m)} />)}
      </View>
      {others.length ? <View style={styles.others}>{others.map((m) => <Chip key={m} label={m} selected onPress={() => toggle(m)} testID={`home-mood-${m}`} />)}</View> : null}

      {writing ? (
        <View style={{ marginTop: space.md }}>
          <TextInput testID="home-mood-input" value={draft} onChangeText={setDraft} autoFocus multiline maxLength={240} placeholder="Ej. Hoy me siento un poco inquieta" placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
            <Btn label="Cancelar" small variant="ghost" onPress={() => setWriting(false)} testID="home-mood-cancel" style={{ flex: 1 }} />
            <Btn label="Guardar" small loading={saving} disabled={!draft.trim() && !note} onPress={() => saveNote(draft.trim())} testID="home-mood-save" style={{ flex: 1 }} />
          </View>
        </View>
      ) : note ? (
        <Pressable onPress={() => { setDraft(note); setWriting(true); }} testID="home-mood-note" style={[styles.note, { backgroundColor: colors.mauveSoft }]}>
          <Txt style={{ flex: 1 }} numberOfLines={3}>“{note}”</Txt>
          <Ic name="pencil" size={14} />
        </Pressable>
      ) : (
        <Pressable onPress={() => { setDraft(""); setWriting(true); }} testID="home-mood-add" style={[styles.add, { backgroundColor: colors.surfaceTertiary }]}>
          <Ic name="plus" size={16} />
          <Txt v="label" color={colors.onSurface}>Agregar un estado propio</Txt>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapAll: { marginTop: space.xxl },
  head: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginBottom: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.sm },
  mood: { width: "25%", alignItems: "center", paddingVertical: 4, minHeight: 96 },
  moodLabel: { fontSize: 12, lineHeight: 15, textAlign: "center", marginTop: 4, paddingHorizontal: 2 },
  tick: { position: "absolute", right: -2, top: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  others: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm },
  add: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.md, minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, alignSelf: "flex-start" },
  note: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, borderRadius: radius.md, padding: space.md },
  input: { minHeight: 72, borderRadius: radius.md, borderWidth: 1.5, padding: space.md, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
});
