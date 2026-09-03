import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { READ_FONT, READ_FONT_SEMI } from "@/components/ui";

const ITALIC_FONT = "CrimsonPro_400Regular_Italic";
const OUTLINE = /^(?:[A-Z]|[a-z]|[ivxl]+)\.\s/;

/** Inline renderer: **bold**, *italic*, and “quotations” in the accent color. */
function Inline({ text, base, quote }: { text: string; base: object; quote: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|“[^”]*”)/g).filter(Boolean);
  return (
    <Text style={base}>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <Text key={i} style={{ fontFamily: READ_FONT_SEMI }}>
              {p.slice(2, -2)}
            </Text>
          );
        }
        if (p.startsWith("“") && p.endsWith("”")) {
          return (
            <Text key={i} style={{ color: quote, fontFamily: ITALIC_FONT }}>
              {p}
            </Text>
          );
        }
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
          return (
            <Text key={i} style={{ fontFamily: ITALIC_FONT }}>
              {p.slice(1, -1)}
            </Text>
          );
        }
        return <Text key={i}>{p}</Text>;
      })}
    </Text>
  );
}

/** Guzik outline renderer: title, A. group headers, a./b. points, i./ii.
 * sub-points — each outline item its own spaced block with indent. */
export default function CommentaryText({ text }: { text: string }) {
  const { c } = useTheme();
  const items: string[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (items.length === 0 || OUTLINE.test(line)) items.push(line);
    else items[items.length - 1] += " " + line;
  }
  return (
    <View style={styles.wrap}>
      {items.map((p, idx) => {
        const group = /^[A-Z]\.\s/.test(p);
        const sub = /^[ivxl]+\.\s/.test(p);
        const point = !sub && /^[a-z]\.\s/.test(p);
        const isTitle = idx === 0 && !group && !point && !sub;
        const base = {
          color: sub ? c.subtext : c.text,
          fontFamily: isTitle || group ? READ_FONT_SEMI : READ_FONT,
          fontSize: sub ? 14 : 15,
          lineHeight: sub ? 20 : 22,
        };
        return (
          <View key={idx} style={[point && styles.indent1, sub && styles.indent2]}>
            <Inline text={p} base={base} quote={c.ox} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  indent1: {
    paddingLeft: 12,
  },
  indent2: {
    paddingLeft: 26,
  },
});
