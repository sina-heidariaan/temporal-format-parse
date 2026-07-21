/**
 * Self-contained structural types for the Temporal values this package reads and
 * produces. We deliberately do NOT import `@js-temporal/polyfill`'s types: keeping
 * these declarations local is what lets `temporal-format-parse` ship with ZERO runtime
 * *and* zero type dependencies, so the published `.d.ts` resolves for any consumer
 * whether they run native Temporal (Node 26+) or a polyfill.
 *
 * The shapes below are intentionally a subset — only the members `format`/`parse`
 * touch. A real `Temporal.PlainDate` (native or polyfill) is structurally assignable
 * to `PlainDate` here, and vice-versa for construction via {@link TemporalProvider}.
 */

/** The eight core Temporal value types (Gregorian/ISO scope). */
export type TemporalTypeName =
  | "Instant"
  | "PlainDate"
  | "PlainTime"
  | "PlainDateTime"
  | "PlainYearMonth"
  | "PlainMonthDay"
  | "ZonedDateTime"
  | "Duration";

interface Tagged<N extends string> {
  readonly [Symbol.toStringTag]: N;
  toString(): string;
}

interface DateFields {
  readonly year: number;
  readonly month: number;
  readonly monthCode: string;
  readonly day: number;
}

interface TimeFields {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
  readonly microsecond: number;
  readonly nanosecond: number;
}

export type PlainDate = Tagged<"Temporal.PlainDate"> & DateFields;
export type PlainTime = Tagged<"Temporal.PlainTime"> & TimeFields;
export type PlainDateTime = Tagged<"Temporal.PlainDateTime"> & DateFields & TimeFields;
export type PlainYearMonth = Tagged<"Temporal.PlainYearMonth"> &
  Pick<DateFields, "year" | "month" | "monthCode">;
export type PlainMonthDay = Tagged<"Temporal.PlainMonthDay"> & Pick<DateFields, "monthCode" | "day">;
export type ZonedDateTime = Tagged<"Temporal.ZonedDateTime"> &
  DateFields &
  TimeFields & {
    readonly offset: string;
    readonly timeZoneId: string;
    readonly epochNanoseconds: bigint;
  };
export type Instant = Tagged<"Temporal.Instant"> & { readonly epochNanoseconds: bigint };
export type Duration = Tagged<"Temporal.Duration">;

/** Maps a type name to its structural value type (used to type `parse`'s return). */
export interface TemporalByName {
  Instant: Instant;
  PlainDate: PlainDate;
  PlainTime: PlainTime;
  PlainDateTime: PlainDateTime;
  PlainYearMonth: PlainYearMonth;
  PlainMonthDay: PlainMonthDay;
  ZonedDateTime: ZonedDateTime;
  Duration: Duration;
}

/**
 * Loose input shape accepted by {@link format}. Every field is optional because a
 * single signature must accept any Temporal type; the runtime dispatch on
 * `Symbol.toStringTag` (see `reflect.ts`) enforces that a real Temporal value was
 * passed and which fields are actually present.
 */
export interface TemporalLike {
  readonly [Symbol.toStringTag]?: string;
  readonly year?: number;
  readonly month?: number;
  readonly monthCode?: string;
  readonly day?: number;
  readonly hour?: number;
  readonly minute?: number;
  readonly second?: number;
  readonly millisecond?: number;
  readonly microsecond?: number;
  readonly nanosecond?: number;
  readonly offset?: string;
  readonly timeZoneId?: string;
}

/** A single Temporal constructor as `parse` uses it — just its static `.from`. */
export interface TemporalConstructorLike {
  // Deliberately permissive so ANY real Temporal implementation (native or any
  // polyfill) is assignable without friction; `parse` casts the result to the precise
  // type named by its `target` argument.
  from(item: any, options?: any): any;
}

/**
 * The construction surface `parse` needs: an object exposing each Temporal type's
 * constructor with its static `.from`. Both `globalThis.Temporal` (native) and
 * `@js-temporal/polyfill`'s `Temporal` namespace satisfy this structurally.
 */
export type TemporalProvider = Record<TemporalTypeName, TemporalConstructorLike>;

/** Options for {@link parse}. */
export interface ParseOptions {
  /**
   * The Temporal implementation used to construct the result. Defaults to
   * `globalThis.Temporal` (native, Node 26+). On older runtimes pass one explicitly,
   * e.g. `{ temporal: Temporal }` from `@js-temporal/polyfill`.
   */
  temporal?: TemporalProvider;
}
