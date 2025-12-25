// @vitest-environment jsdom
import { Table } from "../../Table";

interface Task {
    id: string;
    title: string;
    completed: boolean;
}

// Mock Solid primitives
let mountCallback: (() => void) | undefined;
let cleanupCallback: (() => void) | undefined;

vi.mock("solid-js", () => ({
    createSignal: (initial: number) => [() => initial, vi.fn()],
    onMount: (fn: () => void) => {
        mountCallback = fn;
    },
    onCleanup: (fn: () => void) => {
        cleanupCallback = fn;
    },
}));

// Import after mocking
import { createTableSignal } from "./createTableSignal";

describe("createTableSignal (Solid)", () => {
    let table: Table<string, Task>;

    beforeEach(() => {
        table = new Table<string, Task>();
        mountCallback = undefined;
        cleanupCallback = undefined;
    });

    describe("subscription", () => {
        test("subscribes to table on mount", () => {
            const subscribeSpy = vi.spyOn(table, "subscribe");

            createTableSignal(table);
            mountCallback?.();

            expect(subscribeSpy).toHaveBeenCalledTimes(1);
        });

        test("unsubscribes on cleanup", () => {
            const unsubscribeMock = vi.fn();
            vi.spyOn(table, "subscribe").mockReturnValue(unsubscribeMock);

            createTableSignal(table);
            mountCallback?.();
            cleanupCallback?.();

            expect(unsubscribeMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("memoization", () => {
        test("memoizes by default on mount", () => {
            const memoSpy = vi.spyOn(table, "memo");

            createTableSignal(table);
            mountCallback?.();

            expect(memoSpy).toHaveBeenCalledWith(true);
        });

        test("allows opt-out of memoization", () => {
            const memoSpy = vi.spyOn(table, "memo");

            createTableSignal(table, false);
            mountCallback?.();

            expect(memoSpy).toHaveBeenCalledWith(false);
        });

        test("unmemoizes on cleanup", () => {
            const memoSpy = vi.spyOn(table, "memo");

            createTableSignal(table);
            mountCallback?.();
            cleanupCallback?.();

            expect(memoSpy).toHaveBeenLastCalledWith(false);
        });
    });

    describe("signal", () => {
        test("returns a signal accessor function", () => {
            const version = createTableSignal(table);

            expect(typeof version).toBe("function");
        });
    });
});
