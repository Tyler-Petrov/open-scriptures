import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Palette } from "@/lib/theme";
import { BOOKS, type BookMeta } from "@/lib/bible";
import type { ReadingPosition } from "@/lib/annotations";
import { Icon, IconButton, Segmented } from "@/components/ui";
import SheetModal, { SheetScrollView } from "@/components/sheet-modal";

const COLS = 6;
const GAP = 8;
const SIDE = 20;
const SNAP_POINTS = ["100%"];

export type BookSheetProps = {
  open: boolean;
  current: ReadingPosition;
  onPick: (book: string, chapter: number) => void;
  onClose: () => void;
};

/** Book & chapter chooser as a bottom sheet over the reader. */
export default function BookSheet({ open, current, onPick, onClose }: BookSheetProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [testament, setTestament] = useState<"OT" | "NT">("OT");
  const [expanded, setExpanded] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrolledRef = useRef(false);

  // Each time the sheet opens, land on the book being read.
  useEffect(() => {
    if (!open) return;
    const meta = BOOKS.find((b) => b.abbrev === current.book);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the sheet opens
    setTestament(meta?.testament ?? "OT");
    setExpanded(current.book);
    scrolledRef.current = false;
  }, [open, current.book]);

  const books = BOOKS.filter((b) => b.testament === testament);
  const cell = Math.floor((width - SIDE * 2 - 28 - GAP * (COLS - 1)) / COLS);
  const styles = sheetStyles(c, cell);

  const switchTestament = (t: "OT" | "NT") => {
    setTestament(t);
    const stays = BOOKS.find((b) => b.abbrev === expanded)?.testament === t;
    if (!stays) setExpanded(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <SheetModal
      visible={open}
      onRequestClose={onClose}
      snapPoints={SNAP_POINTS}
      initialIndex={0}
      backgroundColor={c.bg}
      contentStyle={styles.sheet}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Books</Text>
        </View>
        <IconButton name="close" label="Close" onPress={onClose} color={c.subtext} />
      </View>

      <Segmented
        style={styles.segmented}
        value={testament}
        onChange={switchTestament}
        options={[
          { value: "OT", label: "Old Testament" },
          { value: "NT", label: "New Testament" },
        ]}
      />

      <SheetScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {books.map((b) => {
          const isOpen = expanded === b.abbrev;
          const isCurrentBook = current.book === b.abbrev;
          return (
            <View
              key={b.abbrev}
              style={[styles.bookCard, isOpen && styles.bookCardOpen]}
              onLayout={(e) => {
                if (isCurrentBook && isOpen && !scrolledRef.current) {
                  scrolledRef.current = true;
                  const y = e.nativeEvent.layout.y;
                  if (y > 120) {
                    scrollRef.current?.scrollTo({ y: y - 12, animated: false });
                  }
                }
              }}
            >
              <Pressable
                onPress={() => setExpanded(isOpen ? null : b.abbrev)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                style={({ pressed }) => [styles.bookRow, pressed && { opacity: 0.7 }]}
              >
                <Text
                  style={[styles.bookName, (isOpen || isCurrentBook) && styles.bookNameActive]}
                >
                  {b.name}
                </Text>
                <Text style={styles.bookCount}>
                  {b.chapters} {b.chapters === 1 ? "chapter" : "chapters"}
                </Text>
                <RotatingChevron open={isOpen} color={c.subtext} />
              </Pressable>
              {isOpen ? (
                <ChapterGrid
                  book={b}
                  cell={cell}
                  current={isCurrentBook ? current.chapter : null}
                  onPick={(n) => onPick(b.abbrev, n)}
                  styles={styles}
                />
              ) : null}
            </View>
          );
        })}
      </SheetScrollView>
    </SheetModal>
  );
}

function RotatingChevron({ open, color }: { open: boolean; color: string }) {
  const [anim] = useState(() => new Animated.Value(open ? 1 : 0));
  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, anim]);
  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "180deg"],
            }),
          },
        ],
      }}
    >
      <Icon name="chevronDown" size={20} color={color} />
    </Animated.View>
  );
}

function ChapterGrid({
  book,
  cell,
  current,
  onPick,
  styles,
}: {
  book: BookMeta;
  cell: number;
  current: number | null;
  onPick: (n: number) => void;
  styles: ReturnType<typeof sheetStyles>;
}) {
  const rows = Math.ceil(book.chapters / COLS);
  const fullHeight = rows * cell + (rows - 1) * GAP + 16; // grid + its vertical padding
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // height animation
    }).start();
  }, [anim]);

  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);
  return (
    <Animated.View
      style={{
        height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, fullHeight] }),
        opacity: anim,
        overflow: "hidden",
      }}
    >
      <View style={styles.grid}>
        {chapters.map((n) => {
          const isCurrent = current === n;
          return (
            <Pressable
              key={n}
              onPress={() => onPick(n)}
              accessibilityRole="button"
              accessibilityLabel={`${book.name} ${n}`}
              style={({ pressed }) => [
                styles.cell,
                isCurrent && styles.cellCurrent,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.cellText, isCurrent && styles.cellTextCurrent]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const sheetStyles = (c: Palette, cell: number) =>
  StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: c.bg,
      paddingTop: 4,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: SIDE,
      paddingRight: 8,
      paddingBottom: 10,
    },
    headerText: {
      flex: 1,
    },
    title: {
      color: c.text,
      fontSize: 22,
      fontWeight: "700",
    },
    segmented: {
      marginHorizontal: SIDE,
      marginBottom: 10,
    },
    list: {
      paddingHorizontal: SIDE,
      paddingTop: 4,
      gap: 4,
    },
    bookCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "transparent",
    },
    bookCardOpen: {
      backgroundColor: c.card,
      borderColor: c.line,
      marginVertical: 4,
    },
    bookRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    bookName: {
      flex: 1,
      color: c.text,
      fontSize: 16,
    },
    bookNameActive: {
      color: c.ox,
      fontWeight: "700",
    },
    bookCount: {
      color: c.subtext,
      fontSize: 12,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GAP,
      paddingHorizontal: 14,
      paddingBottom: 14,
      paddingTop: 2,
    },
    cell: {
      width: cell,
      height: cell,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    cellCurrent: {
      backgroundColor: c.ox,
      borderColor: c.ox,
    },
    cellText: {
      color: c.text,
      fontSize: 15,
      fontWeight: "500",
    },
    cellTextCurrent: {
      color: "#FFF7EC",
      fontWeight: "700",
    },
  });
