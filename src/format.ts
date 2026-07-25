import type { TemporalLike } from "./types.js";
import { getTemporalType } from "./reflect.js";
import { FormatError } from "./errors.js";
import { ALLOWED_FIELDS, tokenize, UNSUPPORTED_TYPES, type Token } from "./tokens.js";

/**
 * Format a Temporal value with a token pattern — the mirror of {@link parse}.
 *
 * `format` is fully implementation-agnostic and dependency-free: it only *reads*
 * fields off the value you pass (never a JS `Date`, never a constructor), so it works
 * on native Temporal and any polyfill without configuration.
 *
 * @example
 * format(Temporal.PlainDate.from("2026-07-13"), "MM/dd/yyyy"); // "07/13/2026"
 * format(zdt, "yyyy-MM-dd'T'HH:mm:ssZZ'['VV']'");
 *
 * @throws {FormatError} if `value` isn't a Temporal value, is an unsupported type
 *   (Instant/Duration), or the pattern uses a token the value's type can't supply.
 * @throws {InvalidPatternError} if the pattern itself is malformed.
 */
export function format(value: TemporalLike, pattern: string): string {
  const type = getTemporalType(value);
  if (!type) {
    throw new FormatError("format(value, pattern): value is not a Temporal object.");
  }
  if (UNSUPPORTED_TYPES.has(type)) {
    throw new FormatError(
      `format does not support Temporal.${type} (it has no wall-clock/calendar fields). ` +
        (type === "Instant"
          ? "Convert it with .toZonedDateTimeISO(timeZone) first."
          : "A Duration is an amount, not a point in time."),
    );
  }

  const allowed = ALLOWED_FIELDS[type];
  let out = "";
  for (const seg of tokenize(pattern)) {
    if (seg.kind === "literal") {
      out += seg.text;
      continue;
    }
    const tok = seg.tok;
    if (!allowed.has(tok.field)) {
      throw new FormatError(`Token "${tok.letter.repeat(tok.count)}" is not valid for Temporal.${type}.`);
    }
    out += renderToken(value, type, tok);
  }
  return out;
}

/** Zero-pad the absolute value to `width`, preserving a leading sign for negatives. */
function padSigned(n: number, width: number): string {
  const s = Math.abs(n).toString().padStart(width, "0");
  return n < 0 ? `-${s}` : s;
}

/** PlainMonthDay exposes `monthCode` ("M07") but no numeric `.month`; derive it. */
function monthOf(value: TemporalLike): number {
  if (typeof value.month === "number") return value.month;
  const code = value.monthCode;
  if (typeof code === "string") {
    const n = Number.parseInt(code.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n)) return n;
  }
  throw new FormatError("value has no month to format.");
}

function requireNumber(value: number | undefined, field: string): number {
  if (typeof value !== "number") throw new FormatError(`value has no ${field} to format.`);
  return value;
}

const OFFSET_SHAPE = /^([+-])(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/;

/**
 * Render a `±HH:MM` offset in one of the `X` forms: UTC becomes the literal `Z`,
 * `X` uses `±HH` when the minutes are zero and widens to `±HHMM` otherwise, `XX` is
 * always `±HHMM`, and `XXX` is always `±HH:MM`.
 */
function renderOffsetX(offset: string, tok: Token): string {
  const m = OFFSET_SHAPE.exec(offset);
  if (!m) throw new FormatError(`Cannot format UTC offset "${offset}" — expected ±HH:MM.`);
  const sign = m[1]!;
  const hh = m[2]!;
  const mm = m[3]!;
  const ss = m[4];
  if (ss !== undefined && Number.parseFloat(ss) !== 0) {
    // Sub-minute offsets exist only in pre-1900 zone history and no X form can carry
    // them; ZZ passes the value through unchanged.
    throw new FormatError(`UTC offset "${offset}" has sub-minute precision that "${tok.letter.repeat(tok.count)}" cannot represent; use ZZ.`);
  }
  if (hh === "00" && mm === "00") return "Z";
  if (tok.width === 3) return `${sign}${hh}:${mm}`;
  if (tok.width === 2 || mm !== "00") return `${sign}${hh}${mm}`;
  return `${sign}${hh}`;
}

function renderToken(value: TemporalLike, type: string, tok: Token): string {
  switch (tok.field) {
    case "year": {
      const year = requireNumber(value.year, "year");
      if (tok.twoDigitYear) {
        return (((year % 100) + 100) % 100).toString().padStart(2, "0");
      }
      return padSigned(year, tok.width);
    }
    case "month":
      return monthOf(value).toString().padStart(tok.width, "0");
    case "day":
      return requireNumber(value.day, "day").toString().padStart(tok.width, "0");
    case "hour":
      return requireNumber(value.hour, "hour").toString().padStart(tok.width, "0");
    case "hour12": {
      const hour = requireNumber(value.hour, "hour");
      // 0 → 12 AM and 12 → 12 PM: the 12-hour clock has no zero.
      return (hour % 12 || 12).toString().padStart(tok.width, "0");
    }
    case "dayPeriod":
      return requireNumber(value.hour, "hour") < 12 ? "AM" : "PM";
    case "minute":
      return requireNumber(value.minute, "minute").toString().padStart(tok.width, "0");
    case "second":
      return requireNumber(value.second, "second").toString().padStart(tok.width, "0");
    case "fraction": {
      const ms = value.millisecond ?? 0;
      const us = value.microsecond ?? 0;
      const ns = value.nanosecond ?? 0;
      const nanoOfSecond = ms * 1_000_000 + us * 1_000 + ns;
      return nanoOfSecond.toString().padStart(9, "0").slice(0, tok.width);
    }
    case "offset": {
      if (typeof value.offset !== "string") {
        throw new FormatError(`Temporal.${type} has no UTC offset (${tok.letter.repeat(tok.count)}) to format.`);
      }
      // ZZ (width 0) emits the value's own ±HH:MM verbatim; X/XX/XXX reshape it.
      return tok.width === 0 ? value.offset : renderOffsetX(value.offset, tok);
    }
    case "zone": {
      if (typeof value.timeZoneId !== "string") {
        throw new FormatError(`Temporal.${type} has no time-zone id (VV) to format.`);
      }
      return value.timeZoneId;
    }
  }
}
