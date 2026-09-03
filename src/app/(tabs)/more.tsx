import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTheme } from "@/lib/theme";
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  useSettings,
  type ThemeMode,
} from "@/lib/settings";
import {
  HIGHLIGHT_TINTS,
  getHighlights,
  goToVerse,
  type Highlights,
} from "@/lib/annotations";
import { getChapter, ref as verseRef } from "@/lib/bible";
import {
  Card,
  Divider,
  Icon,
  IconButton,
  PageTitle,
  READ_FONT,
  Screen,
  SectionLabel,
  Segmented,
  type GlyphName,
} from "@/components/ui";

type LibraryItem = {
  verseKey: string;
  tint: string | null;
  note: string | null;
};

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: GlyphName }[] = [
  { value: "system", label: "Auto", icon: "auto" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

export default function MoreScreen() {
  const { c } = useTheme();
  const { settings, update } = useSettings();

  const [highlights, setHighlightsState] = useState<Highlights>({});
  const [expanded, setExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void getHighlights().then((h) => {
        if (alive) setHighlightsState(h);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  const items = useMemo<LibraryItem[]>(
    () =>
      Object.entries(highlights).map(([verseKey, hl]) => ({
        verseKey,
        tint: HIGHLIGHT_TINTS[hl.color],
        note: hl.note ?? null,
      })),
    [highlights]
  );

  const [verses, setVerses] = useState<Record<string, string[]>>({});
  const loadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!expanded || items.length === 0) return;
    const chapters = new Set(
      items.map((item) => item.verseKey.split(".").slice(0, 2).join("."))
    );
    let alive = true;
    void (async () => {
      for (const key of chapters) {
        if (loadedRef.current.has(key)) continue;
        loadedRef.current.add(key);
        const [abbrev, chapterRaw] = key.split(".");
        const list = await getChapter(abbrev, Number(chapterRaw));
        if (!alive) return;
        setVerses((prev) => ({ ...prev, [key]: list }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [expanded, items]);

  const stepFontSize = (delta: number) => {
    const next = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, settings.fontSize + delta));
    update({ fontSize: next });
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <PageTitle style={styles.title}>More</PageTitle>

      <SectionLabel>Your library</SectionLabel>
      <Card style={styles.groupCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((v) => !v)}
          style={({ pressed }) => [styles.libraryRow, pressed && styles.pressedRow]}
        >
          <Icon name="highlighter" size={20} color={c.ox} />
          <Text style={[styles.libraryLabel, { color: c.text }]}>Highlights</Text>
          <View style={styles.spacer} />
          <View style={[styles.countPill, { backgroundColor: c.bg }]}>
            <Text style={[styles.countText, { color: c.subtext }]}>{items.length}</Text>
          </View>
          <Icon name={expanded ? "chevronUp" : "chevronDown"} size={18} color={c.subtext} />
        </Pressable>
        {expanded && <LibraryItems items={items} verses={verses} />}
      </Card>

      <SectionLabel>Reading</SectionLabel>
      <Card style={styles.groupCard}>
        <View style={styles.settingBlock}>
          <View style={styles.settingHead}>
            <Icon name="palette" size={20} color={c.subtext} />
            <Text style={[styles.settingsLabel, { color: c.text }]}>Theme</Text>
          </View>
          <Segmented
            options={THEME_OPTIONS}
            value={settings.theme}
            onChange={(theme) => update({ theme })}
          />
        </View>
        <Divider />
        <View style={styles.settingsRow}>
          <Icon name="textSize" size={20} color={c.subtext} />
          <Text style={[styles.settingsLabel, { color: c.text }]}>Text size</Text>
          <View style={styles.spacer} />
          <IconButton
            name="textSizeDown"
            label="Smaller text"
            tone="soft"
            size={20}
            disabled={settings.fontSize <= FONT_SIZE_MIN}
            onPress={() => stepFontSize(-1)}
          />
          <Text style={[styles.fontSizeValue, { color: c.text }]}>{settings.fontSize}</Text>
          <IconButton
            name="textSizeUp"
            label="Larger text"
            tone="soft"
            size={20}
            disabled={settings.fontSize >= FONT_SIZE_MAX}
            onPress={() => stepFontSize(1)}
          />
        </View>
        <View style={[styles.previewBox, { borderColor: c.line, backgroundColor: c.bg }]}>
          <Text
            style={{
              color: c.text,
              fontFamily: READ_FONT,
              fontSize: settings.fontSize,
              lineHeight: Math.round(settings.fontSize * 1.55),
            }}
            numberOfLines={2}
          >
            Thy word is a lamp unto my feet, and a light unto my path.
          </Text>
        </View>
        <Divider />
        <View style={styles.settingsRow}>
          <Icon name="library" size={20} color={c.subtext} />
          <Text style={[styles.settingsLabel, { color: c.text }]}>Translation</Text>
          <View style={styles.spacer} />
          <Text style={[styles.settingsValue, { color: c.subtext }]}>King James Version</Text>
        </View>
      </Card>

      <SectionLabel>About</SectionLabel>
      <Card style={styles.groupCard}>
        <View style={styles.settingsRow}>
          <Icon name="info" size={20} color={c.subtext} />
          <Text style={[styles.settingsLabel, { color: c.text }]}>Bible</Text>
          <View style={styles.spacer} />
          <Text style={[styles.settingsValue, { color: c.subtext }]}>Version 1.0</Text>
        </View>
        <Divider />
        <View style={styles.settingsRow}>
          <Icon name="headphones" size={20} color={c.subtext} />
          <Text style={[styles.aboutText, { color: c.subtext }]}>
            Audio is streamed from LibriVox public-domain recordings.
          </Text>
        </View>
      </Card>

      <Text style={[styles.footnote, { color: c.subtext }]}>
        Your reading and highlights stay on this device.
      </Text>
    </Screen>
  );
}

function LibraryItems({
  items,
  verses,
}: {
  items: LibraryItem[];
  verses: Record<string, string[]>;
}) {
  const { c } = useTheme();
  if (items.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: c.subtext }]}>
        Tap any verse while reading to highlight it or add a note.
      </Text>
    );
  }
  return (
    <View style={styles.items}>
      {items.map((item, index) => {
        const [abbrev, chapterRaw, verseRaw] = item.verseKey.split(".");
        const chapterKey = `${abbrev}.${chapterRaw}`;
        const list = verses[chapterKey];
        const text = list ? list[Number(verseRaw) - 1] : null;
        const snippet = text ? (text.length > 90 ? `${text.slice(0, 90)}…` : text) : null;
        return (
          <Pressable
            key={item.verseKey}
            accessibilityRole="button"
            onPress={() => void goToVerse(item.verseKey)}
            style={({ pressed }) => [
              styles.itemRow,
              index > 0 && styles.itemGap,
              pressed && styles.pressedRow,
            ]}
          >
            <View style={styles.itemHeader}>
              <View
                style={[
                  styles.tintDot,
                  item.tint
                    ? { backgroundColor: item.tint }
                    : { borderWidth: 1.5, borderColor: c.line },
                ]}
              />
              <Text style={[styles.itemRef, { color: c.text }]}>
                {verseRef(item.verseKey)}
              </Text>
              <View style={styles.spacer} />
              <Icon name="chevronRight" size={16} color={c.subtext} />
            </View>
            {snippet ? (
              <Text style={[styles.itemBody, { color: c.subtext }]} numberOfLines={2}>
                {snippet}
              </Text>
            ) : (
              <Text style={[styles.itemBody, { color: c.subtext }]}>Loading…</Text>
            )}
            {item.note ? (
              <View style={styles.noteRow}>
                <Icon name="notes" size={14} color={c.gold} />
                <Text style={[styles.noteText, { color: c.text }]} numberOfLines={2}>
                  {item.note}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  title: {
    paddingTop: 12,
    paddingBottom: 6,
  },
  groupCard: {
    paddingVertical: 4,
    gap: 0,
  },
  libraryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 2,
  },
  libraryLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  countPill: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignItems: "center",
  },
  countText: {
    fontSize: 12,
    fontWeight: "600",
  },
  settingBlock: {
    paddingVertical: 14,
    paddingHorizontal: 2,
    gap: 12,
  },
  settingHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  settingsLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  settingsValue: {
    fontSize: 14,
  },
  fontSizeValue: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 28,
    textAlign: "center",
  },
  previewBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 2,
    marginBottom: 14,
  },
  aboutText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  spacer: {
    flex: 1,
  },
  pressedRow: {
    opacity: 0.7,
  },
  items: {
    paddingHorizontal: 2,
    paddingBottom: 14,
  },
  itemRow: {
    gap: 4,
  },
  itemGap: {
    marginTop: 14,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tintDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  itemRef: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
  },
  emptyText: {
    fontSize: 13,
    paddingHorizontal: 2,
    paddingBottom: 14,
  },
  footnote: {
    fontSize: 12,
    textAlign: "center",
    paddingBottom: 8,
  },
});
