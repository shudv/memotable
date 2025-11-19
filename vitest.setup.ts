import { expect } from "vitest";

expect.extend({
    toYield<T>(received: Iterable<T>, expected: T[]) {
        return this.equals(Array.from(received).sort(), expected.sort())
            ? {
                  message: () => `expected ${received} not to yield ${expected}`,
                  pass: true,
              }
            : {
                  message: () => `expected ${received} to yield ${expected}`,
                  pass: false,
              };
    },

    toYieldOrdered<T>(received: Iterable<T>, expected: T[]) {
        return this.equals(
            isIterable(received) && typeof received !== "string" ? Array.from(received) : received,
            expected,
        )
            ? {
                  message: () => `expected ${received} not to yield ${expected}`,
                  pass: true,
              }
            : {
                  message: () => `expected ${received} to yield ${expected}`,
                  pass: false,
              };
    },
});

function isIterable<T>(obj: Iterable<T>) {
    return obj != null && typeof obj[Symbol.iterator] === "function";
}
