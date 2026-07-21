import type { ParseOptions, TemporalProvider } from "./types.js";
import { ParseError } from "./errors.js";

/**
 * Resolve the Temporal implementation used to *construct* parsed values.
 *
 * `format` never needs this (it only reads fields off a value you already hold), so
 * only `parse` calls it. Preference order:
 *   1. an explicitly supplied `{ temporal }` (any native/polyfill Temporal namespace),
 *   2. the host's native `globalThis.Temporal` (Node 26+ / modern browsers).
 * If neither exists we fail loudly with the exact fix — this keeps the package
 * dependency-free while still working everywhere.
 */
export function resolveTemporal(options?: ParseOptions): TemporalProvider {
  const provided = options?.temporal;
  if (provided) return provided;

  const globalTemporal = (globalThis as { Temporal?: unknown }).Temporal;
  if (globalTemporal) return globalTemporal as TemporalProvider;

  throw new ParseError(
    "No Temporal implementation available to construct the result. On a runtime " +
      "without native Temporal (Node < 26), pass one explicitly, e.g.:\n" +
      '  import { Temporal } from "@js-temporal/polyfill";\n' +
      '  parse(input, pattern, target, { temporal: Temporal });',
  );
}
