import type { ParseOptions, TemporalByName, TemporalTypeName } from "./types.js";
import { ParseError } from "./errors.js";
import { resolveTemporal } from "./temporal.js";
import { ALLOWED_FIELDS, tokenize, UNSUPPORTED_TYPES, type FieldKind, type Token } from "./tokens.js";

/**
 * Parse a string into a Temporal value using a numeric token pattern — the mirror of
 * {@link format}. Fixed numeric patterns only (`yyyy-MM-dd`, `MM/dd/yyyy`,
 * `dd.MM.yyyy HH:mm`, …), plus the fixed `AM`/`PM` marker (`h:mm a`); there is **no**
 * locale-aware parsing (month names, weekday names, era).
 *
 * The result is built with a real Temporal implementation, resolved from
 * `options.temporal` or the host's native `globalThis.Temporal` (see {@link ParseOptions}).
 * No JS `Date` is involved at any point.
 *
 * @example
 * parse("07/13/2026", "MM/dd/yyyy", "PlainDate");
 * parse("13.07.2026 09:30", "dd.MM.yyyy HH:mm", "PlainDateTime", { temporal: Temporal });
 * parse("1:05 PM", "h:mm a", "PlainTime");
 *
 * ### Two-digit year (`yy`) pivot
 * `00`–`68` → `2000`–`2068`; `69`–`99` → `1969`–`1999` (the ECMAScript legacy rule).
 * Use `yyyy` when you need unambiguous years.
 *
 * @throws {ParseError} if the input doesn't match, required fields are missing, or no
 *   Temporal implementation is available.
 * @throws {InvalidPatternError} if the pattern is malformed.
 */
export function parse<K extends TemporalTypeName>(
  input: string,
  pattern: string,
  target: K,
  options?: ParseOptions,
): TemporalByName[K] {
  if (UNSUPPORTED_TYPES.has(target)) {
    throw new ParseError(
      `parse cannot target Temporal.${target}. ` +
        (target === "Instant"
          ? "Parse a ZonedDateTime (with VV) and call .toInstant(), or include an offset."
          : "A Duration is an amount, not a point in time."),
    );
  }

  const allowed = ALLOWED_FIELDS[target];
  const order: Token[] = [];
  let source = "^";
  for (const seg of tokenize(pattern)) {
    if (seg.kind === "literal") {
      source += escapeRegExp(seg.text);
      continue;
    }
    const tok = seg.tok;
    if (!allowed.has(tok.field)) {
      throw new ParseError(`Token "${tok.letter.repeat(tok.count)}" cannot be parsed into a Temporal.${target}.`);
    }
    order.push(tok);
    source += `(${groupPattern(tok)})`;
  }
  source += "$";

  const match = new RegExp(source).exec(input);
  if (!match) {
    throw new ParseError(`Input "${input}" does not match pattern "${pattern}".`);
  }

  const fields = extractFields(order, match);
  resolveHour12(fields);
  const bag = buildBag(target, fields);
  const Temporal = resolveTemporal(options);
  try {
    // overflow:"reject" makes out-of-range fields (month 13, day 30 in Feb, hour 25)
    // throw instead of being silently clamped — parsing should fail loudly.
    return Temporal[target].from(bag, { overflow: "reject" }) as TemporalByName[K];
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ParseError(`Parsed fields are not a valid Temporal.${target}: ${reason}`);
  }
}

/** Collected raw fields before construction. */
interface Fields {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  hour12?: number;
  /** True for PM, false for AM; only set when the pattern has an `a` token. */
  dayPeriodPm?: boolean;
  minute?: number;
  second?: number;
  millisecond?: number;
  microsecond?: number;
  nanosecond?: number;
  offset?: string;
  zone?: string;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The regex body (without the capturing parens) for a token's captured group. */
function groupPattern(tok: Token): string {
  switch (tok.field) {
    case "year":
      if (tok.twoDigitYear) return "\\d{2}";
      return tok.count === 1 ? "-?\\d{1,6}" : `\\d{${tok.width}}`;
    case "fraction":
      return `\\d{${tok.width}}`;
    case "dayPeriod":
      return "[AaPp][Mm]";
    case "offset":
      // ZZ (width 0) is strictly ±HH:MM. The X forms also accept "Z" for UTC.
      switch (tok.width) {
        case 1:
          return "Z|[+-]\\d{2}(?:\\d{2})?";
        case 2:
          return "Z|[+-]\\d{4}";
        case 3:
          return "Z|[+-]\\d{2}:\\d{2}";
        default:
          return "[+-]\\d{2}:\\d{2}";
      }
    case "zone":
      return "[A-Za-z_][A-Za-z0-9_+-]*(?:\\/[A-Za-z0-9_+-]+)*";
    default:
      // month / day / hour / hour12 / minute / second: fixed width when padded (MM),
      // else 1–2.
      return tok.width >= 2 ? "\\d{2}" : "\\d{1,2}";
  }
}

function extractFields(order: Token[], match: RegExpExecArray): Fields {
  const fields: Fields = {};
  for (let i = 0; i < order.length; i++) {
    const tok = order[i]!;
    const raw = match[i + 1]!;
    assignField(fields, tok, raw);
  }
  return fields;
}

function assignField(fields: Fields, tok: Token, raw: string): void {
  switch (tok.field) {
    case "year":
      fields.year = tok.twoDigitYear ? pivotTwoDigitYear(Number.parseInt(raw, 10)) : Number.parseInt(raw, 10);
      return;
    case "month":
      fields.month = Number.parseInt(raw, 10);
      return;
    case "day":
      fields.day = Number.parseInt(raw, 10);
      return;
    case "hour":
      fields.hour = Number.parseInt(raw, 10);
      return;
    case "hour12":
      fields.hour12 = Number.parseInt(raw, 10);
      return;
    case "dayPeriod":
      fields.dayPeriodPm = raw[0] === "p" || raw[0] === "P";
      return;
    case "minute":
      fields.minute = Number.parseInt(raw, 10);
      return;
    case "second":
      fields.second = Number.parseInt(raw, 10);
      return;
    case "fraction": {
      const nanoOfSecond = Number.parseInt(raw.padEnd(9, "0"), 10);
      fields.millisecond = Math.floor(nanoOfSecond / 1_000_000);
      fields.microsecond = Math.floor(nanoOfSecond / 1_000) % 1_000;
      fields.nanosecond = nanoOfSecond % 1_000;
      return;
    }
    case "offset":
      fields.offset = normalizeOffset(raw);
      return;
    case "zone":
      fields.zone = raw;
      return;
  }
}

/**
 * Reduce every accepted offset spelling (`Z`, `±HH`, `±HHMM`, `±HH:MM`) to the single
 * canonical `±HH:MM` that Temporal's `.from()` bag expects.
 */
function normalizeOffset(raw: string): string {
  if (raw === "Z") return "+00:00";
  if (raw.includes(":")) return raw;
  const sign = raw[0]!;
  const digits = raw.slice(1);
  const hh = digits.slice(0, 2);
  const mm = digits.length > 2 ? digits.slice(2, 4) : "00";
  return `${sign}${hh}:${mm}`;
}

/**
 * Fold a 12-hour reading (`h` + `a`) into the 24-hour `hour` field. Neither token is
 * meaningful alone: `h` without `a` is ambiguous (is `07` morning or evening?) and `a`
 * without `h` carries no hour at all, so both cases fail rather than guess.
 */
function resolveHour12(fields: Fields): void {
  if (fields.hour12 === undefined) {
    if (fields.dayPeriodPm !== undefined) {
      throw new ParseError('Pattern has an AM/PM token "a" but no 12-hour token "h" to apply it to.');
    }
    return;
  }
  if (fields.dayPeriodPm === undefined) {
    throw new ParseError('Pattern has a 12-hour token "h" but no AM/PM token "a", so the hour is ambiguous.');
  }
  const h12 = fields.hour12;
  if (h12 < 1 || h12 > 12) {
    throw new ParseError(`Hour "${h12}" is out of range for a 12-hour clock (1–12).`);
  }
  // 12 AM is hour 0 and 12 PM is hour 12.
  fields.hour = (h12 % 12) + (fields.dayPeriodPm ? 12 : 0);
}

/** `00`–`68` → 2000s, `69`–`99` → 1900s (ECMAScript legacy pivot). */
function pivotTwoDigitYear(yy: number): number {
  return yy <= 68 ? 2000 + yy : 1900 + yy;
}

const REQUIRED: Record<TemporalTypeName, readonly FieldKind[]> = {
  PlainDate: ["year", "month", "day"],
  PlainTime: ["hour"],
  PlainDateTime: ["year", "month", "day"],
  PlainYearMonth: ["year", "month"],
  PlainMonthDay: ["month", "day"],
  ZonedDateTime: ["year", "month", "day", "zone"],
  Instant: [],
  Duration: [],
};

/** Build the `.from()` argument bag, verifying the target's required fields are present. */
function buildBag(target: TemporalTypeName, fields: Fields): Record<string, unknown> {
  for (const field of REQUIRED[target]) {
    const present = field === "zone" ? fields.zone !== undefined : fields[field as keyof Fields] !== undefined;
    if (!present) {
      throw new ParseError(`Pattern is missing a ${field} token required to parse a Temporal.${target}.`);
    }
  }

  const bag: Record<string, unknown> = {};
  const setNum = (key: keyof Fields) => {
    if (fields[key] !== undefined) bag[key] = fields[key];
  };

  if (target === "PlainYearMonth") {
    setNum("year");
    setNum("month");
    return bag;
  }
  if (target === "PlainMonthDay") {
    setNum("month");
    setNum("day");
    return bag;
  }

  // Date-bearing targets.
  if (target === "PlainDate" || target === "PlainDateTime" || target === "ZonedDateTime") {
    setNum("year");
    setNum("month");
    setNum("day");
  }
  // Time-bearing targets.
  if (target === "PlainTime" || target === "PlainDateTime" || target === "ZonedDateTime") {
    setNum("hour");
    setNum("minute");
    setNum("second");
    setNum("millisecond");
    setNum("microsecond");
    setNum("nanosecond");
  }
  if (target === "ZonedDateTime") {
    bag.timeZone = fields.zone;
    if (fields.offset !== undefined) bag.offset = fields.offset;
  }
  return bag;
}
