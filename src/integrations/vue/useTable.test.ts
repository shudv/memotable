// @vitest-environment jsdom
import { Table } from "../../Table";

interface Task {
    id: string;
    title: string;
    completed: boolean;
}

// Mock Vue's lifecycle hooks and reactivity
let mountedCallback: (() => void) | undefined;
let unmountedCallback: (() => void) | undefined;

vi.mock("vue", () => ({
    shallowRef: (initial: number) => ({ value: initial }),
    triggerRef: vi.fn(),
    onMounted: (fn: () => void) => {
        mountedCallback = fn;
    },
    onUnmounted: (fn: () => void) => {
        unmountedCallback = fn;
    },
}));

// Import after mocking
import { useTable } from "./useTable";

describe("useTable (Vue)", () => {
    let table: Table<string, Task>;

    beforeEach(() => {
        table = new Table<string, Task>();
        mountedCallback = undefined;
        unmountedCallback = undefined;
    });

    describe("subscription", () => {
        test("subscribes to table on mount", () => {
            const subscribeSpy = vi.spyOn(table, "subscribe");

            useTable(table);
            mountedCallback?.();

            expect(subscribeSpy).toHaveBeenCalledTimes(1);
        });

        test("unsubscribes on unmount", () => {
            const unsubscribeMock = vi.fn();
            vi.spyOn(table, "subscribe").mockReturnValue(unsubscribeMock);

            useTable(table);
            mountedCallback?.();
            unmountedCallback?.();

            expect(unsubscribeMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("memoization", () => {
        test("memoizes by default on mount", () => {
            const memoSpy = vi.spyOn(table, "memo");

            useTable(table);
            mountedCallback?.();

            expect(memoSpy).toHaveBeenCalledWith(true);
        });

        test("allows opt-out of memoization", () => {
            const memoSpy = vi.spyOn(table, "memo");

            useTable(table, false);
            mountedCallback?.();

            expect(memoSpy).toHaveBeenCalledWith(false);
        });

        test("unmemoizes on unmount", () => {
            const memoSpy = vi.spyOn(table, "memo");

            useTable(table);
            mountedCallback?.();
            unmountedCallback?.();

            expect(memoSpy).toHaveBeenLastCalledWith(false);
        });
    });

    describe("reactivity", () => {
        test("returns a reactive trigger ref", () => {
            const trigger = useTable(table);

            expect(trigger).toHaveProperty("value");
        });
    });
});
