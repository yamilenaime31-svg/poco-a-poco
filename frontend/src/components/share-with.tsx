import { Switch, View } from "react-native";

import { useApi } from "@/src/api";
import { Chip, ChipRow, Ic, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

export function useCaregivers() {
  const net = useApi<any>("/network");
  return (net.data?.as_patient || []).filter((l: any) => l.status === "active" && l.caregiver_id) as any[];
}

/** Private by default. The owner explicitly picks who can see an item before saving. */
export function ShareWith({ value, onChange, testID = "share" }: { value: string[]; onChange: (v: string[]) => void; testID?: string }) {
  const { colors } = useTheme();
  const people = useCaregivers();
  const on = value.length > 0;
  const names = people.filter((p) => value.includes(p.caregiver_id)).map((p) => p.caregiver_name);
  return (
    <View style={{ backgroundColor: on ? colors.lavenderSoft : colors.surfaceSecondary, borderRadius: radius.md, padding: space.lg, marginBottom: space.xl, borderWidth: 1, borderColor: on ? colors.lavender : colors.border }} testID={testID}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Ic name={on ? "users" : "lock"} size={18} />
        <View style={{ flex: 1 }}>
          <Txt v="medium">Compartir con…</Txt>
          <Txt v="caption" color={colors.onSurface} testID={`${testID}-summary`}>
            {on ? `Compartido con ${joinNames(names)}` : "Solo yo puedo ver esto"}
          </Txt>
        </View>
        <Switch
          testID={`${testID}-switch`}
          value={on}
          disabled={!people.length}
          onValueChange={(v) => onChange(v ? people.map((p) => p.caregiver_id) : [])}
          trackColor={{ true: colors.lavender, false: colors.surfaceTertiary }}
          thumbColor={colors.surfaceSecondary}
        />
      </View>
      {!people.length ? (
        <Txt v="caption" style={{ marginTop: space.sm }}>
          Aún no tienes acompañantes vinculados.
        </Txt>
      ) : on ? (
        <View style={{ marginTop: space.md }}>
          <ChipRow>
            {people.map((p) => (
              <Chip key={p.id} label={p.caregiver_name} selected={value.includes(p.caregiver_id)} onPress={() => onChange(value.includes(p.caregiver_id) ? value.filter((x) => x !== p.caregiver_id) : [...value, p.caregiver_id])} testID={`${testID}-person-${p.caregiver_name}`} />
            ))}
          </ChipRow>
        </View>
      ) : null}
    </View>
  );
}
