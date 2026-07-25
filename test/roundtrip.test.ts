import { describe, it } from "vitest";
import fc from "fast-check";
import { Temporal } from "@js-temporal/polyfill";
import { format } from "../src/format.js";
import { parse } from "../src/parse.js";

/**
 * The core contract: for every supported (type, pattern), parsing the formatted
 * output reproduces the original value. Equality is checked with each type's own
 * `.equals` (or instant identity for ZonedDateTime), never string comparison, so
 * calendar/zone nuances are respected rather than papered over.
 */
const opts = { temporal: Temporal };

const splitNs = (ns: number) => ({
  millisecond: Math.floor(ns / 1_000_000),
  microsecond: Math.floor(ns / 1_000) % 1_000,
  nanosecond: ns % 1_000,
});

describe("round-trip: parse(format(v, p), p, type) === v", () => {
  it("PlainDate — yyyy-MM-dd", () => {
    const arb = fc
      .record({ year: fc.integer({ min: 1583, max: 9999 }), month: fc.integer({ min: 1, max: 12 }), day: fc.integer({ min: 1, max: 28 }) })
      .map((f) => Temporal.PlainDate.from(f));
    fc.assert(
      fc.property(arb, (v) => {
        const back = parse(format(v, "yyyy-MM-dd"), "yyyy-MM-dd", "PlainDate", opts);
        return v.equals(back);
      }),
    );
  });

  it("PlainTime — HH:mm:ss.SSSSSSSSS", () => {
    const arb = fc
      .record({ hour: fc.integer({ min: 0, max: 23 }), minute: fc.integer({ min: 0, max: 59 }), second: fc.integer({ min: 0, max: 59 }), ns: fc.integer({ min: 0, max: 999_999_999 }) })
      .map(({ hour, minute, second, ns }) => Temporal.PlainTime.from({ hour, minute, second, ...splitNs(ns) }));
    fc.assert(
      fc.property(arb, (v) => {
        const p = "HH:mm:ss.SSSSSSSSS";
        return v.equals(parse(format(v, p), p, "PlainTime", opts));
      }),
    );
  });

  it("PlainDateTime — yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSS", () => {
    const arb = fc
      .record({
        year: fc.integer({ min: 1583, max: 9999 }),
        month: fc.integer({ min: 1, max: 12 }),
        day: fc.integer({ min: 1, max: 28 }),
        hour: fc.integer({ min: 0, max: 23 }),
        minute: fc.integer({ min: 0, max: 59 }),
        second: fc.integer({ min: 0, max: 59 }),
        ns: fc.integer({ min: 0, max: 999_999_999 }),
      })
      .map(({ ns, ...f }) => Temporal.PlainDateTime.from({ ...f, ...splitNs(ns) }));
    fc.assert(
      fc.property(arb, (v) => {
        const p = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSS";
        return v.equals(parse(format(v, p), p, "PlainDateTime", opts));
      }),
    );
  });

  it("PlainTime — h:mm:ss a (12-hour clock)", () => {
    const arb = fc
      .record({
        hour: fc.integer({ min: 0, max: 23 }),
        minute: fc.integer({ min: 0, max: 59 }),
        second: fc.integer({ min: 0, max: 59 }),
      })
      .map((f) => Temporal.PlainTime.from(f));
    fc.assert(
      fc.property(arb, (v) => {
        const p = "h:mm:ss a";
        return v.equals(parse(format(v, p), p, "PlainTime", opts));
      }),
    );
  });

  it("PlainYearMonth — yyyy-MM", () => {
    const arb = fc
      .record({ year: fc.integer({ min: 1583, max: 9999 }), month: fc.integer({ min: 1, max: 12 }) })
      .map((f) => Temporal.PlainYearMonth.from(f));
    fc.assert(
      fc.property(arb, (v) => v.equals(parse(format(v, "yyyy-MM"), "yyyy-MM", "PlainYearMonth", opts))),
    );
  });

  it("PlainMonthDay — MM-dd", () => {
    const arb = fc
      .record({ month: fc.integer({ min: 1, max: 12 }), day: fc.integer({ min: 1, max: 28 }) })
      .map((f) => Temporal.PlainMonthDay.from(f));
    fc.assert(
      fc.property(arb, (v) => v.equals(parse(format(v, "MM-dd"), "MM-dd", "PlainMonthDay", opts))),
    );
  });

  it("ZonedDateTime — full pattern with ZZ + VV (instant identity)", () => {
    const zones = ["UTC", "America/New_York", "Europe/London", "Asia/Kolkata", "Australia/Sydney"];
    // Epoch range ~1970..2200 keeps years 4-digit and offsets at ±HH:MM.
    const MAX_NS = 7_258_118_400_000_000_000n;
    const arb = fc
      .tuple(fc.bigInt({ min: 0n, max: MAX_NS }), fc.constantFrom(...zones))
      .map(([ns, zone]) => Temporal.Instant.fromEpochNanoseconds(ns).toZonedDateTimeISO(zone));
    fc.assert(
      fc.property(arb, (v) => {
        const p = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSSZZ'['VV']'";
        const back = parse(format(v, p), p, "ZonedDateTime", opts);
        return back.epochNanoseconds === v.epochNanoseconds && back.timeZoneId === v.timeZoneId;
      }),
    );
  });

  it.each(["X", "XX", "XXX"])("ZonedDateTime — %s offset form (instant identity)", (offsetToken) => {
    // Includes UTC (renders as "Z") and a half-hour zone (forces X to widen).
    const zones = ["UTC", "America/New_York", "Europe/London", "Asia/Kolkata", "Australia/Sydney"];
    const MAX_NS = 7_258_118_400_000_000_000n;
    const arb = fc
      .tuple(fc.bigInt({ min: 0n, max: MAX_NS }), fc.constantFrom(...zones))
      .map(([ns, zone]) => Temporal.Instant.fromEpochNanoseconds(ns).toZonedDateTimeISO(zone));
    fc.assert(
      fc.property(arb, (v) => {
        const p = `yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSS${offsetToken}'['VV']'`;
        const back = parse(format(v, p), p, "ZonedDateTime", opts);
        return back.epochNanoseconds === v.epochNanoseconds && back.timeZoneId === v.timeZoneId;
      }),
    );
  });
});
