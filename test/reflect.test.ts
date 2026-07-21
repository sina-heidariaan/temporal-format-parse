import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { getTemporalType, isTemporal } from "../src/reflect.js";

describe("getTemporalType", () => {
  it.each<[string, unknown]>([
    ["Instant", Temporal.Instant.fromEpochMilliseconds(0)],
    ["PlainDate", Temporal.PlainDate.from("2026-07-13")],
    ["PlainTime", Temporal.PlainTime.from("12:34")],
    ["PlainDateTime", Temporal.PlainDateTime.from("2026-07-13T12:34")],
    ["PlainYearMonth", Temporal.PlainYearMonth.from("2026-07")],
    ["PlainMonthDay", Temporal.PlainMonthDay.from("07-13")],
    ["ZonedDateTime", Temporal.ZonedDateTime.from("2026-07-13T12:34[UTC]")],
    ["Duration", Temporal.Duration.from({ hours: 1 })],
  ])("identifies %s", (name, value) => {
    expect(getTemporalType(value)).toBe(name);
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["undefined", undefined],
    ["number", 42],
    ["string", "2026-07-13"],
    ["plain object", { foo: 1 }],
    ["Date", new Date()],
    ["object with a fake tag", { [Symbol.toStringTag]: "Temporal.Nope" }],
  ])("returns undefined for %s", (_label, value) => {
    expect(getTemporalType(value)).toBeUndefined();
  });
});

describe("isTemporal", () => {
  it("is true for Temporal values and false otherwise", () => {
    expect(isTemporal(Temporal.PlainDate.from("2026-07-13"))).toBe(true);
    expect(isTemporal(Temporal.Duration.from({ hours: 1 }))).toBe(true);
    expect(isTemporal(new Date())).toBe(false);
    expect(isTemporal("2026-07-13")).toBe(false);
    expect(isTemporal(null)).toBe(false);
  });
});
