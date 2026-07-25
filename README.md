# temporal-format-parse

> Token-based **format** and numeric **parse** for the TC39 **Temporal** API —
> `format(date, "MM/dd/yyyy")` ⇆ `parse("07/13/2026", "MM/dd/yyyy", "PlainDate")` —
> operating **directly on Temporal values, with no JavaScript `Date`** and **zero
> runtime dependencies**.

[![npm](https://img.shields.io/npm/v/temporal-format-parse.svg)](https://www.npmjs.com/package/temporal-format-parse)
![license](https://img.shields.io/badge/license-MIT-blue.svg)

**Status:** early release (v0.x). Works on native `Temporal` (Node 26+, modern
browsers) and on any polyfill you supply.

## Why

Temporal ships ISO/RFC-9557 round-tripping and `Intl.DateTimeFormat`, but **no token
formatter and no token parser** — that was deferred to Temporal v2. Every existing
token library (Moment, Luxon, Day.js, date-fns) works through the legacy `Date`, so a
Temporal → Date → Temporal round-trip silently drops **nanoseconds, calendar, and time
zone** — the very things Temporal exists to protect.

`temporal-format-parse` fills exactly that gap and nothing more: it reads and writes Temporal
values field-by-field, so nothing is lost.

## What this package adds — before / after

Temporal alone can round-trip ISO strings and format with `Intl`, but it **cannot take
an arbitrary token pattern**, and it **cannot parse one back**. Today you reach for a
`Date`-based library and lose precision. Here is exactly what changes.

### Formatting a Temporal value with a custom pattern

```ts
const d = Temporal.PlainDate.from("2026-07-13");

// ❌ Before — Temporal has no token formatter, so you round-trip through Date
import { format as fnsFormat } from "date-fns";
fnsFormat(new Date(d.toString()), "MM/dd/yyyy");   // "07/13/2026" — but a Date was created

// ✅ After — straight on the Temporal value, no Date created
import { format } from "temporal-format-parse";
format(d, "MM/dd/yyyy");                            // "07/13/2026"
```

### Parsing a formatted string back into Temporal

```ts
// ❌ Before — Temporal.PlainDate.from only accepts ISO 8601; this THROWS
Temporal.PlainDate.from("07/13/2026");             // RangeError: invalid ISO 8601 string

// ✅ After — parse any numeric token layout into the exact Temporal type you want
import { parse } from "temporal-format-parse";
parse("07/13/2026", "MM/dd/yyyy", "PlainDate");    // Temporal.PlainDate 2026-07-13
```

### Keeping nanoseconds and time zone (what the `Date` path silently drops)

```ts
const zdt = Temporal.ZonedDateTime.from("2026-07-13T09:30:00.123456789-04:00[America/New_York]");

// ❌ Before — Date has millisecond precision and no zone identity
new Date(zdt.epochMilliseconds).toISOString();     // "2026-07-13T13:30:00.123Z" — µs/ns gone, zone gone

// ✅ After — full nanosecond precision, offset, and IANA zone id preserved and round-trippable
const p = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSSZZ'['VV']'";
const s = format(zdt, p);                           // "2026-07-13T09:30:00.123456789-04:00[America/New_York]"
parse(s, p, "ZonedDateTime").equals(zdt);           // true
```

| Task | Before (Date-based libs) | After (`temporal-format-parse`) |
|------|--------------------------|---------------------------|
| Format with a token pattern | Round-trip through `Date` | Directly on the Temporal value |
| Parse a non-ISO layout | Not supported by Temporal; libs return a `Date` | Returns the exact Temporal type |
| Sub-millisecond precision | Lost (`Date` = ms) | Preserved to nanoseconds |
| Time-zone identity | Lost | Preserved (`VV`) |
| Runtime dependencies | Moment/Luxon/date-fns bundle | **Zero** |

## Install

```sh
npm add temporal-format-parse
```

On **Node 26+** (native Temporal) there is nothing else to do. On older runtimes,
`format` still works with zero setup, and `parse` just needs a Temporal implementation
passed in once (see [Supplying a polyfill](#supplying-a-polyfill-node--26)).

## Usage

```ts
import { format, parse } from "temporal-format-parse";
// or tree-shake one side:  import { format } from "temporal-format-parse/format";

format(Temporal.PlainDate.from("2026-07-13"), "dd.MM.yyyy");           // "13.07.2026"
format(Temporal.PlainTime.from("09:03:07.5"), "HH:mm:ss.SSS");         // "09:03:07.500"
format(Temporal.PlainTime.from("13:05"), "h:mm a");                    // "1:05 PM"

parse("13.07.2026", "dd.MM.yyyy", "PlainDate");
parse("1:05 PM", "h:mm a", "PlainTime");
parse("2026-07-13 09:30", "yyyy-MM-dd HH:mm", "PlainDateTime");
parse("2026-07-13T09:30-04:00[America/New_York]",
      "yyyy-MM-dd'T'HH:mmZZ'['VV']'", "ZonedDateTime");
```

`parse`'s third argument is the target type name (`"PlainDate"`, `"PlainTime"`,
`"PlainDateTime"`, `"PlainYearMonth"`, `"PlainMonthDay"`, `"ZonedDateTime"`); the return
type is inferred from it.

## Tokens

Unicode TR35-style, **numeric only**. A run of the same letter is one token; anything
else is a literal. Wrap letters in single quotes to keep them literal (`'T'`), and use
`''` for a literal apostrophe.

| Token | Meaning | Example |
|-------|---------|---------|
| `yyyy` | Year, zero-padded to 4 (parse: exactly 4 digits) | `2026` |
| `yy` | Two-digit year (pivoted — see below) | `26` |
| `y` | Year, minimal width (parse: 1–6 digits, optional `-`) | `2026` |
| `MM` / `M` | Month, padded / minimal | `07` / `7` |
| `dd` / `d` | Day of month, padded / minimal | `13` / `13` |
| `HH` / `H` | Hour (0–23), padded / minimal | `09` / `9` |
| `hh` / `h` | Hour (1–12), padded / minimal — pairs with `a` | `01` / `1` |
| `a` | `AM` / `PM` marker | `PM` |
| `mm` / `m` | Minute, padded / minimal | `03` |
| `ss` / `s` | Second, padded / minimal | `07` |
| `S…` | Fractional second, N digits (`SSS` = ms … `SSSSSSSSS` = ns) | `123456789` |
| `ZZ` | UTC offset, always `±HH:MM` (ZonedDateTime) | `-04:00` |
| `X` | UTC offset `±HH` (widens to `±HHMM` when minutes ≠ 0), `Z` for UTC | `-04` |
| `XX` | UTC offset `±HHMM`, `Z` for UTC | `-0400` |
| `XXX` | UTC offset `±HH:MM`, `Z` for UTC | `-04:00` |
| `VV` | IANA time-zone id (ZonedDateTime) | `America/New_York` |

**Which tokens each type accepts**

| Type | Valid fields |
|------|--------------|
| `PlainDate` | `y M d` |
| `PlainTime` | `H h a m s S` |
| `PlainDateTime` | `y M d H h a m s S` |
| `PlainYearMonth` | `y M` |
| `PlainMonthDay` | `M d` |
| `ZonedDateTime` | `y M d H h a m s S ZZ X VV` |

A token a type can't supply is rejected with a `FormatError` / `ParseError`. `Instant`
and `Duration` aren't supported (an Instant has no date without a zone; a Duration is an
amount, not a point in time) — convert an `Instant` with `.toZonedDateTimeISO(zone)`
first.

### 12-hour clock (`h` + `a`)

`h`/`hh` is the 1–12 hour and `a` is the `AM`/`PM` marker. `12:00 AM` is midnight and
`12:00 PM` is noon.

```ts
format(Temporal.PlainTime.from("13:05"), "h:mm a");   // "1:05 PM"
parse("1:05 PM", "h:mm a", "PlainTime");              // 13:05:00
```

Two rules keep this unambiguous:

- A pattern **cannot mix** `H` with `h`/`a` — they describe the same field two different
  ways, so the pattern is rejected rather than silently resolved.
- On **parse**, `h` requires `a` (is `07` morning or evening?) and `a` requires `h`.
  Formatting either one alone is fine.

`a` is fixed English `AM`/`PM` — arithmetic and two constants, not locale data — so the
zero-dependency, no-CLDR guarantee below still holds. Parsing accepts any case
(`pm`, `Pm`, `PM`).

### UTC offset forms (`ZZ` and `X`/`XX`/`XXX`)

`ZZ` is always `±HH:MM` and never emits `Z`; it is the round-trip-safe default. The `X`
family covers the other spellings you meet in real-world data and renders UTC as `Z`:

```ts
const zdt = Temporal.ZonedDateTime.from("2026-07-13T09:30-04:00[America/New_York]");
format(zdt, "X");    // "-04"
format(zdt, "XX");   // "-0400"
format(zdt, "XXX");  // "-04:00"
format(utcZdt, "X"); // "Z"
```

On parse, every form also accepts the alternatives it can render, and `Z` normalizes to
`+00:00`. `X` widens to `±HHMM` for zones with non-zero minutes (`+0530`), since `±HH`
alone would lose them. Sub-minute historical offsets (pre-1900 LMT) can't be expressed
in any `X` form and throw — use `ZZ`, which passes the value through unchanged.

### Two-digit year (`yy`) pivot

When parsing `yy`, `00`–`68` → `2000`–`2068` and `69`–`99` → `1969`–`1999` (the
ECMAScript legacy rule). Use `yyyy` whenever you need unambiguous years.

### Adjacent numeric tokens

Padded tokens have fixed widths, so patterns with no separators still parse
(`yyyyMMdd` → `20260713`). Prefer the padded forms (`MM`, `dd`, `HH`, …) when tokens sit
next to each other; minimal forms (`M`, `d`) are variable-width and only unambiguous
when a literal separates them.

## Supplying a polyfill (Node < 26)

`parse` constructs the result with a real Temporal implementation. It uses
`globalThis.Temporal` automatically when present; otherwise pass one explicitly (once):

```ts
import { Temporal } from "@js-temporal/polyfill";
import { parse } from "temporal-format-parse";

parse("2026-07-13", "yyyy-MM-dd", "PlainDate", { temporal: Temporal });
```

`format` never needs this — it only reads fields off the value you already hold.

## Scope (what this is not)

- **No locale-aware textual parsing** — no month names, weekday names, or era names.
  Those need CLDR data and can't reliably round-trip; they were the part TC39 declined
  to standardize, and are deliberately out of scope here. (The `a` marker is the one
  textual token, and it is fixed English `AM`/`PM`, not locale data.)
- **No full CLDR/LDML engine** — a curated common token subset only.
- **No `Date`** anywhere in the code path.

## API

```ts
function format(value: TemporalLike, pattern: string): string;

function parse<K extends TemporalTypeName>(
  input: string,
  pattern: string,
  target: K,
  options?: { temporal?: TemporalProvider },
): TemporalByName[K];
```

Errors: `FormatError`, `ParseError`, `InvalidPatternError` (all extend `RangeError`).
Also exported: `getTemporalType`, `isTemporal`, and the Temporal value types.

## Versioning & releases

Semantic Versioning. Every release is a git tag `vX.Y.Z` and a matching
[GitHub Release](https://github.com/sina-heidariaan/temporal-format-parser/releases); notable
changes are recorded in [CHANGELOG.md](./CHANGELOG.md). While the package is `0.x`,
minor versions may contain breaking changes (per SemVer's initial-development clause).
See [PUBLISHING.md](./PUBLISHING.md) for how releases are cut.

## License

MIT
