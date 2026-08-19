# Changelog

All notable changes to **temporal-format-parse** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each
released version corresponds to a git tag `vX.Y.Z` and a GitHub Release.

## [Unreleased]

## [0.2.1] — 2026-08-19

Documentation and metadata only. **The published code is byte-identical to 0.2.0** —
no token, API or behaviour change.

### Added

- **Public conformance suite** — `conformance/cases.json`, 65 machine-readable cases
  covering DST gaps and overlaps, inputs that must be rejected, extreme years, offset
  and zone spellings, and 1–9 fractional-second digits. Run by
  `test/conformance.test.ts` on every CI run, and portable to any other Temporal token
  library (see `conformance/README.md`).
- README: a **Recipes** section with five worked layouts (`yyyyMMdd`, LDAP generalized
  time, Luxon `fromFormat` migration, date-fns migration, zoned nanosecond timestamps),
  each backed by a test in `test/recipes.test.ts`.
- README: a **"Why this and not Temporal / Luxon / date-fns / temporal-fmt?"** comparison.
- README: a link to the open discussion collecting real-world date formats.

### Fixed

- `package.json` `repository`, `bugs` and `homepage` pointed at a repository name that
  does not exist (`temporal-format-parser`). They now point at
  `temporal-format-parse`. The same wrong name is corrected in the README, this
  changelog and `PUBLISHING.md`.

### Documentation

- Corrected the overstated claim that "nothing is lost". Nanoseconds, UTC offset and
  IANA zone id do survive a round trip; the **calendar does not**. Added a
  "Calendars — current limitation" section showing exactly how a non-ISO round trip
  goes wrong, and the ISO-conversion workaround.

## [0.2.0] — 2026-07-25

Two additive token groups. No behaviour changes to existing patterns — every 0.1.1
pattern formats and parses byte-identically.

### Added

- **12-hour clock tokens** `h` / `hh` (hour 1–12) and `a` (`AM`/`PM`), valid on
  `PlainTime`, `PlainDateTime` and `ZonedDateTime`. `12:00 AM` is midnight, `12:00 PM`
  is noon; parsing accepts any case (`pm`, `Pm`, `PM`). This is fixed English text, not
  CLDR data, so the zero-dependency and no-locale guarantees are unchanged.
  - A pattern mixing `H` with `h`/`a` is rejected as contradictory
    (`InvalidPatternError`).
  - On parse, `h` requires `a` and `a` requires `h`; an hour outside 1–12 fails loudly.
- **UTC offset variants** `X` (`±HH`, widening to `±HHMM` when minutes are non-zero),
  `XX` (`±HHMM`) and `XXX` (`±HH:MM`). All three render UTC as the literal `Z` and
  accept `Z` on parse, normalizing it to `+00:00`. Existing `ZZ` is untouched: always
  `±HH:MM`, never `Z`.
  - Sub-minute historical offsets can't be represented in any `X` form and throw a
    `FormatError` pointing at `ZZ`.
- Test suite: dedicated `reflect` coverage and `temporal-sql`-style edge-case tests
  (pre-1970 and proleptic/BC years, years ≥ 10000, leap-day validity, DST fall-back
  fold, fractional-second and boundary-time precision), plus 12-hour and offset-variant
  coverage plumbed into the fast-check round-trip properties.
- CI: GitHub Actions workflow — a `check` matrix on Node 18/20/22/24/26 (26 exercises
  native Temporal) plus a separate `attw` tarball-gate job.

## [0.1.1] — 2026-07-21

Initial public release (first version published to npm).

### Added

- `format(value, pattern)` — token formatting directly on any Temporal value
  (`PlainDate`, `PlainTime`, `PlainDateTime`, `PlainYearMonth`, `PlainMonthDay`,
  `ZonedDateTime`). No JavaScript `Date` in the code path.
- `parse(input, pattern, targetTypeName, options?)` — numeric token parsing that
  constructs a real Temporal value via native `globalThis.Temporal` or a
  caller-supplied `{ temporal }` implementation.
- Unicode TR35-style numeric token set: `yyyy yy y MM M dd d HH H mm m ss s S…`
  plus `ZZ` (UTC offset) and `VV` (IANA zone id) for `ZonedDateTime`. Single-quoted
  literals (`'T'`, `''`).
- Per-type token validity checks; documented two-digit-year (`yy`) pivot
  (00–68 → 2000s, 69–99 → 1900s); `overflow: "reject"` so out-of-range input fails
  loudly.
- `getTemporalType`, `isTemporal`, and the error types `FormatError`, `ParseError`,
  `InvalidPatternError`.
- Zero runtime dependencies. Dual CJS/ESM builds with `.d.ts`/`.d.cts`; subpath
  exports `temporal-format-parse/format` and `temporal-format-parse/parse` for
  tree-shaking.

### Not included (by design)

- No locale-aware textual parsing (month/weekday/era names, am/pm words).
- No full CLDR/LDML engine — a curated common numeric token subset only.

[Unreleased]: https://github.com/sina-heidariaan/temporal-format-parse/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/sina-heidariaan/temporal-format-parse/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/sina-heidariaan/temporal-format-parse/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/sina-heidariaan/temporal-format-parse/releases/tag/v0.1.1
