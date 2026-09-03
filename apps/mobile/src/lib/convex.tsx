import { ConvexReactClient } from "convex/react";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) {
  throw new Error(
    "EXPO_PUBLIC_CONVEX_URL is not set. Copy apps/mobile/.env.example to apps/mobile/.env."
  );
}

/** Single Convex client for the whole app (queries, actions, subscriptions). */
export const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });

/** Sent with every call; the backend enforces it only when APP_CLIENT_KEY is set. */
export const CLIENT_KEY: string | undefined = process.env.EXPO_PUBLIC_CLIENT_KEY || undefined;
