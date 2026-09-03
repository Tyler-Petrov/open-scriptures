import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Clipboard,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ref } from "@/lib/bible";
import { getCommentaryFor } from "@/lib/commentary";
import {
  HIGHLIGHT_TINTS,
  getHighlights,
  setHighlight,
  setHighlightNote,
  type Highlight,
  type HighlightColor,
} from "@/lib/annotations";
import { Icon, IconButton, READ_FONT } from "@/components/ui";
import SheetModal, { SheetScrollView } from "@/components/sheet-modal";
import CommentaryText from "@/components/commentary-text";

const COLOR_ORDER: HighlightColor[] = ["yellow", "green", "blue", "pink", "purple"];
const SNAP_POINTS = ["50%", "90%"];

export type VerseSheetProps = {
  verseKey: string;
  text: string;
  onClose: () => void;
};

export default function VerseSheet({ verseKey, text, onClose }: VerseSheetProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [hl, setHl] = useState<Highlight | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [openCmt, setOpenCmt] = useState<string | null>(null);
  const commentary = useMemo(() => {
    const [abbrev, chapter, verse] = verseKey.split(".");
    return getCommentaryFor(abbrev, Number(chapter), Number(verse));
  }, [verseKey]);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef("");
  const savedNoteRef = useRef("");
  const hasHlRef = useRef(false);
  useEffect(() => {
    draftRef.current = noteDraft;
  }, [noteDraft]);
  useEffect(() => {
    savedNoteRef.current = hl?.note ?? "";
    hasHlRef.current = !!hl;
  }, [hl]);
  // Auto-save a dirty note when the sheet closes or moves to another verse.
  useEffect(() => {
    return () => {
      const d = draftRef.current.trim();
      if (hasHlRef.current && d !== savedNoteRef.current) {
        void setHighlightNote(verseKey, d || null);
      }
    };
  }, [verseKey]);

  const reload = useCallback(async () => {
    const all = await getHighlights();
    const cur = all[verseKey] ?? null;
    setHl(cur);
    setNoteDraft(cur?.note ?? "");
  }, [verseKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load
    void reload();
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [reload]);

  const clearHighlight = async () => {
    draftRef.current = "";
    savedNoteRef.current = "";
    hasHlRef.current = false;
    setHl(null);
    setNoteDraft("");
    await setHighlight(verseKey, null);
  };

  const confirmRemoveHighlight = () => {
    if (!hl) return;
    Alert.alert(
      "Remove highlight?",
      hl.note
        ? "This will also delete the note attached to this verse."
        : "Remove this verse from your highlights?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void clearHighlight() },
      ],
      { cancelable: true }
    );
  };

  const applyColor = async (color: HighlightColor) => {
    if (hl?.color === color) {
      confirmRemoveHighlight();
      return;
    }
    setHl((prev) => ({ ...prev, color }));
    await setHighlight(verseKey, color);
  };

  const saveNote = async () => {
    const value = noteDraft.trim();
    setHl((prev) => (prev ? { ...prev, note: value || undefined } : prev));
    await setHighlightNote(verseKey, value || null);
  };

  const quoted = `“${text}” — ${ref(verseKey)} (KJV)`;

  const copy = () => {
    Clipboard.setString(quoted);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const share = () => void Share.share({ message: quoted });

  const styles = sheetStyles(c, insets.bottom);

  return (
    <SheetModal
      visible
      onRequestClose={onClose}
      snapPoints={SNAP_POINTS}
      initialIndex={1}
      backgroundColor={c.card}
      contentStyle={styles.sheet}
    >
      <SheetScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
            <View style={styles.refRow}>
              <Text style={styles.ref}>{ref(verseKey)}</Text>
              <Text style={styles.version}>KJV</Text>
              <View style={styles.spacer} />
              <IconButton
                name={copied ? "check" : "copy"}
                label="Copy verse"
                tone="soft"
                size={19}
                color={copied ? c.ox : c.text}
                onPress={copy}
                style={styles.refAction}
              />
              <IconButton
                name="share"
                label="Share verse"
                tone="soft"
                size={19}
                onPress={share}
                style={styles.refAction}
              />
            </View>
            <Text style={styles.text} numberOfLines={5}>
              {text}
            </Text>

            <Text style={styles.label}>Highlight</Text>
            <View style={styles.swatchRow}>
              {COLOR_ORDER.map((color) => {
                const active = hl?.color === color;
                return (
                  <Pressable
                    key={color}
                    onPress={() => void applyColor(color)}
                    accessibilityRole="button"
                    accessibilityLabel={`Highlight ${color}`}
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.swatch,
                      { backgroundColor: HIGHLIGHT_TINTS[color] },
                      active && styles.swatchActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    {active ? <Icon name="check" size={20} color="#FFFFFF" /> : null}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={confirmRemoveHighlight}
                disabled={!hl}
                accessibilityRole="button"
                accessibilityLabel="Remove highlight"
                style={({ pressed }) => [
                  styles.swatch,
                  styles.swatchClear,
                  !hl && { opacity: 0.35 },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Icon name="close" size={18} color={c.subtext} />
              </Pressable>
            </View>

            {commentary.length > 0 ? (
              <>
                <Text style={styles.label}>Commentary</Text>
                <View style={styles.cmtList}>
                  {commentary.map((hit, i) => {
                    const key = `${hit.writerId}-${hit.from}-${hit.to}-${i}`;
                    const open = openCmt === key;
                    return (
                      <View key={key} style={styles.cmtCard}>
                        <Pressable
                          onPress={() => setOpenCmt(open ? null : key)}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: open }}
                          style={({ pressed }) => [styles.cmtHead, pressed && { opacity: 0.7 }]}
                        >
                          <View style={styles.cmtHeadText}>
                            <Text style={styles.cmtWriter}>{hit.writer}</Text>
                            <Text style={styles.cmtRef}>{hit.ref}</Text>
                          </View>
                          <Icon name={open ? "chevronUp" : "chevronDown"} size={18} color={c.subtext} />
                        </Pressable>
                        {open ? (
                          <View style={styles.cmtBodyWrap}>
                            <CommentaryText text={hit.text} />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            {hl ? (
              <View style={styles.noteBox}>
                <TextInput
                  style={styles.noteInput}
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  onBlur={() => void saveNote()}
                  placeholder="Add a note to this highlight…"
                  placeholderTextColor={c.subtext}
                  multiline
                />
              </View>
            ) : null}
      </SheetScrollView>
    </SheetModal>
  );
}

type Palette = {
  bg: string;
  card: string;
  line: string;
  text: string;
  subtext: string;
  gold: string;
  ox: string;
};

const sheetStyles = (c: Palette, bottom: number) =>
  StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: c.card,
      paddingTop: 4,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: Math.max(28, bottom + 20),
      gap: 12,
    },
    refRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    ref: {
      color: c.ox,
      fontSize: 15,
      fontWeight: "700",
    },
    version: {
      color: c.subtext,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 1,
    },
    refAction: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.bg,
    },
    text: {
      color: c.text,
      fontFamily: READ_FONT,
      fontSize: 19,
      lineHeight: 27,
    },
    label: {
      color: c.subtext,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginTop: 6,
    },
    swatchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    swatch: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    swatchActive: {
      borderColor: c.text,
    },
    swatchClear: {
      borderColor: c.line,
      backgroundColor: c.bg,
      marginLeft: "auto",
    },
    cmtList: {
      gap: 8,
    },
    cmtCard: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 14,
      backgroundColor: c.bg,
      overflow: "hidden",
    },
    cmtHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    cmtHeadText: {
      flex: 1,
    },
    cmtWriter: {
      color: c.text,
      fontSize: 14,
      fontWeight: "600",
    },
    cmtRef: {
      color: c.subtext,
      fontSize: 12,
      marginTop: 1,
    },
    cmtBodyWrap: {
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    noteBox: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 14,
      backgroundColor: c.bg,
      padding: 14,
      gap: 8,
    },
    noteInput: {
      color: c.text,
      fontSize: 15,
      lineHeight: 21,
      minHeight: 44,
      textAlignVertical: "top",
      padding: 0,
    },
    spacer: { flex: 1 },
  });
