import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { GOLD_SOFT, OX_SOFT, useTheme, type Palette } from "@/lib/theme";
import { useSettings } from "@/lib/settings";
import { BOOKS, getBookMeta, getChapter } from "@/lib/bible";
import { BOOK_AUDIO } from "@/lib/audio";
import { getChapterTiming } from "@/lib/timings";
import { getVerseSpans } from "@/lib/strongs";
import { completedDays, getPlan, loadPlanProgress, markDayComplete } from "@/lib/plans";
import {
  HIGHLIGHT_TINTS,
  getHighlights,
  getPosition,
  setPosition,
  subscribeAnnotations,
  type Highlights,
  type ReadingPosition,
} from "@/lib/annotations";
import VerseSheet from "@/components/verse-sheet";
import WordSheet from "@/components/word-sheet";
import BookSheet from "@/components/book-sheet";
import DisplaySheet from "@/components/display-sheet";
import {
  ICON_FONT,
  Icon,
  IconButton,
  READ_FONT,
  READ_FONT_SEMI,
  glyph,
} from "@/components/ui";

type Params = {
  book?: string;
  ch?: string;
  v?: string;
  plan?: string;
  day?: string;
};

const WORD_PRESS_DELAY_MS = 500;
const WORD_PRESS_RELEASE_GUARD_MS = 100;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default function ReadScreen() {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const params = useLocalSearchParams<Params>();

  const [pos, setPos] = useState<ReadingPosition>({ book: "Gen", chapter: 1 });
  const [verses, setVerses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingVerse, setPendingVerse] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [wordSheet, setWordSheet] = useState<{ code: string; word: string } | null>(null);
  const wordPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordPressReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordPressOpenedRef = useRef(false);

  const clearWordPressTimers = useCallback(() => {
    if (wordPressTimerRef.current) clearTimeout(wordPressTimerRef.current);
    if (wordPressReleaseTimerRef.current) clearTimeout(wordPressReleaseTimerRef.current);
    wordPressTimerRef.current = null;
    wordPressReleaseTimerRef.current = null;
  }, []);

  const beginWordPress = useCallback(
    (code: string, word: string) => {
      clearWordPressTimers();
      wordPressOpenedRef.current = false;
      wordPressTimerRef.current = setTimeout(() => {
        wordPressTimerRef.current = null;
        wordPressOpenedRef.current = true;
        Vibration.vibrate(20);
        setWordSheet({ code, word });
      }, WORD_PRESS_DELAY_MS);
    },
    [clearWordPressTimers]
  );

  const cancelWordPress = useCallback(() => {
    if (wordPressTimerRef.current) clearTimeout(wordPressTimerRef.current);
    wordPressTimerRef.current = null;
    if (wordPressOpenedRef.current) {
      wordPressReleaseTimerRef.current = setTimeout(() => {
        wordPressOpenedRef.current = false;
        wordPressReleaseTimerRef.current = null;
      }, WORD_PRESS_RELEASE_GUARD_MS);
    }
  }, []);

  const selectVerse = useCallback((index: number) => {
    if (!wordPressOpenedRef.current) setSelected(index);
  }, []);

  useEffect(() => clearWordPressTimers, [clearWordPressTimers]);

  // react-native-web never fires onLongPress on nested Text, so the browser
  // gets a DOM-level long-press with the same 500ms threshold.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const down = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        "[data-scode]"
      ) as HTMLElement | null;
      if (!el) return;
      const sx = e.clientX;
      const sy = e.clientY;
      const move = (me: PointerEvent) => {
        if (Math.hypot(me.clientX - sx, me.clientY - sy) > 12) clear();
      };
      const up = () => {
        clear();
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
      };
      timer = setTimeout(() => {
        // opens at the threshold, finger still down; swallow the click that
        // follows release so the verse sheet doesn't open on top
        const blocker = (ce: MouseEvent) => {
          ce.stopPropagation();
          ce.preventDefault();
        };
        document.addEventListener("click", blocker, true);
        setTimeout(() => document.removeEventListener("click", blocker, true), 800);
        try {
          navigator.vibrate?.(20);
        } catch {
          // vibration unsupported on this browser
        }
        setWordSheet({ code: el.dataset.scode ?? "", word: el.textContent ?? "" });
        clear();
      }, WORD_PRESS_DELAY_MS);
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, []);
  const [highlights, setHighlights] = useState<Highlights>({});
  const [planCtx, setPlanCtx] = useState<{ id: string; day: number } | null>(null);
  const [planDayDone, setPlanDayDone] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);
  const followRef = useRef(true);

  const listRef = useRef<FlatList<string>>(null);
  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  const loadingRef = useRef(false);
  const bootedRef = useRef(false);

  const meta = useMemo(() => {
    try {
      return getBookMeta(pos.book);
    } catch {
      return getBookMeta("Gen");
    }
  }, [pos.book]);
  const timing = useMemo(() => getChapterTiming(pos.book, pos.chapter), [pos.book, pos.chapter]);
  const bookIndex = Math.max(0, BOOKS.findIndex((b) => b.abbrev === pos.book));
  const prevBook = bookIndex > 0 ? BOOKS[bookIndex - 1] : null;
  const nextBook = bookIndex < BOOKS.length - 1 ? BOOKS[bookIndex + 1] : null;
  const hasPrev = pos.chapter > 1 || !!prevBook;
  const hasNext = pos.chapter < meta.chapters || !!nextBook;
  const nextLabel =
    pos.chapter < meta.chapters
      ? `${meta.name} ${pos.chapter + 1}`
      : nextBook
        ? `${nextBook.name} 1`
        : null;

  const load = useCallback(
    async (book: string, chapter: number, verse: number | null = null) => {
      loadingRef.current = true;
      bootedRef.current = true;
      setLoading(true);
      setSelected(null);
      setFlash(null);
      setPos({ book, chapter });
      await setPosition(book, chapter);
      try {
        const data = await getChapter(book, chapter);
        setVerses(data);
        setPendingVerse(verse);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    []
  );

  const refreshAnnotations = useCallback(async () => {
    setHighlights(await getHighlights());
  }, []);

  // Deep links: search results, Home, plans, library.
  const pBook = one(params.book);
  const pCh = one(params.ch);
  const pV = one(params.v);
  const pPlan = one(params.plan);
  const pDay = one(params.day);
  useEffect(() => {
    if (!pBook || !BOOKS.some((b) => b.abbrev === pBook)) return;
    const ch = Number(pCh);
    const v = Number(pV);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deep-link driven load
    void load(
      pBook,
      Number.isFinite(ch) && ch >= 1 ? ch : 1,
      Number.isFinite(v) && v >= 1 ? v : null
    );
    const day = Number(pDay);
    const ctx = pPlan && getPlan(pPlan) && Number.isFinite(day) ? { id: pPlan, day } : null;
    setPlanCtx(ctx);
    if (ctx) {
      void loadPlanProgress().then((progress) => {
        setPlanDayDone(completedDays(progress, ctx.id).includes(ctx.day));
      });
    }
  }, [pBook, pCh, pV, pPlan, pDay, load]);

  // On focus: first load, or pick up a position the book picker stored.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const stored = await getPosition();
        if (!alive || loadingRef.current) return;
        const cur = posRef.current;
        const valid = BOOKS.some((b) => b.abbrev === stored.book);
        const changed = valid && (stored.book !== cur.book || stored.chapter !== cur.chapter);
        if (!bootedRef.current || changed) {
          void load(valid ? stored.book : "Gen", valid ? stored.chapter : 1);
        }
        void refreshAnnotations();
      })();
      const unsub = subscribeAnnotations(() => void refreshAnnotations());
      return () => {
        alive = false;
        unsub();
      };
    }, [load, refreshAnnotations])
  );

  // Scroll to a target verse once the chapter is rendered, then flash it.
  useEffect(() => {
    if (loading || pendingVerse == null || verses.length === 0) return;
    const target = pendingVerse - 1;
    if (target < 0 || target >= verses.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale target
      setPendingVerse(null);
      return;
    }
    const t = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index: target, viewPosition: 0.2, animated: true });
      } catch {
        // onScrollToIndexFailed retries
      }
      setPendingVerse(null);
      setFlash(target);
    }, 150);
    return () => clearTimeout(t);
  }, [loading, pendingVerse, verses.length]);

  useEffect(() => {
    if (flash == null) return;
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [flash]);

  // ---- Audio (chapter-aligned LibriVox streams) ----
  const audio = useAudioPlayer(audioUrl ? { uri: audioUrl } : undefined, {
    updateInterval: 500,
  });
  const audioStatus = useAudioPlayerStatus(audio);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- streams are per-book
    setAudioUrl(null);
    setPlaying(false);
    setPendingSeek(null);
  }, [pos.book]);

  useEffect(() => {
    if (!audioUrl) return;
    audio.setActiveForLockScreen(true, {
      title: "The Holy Bible",
      artist: "King James Version",
    }, {
      showSeekBackward: true,
      showSeekForward: true,
    });
    return () => audio.setActiveForLockScreen(false);
  }, [audio, audioUrl]);

  useEffect(() => {
    if (!audioUrl) return;
    audio.updateLockScreenMetadata({
      title: `${meta.name} ${pos.chapter}`,
      artist: "King James Version",
      albumTitle: "The Holy Bible",
    });
  }, [audio, audioUrl, meta.name, pos.chapter]);

  useEffect(() => {
    if (audioUrl && playing) audio.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  useEffect(() => {
    const subscription = audio.addListener("playbackStatusUpdate", (status) => {
      setPlaying(status.playing);
    });
    return () => subscription.remove();
  }, [audio]);

  const toggleAudio = () => {
    if (!audioUrl) {
      setPlaying(true);
      followRef.current = true;
      if (timing) {
        setPendingSeek(timing.verses[0]);
        setAudioUrl(timing.url);
      } else {
        setAudioUrl(BOOK_AUDIO[pos.book] ?? null);
      }
      return;
    }
    if (playing) {
      setPlaying(false);
      audio.pause();
    } else {
      setPlaying(true);
      audio.play();
    }
  };

  const stopAudio = () => {
    setPlaying(false);
    try {
      audio.pause();
    } catch {
      // player may not be mounted yet
    }
    setAudioUrl(null);
    setPendingSeek(null);
  };

  // Apply a queued seek once the (possibly new) source is ready.
  useEffect(() => {
    if (pendingSeek == null) return;
    if (!audioStatus.isLoaded || !(audioStatus.duration > 0)) return;
    void audio.seekTo(pendingSeek);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot consume
    setPendingSeek(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSeek, audioStatus.isLoaded, audioStatus.duration]);

  // Verse currently being read aloud (needs per-verse timings).
  const activeVerse = useMemo(() => {
    if (!playing || !timing || !audioUrl || audioUrl !== timing.url) return null;
    const t = audioStatus.currentTime;
    if (!Number.isFinite(t) || t < timing.verses[0] - 0.5 || t > timing.end + 1) return null;
    let idx = 0;
    for (let i = 0; i < timing.verses.length; i++) {
      if (timing.verses[i] <= t + 0.3) idx = i;
      else break;
    }
    return idx;
  }, [playing, timing, audioUrl, audioStatus.currentTime]);

  // Follow the narration unless the reader has scrolled away.
  useEffect(() => {
    if (activeVerse == null || !followRef.current) return;
    try {
      listRef.current?.scrollToIndex({ index: activeVerse, viewPosition: 0.35, animated: true });
    } catch {
      // list not measured yet
    }
  }, [activeVerse]);

  // When narration passes the end of the chapter, turn the page.
  useEffect(() => {
    if (!playing || !timing || !audioUrl || audioUrl !== timing.url) return;
    if (loadingRef.current) return;
    const t = audioStatus.currentTime;
    if (!Number.isFinite(t) || t < timing.end + 0.6) return;
    const next = getChapterTiming(pos.book, pos.chapter + 1);
    if (next) {
      if (next.url !== timing.url) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- page turn driven by playback position
        setPendingSeek(next.verses[0]);
        setAudioUrl(next.url);
      }
      void load(pos.book, pos.chapter + 1);
    } else {
      stopAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioStatus.currentTime, playing, timing, audioUrl, pos.book, pos.chapter]);

  /** Keep an active audio session on the chapter the reader navigates to. */
  const syncAudio = (book: string, chapter: number) => {
    if (!audioUrl) return;
    const t = getChapterTiming(book, chapter);
    if (!t) return; // legacy whole-book stream: leave it playing
    followRef.current = true;
    setPendingSeek(t.verses[0]);
    if (t.url !== audioUrl) setAudioUrl(t.url);
  };

  const extra = useMemo(
    () => ({ highlights, selected, flash, activeVerse }),
    [highlights, selected, flash, activeVerse]
  );

  // ---- Chapter navigation ----
  const goPrev = () => {
    if (pos.chapter > 1) {
      syncAudio(pos.book, pos.chapter - 1);
      void load(pos.book, pos.chapter - 1);
    } else if (prevBook) {
      void load(prevBook.abbrev, prevBook.chapters);
    }
  };
  const goNext = () => {
    if (pos.chapter < meta.chapters) {
      syncAudio(pos.book, pos.chapter + 1);
      void load(pos.book, pos.chapter + 1);
    } else if (nextBook) {
      void load(nextBook.abbrev, 1);
    }
  };

  const fontSize = Math.min(28, Math.max(14, settings.fontSize));
  const styles = useMemo(() => readerStyles(c, fontSize, insets), [c, fontSize, insets]);

  const plan = planCtx ? getPlan(planCtx.id) : undefined;
  const planDay = plan?.days.find((d) => d.day === planCtx?.day);
  const planNextDay = plan && planDay ? plan.days.find((d) => d.day === planDay.day + 1) : undefined;

  const markPlanDayDone = () => {
    if (!plan || !planDay) return;
    setPlanDayDone(true);
    void markDayComplete(plan.id, planDay.day);
  };

  const renderVerse = ({ item, index }: { item: string; index: number }) => {
    const verseKey = `${pos.book}.${pos.chapter}.${index + 1}`;
    const hl = highlights[verseKey];
    const tint = hl ? hexToRgba(HIGHLIGHT_TINTS[hl.color], isDark ? 0.38 : 0.42) : null;
    const hasNote = !!hl?.note;
    const spans = getVerseSpans(pos.book, pos.chapter, index + 1);
    const emphasized = selected === index || flash === index;
    const isActive = activeVerse === index;
    return (
      <Pressable
        onPress={() => selectVerse(index)}
        accessibilityRole="button"
        accessibilityLabel={`Verse ${index + 1}`}
        style={({ pressed }) => [
          styles.verseRow,
          emphasized && { backgroundColor: GOLD_SOFT },
          !emphasized && isActive && { backgroundColor: OX_SOFT },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.verseText}>
          <Text style={styles.verseNum}>{index + 1}</Text>
          <Text style={styles.verseGap}>{"  "}</Text>
          {spans ? (
            spans.map((sp, i) => {
              const t = sp[0];
              const code = sp[1];
              const supplied = sp.length > 2 ? styles.supplied : null;
              return code ? (
                <Text
                  key={i}
                  suppressHighlighting
                  {...(Platform.OS === "web"
                    ? // RNW virtual-text pressability is broken and swallows
                      // clicks, so the web span stays inert: the row handles
                      // taps and the document-level listener handles long presses
                      // via this data attribute.
                      ({ dataSet: { scode: String(code) } } as object)
                    : {
                        onPress: () => selectVerse(index),
                        onPressIn: () => beginWordPress(String(code), t),
                        onPressOut: cancelWordPress,
                      })}
                  style={[tint ? { backgroundColor: tint } : styles.taggedWord, supplied]}
                >
                  {t}
                </Text>
              ) : (
                <Text key={i} style={[tint ? { backgroundColor: tint } : null, supplied]}>
                  {t}
                </Text>
              );
            })
          ) : (
            <Text style={tint ? { backgroundColor: tint } : undefined}>{item}</Text>
          )}
          {hasNote ? <Text style={styles.mark}>{`  ${glyph("notes")}`}</Text> : null}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setBookOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose book and chapter"
          style={({ pressed }) => [styles.titlePill, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.titleText} numberOfLines={1}>
            {meta.name} {pos.chapter}
          </Text>
          <Icon name="chevronDown" size={20} color={c.subtext} />
        </Pressable>
        <View style={styles.spacer} />
        <IconButton
          name="textSize"
          label="Text size and theme"
          onPress={() => setDisplayOpen(true)}
        />
        {timing || BOOK_AUDIO[pos.book] ? (
          <IconButton
            name={audioUrl ? (playing ? "pause" : "play") : "headphones"}
            label={audioUrl ? (playing ? "Pause" : "Resume") : `Listen to ${meta.name}`}
            onPress={toggleAudio}
            color={audioUrl ? c.ox : c.text}
          />
        ) : null}
      </View>

      {plan && planDay ? (
        <View style={styles.banner}>
          <Icon name={planDayDone ? "checkCircle" : "calendar"} size={18} color={c.ox} />
          <Pressable
            style={styles.bannerBody}
            onPress={() => router.push(`/plans/${plan.id}/day/${planDay.day}`)}
            accessibilityRole="button"
            accessibilityLabel={`Back to ${plan.title}, day ${planDay.day}`}
          >
            <Text style={styles.bannerText} numberOfLines={1}>
              {planDayDone ? `Day ${planDay.day} done · ${plan.title}` : `Day ${planDay.day} · ${plan.title}`}
            </Text>
          </Pressable>
          {planDayDone ? (
            planNextDay ? (
              <Pressable
                onPress={() => router.push(`/plans/${plan.id}/day/${planNextDay.day}`)}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.bannerLink}>Next: day {planNextDay.day}</Text>
              </Pressable>
            ) : null
          ) : (
            <Pressable onPress={markPlanDayDone} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.bannerLink}>Mark done</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setPlanCtx(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss plan banner"
            hitSlop={8}
          >
            <Icon name="close" size={18} color={c.subtext} />
          </Pressable>
        </View>
      ) : null}

      {audioUrl ? (
        <View style={styles.audioBar}>
          <Icon name="headphones" size={18} color={c.ox} />
          <Pressable
            style={styles.audioTextWrap}
            accessibilityRole="button"
            accessibilityLabel="Jump to the verse being read"
            onPress={() => {
              followRef.current = true;
              if (activeVerse != null) {
                try {
                  listRef.current?.scrollToIndex({ index: activeVerse, viewPosition: 0.35, animated: true });
                } catch {
                  // list not measured yet
                }
              }
            }}
          >
            <Text style={styles.audioText} numberOfLines={1}>
              {audioStatus.isBuffering
                ? `Loading ${meta.name}…`
                : activeVerse != null
                  ? `${meta.name} ${pos.chapter}:${activeVerse + 1}`
                  : playing
                    ? `Listening to ${meta.name}`
                    : `Paused · ${meta.name}`}
            </Text>
          </Pressable>
          <Pressable onPress={toggleAudio} accessibilityRole="button" hitSlop={8}>
            <Icon name={playing ? "pause" : "play"} size={22} color={c.text} />
          </Pressable>
          <Pressable
            onPress={stopAudio}
            accessibilityRole="button"
            accessibilityLabel="Stop listening"
            hitSlop={8}
          >
            <Icon name="stop" size={22} color={c.text} />
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.gold} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          key={`${pos.book}.${pos.chapter}`}
          data={verses}
          keyExtractor={(_, i) => String(i)}
          extraData={extra}
          initialNumToRender={40}
          onScrollBeginDrag={() => {
            followRef.current = false;
          }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>{meta.name}</Text>
              <Text style={styles.numeral}>{pos.chapter}</Text>
              <View style={styles.rule} />
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {nextLabel ? (
                <Pressable
                  onPress={goNext}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.7 }]}
                >
                  <View>
                    <Text style={styles.nextCaption}>Continue reading</Text>
                    <Text style={styles.nextLabel}>{nextLabel}</Text>
                  </View>
                  <Icon name="arrow" size={22} color={c.ox} />
                </Pressable>
              ) : (
                <Text style={styles.endText}>The end of the Revelation.</Text>
              )}
            </View>
          }
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              try {
                listRef.current?.scrollToIndex({
                  index: info.index,
                  viewPosition: 0.2,
                  animated: false,
                });
              } catch {
                listRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                });
              }
            }, 150);
          }}
          renderItem={renderVerse}
        />
      )}

      <View style={styles.floatNav}>
        {hasPrev ? (
          <IconButton
            name="chevronLeft"
            label="Previous chapter"
            tone="soft"
            size={26}
            onPress={goPrev}
            style={styles.floatBtn}
          />
        ) : (
          <View />
        )}
        {hasNext ? (
          <IconButton
            name="chevronRight"
            label="Next chapter"
            tone="soft"
            size={26}
            onPress={goNext}
            style={styles.floatBtn}
          />
        ) : (
          <View />
        )}
      </View>

      <BookSheet
        open={bookOpen}
        current={pos}
        onClose={() => setBookOpen(false)}
        onPick={(book, chapter) => {
          setBookOpen(false);
          syncAudio(book, chapter);
          void load(book, chapter);
        }}
      />
      {wordSheet ? (
        <WordSheet
          code={wordSheet.code}
          word={wordSheet.word}
          onClose={() => setWordSheet(null)}
        />
      ) : null}
      {selected != null && verses[selected] != null ? (
        <VerseSheet
          verseKey={`${pos.book}.${pos.chapter}.${selected + 1}`}
          text={verses[selected]}
          onClose={() => setSelected(null)}
        />
      ) : null}
      <DisplaySheet open={displayOpen} onClose={() => setDisplayOpen(false)} />
    </View>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const readerStyles = (c: Palette, fs: number, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 16,
      paddingRight: 8,
      paddingTop: insets.top + 6,
      paddingBottom: 6,
      gap: 2,
    },
    titlePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.card,
      borderColor: c.line,
      borderWidth: 1,
      borderRadius: 999,
      paddingLeft: 16,
      paddingRight: 10,
      height: 42,
      maxWidth: "58%",
    },
    titleText: {
      color: c.text,
      fontSize: 16,
      fontWeight: "700",
      flexShrink: 1,
    },
    spacer: { flex: 1 },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 2,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.line,
    },
    bannerBody: {
      flex: 1,
    },
    bannerText: {
      color: c.text,
      fontSize: 13,
      fontWeight: "600",
    },
    bannerLink: {
      color: c.ox,
      fontSize: 13,
      fontWeight: "700",
    },
    audioBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: 16,
      marginTop: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.line,
    },
    audioTextWrap: {
      flex: 1,
    },
    audioText: {
      color: c.text,
      fontSize: 13,
      fontWeight: "600",
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      paddingHorizontal: 22,
      paddingTop: 8,
      paddingBottom: 96 + insets.bottom,
    },
    heading: {
      alignItems: "center",
      paddingTop: 18,
      paddingBottom: 22,
      gap: 2,
    },
    eyebrow: {
      color: c.subtext,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 2.4,
      textTransform: "uppercase",
    },
    numeral: {
      color: c.text,
      fontFamily: READ_FONT_SEMI,
      fontSize: 64,
      lineHeight: 72,
    },
    rule: {
      width: 36,
      height: 2,
      backgroundColor: c.gold,
      marginTop: 4,
    },
    verseRow: {
      borderRadius: 8,
      paddingVertical: Math.round(fs * 0.18),
      paddingHorizontal: 6,
      marginHorizontal: -6,
    },
    verseText: {
      color: c.text,
      fontFamily: READ_FONT,
      fontSize: fs,
      lineHeight: Math.round(fs * 1.6),
    },
    verseNum: {
      color: c.gold,
      fontFamily: READ_FONT_SEMI,
      fontSize: Math.round(fs * 0.62),
    },
    verseGap: {
      fontSize: Math.round(fs * 0.5),
    },
    // Tappable phrases read as quiet buttons: a faint gold wash with rounded
    // corners (Android can't round inline text backgrounds — it gets the same
    // wash with square corners).
    supplied: {
      fontFamily: "CrimsonPro_400Regular_Italic",
    },
    taggedWord: {
      backgroundColor: hexToRgba(c.gold, 0.11),
      borderRadius: 5,
      ...(Platform.OS === "web" ? { paddingHorizontal: 2 } : null),
    },
    mark: {
      fontFamily: ICON_FONT,
      color: c.subtext,
      fontSize: Math.round(fs * 0.8),
    },
    footer: {
      marginTop: 28,
      alignItems: "stretch",
    },
    nextBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    nextCaption: {
      color: c.subtext,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    nextLabel: {
      color: c.text,
      fontSize: 17,
      fontWeight: "700",
      marginTop: 2,
    },
    endText: {
      color: c.subtext,
      fontFamily: READ_FONT,
      fontSize: 17,
      textAlign: "center",
    },
    floatNav: {
      pointerEvents: "box-none",
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 16 + insets.bottom,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    floatBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
  });
