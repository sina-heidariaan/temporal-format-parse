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

describe("format — 12-hour clock (h/hh/a)", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["00:30", "12:30 AM"],
    ["01:05", "1:05 AM"],
    ["11:59", "11:59 AM"],
    ["12:00", "12:00 PM"],
    ["12:30", "12:30 PM"],
    ["13:05", "1:05 PM"],
    ["23:59", "11:59 PM"],
  ])("%s → %s with h:mm a", (iso, expected) => {
    expect(format(Temporal.PlainTime.from(iso), "h:mm a")).toBe(expected);
  });

  it("pads with hh", () => {
    expect(format(Temporal.PlainTime.from("09:05"), "hh:mm a")).toBe("09:05 AM");
    expect(format(Temporal.PlainTime.from("00:05"), "hh:mm a")).toBe("12:05 AM");
  });

  it("works on PlainDateTime and ZonedDateTime", () => {
    expect(format(Temporal.PlainDateTime.from("2026-07-13T13:05"), "yyyy-MM-dd h:mm a")).toBe("2026-07-13 1:05 PM");
    const zdt = Temporal.ZonedDateTime.from("2026-07-13T13:05:00-04:00[America/New_York]");
    expect(format(zdt, "h:mm a ZZ")).toBe("1:05 PM -04:00");
  });

  it("agrees with Intl's h12 hourCycle", () => {
    const dtf = new TemporalIntl.DateTimeFormat("en-US", {
      calendar: "iso8601",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h12",
      timeZone: "UTC",
    });
    for (const iso of ["2026-07-13T00:00", "2026-07-13T12:00", "2026-07-13T13:05", "2026-07-13T23:59"]) {
      const dt = Temporal.PlainDateTime.from(iso);
      const parts = Object.fromEntries(dtf.formatToParts(dt).map((p) => [p.type, p.value]));
      expect(format(dt, "h:mm a")).toBe(`${parts.hour}:${parts.minute} ${parts.dayPeriod?.toUpperCase()}`);
    }
  });

  it("rejects mixing the 24-hour and 12-hour clocks", () => {
    const t = Temporal.PlainTime.from("13:05");
    expect(() => format(t, "HH:mm a")).toThrow(InvalidPatternError);
    expect(() => format(t, "HH h")).toThrow(InvalidPatternError);
  });

  it("rejects 12-hour tokens on a date-only type", () => {
    expect(() => format(Temporal.PlainDate.from("2026-07-13"), "yyyy h")).toThrow(FormatError);
    expect(() => format(Temporal.PlainDate.from("2026-07-13"), "yyyy a")).toThrow(FormatError);
  });

  it("rejects hhh and aa", () => {
    const t = Temporal.PlainTime.from("13:05");
    expect(() => format(t, "hhh")).toThrow(InvalidPatternError);
    expect(() => format(t, "aa")).toThrow(InvalidPatternError);
  });
});

describe("format — offset variants (X/XX/XXX)", () => {
  const at = (iso: string) => Temporal.ZonedDateTime.from(iso);

  it.each([
    ["X", "2026-07-13T09:30:00-04:00[America/New_York]", "-04"],
    ["XX", "2026-07-13T09:30:00-04:00[America/New_York]", "-0400"],
    ["XXX", "2026-07-13T09:30:00-04:00[America/New_York]", "-04:00"],
    ["ZZ", "2026-07-13T09:30:00-04:00[America/New_York]", "-04:00"],
  ])("%s on a whole-hour offset → %s", (pattern, iso, expected) => {
    expect(format(at(iso), pattern)).toBe(expected);
  });

  it("renders UTC as Z for every X form but not for ZZ", () => {
    const utc = at("2026-07-13T09:30:00+00:00[UTC]");
    expect(format(utc, "X")).toBe("Z");
    expect(format(utc, "XX")).toBe("Z");
    expect(format(utc, "XXX")).toBe("Z");
    expect(format(utc, "ZZ")).toBe("+00:00");
  });

  it("widens X to ±HHMM when the offset has minutes", () => {
    const kolkata = at("2026-07-13T09:30:00+05:30[Asia/Kolkata]");
    expect(format(kolkata, "X")).toBe("+0530");
    expect(format(kolkata, "XX")).toBe("+0530");
    expect(format(kolkata, "XXX")).toBe("+05:30");
  });

  it("rejects X on a type with no offset", () => {
    expect(() => format(Temporal.PlainDateTime.from("2026-07-13T09:30"), "X")).toThrow(FormatError);
  });

  it("rejects XXXX", () => {
    expect(() => format(at("2026-07-13T09:30:00+00:00[UTC]"), "XXXX")).toThrow(InvalidPatternError);
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
