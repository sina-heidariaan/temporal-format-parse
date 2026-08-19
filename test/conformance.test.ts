/**
 * Runs the public conformance suite in `conformance/cases.json` against this library.
 *
 * The cases are plain data on purpose: any other Temporal token library can be checked
 * against the same file by writing a small adapter. See `conformance/README.md`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Temporal } from "@js-temporal/polyfill";
import { format } from "../src/format.js";
import { parse } from "../src/parse.js";
import { FormatError, InvalidPatternError, ParseError } from "../src/errors.js";
import type { TemporalProvider, TemporalTypeName } from "../src/types.js";

const opts = { temporal: Temporal as unknown as TemporalProvider };

type Case = {
  id: string;
  group: string;
  op: "parse" | "format" | "roundtrip";
  input?: string;
  from?: { type: TemporalTypeName; iso: string; calendar?: string };
  pattern: string;
  target?: TemporalTypeName;
  expect: {
    value?: string;
    output?: string;
    equals?: boolean;
    calendar?: string;
    throws?: "ParseError" | "FormatError" | "InvalidPatternError";
  };
  why?: string;
};

const suite = JSON.parse(
  readFileSync(fileURLToPath(new URL("../conformance/cases.json", import.meta.url)), "utf8"),
) as { version: number; groups: Record<string, string>; cases: Case[] };

/** Build the starting Temporal value for a `format` or `roundtrip` case. */
function materialize(from: NonNullable<Case["from"]>): any {
  const ctor = (Temporal as any)[from.type];
  const value = ctor.from(from.iso);
  return from.calendar ? value.withCalendar(from.calendar) : value;
}

const errorFor = { ParseError, FormatError, InvalidPatternError } as const;

function runCase(c: Case): void {
  if (c.expect.throws) {
    const expected = errorFor[c.expect.throws];
    expect(() => execute(c)).toThrow(expected);
    return;
  }
  const result = execute(c);

  if (c.op === "format") {
    expect(result).toBe(c.expect.output);
    return;
  }
  if (c.op === "parse") {
    expect(String(result)).toBe(c.expect.value);
    if (c.expect.calendar) expect((result as any).calendarId).toBe(c.expect.calendar);
    return;
  }
  // roundtrip: format produced `output`, and parsing it returns an equal value.
  const { text, back, original } = result as { text: string; back: any; original: any };
  expect(text).toBe(c.expect.output);
  if (c.expect.equals) expect(back.equals(original)).toBe(true);
}

function execute(c: Case): any {
  if (c.op === "format") {
    return format(materialize(c.from!), c.pattern);
  }
  if (c.op === "parse") {
    return parse(c.input!, c.pattern, c.target!, opts);
  }
  const original = materialize(c.from!);
  const text = format(original, c.pattern);
  const back = parse(text, c.pattern, c.target!, opts);
  return { text, back, original };
}

// Every case must have a unique id — ids are how other projects reference a case.
it("case ids are unique", () => {
  const ids = suite.cases.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it("every case belongs to a declared group", () => {
  for (const c of suite.cases) expect(Object.keys(suite.groups)).toContain(c.group);
});

for (const group of Object.keys(suite.groups)) {
  const cases = suite.cases.filter((c) => c.group === group);
  describe(`conformance / ${group} — ${suite.groups[group]}`, () => {
    it.each(cases.map((c) => [c.id, c] as const))("%s", (_id, c) => runCase(c));
  });
}
