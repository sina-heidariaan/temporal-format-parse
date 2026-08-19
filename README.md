# temporal-format-parse

> **Parse fixed, machine-written date formats straight into TC39 Temporal.**
> `parse("20260713", "yyyyMMdd", "PlainDate")` → `Temporal.PlainDate`, and
> `format` writes the same pattern back out. No JavaScript `Date` anywhere in the
> code path, zero runtime dependencies.

Your database, your CSV export, your LDAP directory and your mainframe feed all hand
you dates in their own fixed layout — `20260713`, `13.07.2026`, `20260713093000Z`.
`Temporal.PlainDate.from()` only accepts ISO 8601, so today you route that string
through a `Date`-based library and lose precision on the way back. This package reads
those layouts directly into the Temporal type you asked for.

[![npm](https://img.shields.io/npm/v/temporal-format-parse.svg)](https://www.npmjs.com/package/temporal-format-parse)
![license](https://img.shields.io/badge/license-MIT-blue.svg)

**Status:** early release (v0.x). Works on native `Temporal` (Node 26+, modern
browsers) and on any polyfill you supply.

> **Got a date format this can't read?**
> [Tell me about it in one line →](https://github.com/sina-heidariaan/temporal-format-parse/discussions/2)
> I'm collecting real-world layouts so this library covers inputs people actually have.

## Why

Temporal ships ISO/RFC-9557 round-tripping and `Intl.DateTimeFormat`, but **no token
formatter and no token parser** — that was deferred to Temporal v2. Every existing
token library (Moment, Luxon, Day.js, date-fns) works through the legacy `Date`, so a
Temporal → Date → Temporal round-trip silently drops **nanoseconds, calendar, and time
zone** — the very things Temporal exists to protect.

`temporal-format-parse` fills exactly that gap: it reads and writes Temporal values
field by field, so the wall-clock fields, the **nanoseconds**, the **UTC offset** and the
**IANA time-zone id** all survive a `format` → `parse` round trip.

One thing it does **not** carry is the **calendar**. If your value uses a non-ISO
calendar, read [Calendars — current limitation](#calendars--current-limitation) before
you use this package.

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

## Why this and not Temporal / Luxon / date-fns / temporal-fmt?

All four are good tools. They just answer different questions.

| | Temporal alone | Luxon | date-fns | temporal-fmt | **temporal-format-parse** |
|---|---|---|---|---|---|
| Parse a custom token pattern | ✗ (ISO 8601 only) | ✓ `fromFormat` | ✓ `parse` | ✓ | ✓ |
| What parsing returns | — | a Luxon `DateTime` | a JS `Date` | a Temporal value | a Temporal value |
| A JS `Date` in the code path | no | yes | yes | no | no |
| Month names, weekdays, locale text | via `Intl` formatting | ✓ | ✓ | ✓ | ✗ — on purpose |
| Relative time, durations, math | some math | ✓ | ✓ | ✓ | ✗ — Temporal already does math |

**Temporal alone** — use it when your strings are ISO 8601 or RFC 9557. It has no token
parser and no token formatter; those were deferred past v1. If `Temporal.PlainDate.from`
already reads your input, you do not need this package.

**Luxon / date-fns** — reach for these when you need human-facing text: `"July 13, 2026"`,
`"3 days ago"`, French month names. They are mature and locale-complete. The cost is that
both are built on the legacy `Date`, so a Temporal value handed in and taken back out
comes home at millisecond precision.

**temporal-fmt** — the closest neighbour, and a bigger library: it also works directly on
Temporal values, and it *adds* locale-aware tokens (`MMMM`, `EEEE`), duration formatting
and relative time, backed by `Intl`. Pick it when you want one library that does human
text too.

**temporal-format-parse** — pick this one when the input is **machine-written and fixed**,
and you want the smallest, strictest thing that reads it. Numeric tokens only, no `Intl`,
no CLDR, nothing to configure, and parsing rejects rather than guesses: `"2026-02-30"`,
`"2026-7-13"` under `yyyy-MM-dd`, or a trailing stray character all throw a `ParseError`
instead of quietly returning a wrong date.

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

## Recipes

Five layouts that come up over and over. Every snippet below is covered by a test in
[`test/recipes.test.ts`](./test/recipes.test.ts).

### 1. Compact `yyyyMMdd` (databases, filenames, batch feeds)

No separators, so use the padded tokens — they have fixed widths and parse cleanly when
they sit next to each other.

```ts
parse("20260713", "yyyyMMdd", "PlainDate");                  // Temporal.PlainDate 2026-07-13
format(Temporal.PlainDate.from("2026-07-13"), "yyyyMMdd");   // "20260713"

// with a time attached, e.g. a log filename
parse("20260713T093000", "yyyyMMdd'T'HHmmss", "PlainDateTime");  // 2026-07-13T09:30:00
```

### 2. LDAP / X.509 generalized time (`20260713093000Z`)

Generalized time is always UTC when it ends in `Z`. `ZonedDateTime` needs a real zone
token (`VV`), and this format has none — so parse to a `PlainDateTime` and attach UTC:

```ts
const local = parse("20260713093000Z", "yyyyMMddHHmmss'Z'", "PlainDateTime");
local.toZonedDateTime("UTC");        // 2026-07-13T09:30:00+00:00[UTC]

// with the optional fraction
parse("20260713093000.5Z", "yyyyMMddHHmmss'.'S'Z'", "PlainDateTime");  // 2026-07-13T09:30:00.5
```

The `'Z'` is in quotes because here it is a literal letter, not an offset token.

### 3. Migrating from Luxon `fromFormat`

The token spelling is the same; only the call shape and the return type change.

```ts
// before — returns a Luxon DateTime
DateTime.fromFormat("07/13/2026", "MM/dd/yyyy");
DateTime.fromFormat("2026-07-13 14:05:09", "yyyy-MM-dd HH:mm:ss");

// after — returns the Temporal type you name
parse("07/13/2026", "MM/dd/yyyy", "PlainDate");                     // Temporal.PlainDate
parse("2026-07-13 14:05:09", "yyyy-MM-dd HH:mm:ss", "PlainDateTime"); // Temporal.PlainDateTime
```

Two differences to expect: there is no `.invalid` result — a bad input **throws** a
`ParseError`; and textual tokens (`MMMM`, `EEEE`, `LLL`) are not supported here.

### 4. Migrating from date-fns `parse` / `format`

date-fns needs a reference `Date` to fill in the fields your pattern omits. This package
does not: the target type declares exactly which fields the pattern must supply, and a
missing one is an error rather than a silent default.

```ts
// before — returns a JS Date, borrowing today's time from the reference date
parse("13.07.2026", "dd.MM.yyyy", new Date());
formatFns(new Date(), "yyyy-MM-dd");

// after — no reference value, no Date
parse("13.07.2026", "dd.MM.yyyy", "PlainDate");                // Temporal.PlainDate
format(Temporal.Now.plainDateISO(), "yyyy-MM-dd");             // "2026-07-13"
```

date-fns tokens `yyyy MM dd HH mm ss` carry over unchanged. Its `T`/`t` (epoch) and
locale tokens have no equivalent here.

### 5. Zoned timestamps at nanosecond precision

The one round trip a `Date`-based library cannot do at all:

```ts
const pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSSZZ'['VV']'";
const zdt = Temporal.ZonedDateTime.from(
  "2026-07-13T09:30:00.123456789-04:00[America/New_York]",
);

const s = format(zdt, pattern);
// "2026-07-13T09:30:00.123456789-04:00[America/New_York]"

parse(s, pattern, "ZonedDateTime").equals(zdt);   // true
```

`SSSSSSSSS` is nine fractional digits (nanoseconds), `ZZ` is the `±HH:MM` offset, and
`VV` is the IANA zone id. Drop `VV` and you can no longer build a `ZonedDateTime` —
the offset alone does not identify a zone.

## Calendars — current limitation

**Both `format` and `parse` work in whatever calendar the value already uses, and `parse`
always produces an `iso8601` value.** There is no calendar token, and no `era` / `eraYear`
token.

That is fine for the ISO calendar, which is what almost all machine data uses. It is a
real trap for anything else:

```ts
const hebrew = Temporal.PlainDate.from("2026-07-13").withCalendar("hebrew");

format(hebrew, "yyyy-MM-dd");                     // "5786-10-28"  ← Hebrew fields
parse("5786-10-28", "yyyy-MM-dd", "PlainDate");   // ISO date 5786-10-28  ← a different day
```

`format` faithfully printed the Hebrew year, month and day. `parse` had no way to know
they were Hebrew, so it read them as ISO. The round trip does **not** come back to the
same day.

So, concretely:

- ✅ ISO-calendar values round-trip exactly, including nanoseconds, offset and zone id.
- ⚠️ A non-ISO value formats using **its own** calendar's field numbers.
- ❌ `parse` never returns a non-ISO calendar, so a non-ISO round trip is lossy.
- ❌ Japanese/ROC-style eras (`reiwa 8`) cannot be formatted or parsed at all.

**What to do today:** convert to ISO before formatting, and re-apply the calendar after
parsing — then the mapping is explicit and correct.

```ts
format(hebrew.withCalendar("iso8601"), "yyyy-MM-dd");                    // "2026-07-13"
parse("2026-07-13", "yyyy-MM-dd", "PlainDate").withCalendar("hebrew");   // same Hebrew day
```

Calendar-aware options are on the "build it if users ask" list. If you need them,
[open an issue](https://github.com/sina-heidariaan/temporal-format-parse/issues) or
[say which calendar in the formats thread](https://github.com/sina-heidariaan/temporal-format-parse/discussions/2).

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
- **No calendar-aware parsing** — `parse` always returns an `iso8601` value and there is
  no era token. See [Calendars — current limitation](#calendars--current-limitation).
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

## Conformance suite

[`conformance/cases.json`](./conformance/cases.json) is a public, machine-readable suite
of **66 cases** covering the parts of token parsing that are easy to get quietly wrong:

- daylight-saving **gaps and overlaps** (a clock time that never happened; one that
  happened twice),
- inputs that must be **rejected** — `2026-02-30`, `10:00:60`, `2026-7-13` under
  `yyyy-MM-dd`, a trailing stray character,
- **extreme years** — 0, 1, 9999, Temporal's maximum 275760, negative years, the
  two-digit pivot boundary,
- **offsets and zones** — `Z` for UTC, half-hour zones, sub-minute pre-1900 offsets,
  an offset that disagrees with its zone,
- **fractional seconds** at every width from 1 to 9 digits.

All 66 pass here, verified by [`test/conformance.test.ts`](./test/conformance.test.ts) on
every CI run. 7 of them are flagged `"opinionated"` because they encode this library's
own design choices rather than facts about dates; filter those out if you are scoring
something else. The suite has already been reviewed by the author of a competing
library, and one flagged case was promoted to factual after both implementations
independently landed on the same behaviour. The cases are plain data, not code, so you can run them against **any**
Temporal token library — see [`conformance/README.md`](./conformance/README.md) for the
case format and an adapter sketch. New cases are welcome, especially from real production
data.

## Versioning & releases

Semantic Versioning. Every release is a git tag `vX.Y.Z` and a matching
[GitHub Release](https://github.com/sina-heidariaan/temporal-format-parse/releases); notable
changes are recorded in [CHANGELOG.md](./CHANGELOG.md). While the package is `0.x`,
minor versions may contain breaking changes (per SemVer's initial-development clause).
See [PUBLISHING.md](./PUBLISHING.md) for how releases are cut.

## License

MIT
