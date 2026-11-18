import { useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";

import { tokenFrom } from "@/src/invite";
import { Btn, Empty, Loading, Screen, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export default function Scan() {
  const router = useRouter();
  const { colors } = useTheme();
  const [perm, request] = useCameraPermissions();
  const [asked, setAsked] = useState(false);
  const done = useRef(false);

  const onScan = ({ data }: { data: string }) => {
    const t = tokenFrom(data);
    if (!t || done.current) return;
    done.current = true;
    router.replace({ pathname: "/invite", params: { token: t } });
  };

  if (!perm) return <Loading />;
  return (
    <Screen title="Escanear QR" scroll={false} testID="scan-screen">
      {perm.granted ? (
        <View style={{ flex: 1, padding: space.xl }}>
          <View style={[styles.cam, { borderColor: colors.sage }]}>
            <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScan} />
          </View>
          <Txt v="caption" style={{ textAlign: "center", marginTop: space.lg }}>Apunta al código QR de la invitación. Antes de vincularte te pediremos confirmar.</Txt>
          <Btn label="Usar enlace o código" variant="ghost" onPress={() => router.back()} testID="scan-fallback-button" style={{ marginTop: space.md }} />
        </View>
      ) : (
        <View style={{ padding: space.xl }}>
          <Empty
            icon="camera"
            title="Usar la cámara para escanear"
            text={perm.canAskAgain || !asked ? "Solo la usamos para leer el QR de una invitación." : "El permiso está bloqueado. Puedes activarlo en Ajustes o usar el enlace o código."}
            action={perm.canAskAgain ? "Permitir cámara" : "Abrir Ajustes"}
            onAction={async () => {
              setAsked(true);
              if (perm.canAskAgain) await request();
              else Linking.openSettings();
            }}
            testID="scan-permission"
          />
          <Btn label="Usar enlace o código" variant="secondary" onPress={() => router.back()} testID="scan-fallback-button" />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cam: { flex: 1, maxHeight: 420, borderRadius: radius.lg, overflow: "hidden", borderWidth: 3 },
});
