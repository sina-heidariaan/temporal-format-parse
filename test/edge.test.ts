import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { format } from "../src/format.js";
import { parse } from "../src/parse.js";
import { ParseError } from "../src/errors.js";

// Edge scenarios in the style of the temporal-sql suite: boundary dates, proleptic and
// large years, leap-day validity, DST folds, and fractional-second precision.
const opts = { temporal: Temporal };

describe("edge — boundary and historical dates", () => {
  it("handles pre-1970 dates", () => {
    const d = Temporal.PlainDate.from("1969-07-20");
    expect(format(d, "yyyy-MM-dd")).toBe("1969-07-20");
    expect(parse("1969-07-20", "yyyy-MM-dd", "PlainDate", opts).equals(d)).toBe(true);
  });

  it("formats and parses a proleptic negative (BC) year via the y token", () => {
    const d = Temporal.PlainDate.from({ year: -43, month: 3, day: 15 }); // 44 BC
    expect(format(d, "y-MM-dd")).toBe("-43-03-15");
    expect(parse("-43-03-15", "y-MM-dd", "PlainDate", opts).equals(d)).toBe(true);
  });

  it("handles years >= 10000 via the y token", () => {
    const d = Temporal.PlainDate.from({ year: 12026, month: 7, day: 13 });
    expect(format(d, "y-MM-dd")).toBe("12026-07-13");
    expect(parse("12026-07-13", "y-MM-dd", "PlainDate", opts).equals(d)).toBe(true);
  });

  it("documents the yyyy 4-digit limit: a 5-digit year won't parse with yyyy", () => {
    // yyyy is fixed-width (4). Use y for extended years; parsing 12026 with yyyy fails.
    expect(() => parse("12026-07-13", "yyyy-MM-dd", "PlainDate", opts)).toThrow(ParseError);
  });
});

describe("edge — leap day validity (overflow: reject)", () => {
  it("accepts Feb 29 in a leap year", () => {
    expect(parse("2024-02-29", "yyyy-MM-dd", "PlainDate", opts).toString()).toBe("2024-02-29");
  });

  it("rejects Feb 29 in a non-leap year", () => {
    expect(() => parse("2025-02-29", "yyyy-MM-dd", "PlainDate", opts)).toThrow(ParseError);
  });

  it("round-trips Feb 29 as a PlainMonthDay", () => {
    const md = Temporal.PlainMonthDay.from({ month: 2, day: 29 });
    expect(format(md, "MM-dd")).toBe("02-29");
    expect(parse("02-29", "MM-dd", "PlainMonthDay", opts).equals(md)).toBe(true);
  });
});

describe("edge — DST fall-back fold (ZZ disambiguates)", () => {
  // 2024-11-03 01:30 in America/New_York occurs twice: first at -04:00 (EDT), then at
  // -05:00 (EST). The offset token (ZZ) must pick the correct instant on parse.
  const p = "yyyy-MM-dd'T'HH:mm:ssZZ'['VV']'";
  const first = Temporal.ZonedDateTime.from("2024-11-03T01:30:00-04:00[America/New_York]");
  const second = Temporal.ZonedDateTime.from("2024-11-03T01:30:00-05:00[America/New_York]");

  it("the two occurrences are one hour apart", () => {
    expect(second.epochNanoseconds - first.epochNanoseconds).toBe(3_600_000_000_000n);
  });

  it("round-trips the earlier (EDT) occurrence to the same instant", () => {
    const back = parse(format(first, p), p, "ZonedDateTime", opts);
    expect(back.epochNanoseconds).toBe(first.epochNanoseconds);
    expect(back.epochNanoseconds).not.toBe(second.epochNanoseconds);
  });

  it("round-trips the later (EST) occurrence to the same instant", () => {
    const back = parse(format(second, p), p, "ZonedDateTime", opts);
    expect(back.epochNanoseconds).toBe(second.epochNanoseconds);
  });
});

describe("edge — fractional seconds & boundary times", () => {
  it("preserves leading zeros in the fraction", () => {
    const t = Temporal.PlainTime.from({ second: 7, millisecond: 50 });
    expect(format(t, "ss.SSS")).toBe("07.050");
    // parse into a PlainTime needs an hour token (fail-loudly design), so use a full pattern.
    expect(parse("00:00:07.050", "HH:mm:ss.SSS", "PlainTime", opts).millisecond).toBe(50);
  });

  it("formats a zero fraction as all zeros", () => {
    expect(format(Temporal.PlainTime.from("12:00:00"), "HH:mm:ss.SSS")).toBe("12:00:00.000");
  });

  it("truncates (does not round) to the requested fraction width", () => {
    // 123456789 ns → SSS keeps the first three digits only.
    expect(format(Temporal.PlainTime.from("00:00:00.123456789"), "ss.SSS")).toBe("00.123");
  });

  it("handles midnight and end-of-day boundaries", () => {
    expect(format(Temporal.PlainTime.from("00:00:00"), "HH:mm:ss")).toBe("00:00:00");
    expect(format(Temporal.PlainTime.from("23:59:59"), "HH:mm:ss")).toBe("23:59:59");
    expect(parse("00:00", "HH:mm", "PlainTime", opts).toString()).toBe("00:00:00");
    expect(parse("23:59:59", "HH:mm:ss", "PlainTime", opts).toString()).toBe("23:59:59");
  });

  it("parses various UTC offsets including half-hour zones", () => {
    const zdt = parse("2026-07-13 09:30 +05:30 Asia/Kolkata", "yyyy-MM-dd HH:mm ZZ VV", "ZonedDateTime", opts);
    expect(zdt.offset).toBe("+05:30");
    expect(zdt.timeZoneId).toBe("Asia/Kolkata");
  });
});
