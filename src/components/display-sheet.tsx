import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  useSettings,
  type ThemeMode,
} from "@/lib/settings";
import { Icon, IconButton, READ_FONT, Segmented } from "@/components/ui";
import SheetModal from "@/components/sheet-modal";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: "auto" | "sun" | "moon" }[] = [
  { value: "system", label: "Auto", icon: "auto" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

/** Reader display controls: text size and theme. */
export default function DisplaySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const size = settings.fontSize;

  const step = (delta: number) =>
    update({
      fontSize: Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size + delta)),
    });

  return (
    <SheetModal
      visible={open}
      onRequestClose={onClose}
      backgroundColor={c.card}
      contentStyle={[
        styles.sheet,
        {
          backgroundColor: c.card,
          paddingBottom: Math.max(24, insets.bottom + 16),
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.text }]}>Display</Text>
        <IconButton name="close" label="Close" onPress={onClose} color={c.subtext} />
      </View>

      <Text style={[styles.label, { color: c.subtext }]}>Text size</Text>
      <View style={[styles.preview, { borderColor: c.line, backgroundColor: c.bg }]}>
        <Text
          style={{
            color: c.text,
            fontFamily: READ_FONT,
            fontSize: size,
            lineHeight: Math.round(size * 1.55),
          }}
          numberOfLines={2}
        >
          In the beginning God created the heaven and the earth.
        </Text>
      </View>
      <View style={styles.stepRow}>
        <StepButton
          icon="textSizeDown"
          label="Smaller text"
          disabled={size <= FONT_SIZE_MIN}
          onPress={() => step(-1)}
        />
        <View style={styles.stepMid}>
          <Text style={[styles.stepValue, { color: c.text }]}>{size}</Text>
          <Text style={[styles.stepCaption, { color: c.subtext }]}>pt</Text>
        </View>
        <StepButton
          icon="textSizeUp"
          label="Larger text"
          disabled={size >= FONT_SIZE_MAX}
          onPress={() => step(1)}
        />
      </View>

      <Text style={[styles.label, { color: c.subtext, marginTop: 18 }]}>Theme</Text>
      <Segmented
        options={THEME_OPTIONS}
        value={settings.theme}
        onChange={(theme) => update({ theme })}
      />
    </SheetModal>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "textSizeDown" | "textSizeUp";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.stepButton,
        { borderColor: c.line, backgroundColor: c.bg },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Icon name={icon} size={24} color={c.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  preview: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
    justifyContent: "center",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  stepButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepMid: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    minWidth: 56,
    justifyContent: "center",
  },
  stepValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  stepCaption: {
    fontSize: 12,
  },
});
