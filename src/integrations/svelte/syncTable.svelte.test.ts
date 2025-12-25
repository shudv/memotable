// @vitest-environment jsdom
import { Table } from "../../Table";

interface Task {
    id: string;
    title: string;
    completed: boolean;
}

// Mock Svelte lifecycle and stores
let mountCallback: (() => void) | undefined;
let destroyCallback: (() => void) | undefined;

vi.mock("svelte", () => ({
    onMount: (fn: () => void) => {
        mountCallback = fn;
    },
    onDestroy: (fn: () => void) => {
        destroyCallback = fn;
    },
}));

vi.mock("svelte/store", () => ({
    writable: (initial: number) => ({
        subscribe: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        _value: initial,
    }),
}));

// Import after mocking
import { syncTable } from "./syncTable.svelte";

describe("syncTable (Svelte)", () => {
    let table: Table<string, Task>;

    beforeEach(() => {
        table = new Table<string, Task>();
        mountCallback = undefined;
        destroyCallback = undefined;
    });

    describe("subscription", () => {
        test("subscribes to table on mount", () => {
            const subscribeSpy = vi.spyOn(table, "subscribe");

            syncTable(table);
            mountCallback?.();

            expect(subscribeSpy).toHaveBeenCalledTimes(1);
        });

        test("unsubscribes on destroy", () => {
            const unsubscribeMock = vi.fn();
            vi.spyOn(table, "subscribe").mockReturnValue(unsubscribeMock);

            syncTable(table);
            mountCallback?.();
            destroyCallback?.();

            expect(unsubscribeMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("memoization", () => {
        test("memoizes by default on mount", () => {
            const memoSpy = vi.spyOn(table, "memo");

            syncTable(table);
            mountCallback?.();

            expect(memoSpy).toHaveBeenCalledWith(true);
        });

        test("allows opt-out of memoization", () => {
            const memoSpy = vi.spyOn(table, "memo");

            syncTable(table, false);
            mountCallback?.();

            expect(memoSpy).toHaveBeenCalledWith(false);
        });

        test("unmemoizes on destroy", () => {
            const memoSpy = vi.spyOn(table, "memo");

            syncTable(table);
            mountCallback?.();
            destroyCallback?.();

            expect(memoSpy).toHaveBeenLastCalledWith(false);
        });
    });

    describe("reactivity", () => {
        test("returns a Svelte writable store", () => {
            const result = syncTable(table);

            expect(result).toHaveProperty("subscribe");
            expect(result).toHaveProperty("set");
            expect(result).toHaveProperty("update");
        });
    });
});
