// Strong's data lives in Convex. Only the currently viewed records enter memory.
import { useCallback, useEffect, useState } from "react";
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { api } from "@openscripture/backend/convex/_generated/api";
import type { TranslationId } from "@openscripture/core";
import { CLIENT_KEY, convex } from "./convex";
import { errorMessage } from "./scripture";

export { linkedSpans } from "@openscripture/core";
export type { WordSpan, StrongsEntry } from "@openscripture/core";

type RemoteState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** Subscribe with an error callback so a word-study failure cannot crash the reader. */
function useStrongsQuery<Q extends FunctionReference<"query">>(query: Q, args: FunctionArgs<Q>) {
  const key = JSON.stringify(args);
  const name = getFunctionName(query);
  const [result, setResult] = useState<{ key: string; state: RemoteState<FunctionReturnType<Q>> } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const watch = convex.watchQuery(makeFunctionReference<"query", FunctionArgs<Q>, FunctionReturnType<Q>>(name), JSON.parse(key));
    const update = () => {
      if (!active) return;
      try {
        const data = watch.localQueryResult();
        if (data !== undefined) setResult({ key, state: { status: "ready", data } });
      } catch (error) {
        setResult({ key, state: { status: "error", message: errorMessage(error) } });
      }
    };
    const unsubscribe = watch.onUpdate(update);
    queueMicrotask(update); // Also read a result already cached by another subscriber.
    return () => { active = false; unsubscribe(); };
  }, [name, key, attempt]);
  const retry = useCallback(() => { setResult(null); setAttempt(n => n + 1); }, []);
  const state: RemoteState<FunctionReturnType<Q>> = result?.key === key ? result.state : { status: "loading" };
  return { state, retry };
}

export function useStrongsChapter(translation: TranslationId, book: string, chapter: number) {
  return useStrongsQuery(api.strongs.chapter, { translation, book, chapter, clientKey: CLIENT_KEY });
}

export function useStrongsEntry(code: string) {
  return useStrongsQuery(api.strongs.entry, { code, clientKey: CLIENT_KEY });
}

export function useStrongsOccurrences(translation: TranslationId, code: string) {
  return useStrongsQuery(api.strongs.occurrences, { translation, code, clientKey: CLIENT_KEY });
}
