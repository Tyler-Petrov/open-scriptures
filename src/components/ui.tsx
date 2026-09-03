import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { GOLD_SOFT, useTheme } from "@/lib/theme";

export const READ_FONT = "CrimsonPro_400Regular";
export const READ_FONT_SEMI = "CrimsonPro_600SemiBold";
export const ICON_FONT = "MaterialSymbols_400Regular";

// Material Symbols (Outlined) codepoints.
const GLYPHS = {
  home: 0xe9b2,
  book: 0xe666,
  library: 0xea19,
  calendar: 0xebcc,
  more: 0xe5d3,
  person: 0xf0d3,
  search: 0xef7a,
  shuffle: 0xe043,
  chevronRight: 0xe5cc,
  chevronLeft: 0xe5cb,
  chevronDown: 0xe5cf,
  chevronUp: 0xe5ce,
  plus: 0xe145,
  minus: 0xe15b,
  bookmark: 0xe8e7,
  bookmarkAdded: 0xe599,
  note: 0xe745,
  notes: 0xf1fc,
  quote: 0xe244,
  highlighter: 0xe6d1,
  textSizeUp: 0xeae2,
  textSizeDown: 0xeadd,
  textSize: 0xe245,
  sun: 0xe518,
  moon: 0xe51c,
  auto: 0xe1ab,
  palette: 0xe40a,
  check: 0xe668,
  checkCircle: 0xf0be,
  arrow: 0xe5c8,
  back: 0xe5c4,
  close: 0xe5cd,
  play: 0xe037,
  pause: 0xe034,
  stop: 0xe047,
  headphones: 0xf01f,
  copy: 0xe14d,
  share: 0xe80d,
  tune: 0xe429,
  delete: 0xe92e,
  history: 0xe8b3,
  settings: 0xe8b8,
  flag: 0xf0c6,
  restart: 0xf053,
  info: 0xe88e,
  done: 0xe876,
  outward: 0xf8ce,
  today: 0xe8df,
  circle: 0xe836,
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function glyph(name: GlyphName): string {
  return String.fromCodePoint(GLYPHS[name]);
}

export function Icon({
  name,
  size = 22,
  color,
  style,
}: {
  name: GlyphName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<TextStyle>;
}) {
  const { c } = useTheme();
  return (
    <Text
      style={[
        styles.iconBase,
        { fontSize: size, lineHeight: size, color: color ?? c.text },
        style,
      ]}
    >
      {glyph(name)}
    </Text>
  );
}

/** Round tappable icon. `tone` picks the fill: plain (no fill), soft (card), or accent (oxblood). */
export function IconButton({
  name,
  onPress,
  label,
  size = 22,
  tone = "plain",
  color,
  disabled = false,
  style,
}: {
  name: GlyphName;
  onPress?: () => void;
  label: string;
  size?: number;
  tone?: "plain" | "soft" | "accent";
  color?: ColorValue;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg =
    tone === "accent" ? c.ox : tone === "soft" ? c.card : "transparent";
  const tint = color ?? (tone === "accent" ? "#FFF7EC" : c.text);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: bg, borderColor: tone === "soft" ? c.line : "transparent" },
        tone === "soft" && styles.iconButtonSoft,
        pressed && styles.pressedCard,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Icon name={name} size={size} color={tint} />
    </Pressable>
  );
}

export function LogoMark({
  size = 84,
  color,
}: {
  size?: number;
  color?: string;
}) {
  const { c } = useTheme();
  const col = color ?? c.gold;
  const bar = Math.max(3, Math.round(size * 0.09));
  return (
    <View
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        borderWidth: 2,
        borderColor: col,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: bar,
          height: size * 0.44,
          backgroundColor: col,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size * 0.28,
          height: bar,
          backgroundColor: col,
          marginTop: -size * 0.1,
        }}
      />
    </View>
  );
}

export function Screen({
  children,
  style,
  scroll = false,
  contentStyle,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  if (scroll) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.screenRoot, { backgroundColor: c.bg }, style]}
      >
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screenRoot, { backgroundColor: c.bg }, style]}
    >
      {children}
    </SafeAreaView>
  );
}

/** Big serif page title used at the top of tab screens. */
export function PageTitle({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  const { c } = useTheme();
  return (
    <Text style={[styles.pageTitle, { color: c.text }, style]}>{children}</Text>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  const base: StyleProp<ViewStyle> = [
    styles.card,
    { backgroundColor: c.card, borderColor: c.line },
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [base, pressed && styles.pressedCard]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

export function Chip({
  label,
  icon,
  onPress,
  accent = false,
  style,
}: {
  label: string;
  icon?: GlyphName;
  onPress?: () => void;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg = accent ? GOLD_SOFT : c.card;
  const content = (
    <>
      {icon ? <Icon name={icon} size={18} color={accent ? c.gold : c.ox} /> : null}
      <Text style={[styles.chipLabel, { color: c.text }]}>{label}</Text>
    </>
  );
  const shell: StyleProp<ViewStyle> = [
    styles.chip,
    { backgroundColor: bg, borderColor: accent ? "rgba(201,162,75,0.45)" : c.line },
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [shell, pressed && styles.pressedCard]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={shell}>{content}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: GlyphName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: c.ox },
        !disabled && pressed && styles.pressedPrimary,
        disabled && styles.disabledPrimary,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={20} color="#FFF7EC" /> : null}
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  gold = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: GlyphName;
  gold?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const tint = gold ? c.gold : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.ghost,
        { borderColor: gold ? "rgba(201,162,75,0.55)" : c.line },
        pressed && styles.pressedCard,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={tint} /> : null}
      <Text style={[styles.ghostLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

/** Domain-value adapter around Expo UI's native segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string; icon?: GlyphName }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, isDark } = useTheme();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  return (
    <SegmentedControl
      values={options.map((option) => option.label)}
      selectedIndex={selectedIndex}
      onChange={(event) => {
        const option = options[event.nativeEvent.selectedSegmentIndex];
        if (option) onChange(option.value);
      }}
      tintColor={c.ox}
      appearance={isDark ? "dark" : "light"}
      style={[styles.segmented, style]}
    />
  );
}

export function SectionLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { c } = useTheme();
  return (
    <Text style={[styles.sectionLabel, { color: c.subtext }, style]}>
      {String(children)}
    </Text>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[styles.divider, { backgroundColor: c.line }, style]} />;
}

export function ProgressBar({
  ratio,
  height = 6,
  style,
}: {
  ratio: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, ratio));
  return (
    <View
      style={[
        { height, borderRadius: height / 2, backgroundColor: c.line, overflow: "hidden" },
        style,
      ]}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: c.gold,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  pageTitle: {
    fontFamily: READ_FONT_SEMI,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.2,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  pressedCard: {
    opacity: 0.7,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonSoft: {
    borderWidth: 1,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  primary: {
    minHeight: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  pressedPrimary: {
    opacity: 0.88,
  },
  disabledPrimary: {
    opacity: 0.45,
  },
  primaryLabel: {
    color: "#FFF7EC",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  ghost: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ghostLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  segmented: {
    alignSelf: "stretch",
    minHeight: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  iconBase: {
    fontFamily: ICON_FONT,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
});
