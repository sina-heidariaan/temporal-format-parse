# Temporal token format/parse — conformance cases

`cases.json` is a **portable, machine-readable test suite** for libraries that format and
parse [TC39 Temporal](https://tc39.es/proposal-temporal/docs/) values with token patterns.

It is data, not code. Nothing in it is specific to `temporal-format-parse` — any library
that can turn a token pattern and a string into a Temporal value can be run against it.

**Why this exists.** Token parsing looks simple and is full of quiet traps: a clock time
that does not exist because of daylight saving, `2026-02-30`, an offset that disagrees
with its zone, nine fractional digits, the year 275760. A library can look correct in a
README and still get every one of those wrong. These are the cases worth arguing about,
written down with their expected answers.

Current status in this repository: **65 cases, all passing** (58 factual, 7 flagged as this library's own design choices — see below) (see
[`test/conformance.test.ts`](../test/conformance.test.ts)).

## Groups

| Group | What it pins down |
|---|---|
| `dst` | Spring-forward gaps and fall-back overlaps in `America/New_York`. |
| `invalid` | Inputs that must be **rejected**, not silently corrected. |
| `extreme-years` | Year 0, year 1, 9999, Temporal's maximum year, negative years, the two-digit pivot. |
| `offsets` | `ZZ` vs `X`/`XX`/`XXX`, `Z` for UTC, half-hour zones, sub-minute historical offsets. |
| `zones` | IANA zone identity (`VV`) and what a `ZonedDateTime` actually requires. |
| `fraction` | Fractional seconds at 1 through 9 digits, plus padding and truncation. |
| `calendar` | The non-ISO calendar limitation, written down honestly rather than hidden. |
| `shape` | Adjacent numeric tokens, quoted literals, exact-width matching, the 12-hour clock. |

## Case format

Every case has an `id` (stable — reference it from bug reports), a `group`, an `op`, a
`pattern`, an `expect`, and usually a `why` explaining what the case is defending.

**`op: "parse"`** — parse `input` with `pattern` into `target`.

```json
{ "id": "invalid-leap-second", "group": "invalid", "op": "parse",
  "input": "10:00:60", "pattern": "HH:mm:ss", "target": "PlainTime",
  "expect": { "throws": "ParseError" },
  "why": "Temporal has no leap seconds; :60 must be rejected, not clamped to :59." }
```

**`op: "format"`** — build the value from `from` (`type` + an ISO string, optionally a
`calendar`), then format it with `pattern`.

```json
{ "id": "offset-X-widens-for-half-hour-zone", "group": "offsets", "op": "format",
  "from": { "type": "ZonedDateTime", "iso": "2026-07-13T09:30+05:30[Asia/Kolkata]" },
  "pattern": "X", "expect": { "output": "+0530" } }
```

**`op: "roundtrip"`** — format the `from` value, check the text, then parse it back and
check the result equals the original.

```json
{ "id": "shape-adjacent-padded-tokens", "group": "shape", "op": "roundtrip",
  "from": { "type": "PlainDate", "iso": "2026-07-13" },
  "pattern": "yyyyMMdd", "target": "PlainDate",
  "expect": { "output": "20260713", "equals": true } }
```

### `expect` fields

| Field | Meaning |
|---|---|
| `value` | Expected `String(result)` of a parsed value. |
| `calendar` | Expected `calendarId` of a parsed value, when the case is about calendars. |
| `output` | Expected formatted string. |
| `equals` | For `roundtrip`: the reparsed value must satisfy `.equals(original)`. |
| `throws` | The operation must throw. One of `ParseError`, `FormatError`, `InvalidPatternError` — map these onto whatever your library throws. |

## Opinionated cases — read this before scoring another library

7 of the 65 cases are marked `"opinionated": true` and carry an `opinion` line. They
encode a **design choice or a known limitation of `temporal-format-parse`**, not a fact
about dates. A different library can disagree with them and still be completely correct.

Examples of what that means:

- `shape-mixing-H-and-a-rejected` — this library refuses a pattern that mixes `H` with
  `h`/`a`. [`temporal-fmt`](https://github.com/DirazCoder/temporal-fmt) cross-checks them
  instead — `"13:05 PM"` is accepted because it is unambiguous, and only the
  contradictory `"01:05 PM"` throws. That is the better argument; both libraries ship
  tests for their choice.
- `calendar-parse-always-iso` — this documents a *limitation here*: there is no calendar
  token, so a non-ISO round trip is lossy. A calendar-aware library will and should
  behave differently.

**If you are comparing libraries, filter them out:**

```js
const factual = cases.cases.filter((c) => !c.opinionated);   // 58 of 65
```

The remaining 58 are things a date library should get right regardless of its design:
February 30th is not a date, `:60` is not a second, 02:30 did not happen on the US
spring-forward day, and nine fractional digits must not be silently truncated.

Also note that a case is **not applicable** if your library has no token for what it
tests. Cases using `ZZ`/`X`/`XX`/`XXX` or fractions other than 3 digits simply do not
map onto a token set that lacks them — that is a scope difference, not a failure.

## Running it against another library

Write an adapter with two functions and reuse the runner shape in
[`test/conformance.test.ts`](../test/conformance.test.ts):

```js
import cases from "./conformance/cases.json" with { type: "json" };
import { Temporal } from "@js-temporal/polyfill";
import { format, parse } from "your-library";

for (const c of cases.cases) {
  // format: Temporal[c.from.type].from(c.from.iso)  ->  format(value, c.pattern)
  // parse:  parse(c.input, c.pattern, c.target)     ->  compare String(result) to c.expect.value
}
```

Two fair-play notes if you are comparing libraries:

- **Token spellings differ.** These patterns are Unicode TR35-style (`yyyy MM dd HH mm
  ss`, `S` for fractions, `ZZ`/`X` for offsets, `VV` for the zone id). If your library
  spells them differently, translate the pattern in your adapter — the *behaviour* is
  what is being tested, not the spelling.
- **Error types differ.** Only the fact that the operation *fails* is the assertion; the
  class name is this library's.

## Contributing a case

Open a pull request adding an object to `cases.json`. A good case:

1. has a **stable, descriptive `id`** (`dst-overlap-offset-selects-second`, not `case-42`);
2. belongs to one of the declared `groups`;
3. carries a `why` line saying what mistake it catches;
4. is something a reasonable implementation could plausibly get **wrong**.

Cases that come from real production data are the most valuable kind. If you hit a format
this suite does not cover, that is worth a case even if this library already handles it.

## Licence

MIT, same as the rest of the repository. Copy it, vendor it, run it against anything.
