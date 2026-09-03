import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import {
  Icon,
  LogoMark,
  PrimaryButton,
  READ_FONT,
  READ_FONT_SEMI,
  Screen,
} from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { useSettings } from "@/lib/settings";

const FACTS: { icon: "book" | "highlighter" | "calendar"; text: string }[] = [
  { icon: "book", text: "The whole King James Bible, offline" },
  { icon: "highlighter", text: "Highlight verses and add your own notes" },
  { icon: "calendar", text: "Reading plans, from five days to a year" },
];

export default function OnboardingScreen() {
  const { c } = useTheme();
  const { update } = useSettings();
  const [started, setStarted] = useState(false);

  const start = useCallback(() => {
    update({ onboarded: true });
    setStarted(true);
  }, [update]);

  return (
    <Screen style={styles.center}>
      <View style={styles.stack}>
        <LogoMark size={88} />
        <Text style={[styles.title, { color: c.text }]}>
          Read the Bible,{"\n"}a little every day
        </Text>
        <Text style={[styles.verse, { color: c.subtext }]}>
          “Thy word is a lamp unto my feet, and a light unto my path.”
        </Text>
        <Text style={[styles.ref, { color: c.gold }]}>Psalm 119:105</Text>

        <View style={[styles.facts, { borderColor: c.line, backgroundColor: c.card }]}>
          {FACTS.map((f, i) => (
            <View
              key={f.text}
              style={[
                styles.factRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
              ]}
            >
              <Icon name={f.icon} size={20} color={c.ox} />
              <Text style={[styles.factText, { color: c.text }]}>{f.text}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton label="Start reading" onPress={start} style={styles.button} />
        <Text style={[styles.footnote, { color: c.subtext }]}>
          King James Version · Everything stays on this device
        </Text>
      </View>
      {started && <Redirect href="/(tabs)/read" />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  stack: {
    alignItems: "center",
    gap: 14,
    width: "100%",
    maxWidth: 420,
  },
  title: {
    fontFamily: READ_FONT_SEMI,
    fontSize: 34,
    lineHeight: 40,
    textAlign: "center",
    marginTop: 10,
  },
  verse: {
    fontFamily: READ_FONT,
    fontSize: 19,
    lineHeight: 27,
    textAlign: "center",
    marginTop: 4,
  },
  ref: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: -6,
  },
  facts: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  factText: {
    fontSize: 15,
    flex: 1,
  },
  button: {
    width: "100%",
    marginTop: 12,
  },
  footnote: {
    fontSize: 12,
    marginTop: 2,
  },
});
