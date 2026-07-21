# Changelog

All notable changes to **temporal-format-parse** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each
released version corresponds to a git tag `vX.Y.Z` and a GitHub Release.

## [Unreleased]

_Nothing yet._

## [0.1.0] — 2026-07-21

Initial release.

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
  exports `temporal-format-parse/format` and `temporal-format-parse/parse` for tree-shaking.

### Not included (by design)

- No locale-aware textual parsing (month/weekday/era names, am/pm words).
- No full CLDR/LDML engine — a curated common numeric token subset only.

[Unreleased]: https://github.com/sina-heidariaan/temporal-format-parser/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sina-heidariaan/temporal-format-parser/releases/tag/v0.1.0
