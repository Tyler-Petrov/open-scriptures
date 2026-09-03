import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTheme, type Palette } from "@/lib/theme";
import {
  PLANS,
  completedDays,
  getPlan,
  usePlanProgress,
  type Plan,
  type PlanProgress,
} from "@/lib/plans";
import {
  Icon,
  PageTitle,
  ProgressBar,
  READ_FONT,
  READ_FONT_SEMI,
  SectionLabel,
} from "@/components/ui";

// Text on top of an accent-colored cover: warm ink on the lighter accents,
// warm paper on the deeper ones.
export const ON_ACCENT: Record<string, string> = {
  "#C9A24B": "#2B2117",
  "#B45454": "#FFF7EC",
  "#5B8DB8": "#F6F1E6",
  "#7FB069": "#1E2B1C",
};

const FEATURED: { id: string; mark: string; tag: string }[] = [
  { id: "yearly-canonical", mark: "365", tag: "Genesis → Revelation" },
  { id: "yearly-blended", mark: "&", tag: "OT + NT daily" },
];

export default function PlansScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = usePlanProgress();

  const featured = FEATURED.map((f) => ({ ...f, plan: getPlan(f.id) })).filter(
    (f): f is { id: string; mark: string; tag: string; plan: Plan } => !!f.plan
  );

  const started = PLANS.filter((p) => completedDays(progress, p.id).length > 0);
  const rest = PLANS.filter((p) => completedDays(progress, p.id).length === 0);

  const styles = plansStyles(c);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <PageTitle>Plans</PageTitle>
      <Text style={styles.lede}>
        Short studies for this week, or the whole Bible in a year.
      </Text>

      {started.length > 0 ? (
        <>
          <SectionLabel style={styles.section}>In progress</SectionLabel>
          <View style={styles.rows}>
            {started.map((plan) => (
              <PlanRow key={plan.id} plan={plan} progress={progress} styles={styles} />
            ))}
          </View>
        </>
      ) : null}

      <SectionLabel style={styles.section}>Read the whole Bible</SectionLabel>
      <View style={styles.featuredRow}>
        {featured.map((f) => (
          <FeaturedCover key={f.plan.id} plan={f.plan} mark={f.mark} tag={f.tag} styles={styles} />
        ))}
      </View>

      {rest.length > 0 ? (
        <>
          <SectionLabel style={styles.section}>
            {started.length > 0 ? "More plans" : "Start a plan"}
          </SectionLabel>
          <View style={styles.rows}>
            {rest.map((plan) => (
              <PlanRow key={plan.id} plan={plan} progress={progress} styles={styles} />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function FeaturedCover({
  plan,
  mark,
  tag,
  styles,
}: {
  plan: Plan;
  mark: string;
  tag: string;
  styles: ReturnType<typeof plansStyles>;
}) {
  const on = ON_ACCENT[plan.accent] ?? "#FFFFFF";
  return (
    <Pressable
      onPress={() => router.push(`/plans/${plan.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.cover,
        { backgroundColor: plan.accent },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.coverRingLarge, { borderColor: `${on}40` }]} />
      <View style={[styles.coverRingSmall, { borderColor: `${on}2E` }]} />
      <Text style={[styles.coverTag, { color: on }]} numberOfLines={1}>
        {tag}
      </Text>
      <View style={styles.coverMarkWrap}>
        <Text
          style={[
            styles.coverMark,
            { color: on, fontSize: mark.length > 2 ? 46 : 76, lineHeight: mark.length > 2 ? 52 : 84 },
          ]}
        >
          {mark}
        </Text>
      </View>
      <Text style={[styles.coverTitle, { color: on }]} numberOfLines={2}>
        {plan.title}
      </Text>
      <Text style={[styles.coverSub, { color: on }]} numberOfLines={1}>
        {plan.days.length} days
      </Text>
    </Pressable>
  );
}

function PlanRow({
  plan,
  progress,
  styles,
}: {
  plan: Plan;
  progress: PlanProgress;
  styles: ReturnType<typeof plansStyles>;
}) {
  const { c } = useTheme();
  const on = ON_ACCENT[plan.accent] ?? "#FFFFFF";
  const done = completedDays(progress, plan.id);
  const total = plan.days.length;
  const pct = done.length / total;
  const finished = done.length >= total;

  return (
    <Pressable
      onPress={() => router.push(`/plans/${plan.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.rowBadge, { backgroundColor: plan.accent }]}>
        <Text style={[styles.rowBadgeText, { color: on }]}>{plan.title.charAt(0)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {plan.title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {plan.subtitle}
        </Text>
        {done.length > 0 ? (
          <View style={styles.rowProgress}>
            <ProgressBar ratio={pct} height={4} />
            <Text style={styles.rowCaption}>
              {finished
                ? `Finished · ${total} days`
                : `${done.length} of ${total} days · ${Math.round(pct * 100)}%`}
            </Text>
          </View>
        ) : (
          <Text style={styles.rowCaption}>
            {total} days
            {plan.days.some((d) => d.devotional) ? " · daily devotional" : ""}
          </Text>
        )}
      </View>
      <Icon name="chevronRight" size={20} color={c.subtext} />
    </Pressable>
  );
}

const plansStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    lede: {
      color: c.subtext,
      fontSize: 14,
      marginTop: 6,
    },
    section: {
      marginTop: 24,
      marginBottom: 10,
    },
    featuredRow: {
      flexDirection: "row",
      gap: 12,
    },
    cover: {
      flex: 1,
      height: 190,
      borderRadius: 20,
      padding: 16,
      overflow: "hidden",
    },
    coverRingLarge: {
      pointerEvents: "none",
      position: "absolute",
      right: -34,
      bottom: -46,
      width: 132,
      height: 132,
      borderRadius: 66,
      borderWidth: 1.5,
    },
    coverRingSmall: {
      pointerEvents: "none",
      position: "absolute",
      right: 6,
      bottom: -14,
      width: 66,
      height: 66,
      borderRadius: 33,
      borderWidth: 1.5,
    },
    coverTag: {
      opacity: 0.85,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    coverMarkWrap: {
      flex: 1,
      justifyContent: "center",
    },
    coverMark: {
      fontFamily: READ_FONT,
    },
    coverTitle: {
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 20,
    },
    coverSub: {
      opacity: 0.78,
      fontSize: 11,
      marginTop: 3,
    },
    rows: {
      gap: 10,
    },
    row: {
      backgroundColor: c.card,
      borderColor: c.line,
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    rowBadge: {
      width: 46,
      height: 46,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBadgeText: {
      fontFamily: READ_FONT_SEMI,
      fontSize: 24,
      lineHeight: 30,
    },
    rowBody: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: "600",
    },
    rowSub: {
      color: c.subtext,
      fontSize: 12,
    },
    rowProgress: {
      marginTop: 6,
      gap: 5,
    },
    rowCaption: {
      color: c.subtext,
      fontSize: 11,
      marginTop: 3,
    },
  });
