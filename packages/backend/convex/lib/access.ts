import { ConvexError } from "convex/values";

/**
 * This backend exists only to serve the Bible app (API.Bible terms forbid
 * running a general-purpose mirror). When APP_CLIENT_KEY is set in the
 * deployment's env, every public function requires the matching `clientKey`
 * argument, which the app reads from EXPO_PUBLIC_CLIENT_KEY. Leave it unset
 * for local development.
 */
export function assertClient(clientKey: string | undefined): void {
  const expected = process.env.APP_CLIENT_KEY;
  if (expected && clientKey !== expected) {
    throw new ConvexError({
      code: "forbidden",
      message: "This backend only serves the Bible app.",
    });
  }
}
