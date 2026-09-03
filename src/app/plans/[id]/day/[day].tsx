import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useTheme, type Palette } from "@/lib/theme";
import { useSettings } from "@/lib/settings";
import { getBookMeta } from "@/lib/bible";
import {
  completedDays,
  getPlan,
  markDayComplete,
  usePlanProgress,
  type PlanPassage,
} from "@/lib/plans";
import {
  GhostButton,
  Icon,
  PrimaryButton,
  READ_FONT,
  READ_FONT_SEMI,
  SectionLabel,
} from "@/components/ui";

function passageLabel(p: PlanPassage): string {
  const meta = getBookMeta(p.book);
  const to = p.to ?? p.from;
  return to === p.from ? `${meta.name} ${p.from}` : `${meta.name} ${p.from}–${to}`;
}

export default function PlanDayScreen() {
  const params = useLocalSearchParams<{ id: string; day: string }>();
  const planId = String(Array.isArray(params.id) ? params.id[0] : params.id ?? "");
  const dayParam = String(Array.isArray(params.day) ? params.day[0] : params.day ?? "1");
  const dayNum = Math.max(1, parseInt(dayParam, 10) || 1);
  const plan = getPlan(planId);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = usePlanProgress();
  const { settings } = useSettings();

  const styles = dayStyles(c);

  if (!plan) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: "Plan day" }} />
        <View style={styles.missingBody}>
          <Text style={styles.missingTitle}>This plan isn’t available.</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.missingLink}>Back to Plans</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const total = plan.days.length;
  const d = plan.days[Math.min(dayNum, total) - 1];
  const accent = plan.accent;
  const doneSet = new Set(completedDays(progress, plan.id));
  const isDone = doneSet.has(d.day);
  const next = plan.days.find((x) => x.day === d.day + 1);
  const devotionalSize = Math.min(24, Math.max(16, settings.fontSize + 1));

  const markComplete = async () => {
    await markDayComplete(plan.id, d.day);
    if (next) router.replace(`/plans/${plan.id}/day/${next.day}`);
    else router.back();
  };

  const openPassage = (p: PlanPassage) =>
    router.push(`/(tabs)/read?book=${p.book}&ch=${p.from}&plan=${plan.id}&day=${d.day}`);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: plan.title }} />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.dayTitle}>Day {d.day}</Text>
          {isDone ? (
            <View style={[styles.doneBadge, { backgroundColor: `${accent}22` }]}>
              <Icon name="check" size={14} color={accent} />
              <Text style={[styles.doneBadgeText, { color: accent }]}>Completed</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.dayLabel}>{d.label}</Text>

        {d.devotional ? (
          <View style={styles.devotional}>
            <SectionLabel>Devotional</SectionLabel>
            <Text
              style={[
                styles.devotionalText,
                { fontSize: devotionalSize, lineHeight: Math.round(devotionalSize * 1.55) },
              ]}
            >
              {d.devotional}
            </Text>
          </View>
        ) : null}

        <SectionLabel style={styles.passagesLabel}>
          {d.devotional ? "Today's reading" : "Reading"}
        </SectionLabel>
        <View style={styles.passages}>
          {d.passages.map((p, i) => {
            const count = (p.to ?? p.from) - p.from + 1;
            return (
              <Pressable
                key={`${p.book}-${p.from}-${p.to ?? p.from}-${i}`}
                onPress={() => openPassage(p)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.passage, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.passageBadge, { backgroundColor: `${accent}22` }]}>
                  <Text style={[styles.passageBadgeText, { color: accent }]}>
                    {getBookMeta(p.book).name.slice(0, 3)}
                  </Text>
                </View>
                <View style={styles.passageBody}>
                  <Text style={styles.passageTitle}>{passageLabel(p)}</Text>
                  <Text style={styles.passageSub}>
                    {count} {count === 1 ? "chapter" : "chapters"}
                  </Text>
                </View>
                <Icon name="chevronRight" size={20} color={c.subtext} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          {isDone ? (
            next ? (
              <PrimaryButton
                label={`Read next — day ${next.day}`}
                onPress={() => router.replace(`/plans/${plan.id}/day/${next.day}`)}
              />
            ) : (
              <PrimaryButton label="Back to plan" onPress={() => router.back()} />
            )
          ) : (
            <>
              <PrimaryButton label="Mark day complete" icon="check" onPress={() => void markComplete()} />
              {next ? (
                <GhostButton
                  label={`Skip to day ${next.day}`}
                  onPress={() => router.replace(`/plans/${plan.id}/day/${next.day}`)}
                />
              ) : null}
            </>
          )}
          {next ? (
            <Text style={styles.nextHint} numberOfLines={1}>
              Next — day {next.day}: {next.label}
            </Text>
          ) : (
            <Text style={styles.nextHint}>This is the last day of the plan.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const dayStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 8,
    },
    dayTitle: {
      color: c.text,
      fontFamily: READ_FONT_SEMI,
      fontSize: 34,
      lineHeight: 40,
    },
    doneBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    doneBadgeText: {
      fontSize: 12,
      fontWeight: "700",
    },
    dayLabel: {
      color: c.subtext,
      fontSize: 14,
      marginTop: 4,
    },
    devotional: {
      backgroundColor: c.card,
      borderColor: c.line,
      borderWidth: 1,
      borderRadius: 16,
      padding: 18,
      marginTop: 16,
      gap: 10,
    },
    devotionalText: {
      color: c.text,
      fontFamily: READ_FONT,
    },
    passagesLabel: {
      marginTop: 22,
      marginBottom: 10,
    },
    passages: {
      gap: 10,
    },
    passage: {
      backgroundColor: c.card,
      borderColor: c.line,
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    passageBadge: {
      minWidth: 52,
      paddingHorizontal: 10,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    passageBadgeText: {
      fontSize: 13,
      fontWeight: "700",
    },
    passageBody: {
      flex: 1,
    },
    passageTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: "600",
    },
    passageSub: {
      color: c.subtext,
      fontSize: 12,
      marginTop: 2,
    },
    actions: {
      marginTop: 24,
      gap: 10,
    },
    nextHint: {
      color: c.subtext,
      fontSize: 12,
      textAlign: "center",
      marginTop: 2,
    },
    missingBody: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
    },
    missingTitle: {
      color: c.text,
      fontSize: 17,
      fontWeight: "600",
    },
    missingLink: {
      color: c.ox,
      fontSize: 15,
      fontWeight: "600",
    },
  });
