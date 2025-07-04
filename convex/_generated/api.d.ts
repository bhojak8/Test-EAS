/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as alerts from "../alerts.js";
import type * as analytics from "../analytics.js";
import type * as api_ from "../api.js";
import type * as auth from "../auth.js";
import type * as geofences from "../geofences.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as locations from "../locations.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as router from "../router.js";
import type * as sessions from "../sessions.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  alerts: typeof alerts;
  analytics: typeof analytics;
  api: typeof api_;
  auth: typeof auth;
  geofences: typeof geofences;
  groups: typeof groups;
  http: typeof http;
  locations: typeof locations;
  messages: typeof messages;
  notifications: typeof notifications;
  router: typeof router;
  sessions: typeof sessions;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
