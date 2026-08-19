/**
 * Executable proof for every snippet in the README's "Recipes" and
 * "Calendars — current limitation" sections. If a recipe changes, this fails.
 */
import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { format } from "../src/format.js";
import { parse } from "../src/parse.js";
import { ParseError } from "../src/errors.js";
import type { TemporalProvider } from "../src/types.js";

const opts = { temporal: Temporal as unknown as TemporalProvider };

describe("recipe 1 — compact yyyyMMdd", () => {
  it("parses and formats a separator-less date", () => {
    expect(parse("20260713", "yyyyMMdd", "PlainDate", opts).toString()).toBe("2026-07-13");
    expect(format(Temporal.PlainDate.from("2026-07-13"), "yyyyMMdd")).toBe("20260713");
  });

  it("parses a compact date-time used in log filenames", () => {
    const dt = parse("20260713T093000", "yyyyMMdd'T'HHmmss", "PlainDateTime", opts);
    expect(dt.toString()).toBe("2026-07-13T09:30:00");
  });
});

describe("recipe 2 — LDAP / X.509 generalized time", () => {
  it("parses to PlainDateTime, then attaches UTC", () => {
    const local = parse("20260713093000Z", "yyyyMMddHHmmss'Z'", "PlainDateTime", opts);
    expect(local.toZonedDateTime("UTC").toString()).toBe("2026-07-13T09:30:00+00:00[UTC]");
  });

  it("parses the optional fractional second", () => {
    const dt = parse("20260713093000.5Z", "yyyyMMddHHmmss'.'S'Z'", "PlainDateTime", opts);
    expect(dt.toString()).toBe("2026-07-13T09:30:00.5");
  });

  it("rejects an offset token on a PlainDateTime (why the recipe uses a literal 'Z')", () => {
    expect(() => parse("20260713093000Z", "yyyyMMddHHmmssX", "PlainDateTime", opts)).toThrow(ParseError);
  });
});

describe("recipe 3 — migrating from Luxon fromFormat", () => {
  it("reads the same token spellings into Temporal types", () => {
    expect(parse("07/13/2026", "MM/dd/yyyy", "PlainDate", opts).toString()).toBe("2026-07-13");
    expect(parse("2026-07-13 14:05:09", "yyyy-MM-dd HH:mm:ss", "PlainDateTime", opts).toString()).toBe(
      "2026-07-13T14:05:09",
    );
  });

  it("throws instead of returning an invalid value", () => {
    expect(() => parse("2026-02-30", "yyyy-MM-dd", "PlainDate", opts)).toThrow(ParseError);
  });
});

describe("recipe 4 — migrating from date-fns", () => {
  it("needs no reference date", () => {
    expect(parse("13.07.2026", "dd.MM.yyyy", "PlainDate", opts).toString()).toBe("2026-07-13");
    expect(format(Temporal.PlainDate.from("2026-07-13"), "yyyy-MM-dd")).toBe("2026-07-13");
  });

  it("errors on a pattern that omits a required field instead of defaulting it", () => {
    expect(() => parse("07/2026", "MM/yyyy", "PlainDate", opts)).toThrow(ParseError);
  });
});

describe("recipe 5 — zoned timestamps at nanosecond precision", () => {
  const pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSSZZ'['VV']'";
  const zdt = Temporal.ZonedDateTime.from("2026-07-13T09:30:00.123456789-04:00[America/New_York]");

  it("round-trips offset, IANA zone id and all nine fractional digits", () => {
    const s = format(zdt, pattern);
    expect(s).toBe("2026-07-13T09:30:00.123456789-04:00[America/New_York]");
    expect(parse(s, pattern, "ZonedDateTime", opts).equals(zdt)).toBe(true);
  });

  it("cannot build a ZonedDateTime without VV", () => {
    expect(() =>
      parse("2026-07-13T09:30:00-04:00", "yyyy-MM-dd'T'HH:mm:ssZZ", "ZonedDateTime", opts),
    ).toThrow(ParseError);
  });
});

describe("calendars — documented limitation", () => {
  const hebrew = Temporal.PlainDate.from("2026-07-13").withCalendar("hebrew");

  it("formats a non-ISO value using that calendar's own field numbers", () => {
    expect(format(hebrew, "yyyy-MM-dd")).toBe("5786-10-28");
  });

  it("always parses back into the ISO calendar, so the round trip is lossy", () => {
    const back = parse("5786-10-28", "yyyy-MM-dd", "PlainDate", opts);
    expect(back.calendarId).toBe("iso8601");
    expect(back.toString()).toBe("5786-10-28");
    expect(back.equals(hebrew)).toBe(false);
  });

  it("round-trips exactly when you convert to ISO first and re-apply the calendar", () => {
    const s = format(hebrew.withCalendar("iso8601"), "yyyy-MM-dd");
    expect(s).toBe("2026-07-13");
    expect(parse(s, "yyyy-MM-dd", "PlainDate", opts).withCalendar("hebrew").equals(hebrew)).toBe(true);
  });
});
