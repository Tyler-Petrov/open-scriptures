import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TRANSLATIONS } from "@openscripture/core";
import { useTheme, GOLD_SOFT, type Palette } from "@/lib/theme";
import { useSettings } from "@/lib/settings";
import { errorMessage, lookupVerses, searchScripture, type SearchHit } from "@/lib/scripture";
import { semanticAvailable, semanticSearch, type SemanticHit } from "@/lib/semantic";
import { goToVerse } from "@/lib/annotations";
import { Chip, Icon, READ_FONT, READ_FONT_SEMI } from "@/components/ui";

const LIMIT = 200;
const SUGGESTIONS = ["faith", "shepherd", "be not afraid", "love one another", "rejoice"];

function Snippet({
  text,
  terms,
  styles,
}: {
  text: string;
  terms: string[];
  styles: ReturnType<typeof searchStyles>;
}) {
  const parts = useMemo(() => {
    if (terms.length === 0) return [{ t: text, hit: false }];
    const lower = text.toLowerCase();
    const ranges: [number, number][] = [];
    for (const term of terms) {
      let from = 0;
      for (;;) {
        const at = lower.indexOf(term, from);
        if (at < 0) break;
        ranges.push([at, at + term.length]);
        from = at + Math.max(1, term.length);
      }
    }
    if (ranges.length === 0) return [{ t: text, hit: false }];
    ranges.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [ranges[0]];
    for (const r of ranges.slice(1)) {
      const last = merged[merged.length - 1];
      if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push(r);
    }
    const out: { t: string; hit: boolean }[] = [];
    let cursor = 0;
    for (const [s, e] of merged) {
      if (cursor < s) out.push({ t: text.slice(cursor, s), hit: false });
      out.push({ t: text.slice(s, e), hit: true });
      cursor = e;
    }
    if (cursor < text.length) out.push({ t: text.slice(cursor), hit: false });
    return out;
  }, [text, terms]);

  return (
    <Text style={styles.snippet}>
      {parts.map((p, i) =>
        p.hit ? (
          <Text key={i} style={styles.snippetHit}>
            {p.t}
          </Text>
        ) : (
          <Text key={i}>{p.t}</Text>
        )
      )}
    </Text>
  );
}

export default function SearchScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const translation = settings.translation;
  const tInfo = TRANSLATIONS[translation];
  // Bundled text searches as you type. Licensed translations cost an upstream
  // request per search, so they search when you press the search key.
  const liveSearch = tInfo.source === "bundled";

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [semHits, setSemHits] = useState<SemanticHit[]>([]);
  const [semLoading, setSemLoading] = useState(false);

  // What actually gets searched: the live query, or the last submitted one.
  const active = (liveSearch ? query : submitted).trim();

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on clear
      setResults([]);
      setTouched(false);
      setSearching(false);
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    let stale = false;
    const t = setTimeout(
      () => {
        searchScripture(translation, active, LIMIT)
          .then((hits) => {
            if (stale) return;
            setResults(hits);
            setSearching(false);
            setTouched(true);
          })
          .catch((err) => {
            if (stale) return;
            setResults([]);
            setError(errorMessage(err));
            setSearching(false);
            setTouched(true);
          });
      },
      liveSearch ? 250 : 0
    );
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [active, translation, liveSearch]);

  // Semantic results: found against the on-device KJV index, then shown in
  // the selected translation.
  useEffect(() => {
    if (!semanticAvailable()) return;
    if (active.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on clear
      setSemHits([]);
      setSemLoading(false);
      return;
    }
    setSemLoading(true);
    let stale = false;
    const t = setTimeout(
      () => {
        void semanticSearch(active, 8)
          .then(async (hits) => {
            if (tInfo.source === "bundled") return hits;
            const found = await lookupVerses(translation, hits.map((h) => h.verseKey));
            // Anything the provider couldn't return keeps its KJV text, labelled.
            return hits.map((h) =>
              found[h.verseKey]
                ? { ...h, text: found[h.verseKey] }
                : { ...h, ref: `${h.ref} (KJV)` }
            );
          })
          .then((hits) => {
            if (stale) return;
            setSemHits(hits);
            setSemLoading(false);
          })
          .catch(() => {
            if (!stale) setSemLoading(false);
          });
      },
      liveSearch ? 450 : 0
    );
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [active, translation, liveSearch, tInfo.source]);

  const terms = useMemo(
    () => active.toLowerCase().split(/\s+/).filter(Boolean),
    [active]
  );

  const open = useCallback((hit: SearchHit) => {
    void goToVerse(hit.verseKey);
  }, []);

  const clear = () => {
    setQuery("");
    setSubmitted("");
  };

  const styles = useMemo(() => searchStyles(c), [c]);

  const countLine =
    results.length >= LIMIT
      ? `Showing the first ${LIMIT} matches — add a word to narrow it down`
      : `${results.length} ${results.length === 1 ? "verse" : "verses"} · ${translation}`;

  const waitingForSubmit = !liveSearch && query.trim() !== "" && query.trim() !== submitted.trim();

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.inputWrap}>
          <Icon name="search" size={20} color={c.subtext} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => setSubmitted(query)}
            placeholder={`Search the ${translation}`}
            placeholderTextColor={c.subtext}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={`Search the ${tInfo.name}`}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={clear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Icon name="close" size={20} color={c.subtext} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {searching ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.gold} />
        </View>
      ) : results.length > 0 || semHits.length > 0 || semLoading ? (
        <FlatList
          data={results}
          keyExtractor={(h) => h.verseKey}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={
            <Text style={styles.count}>
              {results.length > 0 ? countLine : error ?? "No exact word matches"}
            </Text>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.hit, pressed && { opacity: 0.6 }]}
            >
              <View style={styles.hitHead}>
                <Text style={styles.ref}>{item.ref}</Text>
                <Icon name="chevronRight" size={18} color={c.subtext} />
              </View>
              <Snippet text={item.text} terms={terms} styles={styles} />
            </Pressable>
          )}
          ListFooterComponent={
            semLoading || semHits.length > 0 ? (
              <View style={styles.semSection}>
                <View style={styles.semHead}>
                  <Text style={styles.semLabel}>Similar in meaning</Text>
                  {semLoading ? <ActivityIndicator size="small" color={c.gold} /> : null}
                </View>
                {semHits
                  .filter((h) => !results.some((r) => r.verseKey === h.verseKey))
                  .map((item, i) => (
                    <Pressable
                      key={item.verseKey}
                      onPress={() => void goToVerse(item.verseKey)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.hit,
                        i > 0 && styles.semDivider,
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <View style={styles.hitHead}>
                        <Text style={styles.ref}>{item.ref}</Text>
                        <Icon name="chevronRight" size={18} color={c.subtext} />
                      </View>
                      <Text style={styles.snippet}>{item.text}</Text>
                    </Pressable>
                  ))}
              </View>
            ) : null
          }
        />
      ) : (
        <View style={styles.empty}>
          {error ? (
            <>
              <Text style={styles.emptyTitle}>Search isn’t available right now</Text>
              <Text style={styles.emptySub}>{error}</Text>
            </>
          ) : touched ? (
            <>
              <Text style={styles.emptyTitle}>No verses match “{active}”</Text>
              <Text style={styles.emptySub}>
                {translation === "KJV"
                  ? "Try fewer words, or the King James spelling (“thee”, “saith”)."
                  : "Try fewer words, or a different translation."}
              </Text>
            </>
          ) : waitingForSubmit ? (
            <>
              <Text style={styles.emptyTitle}>Press search to look in the {translation}</Text>
              <Text style={styles.emptySub}>
                {tInfo.name} searches run on the publisher’s service, one request per search.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>
                {translation === "KJV" ? "Search all 31,102 verses" : `Search the ${tInfo.name}`}
              </Text>
              <Text style={styles.emptySub}>
                {liveSearch
                  ? "Every word you type has to appear in the verse. Try one of these:"
                  : "Type your words, then press search. Try one of these:"}
              </Text>
              <View style={styles.chips}>
                {SUGGESTIONS.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    onPress={() => {
                      setQuery(s);
                      setSubmitted(s);
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const searchStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 16,
      paddingRight: 16,
      paddingBottom: 10,
      gap: 4,
    },
    inputWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 46,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.card,
      paddingHorizontal: 14,
    },
    input: {
      flex: 1,
      color: c.text,
      fontSize: 16,
      paddingVertical: 0,
    },
    list: {
      paddingHorizontal: 20,
    },
    count: {
      color: c.subtext,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.4,
      paddingTop: 6,
      paddingBottom: 10,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.line,
    },
    hit: {
      paddingVertical: 14,
      gap: 6,
    },
    hitHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    ref: {
      color: c.ox,
      fontSize: 13,
      fontWeight: "700",
    },
    snippet: {
      color: c.text,
      fontFamily: READ_FONT,
      fontSize: 18,
      lineHeight: 26,
    },
    snippetHit: {
      fontFamily: READ_FONT_SEMI,
      backgroundColor: GOLD_SOFT,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    semSection: {
      marginTop: 18,
    },
    semHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 4,
    },
    semLabel: {
      color: c.subtext,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    semDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.line,
    },
    empty: {
      flex: 1,
      paddingHorizontal: 28,
      paddingTop: 48,
      gap: 8,
    },
    emptyTitle: {
      color: c.text,
      fontFamily: READ_FONT_SEMI,
      fontSize: 24,
    },
    emptySub: {
      color: c.subtext,
      fontSize: 14,
      lineHeight: 20,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
  });
