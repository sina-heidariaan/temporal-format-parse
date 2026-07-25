import type { TemporalTypeName } from "./types.js";
import { InvalidPatternError } from "./errors.js";

/**
 * The token engine shared by `format` and `parse`: a pattern tokenizer, the token
 * vocabulary, and the per-type validity table. Kept deliberately small — a curated
 * common subset of Unicode TR35, numeric only. No locale-dependent tokens (month
 * names, weekday names, era) by design; those need CLDR data and can't round-trip.
 * The one textual token, `a`, is fixed English `AM`/`PM` — arithmetic plus two
 * constants, not locale data.
 */

/** The abstract field a token maps to. */
export type FieldKind =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "hour12"
  | "dayPeriod"
  | "minute"
  | "second"
  | "fraction"
  | "offset"
  | "zone";

/** A single resolved token: which field, how wide, and any special reading. */
export interface Token {
  /** The pattern letter, e.g. `"y"`, `"M"`, `"S"`. */
  readonly letter: string;
  /** How many times it was repeated, e.g. `4` for `yyyy`. */
  readonly count: number;
  readonly field: FieldKind;
  /** Minimum digit width for numeric fields (padding on format, fixed width on parse). */
  readonly width: number;
  /** True only for `yy` (drives the two-digit-year pivot). */
  readonly twoDigitYear: boolean;
}

/** A literal run of characters emitted verbatim (spaces, separators, quoted text). */
export interface Literal {
  readonly kind: "literal";
  readonly text: string;
}

export interface TokenSegment {
  readonly kind: "token";
  readonly tok: Token;
}

export type Segment = Literal | TokenSegment;

/** Letters that begin a token. Any other unquoted ASCII letter is an error. */
const TOKEN_LETTERS = new Set(["y", "M", "d", "H", "h", "a", "m", "s", "S", "Z", "X", "V"]);

const isLetter = (ch: string): boolean => (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");

/** Human-readable token text for error messages, e.g. `yyyy`. */
const show = (letter: string, count: number): string => letter.repeat(count);

/**
 * Resolve a `(letter, count)` run into a {@link Token}, or throw
 * {@link InvalidPatternError} for an unsupported form (e.g. textual month `MMM`).
 */
function resolveToken(letter: string, count: number): Token {
  const base = { letter, count, twoDigitYear: false } as const;
  switch (letter) {
    case "y":
      // yy → two-digit (pivoted). Any other width → full year, zero-padded to width.
      return count === 2
        ? { ...base, field: "year", width: 2, twoDigitYear: true }
        : { ...base, field: "year", width: count };
    case "M":
      if (count > 2) throw new InvalidPatternError(`Month names are not supported ("${show(letter, count)}"); use M or MM.`);
      return { ...base, field: "month", width: count };
    case "d":
      if (count > 2) throw new InvalidPatternError(`Unsupported day token "${show(letter, count)}"; use d or dd.`);
      return { ...base, field: "day", width: count };
    case "H":
      if (count > 2) throw new InvalidPatternError(`Unsupported hour token "${show(letter, count)}"; use H or HH (24-hour).`);
      return { ...base, field: "hour", width: count };
    case "h":
      if (count > 2) throw new InvalidPatternError(`Unsupported hour token "${show(letter, count)}"; use h or hh (12-hour).`);
      return { ...base, field: "hour12", width: count };
    case "a":
      if (count !== 1) throw new InvalidPatternError(`Use a for the AM/PM marker ("${show(letter, count)}" is not a token).`);
      return { ...base, field: "dayPeriod", width: 0 };
    case "m":
      if (count > 2) throw new InvalidPatternError(`Unsupported minute token "${show(letter, count)}"; use m or mm.`);
      return { ...base, field: "minute", width: count };
    case "s":
      if (count > 2) throw new InvalidPatternError(`Unsupported second token "${show(letter, count)}"; use s or ss.`);
      return { ...base, field: "second", width: count };
    case "S":
      if (count > 9) throw new InvalidPatternError(`Fractional-second token too long ("${show(letter, count)}"); max is 9 (nanoseconds).`);
      return { ...base, field: "fraction", width: count };
    case "Z":
      if (count !== 2) throw new InvalidPatternError(`Use ZZ for the UTC offset ("${show(letter, count)}" is not a token).`);
      // width 0 marks the ZZ form: always ±HH:MM, never the literal "Z".
      return { ...base, field: "offset", width: 0 };
    case "X":
      // X → ±HH (or ±HHMM when minutes are non-zero); XX → ±HHMM; XXX → ±HH:MM.
      // All three render UTC as the literal "Z" and accept it on parse.
      if (count > 3) throw new InvalidPatternError(`Unsupported offset token "${show(letter, count)}"; use X, XX or XXX.`);
      return { ...base, field: "offset", width: count };
    case "V":
      if (count !== 2) throw new InvalidPatternError(`Use VV for the IANA time-zone id ("${show(letter, count)}" is not a token).`);
      return { ...base, field: "zone", width: 0 };
    default:
      throw new InvalidPatternError(`Unsupported pattern letter "${letter}". Quote it as '${letter}' to use it literally.`);
  }
}

/**
 * Tokenize a pattern into literal and token segments (TR35 rules):
 *  - a run of the same token letter is one token (`yyyy` → year×4);
 *  - text in single quotes is a literal (`'T'`), and `''` is a literal apostrophe;
 *  - any other character is a literal.
 * Unsupported unquoted letters throw {@link InvalidPatternError} (fail loudly).
 */
export function tokenize(pattern: string): Segment[] {
  const segments: Segment[] = [];
  let literal = "";
  const flushLiteral = () => {
    if (literal) {
      segments.push({ kind: "literal", text: literal });
      literal = "";
    }
  };

  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i]!;

    if (ch === "'") {
      // Quoted literal. '' anywhere means a literal apostrophe.
      if (pattern[i + 1] === "'") {
        literal += "'";
        i += 2;
        continue;
      }
      const end = pattern.indexOf("'", i + 1);
      if (end === -1) throw new InvalidPatternError(`Unterminated quoted literal in pattern: ${pattern}`);
      literal += pattern.slice(i + 1, end);
      i = end + 1;
      continue;
    }

    if (isLetter(ch)) {
      if (!TOKEN_LETTERS.has(ch)) {
        throw new InvalidPatternError(`Unsupported pattern letter "${ch}". Quote it as '${ch}' to use it literally.`);
      }
      let count = 1;
      while (pattern[i + count] === ch) count++;
      flushLiteral();
      segments.push({ kind: "token", tok: resolveToken(ch, count) });
      i += count;
      continue;
    }

    literal += ch;
    i++;
  }

  flushLiteral();
  checkCoherent(segments);
  return segments;
}

/**
 * Reject patterns whose tokens contradict each other. The 24-hour token (`H`) and the
 * 12-hour pair (`h`/`a`) describe the same field two different ways; a pattern using
 * both is a mistake rather than something to resolve silently.
 */
function checkCoherent(segments: readonly Segment[]): void {
  let has24 = false;
  let has12 = false;
  for (const seg of segments) {
    if (seg.kind !== "token") continue;
    if (seg.tok.field === "hour") has24 = true;
    if (seg.tok.field === "hour12" || seg.tok.field === "dayPeriod") has12 = true;
  }
  if (has24 && has12) {
    throw new InvalidPatternError(
      'A pattern cannot mix the 24-hour token "H" with the 12-hour tokens "h"/"a"; pick one clock.',
    );
  }
}

/** Which fields each Temporal type can supply / accept. Empty ⇒ unsupported by tokens. */
export const ALLOWED_FIELDS: Record<TemporalTypeName, ReadonlySet<FieldKind>> = {
  PlainDate: new Set<FieldKind>(["year", "month", "day"]),
  PlainTime: new Set<FieldKind>(["hour", "hour12", "dayPeriod", "minute", "second", "fraction"]),
  PlainDateTime: new Set<FieldKind>([
    "year",
    "month",
    "day",
    "hour",
    "hour12",
    "dayPeriod",
    "minute",
    "second",
    "fraction",
  ]),
  PlainYearMonth: new Set<FieldKind>(["year", "month"]),
  PlainMonthDay: new Set<FieldKind>(["month", "day"]),
  ZonedDateTime: new Set<FieldKind>([
    "year",
    "month",
    "day",
    "hour",
    "hour12",
    "dayPeriod",
    "minute",
    "second",
    "fraction",
    "offset",
    "zone",
  ]),
  Instant: new Set<FieldKind>(),
  Duration: new Set<FieldKind>(),
};

/**
 * Types that carry no wall-clock/calendar fields, so token format/parse doesn't
 * apply. `Instant` needs a time zone to have a date; `Duration` is an amount, not a
 * point in time. Both are rejected with guidance rather than silently mishandled.
 */
export const UNSUPPORTED_TYPES: ReadonlySet<TemporalTypeName> = new Set(["Instant", "Duration"]);
