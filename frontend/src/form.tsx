import { useState } from "react";
import { ScrollView, View } from "react-native";

import { addDays, isDate, today } from "@/src/constants";
import { Chip, ChipRow, Field, Txt } from "@/src/ui";
import { space } from "@/src/theme";

export function DateField({ label, value, onChange, testID, error }: { label: string; value: string; onChange: (v: string) => void; testID: string; error?: string }) {
  return (
    <View>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="AAAA-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        testID={testID}
        error={error || (value && !isDate(value) ? "Usa el formato AAAA-MM-DD" : undefined)}
        style={{ marginBottom: 0 }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, marginTop: -space.sm, marginBottom: space.lg }}>
        <Chip label="Hoy" selected={value === today()} onPress={() => onChange(today())} testID={`${testID}-today`} />
        <Chip label="Mañana" selected={value === addDays(1)} onPress={() => onChange(addDays(1))} testID={`${testID}-tomorrow`} />
        <Chip label="En una semana" selected={value === addDays(7)} onPress={() => onChange(addDays(7))} testID={`${testID}-week`} />
        {value ? <Chip label="Quitar fecha" onPress={() => onChange("")} testID={`${testID}-clear`} /> : null}
      </ScrollView>
    </View>
  );
}

export function SingleChoice({ label, options, value, onChange, testID }: { label?: string; options: string[]; value?: string; onChange: (v: string) => void; testID: string }) {
  return (
    <View style={{ marginBottom: space.xl }}>
      {label ? (
        <Txt v="medium" style={{ marginBottom: space.sm, fontSize: 14 }}>
          {label}
        </Txt>
      ) : null}
      <ChipRow>
        {options.map((o) => (
          <Chip key={o} label={o} selected={value === o} onPress={() => onChange(value === o ? "" : o)} testID={`${testID}-${o}`} />
        ))}
      </ChipRow>
    </View>
  );
}

/** Multi-select chips with an optional "add your own" entry. */
export function MultiChoice({ label, options, value, onChange, testID, allowCustom }: { label?: string; options: string[]; value: string[]; onChange: (v: string[]) => void; testID: string; allowCustom?: boolean }) {
  const [custom, setCustom] = useState("");
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <View style={{ marginBottom: space.xl }}>
      {label ? (
        <Txt v="title" style={{ marginBottom: space.md }}>
          {label}
        </Txt>
      ) : null}
      <ChipRow>
        {all.map((o) => (
          <Chip key={o} label={o} selected={value.includes(o)} onPress={() => toggle(o)} testID={`${testID}-${o}`} />
        ))}
      </ChipRow>
      {allowCustom ? (
        <Field
          value={custom}
          onChangeText={setCustom}
          placeholder="Agregar otra opción y presionar Enter"
          returnKeyType="done"
          testID={`${testID}-custom-input`}
          style={{ marginTop: space.md }}
          onSubmitEditing={() => {
            const c = custom.trim();
            if (c && !value.includes(c)) onChange([...value, c]);
            setCustom("");
          }}
        />
      ) : null}
    </View>
  );
}
