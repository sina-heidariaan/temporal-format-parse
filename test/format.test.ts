import { describe, it, expect } from "vitest";
import { Temporal, Intl as TemporalIntl } from "@js-temporal/polyfill";
import { format } from "../src/format.js";
import { FormatError, InvalidPatternError } from "../src/errors.js";

describe("format — fixed numeric patterns", () => {
  const date = Temporal.PlainDate.from("2026-07-13");

  it.each([
    ["yyyy-MM-dd", "2026-07-13"],
    ["MM/dd/yyyy", "07/13/2026"],
    ["dd.MM.yyyy", "13.07.2026"],
    ["d/M/yyyy", "13/7/2026"],
    ["yy", "26"],
    ["yyyyMMdd", "20260713"],
  ])("PlainDate %s → %s", (pattern, expected) => {
    expect(format(date, pattern)).toBe(expected);
  });

  it("formats single-digit month/day without padding for M/d", () => {
    expect(format(Temporal.PlainDate.from("2026-01-05"), "yyyy-M-d")).toBe("2026-1-5");
    expect(format(Temporal.PlainDate.from("2026-01-05"), "yyyy-MM-dd")).toBe("2026-01-05");
  });

  const time = Temporal.PlainTime.from("09:03:07.123456789");
  it.each([
    ["HH:mm", "09:03"],
    ["HH:mm:ss", "09:03:07"],
    ["H:m:s", "9:3:7"],
    ["HH:mm:ss.SSS", "09:03:07.123"],
    ["HH:mm:ss.SSSSSS", "09:03:07.123456"],
    ["HH:mm:ss.SSSSSSSSS", "09:03:07.123456789"],
  ])("PlainTime %s → %s", (pattern, expected) => {
    expect(format(time, pattern)).toBe(expected);
  });

  it("formats a PlainDateTime with a quoted literal 'T'", () => {
    const dt = Temporal.PlainDateTime.from("2026-07-13T09:03:07");
    expect(format(dt, "yyyy-MM-dd'T'HH:mm:ss")).toBe("2026-07-13T09:03:07");
  });

  it("emits a literal apostrophe with ''", () => {
    expect(format(date, "yyyy''")).toBe("2026'");
  });

  it("formats PlainYearMonth and PlainMonthDay", () => {
    expect(format(Temporal.PlainYearMonth.from("2026-07"), "yyyy-MM")).toBe("2026-07");
    expect(format(Temporal.PlainMonthDay.from("07-13"), "MM/dd")).toBe("07/13");
  });

  it("formats ZonedDateTime offset (ZZ) and zone id (VV)", () => {
    const zdt = Temporal.ZonedDateTime.from("2026-07-13T09:30:00-04:00[America/New_York]");
    expect(format(zdt, "yyyy-MM-dd'T'HH:mm:ssZZ")).toBe("2026-07-13T09:30:00-04:00");
    expect(format(zdt, "yyyy-MM-dd HH:mm ZZ '['VV']'")).toBe("2026-07-13 09:30 -04:00 [America/New_York]");
  });

  it("formats a proleptic negative year with a sign", () => {
    expect(format(Temporal.PlainDate.from("-000044-03-15"), "yyyy-MM-dd")).toBe("-0044-03-15");
  });
});

describe("format — oracle against Intl.DateTimeFormat", () => {
  // Where the numeric tokens overlap Intl's numeric parts, our output must agree.
  const dtf = new TemporalIntl.DateTimeFormat("en-US", {
    calendar: "iso8601",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  });

  it.each([
    "2026-07-13T00:00:00",
    "2026-01-05T09:03:07",
    "1999-12-31T23:59:58",
  ])("matches Intl numeric parts for %s", (iso) => {
    const dt = Temporal.PlainDateTime.from(iso);
    const parts = Object.fromEntries(dtf.formatToParts(dt).map((p) => [p.type, p.value]));
    const expected = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
    expect(format(dt, "yyyy-MM-dd HH:mm:ss")).toBe(expected);
  });
});

describe("format — validity & error handling", () => {
  it("rejects a token the type can't supply (HH on PlainDate)", () => {
    expect(() => format(Temporal.PlainDate.from("2026-07-13"), "yyyy HH")).toThrow(FormatError);
  });

  it("rejects a zone token on PlainDateTime", () => {
    expect(() => format(Temporal.PlainDateTime.from("2026-07-13T00:00"), "VV")).toThrow(FormatError);
  });

  it("rejects a non-Temporal value", () => {
    expect(() => format({ year: 2026 } as never, "yyyy")).toThrow(FormatError);
    expect(() => format(new Date() as never, "yyyy")).toThrow(FormatError);
  });

  it("rejects unsupported Temporal types (Instant, Duration)", () => {
    expect(() => format(Temporal.Now.instant() as never, "yyyy")).toThrow(FormatError);
    expect(() => format(Temporal.Duration.from({ hours: 1 }) as never, "HH")).toThrow(FormatError);
  });

  it("rejects malformed patterns", () => {
    expect(() => format(Temporal.PlainDate.from("2026-07-13"), "yyyy-MM-dd'")).toThrow(InvalidPatternError);
    expect(() => format(Temporal.PlainDate.from("2026-07-13"), "MMM")).toThrow(InvalidPatternError);
    expect(() => format(Temporal.PlainDate.from("2026-07-13"), "yyyy Q")).toThrow(InvalidPatternError);
  });
});
