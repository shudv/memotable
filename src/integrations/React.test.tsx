// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { Table } from "../Table";
import { useTable } from "./React";

interface Task {
    id: string;
    title: string;
    completed: boolean;
}

describe("useTable", () => {
    let table: Table<Task>;

    beforeEach(() => {
        table = new Table<Task>();
    });

    test("returns items from table", () => {
        table.set("task-1", { id: "task-1", title: "Test", completed: false });

        const { result } = renderHook(() => useTable(table));

        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toEqual({ id: "task-1", title: "Test", completed: false });
    });

    test("triggers re-render when table changes", () => {
        const { result } = renderHook(() => useTable(table));

        expect(result.current).toHaveLength(0);

        act(() => {
            table.set("task-1", { id: "task-1", title: "Test", completed: false });
        });

        expect(result.current).toHaveLength(1);
    });

    test("triggers re-render on item update", () => {
        table.set("task-1", { id: "task-1", title: "Original", completed: false });

        const { result } = renderHook(() => useTable(table));

        expect(result.current[0]?.title).toBe("Original");

        act(() => {
            table.set("task-1", { id: "task-1", title: "Updated", completed: false });
        });

        expect(result.current[0]?.title).toBe("Updated");
    });

    test("triggers re-render on item deletion", () => {
        table.set("task-1", { id: "task-1", title: "Test", completed: false });

        const { result } = renderHook(() => useTable(table));

        expect(result.current).toHaveLength(1);

        act(() => {
            table.set("task-1", null);
        });

        expect(result.current).toHaveLength(0);
    });

    test("does not trigger re-render after unmount", () => {
        const { result, unmount } = renderHook(() => useTable(table));

        const itemsBeforeUnmount = result.current;

        unmount();

        act(() => {
            table.set("task-1", { id: "task-1", title: "Test", completed: false });
        });

        // Items should remain the same since component unmounted
        expect(itemsBeforeUnmount).toHaveLength(0);
    });

    test("batch updates trigger single re-render", () => {
        let renderCount = 0;

        renderHook(() => {
            renderCount++;
            return useTable(table);
        });

        const initialCount = renderCount;

        act(() => {
            table.runBatch(() => {
                table.set("task-1", { id: "task-1", title: "Task 1", completed: false });
                table.set("task-2", { id: "task-2", title: "Task 2", completed: false });
                table.set("task-3", { id: "task-3", title: "Task 3", completed: false });
            });
        });

        // Should only trigger one additional render for the batch
        expect(renderCount).toBe(initialCount + 1);
    });

    test("should trigger on applying filter or comparator", () => {
        let renderCount = 0;

        renderHook(() => {
            renderCount++;
            return useTable(table);
        });

        const initialCount = renderCount;

        act(() => {
            table.applyFilter((item) => item.completed === false);
        });

        expect(renderCount).toBe(initialCount + 1);

        act(() => {
            table.applyComparator((a, b) => a.title.localeCompare(b.title));
        });

        expect(renderCount).toBe(initialCount + 2);
    });
});
