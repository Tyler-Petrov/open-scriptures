import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Collapsible, Column, Host, RNHostView } from "@expo/ui";
import { useTheme, type Palette } from "@/lib/theme";
import { BOOKS, ref as refLabel } from "@/lib/bible";
import { goToVerse } from "@/lib/annotations";
import { getEntry, getOccurrences } from "@/lib/strongs";
import { READ_FONT, READ_FONT_SEMI } from "@/components/ui";
import SheetModal, { SheetScrollView } from "@/components/sheet-modal";

const SNAP_POINTS = ["100%"];

type VerseOccurrence = { key: string; verse: number };
type OccurrenceChapter = { chapter: number; verses: VerseOccurrence[] };
type OccurrenceBook = {
  abbrev: string;
  name: string;
  count: number;
  chapters: OccurrenceChapter[];
};

function groupOccurrences(verseKeys: string[]): OccurrenceBook[] {
  const byBook = new Map<string, Map<number, VerseOccurrence[]>>();

  for (const key of verseKeys) {
    const [abbrev, chapterPart, versePart] = key.split(".");
    const chapter = Number(chapterPart);
    const verse = Number(versePart);
    if (!abbrev || !Number.isFinite(chapter) || !Number.isFinite(verse)) continue;

    let chapters = byBook.get(abbrev);
    if (!chapters) {
      chapters = new Map();
      byBook.set(abbrev, chapters);
    }
    const verses = chapters.get(chapter) ?? [];
    verses.push({ key, verse });
    chapters.set(chapter, verses);
  }

  return BOOKS.flatMap((book) => {
    const chapters = byBook.get(book.abbrev);
    if (!chapters) return [];
    const groupedChapters = Array.from(chapters, ([chapter, verses]) => ({ chapter, verses }));
    return [
      {
        abbrev: book.abbrev,
        name: book.name,
        count: groupedChapters.reduce((sum, chapter) => sum + chapter.verses.length, 0),
        chapters: groupedChapters,
      },
    ];
  });
}

type WordStyles = ReturnType<typeof wordStyles>;

type WordReferencesProps = {
  code: string;
  c: Palette;
  isDark: boolean;
  styles: WordStyles;
  onOpenOccurrence: (verseKey: string) => void;
};

function WordReferences({
  code,
  c,
  isDark,
  styles,
  onOpenOccurrence,
}: WordReferencesProps) {
  const occurrences = useMemo(() => getOccurrences(code), [code]);
  const occurrenceBooks = useMemo(() => groupOccurrences(occurrences), [occurrences]);
  const [openBook, setOpenBook] = useState<string | null>(null);

  return (
    <>
      <Text style={styles.label}>
        Appears in {occurrences.length.toLocaleString("en-US")}{" "}
        {occurrences.length === 1 ? "verse" : "verses"} across {occurrenceBooks.length}{" "}
        {occurrenceBooks.length === 1 ? "book" : "books"}
      </Text>
      <Host
        colorScheme={isDark ? "dark" : "light"}
        seedColor={c.card}
        matchContents={{ vertical: true }}
        style={styles.occHost}
      >
        <Column spacing={4}>
          {occurrenceBooks.map((book) => {
            const isOpen = openBook === book.abbrev;
            const countLabel =
              book.count.toLocaleString("en-US") +
              " " +
              (book.count === 1 ? "verse" : "verses");
            return (
              <Collapsible
                key={book.abbrev}
                isOpen={isOpen}
                onOpenChange={(open) => setOpenBook(open ? book.abbrev : null)}
                label={book.name + " · " + countLabel}
                labelStyle={{ color: c.text, fontSize: 14, fontWeight: "600" }}
              >
                {isOpen ? (
                  <RNHostView matchContents>
                    <View style={styles.bookRefs}>
                      {book.chapters.map((chapter) => (
                        <View key={chapter.chapter} style={styles.chapterBlock}>
                          <Text style={styles.chapterLabel}>Chapter {chapter.chapter}</Text>
                          <Text style={styles.referenceLine}>
                            {chapter.verses.map((occurrence, index) => (
                              <Text
                                key={occurrence.key}
                                onPress={() => onOpenOccurrence(occurrence.key)}
                                accessibilityRole="link"
                                accessibilityLabel={refLabel(occurrence.key)}
                                style={styles.referenceLink}
                              >
                                {index > 0 ? "  ·  " : ""}
                                {chapter.chapter}:{occurrence.verse}
                              </Text>
                            ))}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </RNHostView>
                ) : null}
              </Collapsible>
            );
          })}
        </Column>
      </Host>
    </>
  );
}

export type WordSheetProps = {
  code: string;
  word: string;
  onClose: () => void;
};

/** Long-press word sheet: the original Greek/Hebrew/Aramaic behind a KJV word. */
export default function WordSheet({ code, word, onClose }: WordSheetProps) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const entry = useMemo(() => getEntry(code), [code]);
  const styles = wordStyles(c, insets.bottom);

  const openOccurrence = (verseKey: string) => {
    onClose();
    void goToVerse(verseKey);
  };

  return (
    <SheetModal
      visible
      onRequestClose={onClose}
      snapPoints={SNAP_POINTS}
      initialIndex={0}
      backgroundColor={c.card}
      contentStyle={styles.sheet}
    >
      <SheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
            <View style={styles.topRow}>
              <Text style={styles.snum}>{code}</Text>
              {entry ? (
                <View style={styles.langChip}>
                  <Text style={styles.langChipText}>{entry.l}</Text>
                </View>
              ) : null}
              <View style={styles.spacer} />
              <Text style={styles.surface} numberOfLines={1}>
                “{word.trim()}”
              </Text>
            </View>

            {entry ? (
              <>
                <Text style={styles.original}>{entry.o}</Text>
                <Text style={styles.translit}>
                  {entry.t}
                  {entry.p ? <Text style={styles.pron}> · {entry.p}</Text> : null}
                  {entry.pos ? <Text style={styles.pron}> · {entry.pos}</Text> : null}
                </Text>

                {entry.d ? <Text style={styles.definition}>{entry.d}</Text> : null}
                {entry.r ? <Text style={styles.derivation}>{entry.r}</Text> : null}

                {entry.u ? (
                  <>
                    <Text style={styles.label}>Outline of usage</Text>
                    <Text style={styles.body}>{entry.u}</Text>
                  </>
                ) : null}

                {entry.k ? (
                  <>
                    <Text style={styles.label}>KJV translates it</Text>
                    <Text style={styles.body}>{entry.k}</Text>
                  </>
                ) : null}

                <WordReferences
                  code={code}
                  c={c}
                  isDark={isDark}
                  styles={styles}
                  onOpenOccurrence={openOccurrence}
                />
              </>
            ) : (
              <Text style={styles.body}>No dictionary entry found for {code}.</Text>
            )}
      </SheetScrollView>
    </SheetModal>
  );
}

const wordStyles = (c: Palette, bottom: number) =>
  StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: c.card,
      paddingTop: 4,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: Math.max(28, bottom + 20),
      gap: 8,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    snum: {
      color: c.ox,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    langChip: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    langChipText: {
      color: c.subtext,
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    spacer: { flex: 1 },
    surface: {
      color: c.subtext,
      fontSize: 13,
      fontStyle: "italic",
      maxWidth: "40%",
    },
    original: {
      color: c.text,
      fontFamily: READ_FONT_SEMI,
      fontSize: 40,
      lineHeight: 52,
      textAlign: "left",
      marginTop: 2,
    },
    translit: {
      color: c.text,
      fontSize: 15,
      fontStyle: "italic",
    },
    pron: {
      color: c.subtext,
      fontStyle: "normal",
      fontSize: 13,
    },
    definition: {
      color: c.text,
      fontFamily: READ_FONT,
      fontSize: 17,
      lineHeight: 25,
      marginTop: 6,
    },
    derivation: {
      color: c.subtext,
      fontSize: 12.5,
      lineHeight: 18,
    },
    label: {
      color: c.subtext,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 1.3,
      textTransform: "uppercase",
      marginTop: 12,
    },
    body: {
      color: c.text,
      fontSize: 13.5,
      lineHeight: 20,
    },
    occHost: {
      width: "100%",
      marginTop: 2,
    },
    bookRefs: {
      width: "100%",
      borderLeftWidth: 2,
      borderLeftColor: c.gold,
      paddingLeft: 12,
      paddingBottom: 4,
      gap: 12,
    },
    chapterBlock: {
      gap: 3,
    },
    chapterLabel: {
      color: c.subtext,
      fontSize: 10.5,
      fontWeight: "600",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    referenceLine: {
      color: c.text,
      fontSize: 14,
      lineHeight: 28,
    },
    referenceLink: {
      color: c.ox,
      fontWeight: "600",
    },
  });
