// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { Table } from "../../Table";
import { useTable } from "./useTable";

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

    test("triggers re-render on item update", () => {
        let renderCount = 0;

        table.set("task-1", { id: "task-1", title: "Original", completed: false });

        renderHook(() => {
            renderCount++;
            useTable(table);
        });

        const initialCount = renderCount;

        act(() => {
            table.set("task-1", { id: "task-1", title: "Updated", completed: false });
        });

        expect(renderCount).toBe(initialCount + 1);
    });

    test("triggers re-render on item deletion", () => {
        let renderCount = 0;

        table.set("task-1", { id: "task-1", title: "Test", completed: false });

        renderHook(() => {
            renderCount++;
            useTable(table);
        });

        const initialCount = renderCount;

        act(() => {
            table.set("task-1", null);
        });

        expect(renderCount).toBe(initialCount + 1);
    });

    test("does not trigger re-render after unmount", () => {
        let renderCount = 0;

        const { unmount } = renderHook(() => {
            renderCount++;
            useTable(table);
        });

        const countBeforeUnmount = renderCount;

        unmount();

        table.set("task-1", { id: "task-1", title: "Test", completed: false });

        expect(renderCount).toBe(countBeforeUnmount);
    });

    test("batch updates trigger single re-render", () => {
        let renderCount = 0;

        renderHook(() => {
            renderCount++;
            useTable(table);
        });

        const initialCount = renderCount;

        act(() => {
            table.runBatch(() => {
                table.set("task-1", { id: "task-1", title: "Task 1", completed: false });
                table.set("task-2", { id: "task-2", title: "Task 2", completed: false });
                table.set("task-3", { id: "task-3", title: "Task 3", completed: false });
            });
        });

        expect(renderCount).toBe(initialCount + 1);
    });

    test("triggers re-render on applying filter or comparator", () => {
        let renderCount = 0;

        renderHook(() => {
            renderCount++;
            useTable(table);
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
