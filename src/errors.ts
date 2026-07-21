/**
 * Error types. All extend `RangeError` (the class Temporal itself throws for
 * out-of-range/invalid values) and set `this.name`, so callers can branch on
 * `err.name` or `instanceof` without importing anything they don't already handle.
 */

/** Thrown when a pattern string is malformed (unterminated quote, unsupported token). */
export class InvalidPatternError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPatternError";
  }
}

/** Thrown by {@link format} when a value can't be formatted with the given pattern. */
export class FormatError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "FormatError";
  }
}

/** Thrown by {@link parse} when input doesn't match, or required fields are missing. */
export class ParseError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}
