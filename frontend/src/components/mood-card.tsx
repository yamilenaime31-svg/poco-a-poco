import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { api, invalidate } from "@/src/api";
import { MOODS } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Chip, Ic, Txt, tap } from "@/src/ui";
import { fonts, radius, space, useTheme } from "@/src/theme";

const VISIBLE = 4;

/** Optional, private mood check-in: several feelings and/or a free note, editable any time. No interpretation. */
export function MoodCard({ journal, date }: { journal: any; date: string }) {
  const { colors } = useTheme();
  const toast = useToast();
  const saved: string[] = journal?.moods || (journal?.mood ? [journal.mood] : []);
  const [moods, setMoods] = useState<string[]>(saved);
  const [note, setNote] = useState<string>(journal?.mood_note || "");
  const [expanded, setExpanded] = useState(false);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMoods(journal?.moods || (journal?.mood ? [journal.mood] : []));
    setNote(journal?.mood_note || "");
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

  // Selected moods stay visible even when the list is collapsed.
  const shown = expanded ? MOODS : [...MOODS.slice(0, VISIBLE), ...moods.filter((m) => MOODS.indexOf(m) >= VISIBLE)];

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="home-mood-card">
      <View style={styles.head}>
        <Txt v="title">¿Cómo te sientes hoy?</Txt>
        <Txt v="caption">Opcional</Txt>
      </View>
      <View style={styles.wrap}>
        {shown.map((m) => <Chip key={m} label={m} selected={moods.includes(m)} onPress={() => toggle(m)} testID={`home-mood-${m}`} />)}
        <Chip label={expanded ? "Ver menos" : "Ver más"} icon={expanded ? "chevron-up" : "chevron-down"} onPress={() => setExpanded(!expanded)} testID="home-mood-more" />
      </View>

      {writing ? (
        <View style={{ marginTop: space.md }}>
          <TextInput
            testID="home-mood-input"
            value={draft}
            onChangeText={setDraft}
            autoFocus
            multiline
            maxLength={240}
            placeholder="Ej. Hoy me siento un poco inquieta"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
          />
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
            <Btn label="Cancelar" small variant="ghost" onPress={() => setWriting(false)} testID="home-mood-cancel" style={{ flex: 1 }} />
            <Btn label="Guardar" small loading={saving} disabled={!draft.trim() && !note} onPress={() => saveNote(draft.trim())} testID="home-mood-save" style={{ flex: 1 }} />
          </View>
        </View>
      ) : note ? (
        <Pressable onPress={() => { setDraft(note); setWriting(true); }} testID="home-mood-note" style={[styles.note, { backgroundColor: colors.lavenderSoft }]}>
          <Txt style={{ flex: 1 }} numberOfLines={3}>“{note}”</Txt>
          <Ic name="pencil" size={14} color={colors.muted} />
        </Pressable>
      ) : (
        <Pressable onPress={() => { setDraft(""); setWriting(true); }} hitSlop={6} testID="home-mood-add" style={styles.add}>
          <Ic name="plus" size={16} />
          <Txt v="caption" color={colors.onSurface}>Agregar un estado propio</Txt>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.xl, borderRadius: radius.md, padding: space.md, borderWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm },
  add: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.xs, minHeight: 40, alignSelf: "flex-start" },
  note: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, borderRadius: radius.sm, padding: space.md },
  input: { minHeight: 72, borderRadius: radius.md, borderWidth: 1, padding: space.md, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
});
