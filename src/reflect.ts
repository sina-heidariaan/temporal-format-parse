import type { TemporalTypeName } from "./types.js";

/**
 * Inlined, zero-dependency Temporal reflection. Temporal ships no clean runtime
 * discriminator, so we read the standard `Symbol.toStringTag` ("Temporal.PlainDate",
 * etc.) that every Temporal value exposes. This is impl-agnostic — it works
 * identically on native Temporal and any polyfill and, unlike `instanceof`, does not
 * break across the native/polyfill boundary.
 *
 * (This is the ~15-line reflect the base package's `temporal-gregorian/reflect`
 * exports; it is inlined here so the package carries no runtime dependency.)
 */

const TAG_PREFIX = "Temporal.";

const NAMES: ReadonlySet<string> = new Set<TemporalTypeName>([
  "Instant",
  "PlainDate",
  "PlainTime",
  "PlainDateTime",
  "PlainYearMonth",
  "PlainMonthDay",
  "ZonedDateTime",
  "Duration",
]);

/**
 * Return the Temporal type name of `value`, or `undefined` if it isn't a Temporal
 * value. Uses `Symbol.toStringTag`, so it is implementation-agnostic.
 */
export function getTemporalType(value: unknown): TemporalTypeName | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const tag = (value as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag];
  if (typeof tag !== "string" || !tag.startsWith(TAG_PREFIX)) return undefined;
  const name = tag.slice(TAG_PREFIX.length);
  return NAMES.has(name) ? (name as TemporalTypeName) : undefined;
}

/** True when `value` is any Temporal value. */
export function isTemporal(value: unknown): boolean {
  return getTemporalType(value) !== undefined;
}
