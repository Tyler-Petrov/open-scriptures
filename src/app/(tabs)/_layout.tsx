import { Tabs } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { Icon, type GlyphName } from "@/components/ui";

const TABS: { name: string; title: string; icon: GlyphName }[] = [
  { name: "read", title: "Read", icon: "book" },
  { name: "search", title: "Search", icon: "search" },
  { name: "more", title: "More", icon: "more" },
];

export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      initialRouteName="read"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
        tabBarActiveTintColor: c.blue,
        tabBarInactiveTintColor: c.subtext,
        tabBarButton: ({
          android_ripple: _androidRipple,
          hoverEffect: _hoverEffect,
          pressOpacity: _pressOpacity,
          ref: _ref,
          style,
          ...props
        }) => (
          <Pressable
            {...props}
            style={({ pressed }) => [style, pressed && styles.tabPressed]}
          />
        ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.line,
          borderTopWidth: 1,
          elevation: 0,
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 4,
        },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color }) => <Icon name={t.icon} size={24} color={color} />,
          }}
        />
      ))}
      <Tabs.Screen name="plans" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabPressed: {
    opacity: 0.68,
  },
});
