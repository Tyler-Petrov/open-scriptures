import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTheme, type Palette } from "@/lib/theme";
import {
  completedDays,
  firstIncompleteDay,
  getPlan,
  resetPlanProgress,
  usePlanProgress,
  type Plan,
  type PlanDay,
} from "@/lib/plans";
import { ON_ACCENT } from "@/app/(tabs)/plans";
import { Icon, PrimaryButton, ProgressBar, READ_FONT_SEMI, SectionLabel } from "@/components/ui";

function totalChapters(plan: Plan): number {
  return plan.days.reduce(
    (sum, d) => sum + d.passages.reduce((s, p) => s + (p.to ?? p.from) - p.from + 1, 0),
    0
  );
}

export default function PlanDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const plan = getPlan(String(Array.isArray(params.id) ? params.id[0] : params.id ?? ""));
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = usePlanProgress();
  const [confirmReset, setConfirmReset] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setConfirmReset(false);
    }, [])
  );

  const styles = detailStyles(c);

  if (!plan) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: "Plan" }} />
        <View style={styles.missingBody}>
          <Text style={styles.missingTitle}>This plan isn’t available.</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.missingLink}>Back to Plans</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const on = ON_ACCENT[plan.accent] ?? "#FFFFFF";
  const done = completedDays(progress, plan.id);
  const doneSet = new Set(done);
  const started = done.length > 0;
  const finished = done.length >= plan.days.length;
  const nextDay = firstIncompleteDay(plan, progress);
  const chapters = totalChapters(plan);

  const onReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    await resetPlanProgress(plan.id);
    setConfirmReset(false);
  };

  const openDay = (day: number) => router.push(`/plans/${plan.id}/day/${day}`);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: plan.title }} />
      <FlatList
        data={plan.days}
        keyExtractor={(d) => String(d.day)}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={[styles.cover, { backgroundColor: plan.accent }]}>
              <View style={[styles.coverRing, { borderColor: `${on}40` }]} />
              <Text style={[styles.coverMark, { color: on }]}>
                {plan.title.charAt(0)}
              </Text>
              <View style={styles.coverText}>
                <Text style={[styles.coverTitle, { color: on }]} numberOfLines={2}>
                  {plan.title}
                </Text>
                <Text style={[styles.coverSub, { color: on }]} numberOfLines={2}>
                  {plan.subtitle}
                </Text>
              </View>
            </View>

            <Text style={styles.description}>{plan.description}</Text>
            <Text style={styles.meta}>
              {plan.days.length} days · {chapters.toLocaleString("en-US")} chapters
              {plan.days.some((d) => d.devotional) ? " · short devotional each day" : ""}
            </Text>

            {started ? (
              <View style={styles.progressBlock}>
                <ProgressBar ratio={done.length / plan.days.length} height={5} />
                <Text style={styles.progressCaption}>
                  {done.length} of {plan.days.length} days complete
                </Text>
              </View>
            ) : null}

            <PrimaryButton
              label={
                finished
                  ? "Read again from day 1"
                  : started
                    ? `Continue — day ${nextDay}`
                    : "Start plan"
              }
              onPress={() => openDay(finished ? 1 : (nextDay ?? 1))}
              style={styles.startButton}
            />

            <SectionLabel style={styles.daysLabel}>Days</SectionLabel>
          </View>
        }
        renderItem={({ item }) => (
          <DayRow
            day={item}
            done={doneSet.has(item.day)}
            accent={plan.accent}
            onPress={() => openDay(item.day)}
            styles={styles}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          started ? (
            <Pressable
              onPress={() => void onReset()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.reset, pressed && { opacity: 0.7 }]}
            >
              <Icon name="restart" size={16} color={confirmReset ? c.ox : c.subtext} />
              <Text style={[styles.resetText, confirmReset && { color: c.ox }]}>
                {confirmReset ? "Tap again to erase progress" : "Reset progress"}
              </Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

function DayRow({
  day,
  done,
  accent,
  onPress,
  styles,
}: {
  day: PlanDay;
  done: boolean;
  accent: string;
  onPress: () => void;
  styles: ReturnType<typeof detailStyles>;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.dayRow, pressed && { backgroundColor: c.card }]}
    >
      <View
        style={[
          styles.dayDot,
          done
            ? { backgroundColor: accent, borderWidth: 0 }
            : { borderColor: c.line },
        ]}
      >
        {done ? (
          <Icon name="check" size={16} color={ON_ACCENT[accent] ?? "#FFFFFF"} />
        ) : (
          <Text style={styles.dayDotText}>{day.day}</Text>
        )}
      </View>
      <View style={styles.dayBody}>
        <Text style={styles.dayTitle}>Day {day.day}</Text>
        <Text style={styles.daySub} numberOfLines={1}>
          {day.label}
        </Text>
      </View>
      <Icon name="chevronRight" size={20} color={c.subtext} />
    </Pressable>
  );
}

const detailStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    headerBlock: {
      paddingHorizontal: 20,
    },
    cover: {
      height: 148,
      borderRadius: 20,
      padding: 18,
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 14,
      marginTop: 4,
    },
    coverRing: {
      pointerEvents: "none",
      position: "absolute",
      right: -40,
      top: -40,
      width: 150,
      height: 150,
      borderRadius: 75,
      borderWidth: 1.5,
    },
    coverMark: {
      fontFamily: READ_FONT_SEMI,
      fontSize: 64,
      lineHeight: 68,
    },
    coverText: {
      flex: 1,
      paddingBottom: 4,
    },
    coverTitle: {
      fontSize: 19,
      fontWeight: "700",
      lineHeight: 24,
    },
    coverSub: {
      opacity: 0.8,
      fontSize: 12,
      marginTop: 3,
    },
    description: {
      color: c.text,
      fontSize: 14.5,
      lineHeight: 21,
      marginTop: 16,
    },
    meta: {
      color: c.subtext,
      fontSize: 12,
      marginTop: 8,
    },
    progressBlock: {
      marginTop: 14,
      gap: 6,
    },
    progressCaption: {
      color: c.subtext,
      fontSize: 11.5,
    },
    startButton: {
      marginTop: 16,
    },
    daysLabel: {
      marginTop: 24,
      marginBottom: 6,
    },
    dayRow: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    dayDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
    },
    dayDotText: {
      color: c.subtext,
      fontSize: 12.5,
      fontWeight: "500",
    },
    dayBody: {
      flex: 1,
    },
    dayTitle: {
      color: c.text,
      fontSize: 14.5,
      fontWeight: "600",
    },
    daySub: {
      color: c.subtext,
      fontSize: 12.5,
      marginTop: 2,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.line,
      marginLeft: 62,
    },
    reset: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 18,
    },
    resetText: {
      color: c.subtext,
      fontSize: 13,
      fontWeight: "600",
    },
    missing: {
      flex: 1,
      backgroundColor: c.bg,
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
