import { useState } from "react";
import { View } from "react-native";

import { Chip, ChipRow, Field, Txt } from "@/src/ui";
import { space } from "@/src/theme";

export { DateField, TimeField, TimesField } from "@/src/pickers";

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
