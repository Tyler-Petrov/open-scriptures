/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chapters from "../chapters.js";
import type * as commentary from "../commentary.js";
import type * as crons from "../crons.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_providers_apiBible from "../lib/providers/apiBible.js";
import type * as lib_providers_esv from "../lib/providers/esv.js";
import type * as lib_providers_types from "../lib/providers/types.js";
import type * as search from "../search.js";
import type * as timings from "../timings.js";
import type * as translations from "../translations.js";
import type * as verses from "../verses.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chapters: typeof chapters;
  commentary: typeof commentary;
  crons: typeof crons;
  "lib/access": typeof lib_access;
  "lib/availability": typeof lib_availability;
  "lib/providers/apiBible": typeof lib_providers_apiBible;
  "lib/providers/esv": typeof lib_providers_esv;
  "lib/providers/types": typeof lib_providers_types;
  search: typeof search;
  timings: typeof timings;
  translations: typeof translations;
  verses: typeof verses;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
