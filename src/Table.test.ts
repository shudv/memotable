import { describe, it, expect, vi } from "vitest";
import { Table } from "./Table";

// Test item types
type ITask = { title: string };
type ICategoryItem = { id: string; category: string };
type IPerson = { name: string; age: number };

describe("Table", () => {
    describe("Basic Operations", () => {
        it("should get and set items", () => {
            const table = new Table<ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });
            table.set("3", { title: "Task Three" });

            expect(table.get("1")?.title).toEqual("Task One");
            expect(table.ids()).toEqual(["1", "2", "3"]);
            expect(table.items().length).toEqual(3);
        });

        it("should return null for non-existent items", () => {
            const table = new Table<ITask>();
            expect(table.get("non-existent")).toBeNull();
        });

        it("should delete items when set to null", () => {
            const table = new Table<ITask>();
            table.set("1", { title: "Task One" });
            table.set("1", null); // Delete item

            expect(table.get("1")).toBeNull();
        });

        it("should return all items", () => {
            const table = new Table<ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            const allItems = table.items();
            expect(allItems.length).toBe(2);
            expect(allItems).toEqual(
                expect.arrayContaining([{ title: "Task One" }, { title: "Task Two" }]),
            );
        });

        it("should return all ids", () => {
            const table = new Table<ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            expect(table.ids()).toEqual(["1", "2"]);
        });

        it("should handle batch operations", () => {
            const table = new Table<ITask>();

            let changed = table.batch((t) => {
                t.set("1", { title: "Task One*" });
                t.set("2", { title: "Task Two*" });
                t.set("3", null);
                t.set("4", { title: "Task Four*" });
            });

            expect(changed).toBe(true);
            expect(table.get("1")!.title).toEqual("Task One*");
            expect(table.get("2")!.title).toEqual("Task Two*");
            expect(table.get("3")).toBeNull();
            expect(table.get("4")!.title).toEqual("Task Four*");

            // Duplicate execution should not change the table
            changed = table.batch((t) => {
                t.set("1", { title: "Task One*" });
                t.set("2", { title: "Task Two*" });
                t.set("3", null);
                t.set("4", { title: "Task Four*" });
            });
            expect(changed).toBe(true);
        });
    });

    describe("Subscriptions", () => {
        it("should notify subscribers on changes", () => {
            const table = new Table<ITask>();

            const callback = vi.fn();
            table.subscribe(callback);

            table.set("1", { title: "Task One" });
            expect(callback).toHaveBeenCalledWith(["1"]);

            table.set("2", { title: "Task Two" });
            expect(callback).toHaveBeenCalledWith(["2"]);
        });

        it("should allow unsubscribing", () => {
            const table = new Table<ITask>();

            const callback = vi.fn();
            const unsubscribe = table.subscribe(callback);

            table.set("1", { title: "Task One" });
            expect(callback).toHaveBeenCalledWith(["1"]);

            unsubscribe();

            table.set("2", { title: "Task Two" });
            expect(callback).toHaveBeenCalledTimes(1); // No new calls after unsubscribe
        });

        it("should notify with delta after batch operations", () => {
            const table = new Table<ITask>();

            const callback = vi.fn();
            table.subscribe(callback);

            table.batch((t) => {
                t.set("1", { title: "Task One" });
                t.set("2", { title: "Task Two" });
                t.set("3", { title: "Task Three" });
            });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it("should notify subscribers on bucket changes", () => {
            const table = new Table<ICategoryItem>();
            table.index((item) => item.category);

            table.set("1", { id: "1", category: "A" });

            const bucketA = table.partition("A");
            const listener = vi.fn();
            bucketA.subscribe(listener);

            table.set("2", { id: "2", category: "A" });
            expect(listener).toHaveBeenCalled();
        });
    });

    describe("Sorting", () => {
        it("should sort items by comparator", () => {
            const table = new Table<IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);

            expect(table.ids()).toEqual(["2", "1", "3"]);
        });

        it("should clear sort when comparator is null", () => {
            const table = new Table<IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            table.sort((a, b) => a.age - b.age);
            table.sort(null);

            table.set("0", { name: "Someone", age: 35 });

            // Not a full proof test but will typically be true
            expect(table.ids().at(-1)).not.toEqual("0");
        });

        it("should update sorted view when items are modified", () => {
            const table = new Table<IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);
            expect(table.ids()).toEqual(["2", "1", "3"]);

            // Update an item to trigger view update
            table.set("2", { name: "Bob", age: 40 });
            expect(table.ids()).toEqual(["1", "3", "2"]);
        });

        it("should handle items removed from sorted view", () => {
            const table = new Table<IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);

            table.set("2", null); // Delete middle item
            expect(table.ids()).toEqual(["1", "3"]);
        });

        it("should handle adding new items to sorted view", () => {
            const table = new Table<IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);

            table.set("2", { name: "Bob", age: 25 }); // Add new item
            expect(table.ids()).toEqual(["2", "1", "3"]);
        });

        it("should notify listeners when sort is applied", () => {
            const table = new Table<IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            const listener = vi.fn();
            table.subscribe(listener);

            table.sort((a, b) => a.age - b.age);
            expect(listener).toHaveBeenCalledWith([]);
        });

        it("should notify listeners when sort is cleared", () => {
            const table = new Table<IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.sort((a, b) => a.age - b.age);

            const listener = vi.fn();
            table.subscribe(listener);

            table.sort(null);
            expect(listener).toHaveBeenCalledWith([]);
        });
    });

    describe("Indexing", () => {
        it("should create buckets based on index definition", () => {
            const table = new Table<ICategoryItem>();
            table.set("1", { id: "1", category: "A" });
            table.set("2", { id: "2", category: "B" });
            table.set("3", { id: "3", category: "A" });

            table.index((item) => item.category);

            expect(table.partitions()).toContain("A");
            expect(table.partitions()).toContain("B");
            expect(table.partition("A").ids()).toEqual(["1", "3"]);
            expect(table.partition("B").ids()).toEqual(["2"]);
        });

        it("should update buckets when items change", () => {
            const table = new Table<ICategoryItem>();
            table.index((item) => item.category);

            table.set("1", { id: "1", category: "A" });
            expect(table.partition("A").ids()).toEqual(["1"]);

            table.set("1", { id: "1", category: "B" });
            expect(table.partition("A").ids()).toEqual([]);
            expect(table.partition("B").ids()).toEqual(["1"]);
        });

        it("should support multi-value index definitions", () => {
            const table = new Table<{ id: string; tags: string[] }>();
            table.index((item) => item.tags);

            table.set("1", { id: "1", tags: ["red", "blue"] });
            table.set("2", { id: "2", tags: ["blue", "green"] });

            expect(table.partition("red").ids()).toEqual(["1"]);
            expect(table.partition("blue").ids()).toEqual(["1", "2"]);
            expect(table.partition("green").ids()).toEqual(["2"]);
        });

        it("should clear index when definition is null", () => {
            const table = new Table<ICategoryItem>();
            table.set("1", { id: "1", category: "A" });
            table.index((item) => item.category);

            expect(table.partitions()).toContain("A");

            table.index(null);
            expect(table.partitions()).toEqual([]);
        });

        it("should return empty table for non-existent bucket", () => {
            const table = new Table<ICategoryItem>();
            table.index((item) => item.category);

            const bucket = table.partition("NonExistent");
            expect(bucket.ids()).toEqual([]);
        });

        it("should handle null items in index definition", () => {
            const table = new Table<ICategoryItem>();
            table.index((item) => item.category);

            table.set("1", { id: "1", category: "A" });
            expect(table.partition("A").ids()).toEqual(["1"]);

            table.set("1", null);
            expect(table.partition("A").ids()).toEqual([]);
        });

        it("should handle undefined return from index definition", () => {
            const table = new Table<{ id: string; category?: string }>();
            table.index((item) => item.category);

            table.set("1", { id: "1" }); // No category
            table.set("2", { id: "2", category: "A" });

            expect(table.partitions()).toEqual(["A"]);
            expect(table.partition("A").ids()).toEqual(["2"]);
        });

        it("should handle null return from index definition", () => {
            const table = new Table<{ id: string; category: string | null }>();
            table.index((item) => item.category ?? undefined);

            table.set("1", { id: "1", category: null });
            table.set("2", { id: "2", category: "A" });

            expect(table.partitions()).toEqual(["A"]);
        });

        it("should auto-create buckets on first access", () => {
            const table = new Table<{ id: string; category: string }>();
            table.index((item) => item.category);

            expect(table.partitions()).toEqual([]);

            table.set("1", { id: "1", category: "A" });
            expect(table.partitions()).toContain("A");
            expect(table.partition("A").ids()).toEqual(["1"]);
        });

        it("should handle batch updates with indexing", () => {
            const table = new Table<ICategoryItem>();
            table.index((item) => item.category);

            table.batch((t) => {
                t.set("1", { id: "1", category: "A" });
                t.set("2", { id: "2", category: "A" });
                t.set("3", { id: "3", category: "B" });
            });

            expect(table.partition("A").ids()).toEqual(["1", "2"]);
            expect(table.partition("B").ids()).toEqual(["3"]);
        });

        it("should handle removing items from multi-value index", () => {
            const table = new Table<{ id: string; tags: string[] }>();
            table.index((item) => item.tags);

            table.set("1", { id: "1", tags: ["red", "blue"] });
            expect(table.partition("red").ids()).toEqual(["1"]);
            expect(table.partition("blue").ids()).toEqual(["1"]);

            table.set("1", { id: "1", tags: ["green"] });
            expect(table.partition("red").ids()).toEqual([]);
            expect(table.partition("blue").ids()).toEqual([]);
            expect(table.partition("green").ids()).toEqual(["1"]);
        });
    });
});
