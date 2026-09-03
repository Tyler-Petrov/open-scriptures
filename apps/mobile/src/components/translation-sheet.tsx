import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TRANSLATION_IDS, TRANSLATIONS, type TranslationId } from "@openscripture/core";
import { useTheme } from "@/lib/theme";
import { useSettings } from "@/lib/settings";
import { useTranslations } from "@/lib/scripture";
import { Icon, IconButton } from "@/components/ui";
import SheetModal from "@/components/sheet-modal";

/** Pick the translation the reader, search and library snippets use. */
export default function TranslationSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const live = useTranslations();

  const choose = (id: TranslationId) => {
    update({ translation: id });
    onClose();
  };

  return (
    <SheetModal
      visible={open}
      onRequestClose={onClose}
      backgroundColor={c.card}
      contentStyle={[
        styles.sheet,
        { backgroundColor: c.card, paddingBottom: Math.max(24, insets.bottom + 16) },
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.text }]}>Translation</Text>
        <IconButton name="close" label="Close" onPress={onClose} color={c.subtext} />
      </View>

      <View style={[styles.list, { borderColor: c.line, backgroundColor: c.bg }]}>
        {TRANSLATION_IDS.map((id, i) => {
          const t = TRANSLATIONS[id];
          const status = live?.find((x) => x.id === id);
          // Unknown until the backend answers; then only pick what it can serve.
          const blocked = status ? !status.available : false;
          const selected = settings.translation === id;
          return (
            <Pressable
              key={id}
              onPress={() => choose(id)}
              disabled={blocked}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: blocked }}
              accessibilityLabel={t.name}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
                pressed && { opacity: 0.7 },
                blocked && { opacity: 0.45 },
              ]}
            >
              <View style={[styles.badge, { backgroundColor: selected ? c.ox : c.card, borderColor: c.line }]}>
                <Text style={[styles.badgeText, { color: selected ? "#FFFFFF" : c.text }]}>{id}</Text>
              </View>
              <View style={styles.body}>
                <Text style={[styles.name, { color: c.text }]}>{t.name}</Text>
                <Text style={[styles.blurb, { color: c.subtext }]} numberOfLines={2}>
                  {blocked ? status?.reason : t.blurb}
                </Text>
              </View>
              {selected ? <Icon name="check" size={20} color={c.ox} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.footnote, { color: c.subtext }]}>
        Highlights and notes follow the verse, so they carry across translations. Word study and
        audio follow the King James text.
      </Text>
    </SheetModal>
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
  list: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  badge: {
    minWidth: 56,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
  },
  blurb: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
});
