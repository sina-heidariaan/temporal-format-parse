import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { parse } from "../src/parse.js";
import { ParseError, InvalidPatternError } from "../src/errors.js";

// Node < 26 has no native Temporal, so supply the polyfill namespace explicitly.
const opts = { temporal: Temporal };

describe("parse — fixed numeric patterns", () => {
  it("parses PlainDate in several layouts", () => {
    expect(parse("07/13/2026", "MM/dd/yyyy", "PlainDate", opts).toString()).toBe("2026-07-13");
    expect(parse("13.07.2026", "dd.MM.yyyy", "PlainDate", opts).toString()).toBe("2026-07-13");
    expect(parse("2026-07-13", "yyyy-MM-dd", "PlainDate", opts).toString()).toBe("2026-07-13");
    expect(parse("20260713", "yyyyMMdd", "PlainDate", opts).toString()).toBe("2026-07-13");
    expect(parse("13/7/2026", "d/M/yyyy", "PlainDate", opts).toString()).toBe("2026-07-13");
  });

  it("parses PlainTime including fractional seconds", () => {
    expect(parse("09:03", "HH:mm", "PlainTime", opts).toString()).toBe("09:03:00");
    expect(parse("09:03:07", "HH:mm:ss", "PlainTime", opts).toString()).toBe("09:03:07");
    expect(parse("09:03:07.123", "HH:mm:ss.SSS", "PlainTime", opts).toString()).toBe("09:03:07.123");
    expect(parse("09:03:07.123456789", "HH:mm:ss.SSSSSSSSS", "PlainTime", opts).toString()).toBe(
      "09:03:07.123456789",
    );
  });

  it("parses PlainDateTime with a quoted 'T'", () => {
    expect(parse("2026-07-13T09:03:07", "yyyy-MM-dd'T'HH:mm:ss", "PlainDateTime", opts).toString()).toBe(
      "2026-07-13T09:03:07",
    );
  });

  it("parses PlainYearMonth and PlainMonthDay", () => {
    expect(parse("2026-07", "yyyy-MM", "PlainYearMonth", opts).toString()).toBe("2026-07");
    expect(parse("07/13", "MM/dd", "PlainMonthDay", opts).toString()).toBe("07-13");
  });

  it("parses a ZonedDateTime via VV (and optional ZZ)", () => {
    const zdt = parse(
      "2026-07-13T09:30:00-04:00[America/New_York]",
      "yyyy-MM-dd'T'HH:mm:ssZZ'['VV']'",
      "ZonedDateTime",
      opts,
    );
    expect(zdt.toString()).toBe("2026-07-13T09:30:00-04:00[America/New_York]");

    const zdt2 = parse("2026-07-13 09:30 America/New_York", "yyyy-MM-dd HH:mm VV", "ZonedDateTime", opts);
    expect(zdt2.timeZoneId).toBe("America/New_York");
  });
});

describe("parse — 12-hour clock (h/hh/a)", () => {
  it.each([
    ["12:00 AM", "00:00:00"],
    ["12:30 AM", "00:30:00"],
    ["1:05 AM", "01:05:00"],
    ["11:59 AM", "11:59:00"],
    ["12:00 PM", "12:00:00"],
    ["1:05 PM", "13:05:00"],
    ["11:59 PM", "23:59:00"],
  ])("%s → %s", (input, expected) => {
    expect(parse(input, "h:mm a", "PlainTime", opts).toString()).toBe(expected);
  });

  it("accepts lower- and mixed-case markers", () => {
    for (const marker of ["pm", "Pm", "pM", "PM"]) {
      expect(parse(`1:05 ${marker}`, "h:mm a", "PlainTime", opts).hour).toBe(13);
    }
  });

  it("parses padded hh and a full PlainDateTime", () => {
    expect(parse("09:05 PM", "hh:mm a", "PlainTime", opts).toString()).toBe("21:05:00");
    expect(parse("2026-07-13 1:05 PM", "yyyy-MM-dd h:mm a", "PlainDateTime", opts).toString()).toBe(
      "2026-07-13T13:05:00",
    );
  });

  it("rejects h without a, and a without h", () => {
    expect(() => parse("1:05", "h:mm", "PlainTime", opts)).toThrow(ParseError);
    expect(() => parse("01:05 PM", "mm:ss a", "PlainTime", opts)).toThrow(ParseError);
  });

  it("rejects an hour outside 1–12", () => {
    expect(() => parse("13:05 PM", "hh:mm a", "PlainTime", opts)).toThrow(ParseError);
    expect(() => parse("00:05 AM", "hh:mm a", "PlainTime", opts)).toThrow(ParseError);
  });

  it("rejects mixing the 24-hour and 12-hour clocks", () => {
    expect(() => parse("13:05 PM", "HH:mm a", "PlainTime", opts)).toThrow(InvalidPatternError);
  });
});

describe("parse — offset variants (X/XX/XXX)", () => {
  const zoned = (input: string, pattern: string) => parse(input, pattern, "ZonedDateTime", opts);

  it.each([
    ["X", "2026-07-13T09:30-04[America/New_York]"],
    ["XX", "2026-07-13T09:30-0400[America/New_York]"],
    ["XXX", "2026-07-13T09:30-04:00[America/New_York]"],
    ["ZZ", "2026-07-13T09:30-04:00[America/New_York]"],
  ])("accepts the %s spelling of the same offset", (offsetToken, input) => {
    const zdt = zoned(input, `yyyy-MM-dd'T'HH:mm${offsetToken}'['VV']'`);
    expect(zdt.toString()).toBe("2026-07-13T09:30:00-04:00[America/New_York]");
  });

  it("accepts X with minutes and a half-hour zone", () => {
    const zdt = zoned("2026-07-13T09:30+0530[Asia/Kolkata]", "yyyy-MM-dd'T'HH:mmX'['VV']'");
    expect(zdt.offset).toBe("+05:30");
  });

  it("accepts the literal Z for UTC in every X form, but not in ZZ", () => {
    for (const token of ["X", "XX", "XXX"]) {
      const zdt = zoned("2026-07-13T09:30Z[UTC]", `yyyy-MM-dd'T'HH:mm${token}'['VV']'`);
      expect(zdt.offset).toBe("+00:00");
    }
    expect(() => zoned("2026-07-13T09:30Z[UTC]", "yyyy-MM-dd'T'HH:mmZZ'['VV']'")).toThrow(ParseError);
  });

  it("still catches an offset that contradicts the zone", () => {
    expect(() => zoned("2026-07-13T09:30+0900[America/New_York]", "yyyy-MM-dd'T'HH:mmX'['VV']'")).toThrow(ParseError);
  });

  it("rejects X on a target with no offset", () => {
    expect(() => parse("2026-07-13 Z", "yyyy-MM-dd X", "PlainDate", opts)).toThrow(ParseError);
  });
});

describe("parse — two-digit-year pivot", () => {
  it.each([
    ["00", 2000],
    ["68", 2068],
    ["69", 1969],
    ["99", 1999],
  ])("yy %s → %d", (yy, expectedYear) => {
    expect(parse(`${yy}-07-13`, "yy-MM-dd", "PlainDate", opts).year).toBe(expectedYear);
  });
});

describe("parse — error handling", () => {
  it("throws when the input does not match the pattern", () => {
    expect(() => parse("2026/07/13", "yyyy-MM-dd", "PlainDate", opts)).toThrow(ParseError);
    expect(() => parse("not a date", "yyyy-MM-dd", "PlainDate", opts)).toThrow(ParseError);
  });

  it("throws when a required field token is missing", () => {
    expect(() => parse("2026-07", "yyyy-MM", "PlainDate", opts)).toThrow(ParseError);
    expect(() => parse("09:30", "HH:mm", "ZonedDateTime", opts)).toThrow(ParseError);
  });

  it("throws when parsed fields are out of range", () => {
    expect(() => parse("2026-13-01", "yyyy-MM-dd", "PlainDate", opts)).toThrow(ParseError);
    expect(() => parse("2026-02-30", "yyyy-MM-dd", "PlainDate", opts)).toThrow(ParseError);
  });

  it("rejects a token the target can't accept", () => {
    expect(() => parse("2026 09", "yyyy HH", "PlainDate", opts)).toThrow(ParseError);
  });

  it("rejects unsupported targets and malformed patterns", () => {
    expect(() => parse("x", "HH", "Duration", opts)).toThrow(ParseError);
    expect(() => parse("2026", "yyyy'", "PlainDate", opts)).toThrow(InvalidPatternError);
  });

  // Behaviour of the default (no { temporal }) branch depends on the runtime: it uses
  // globalThis.Temporal when present (Node 26+ / browsers) and otherwise throws. Guard
  // on that so the suite is correct across the whole CI Node matrix (18 → 26).
  const hasNativeTemporal = typeof (globalThis as { Temporal?: unknown }).Temporal !== "undefined";

  it.skipIf(hasNativeTemporal)("throws a clear error when no Temporal implementation is available", () => {
    expect(() => parse("2026-07-13", "yyyy-MM-dd", "PlainDate")).toThrow(/No Temporal implementation/);
  });

  it.skipIf(!hasNativeTemporal)("uses native globalThis.Temporal when no { temporal } is supplied", () => {
    expect(parse("2026-07-13", "yyyy-MM-dd", "PlainDate").toString()).toBe("2026-07-13");
  });
});
