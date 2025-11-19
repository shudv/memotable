import "vitest";

declare module "vitest" {
    interface Assertion {
        toYield<T>(expected: readonly T[]): void;
        toYieldOrdered<T>(expected: readonly T[]): void;
    }

    interface AsymmetricMatchersContaining {
        toYield<T>(expected: readonly T[]): void;
        toYieldOrdered<T>(expected: readonly T[]): void;
    }
}
