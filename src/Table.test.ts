import { Table } from "./Table";

// Test value types
type ITask = { title: string; priority?: number };
type ITaggedValue = { tags: string[] };
type IPerson = { name: string; age: number };
type INode = { id: string; parent?: INode };

describe("Table", () => {
    describe("Basic Operations", () => {
        test("set() and get()", () => {
            const table = createTable<string, ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });
            table.set("3", { title: "Task Three" });

            expect(table.get("1")?.title).toEqual("Task One");
            expect(table.keys()).toYieldOrdered(["1", "2", "3"]);
            expect(table.size).toEqual(3);
        });

        test("delete() - should remove value", () => {
            const table = createTable<string, ITask>();

            table.set("1", { title: "Task One" });
            expect(table.delete("1")).toBe(true);
            expect(table.delete("1")).toBe(false); // No-op
            expect(table.delete("1")).toBe(false); // No-op

            expect(table.get("1")).toBeUndefined();
        });

        test("values() - should return all values", () => {
            const table = createTable<string, ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            expect(table.size).toBe(2);
            expect(table.values()).toYield([{ title: "Task One" }, { title: "Task Two" }]);
        });

        test("keys() - should return all keys", () => {
            const table = createTable<string, ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            expect(table.keys()).toYield(["1", "2"]);
        });

        test("size - should return the number of items in the table", () => {
            const table = createTable<string, ITask>();
            expect(table.size).toBe(0);

            table.set("1", { title: "Task One" });
            expect(table.size).toBe(1);

            table.set("2", { title: "Task Two" });
            expect(table.size).toBe(2);

            table.delete("1");
            expect(table.size).toBe(1);

            table.delete("2");
            expect(table.size).toBe(0);
        });

        test("has() - should check for existence of a key", () => {
            const table = createTable<string, ITask>();
            expect(table.has("1")).toBe(false);
            table.set("1", { title: "Task One" });
            expect(table.has("1")).toBe(true);
            expect(table.has("2")).toBe(false);
        });

        test("entries() - should return all key/value pairs", () => {
            const table = createTable<string, ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            expect(table.entries()).toYield([
                ["1", { title: "Task One" }],
                ["2", { title: "Task Two" }],
            ]);
        });

        test("default iterator - should iterate over key/value pairs", () => {
            const table = createTable<string, ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            const entries: [string, ITask][] = [];
            for (const entry of table) {
                entries.push(entry);
            }
            expect(entries).toEqual([
                ["1", { title: "Task One" }],
                ["2", { title: "Task Two" }],
            ]);
        });

        test("clear() - should remove all items and clear indexing and sorting", () => {
            const table = createTable<string, ITask>();

            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            table.sort((a, b) => a.title.localeCompare(b.title));
            table.index((value) => value.title.split(" "));

            expect(table.partition("Task").size).toBe(2);
            expect(table.partition("Task").values()).toYield([
                { title: "Task One" },
                { title: "Task Two" },
            ]);

            table.clear();
            expect(table.size).toBe(0);

            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });
            table.set("3", { title: "Task Three" });

            // indexing and ordering should not work after clear
            expect(table.partition("Task").size).toBe(0);
            expect(table.partition("Task").values()).toYield([]);
        });
    });

    describe("Subscriptions", () => {
        test("subscribe() - should notify on changes", () => {
            const table = createTable<string, ITask>();

            const callback = vi.fn();
            table.subscribe(callback);

            table.batch((t) => {
                t.set("1", { title: "Task One" });
                t.set("2", { title: "Task Two" });
            });
            expect(callback).toHaveBeenCalledWith(["1", "2"]);
            callback.mockClear();

            table.delete("1");
            expect(callback).toHaveBeenCalledWith(["1"]);
            callback.mockClear();

            table.delete("1"); // No-op delete
            expect(callback).not.toHaveBeenCalledWith(["1"]);
            callback.mockClear();

            table.clear();
            expect(callback).toHaveBeenCalledWith(["2"]);
            callback.mockClear();
        });

        test("unsubscription - should stop notifications after unsubscribe", () => {
            const table = createTable<string, ITask>();

            const callback = vi.fn();
            const unsubscribe = table.subscribe(callback);

            table.set("1", { title: "Task One" });
            expect(callback).toHaveBeenCalledWith(["1"]);

            unsubscribe();

            table.set("2", { title: "Task Two" });
            expect(callback).toHaveBeenCalledTimes(1); // No new calls after unsubscribe
        });

        test("notification deltas should contain all modified keys", () => {
            const table = createTable<string, ITask>();

            const callback = vi.fn();
            table.subscribe(callback);

            table.batch((t) => {
                t.set("1", { title: "Task One" });
                t.set("2", { title: "Task Two" });
                t.set("3", { title: "Task Three" });
            });

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(["1", "2", "3"]);
        });

        test("nested subscriptions", () => {
            const table = createTable<string, ITaggedValue>();
            table.index((value) => value.tags);

            const callback = vi.fn();

            // Subscribe to a partition
            table.partition("A").subscribe(callback);

            // Add a value to a different partition
            table.set("1", { tags: ["B"] });

            expect(callback).not.toHaveBeenCalled();

            // Add a value to the subscribed partition
            table.set("2", { tags: ["A"] });

            expect(callback).toHaveBeenCalledWith(["2"]);
        });

        test("multiple subscribers with some unsubscribing", () => {
            const table = createTable<string, ITask>();
            const subscriber1 = vi.fn();
            const subscriber2 = vi.fn();
            const subscriber3 = vi.fn();

            const unsub1 = table.subscribe(subscriber1);
            table.subscribe(subscriber2);
            table.subscribe(subscriber3);

            table.set("1", { title: "Task 1" });
            expect(subscriber1).toHaveBeenCalledTimes(1);
            expect(subscriber2).toHaveBeenCalledTimes(1);
            expect(subscriber3).toHaveBeenCalledTimes(1);

            // Unsubscribe one
            unsub1();

            table.set("2", { title: "Task 2" });
            expect(subscriber1).toHaveBeenCalledTimes(1); // Still 1
            expect(subscriber2).toHaveBeenCalledTimes(2);
            expect(subscriber3).toHaveBeenCalledTimes(2);
        });

        test("subscriber throws an error", () => {
            const table = new Table<string, ITask>();
            const subscriber = vi.fn(() => {
                throw new Error("SubscriberError");
            });

            table.subscribe(subscriber);

            expect(() => {
                table.set("1", { title: "Task 1" });
            }).toThrow();
        });
    });

    describe("Memoization", () => {
        test("memoization toggling multiple times", () => {
            const table = createTable<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.sort((a, b) => a.age - b.age);
            table.index((person) => `${person.age}`);

            // Toggle memoization on and off repeatedly
            for (let i = 0; i < 10; i++) {
                table.memo(true);
                table.memo(false);
            }

            // Should still work correctly
            expect(Array.from(table.values())).toEqual([{ name: "Alice", age: 30 }]);
        });
    });

    describe("Indexing", () => {
        test("should create partitions based on index definition", () => {
            const table = createTable<string, ITaggedValue>();
            table.set("1", { tags: ["A", "B"] });
            table.set("2", { tags: ["B", "C"] });
            table.set("3", { tags: ["C", "D"] });

            table.index((value) => value.tags);

            expect(table.partition("A").keys()).toYield(["1"]);
            expect(table.partition("B").keys()).toYield(["1", "2"]);
            expect(table.partition("C").keys()).toYield(["2", "3"]);
            expect(table.partition("D").keys()).toYield(["3"]);
        });

        test("should ignore partition names with falsy values", () => {
            const table = createTable<string, ITaggedValue>();
            table.set("1", { tags: ["A"] });

            table.index((_) => "");
            expect(Array.from(table.partitions()).length).toEqual(0);

            table.index((_) => null);
            expect(Array.from(table.partitions()).length).toEqual(0);

            table.index((_) => []);
            expect(Array.from(table.partitions()).length).toEqual(0);

            table.index((_) => ["VALID", "", null]);
            expect(Array.from(table.partitions()).length).toEqual(1);
            expect(table.partition("VALID").size).toEqual(1);
        });

        test("partitions() - should return all partition names", () => {
            const table = createTable<string, ITaggedValue>();
            table.set("1", { tags: ["A", "B"] });
            table.set("2", { tags: ["B", "C"] });
            table.set("3", { tags: ["C", "D"] });

            table.index((value) => value.tags);

            // Eagerly access a partition to create it
            table.partition("E").sort(() => 0);

            expect(Array.from(table.partitions()).map(([key]) => key)).toEqual([
                "A",
                "B",
                "C",
                "D",
                "E",
            ]); // Should include empty "E" partition
        });

        test("should update partitions correctly when values are added, updated or removed", () => {
            const table = createTable<string, ITaggedValue>();
            table.index((value) => value.tags);

            // Add values
            table.set("1", { tags: ["A", "B"] });
            table.set("2", { tags: ["B", "C"] });

            expect(table.partition("A").keys()).toYield(["1"]);
            expect(table.partition("B").keys()).toYield(["1", "2"]);
            expect(table.partition("C").keys()).toYield(["2"]);

            // Update value
            table.set("2", { tags: ["C", "D"] });

            expect(table.partition("A").keys()).toYield(["1"]);
            expect(table.partition("B").keys()).toYield(["1"]); // 2 removed
            expect(table.partition("C").keys()).toYield(["2"]);
            expect(table.partition("D").keys()).toYield(["2"]);

            // Delete value
            table.delete("1");

            expect(table.partition("A").keys()).toYield([]);
            expect(table.partition("B").keys()).toYield([]);
            expect(table.partition("C").keys()).toYield(["2"]);
            expect(table.partition("D").keys()).toYield(["2"]);
        });

        test("eager subscriptions - should be able to subscribe before a value is added", () => {
            const table = createTable<string, ITaggedValue>();
            table.index((value) => value.tags);

            const callback = vi.fn();

            // Subscribe to a partition
            table.partition("A").subscribe(callback);

            // Add a value to the subscribed partition
            table.set("1", { tags: ["A"] });

            expect(callback).toHaveBeenCalledWith(["1"]);
        });

        test("should return empty table for non-existent partition", () => {
            const table = createTable<string, ITaggedValue>();
            table.index((value) => value.tags);

            const partition = table.partition("NonExistent");
            expect(partition.keys()).toYield([]);
        });

        test("should handle null/undefined values in index definition", () => {
            const table = createTable<string, ITaggedValue>();
            table.index((value) => {
                if (value.tags.includes("IGNORE")) {
                    return null;
                }

                if (value.tags.includes("SKIP")) {
                    return undefined;
                }

                return value.tags;
            });

            table.set("1", { tags: ["A", "IGNORE"] });
            table.set("2", { tags: ["B", "SKIP"] });
            table.set("3", { tags: ["C"] });

            expect(table.partition("A").keys()).toYield([]);
            expect(table.partition("B").keys()).toYield([]);
            expect(table.partition("C").keys()).toYield(["3"]);
        });

        test("should re-index when index definition is changed", () => {
            const table = createTable<string, ITaggedValue>();
            table.set("1", { tags: ["A"] });
            table.set("2", { tags: ["B"] });
            table.set("3", { tags: ["C"] });

            table.index((value) => value.tags);

            expect(table.partition("A").keys()).toYield(["1"]);
            expect(table.partition("B").keys()).toYield(["2"]);
            expect(table.partition("C").keys()).toYield(["3"]);

            // Change index definition
            table.index((value) => value.tags.map((tag) => (tag === "A" ? tag + "*" : tag)));

            expect(table.partition("A").keys()).toYield([]);
            expect(table.partition("A*").keys()).toYield(["1"]); // Re-indexed
            expect(table.partition("B").keys()).toYield(["2"]);
            expect(table.partition("C").keys()).toYield(["3"]);
        });

        test("should delete partitions when index is removed", () => {
            const table = createTable<string, ITaggedValue>();
            table.set("1", { tags: ["A"] });
            table.set("2", { tags: ["B"] });

            table.index((value) => value.tags);

            expect(table.partition("A").keys()).toYield(["1"]);
            expect(table.partition("B").keys()).toYield(["2"]);

            // Remove indexing
            table.index(null);

            expect(table.partition("A").keys()).toYield([]);
            expect(table.partition("B").keys()).toYield([]);
        });

        test("creating filtered views via indexing", () => {
            const table = createTable<string, ITaggedValue>();

            table.set("1", { tags: ["include"] });
            table.set("2", { tags: ["exclude"] });
            table.set("3", { tags: ["include"] });

            // Create a filtered view that only includes values with "include" tag
            table.index((value) => (value.tags.includes("include") ? "Included" : undefined));

            expect(table.partition("Included").keys()).toYield(["1", "3"]);
            expect(table.partition("Excluded").keys()).toYield([]);

            // Update a value to move it into the included partition
            table.set("2", { tags: ["include"] });
            expect(table.partition("Included").keys()).toYield(["1", "2", "3"]);

            // Update a value to move it out of the included partition
            table.set("1", { tags: ["exclude"] });
            expect(table.partition("Included").keys()).toYield(["2", "3"]);
        });

        test("custom partition initialization", () => {
            const table = createTable<string, ITaggedValue>();
            table.set("1", { tags: ["A", "IGNORE", "C"] });
            table.set("2", { tags: ["B", "IGNORE"] });
            table.set("3", { tags: ["A"] });

            table.index(
                (value) => value.tags,
                (partition, name) => {
                    switch (name) {
                        case "IGNORE":
                            // Sort values with "IGNORE" tag by number of tags descending
                            partition.sort((a, b) => b.tags.length - a.tags.length);
                            break;
                        default:
                            // Default sort by number of tags ascending
                            partition.sort((a, b) => a.tags.length - b.tags.length);
                            break;
                    }
                },
            );

            expect(table.partition("A").keys()).toYield(["3", "1"]); // Sorted by tag count ascending
            expect(table.partition("IGNORE").keys()).toYield(["1", "2"]); // Sorted by tag count descending
        });

        test("re-indexing", () => {
            const table = createTable<string, ITaggedValue>();
            table.set("1", { tags: ["A", "B"] });
            table.set("2", { tags: ["B", "C"] });

            const indexConfig = {
                ignoredTag: "A",
            };

            table.index((value) =>
                !value.tags.some((tag) => tag === indexConfig.ignoredTag) ? "P" : null,
            );

            expect(table.partition("P").keys()).toYield(["2"]);

            // Change index configuration
            indexConfig.ignoredTag = "C";

            table.index(); // Re-index

            expect(table.partition("P").keys()).toYield(["1"]);
        });

        test("re-index is no-op if index definition is not provided", () => {
            const table = createTable<string, ITaggedValue>();
            table.set("1", { tags: ["A"] });
            table.index();
            expect(Array.from(table.partitions()).length).toBe(0);
        });

        test("nested indexing", () => {
            const table = createTable<string, { level1: string; level2: string; level3: string }>();

            table.index(
                (v) => v.level1,
                (p1) => {
                    p1.index(
                        (v) => v.level2,
                        (p2) => {
                            p2.index((v) => v.level3);
                        },
                    );
                },
            );

            table.set("1", { level1: "L1", level2: "L2", level3: "L3" });

            const deepPartition = table.partition("L1").partition("L2").partition("L3");
            expect(deepPartition.has("1")).toBe(true);

            // Delete should propagate through all levels
            table.delete("1");
            expect(deepPartition.has("1")).toBe(false);
        });

        test("many empty partitions", () => {
            const table = createTable<string, { id: number }>();
            table.index((v) => `partition${v.id}`);

            // Create many partitions by accessing them
            for (let i = 0; i < 1000; i++) {
                table.partition(`partition${i}`);
            }

            expect(Array.from(table.partitions()).length).toBe(1000);

            // But table is still empty
            expect(table.size).toBe(0);
        });

        test("index definition that returns different lengths of arrays", () => {
            const table = createTable<string, { tags: string[] }>();
            table.index((v) => v.tags);

            table.set("1", { tags: [] }); // Empty array
            table.set("2", { tags: ["A"] }); // One tag
            table.set("3", { tags: ["A", "B"] }); // Two tags
            table.set("4", { tags: ["A", "B", "C"] }); // Three tags

            expect(table.partition("A").size).toBe(3);
            expect(table.partition("B").size).toBe(2);
            expect(table.partition("C").size).toBe(1);

            // Item 1 with empty tags should not be in any partition
            for (const [p] of table.partitions()) {
                expect(table.partition(p).has("1")).toBe(false);
            }
        });

        test("circular-like reference in index definition", () => {
            const table = createTable<string, INode>();

            // Index by parent id (could create circular dependencies)
            table.index((node) => node.parent?.id ?? "root");

            const root: INode = { id: "root" };
            const child1: INode = { id: "child1", parent: root };
            const child2: INode = { id: "child2", parent: root };

            table.set("root", root);
            table.set("child1", child1);
            table.set("child2", child2);

            expect(table.partition("root").size).toBe(3); // root itself is also in "root" partition
            expect(table.partition("root").has("root")).toBe(true);
            expect(table.partition("root").has("child1")).toBe(true);
            expect(table.partition("root").has("child2")).toBe(true);
        });

        test("changing value that affects multiple indexed partitions simultaneously", () => {
            const table = createTable<string, { status: string; priority: string }>();

            table.index(
                () => ["byStatus", "byPriority"],
                (partition, name) => {
                    if (name === "byStatus") {
                        partition.index((v) => v.status);
                    } else if (name === "byPriority") {
                        partition.index((v) => v.priority);
                    }
                },
            );

            table.set("1", { status: "active", priority: "high" });

            expect(table.partition("byStatus").partition("active").has("1")).toBe(true);
            expect(table.partition("byPriority").partition("high").has("1")).toBe(true);

            // Update both status and priority
            table.set("1", { status: "inactive", priority: "low" });

            expect(table.partition("byStatus").partition("active").has("1")).toBe(false);
            expect(table.partition("byStatus").partition("inactive").has("1")).toBe(true);
            expect(table.partition("byPriority").partition("high").has("1")).toBe(false);
            expect(table.partition("byPriority").partition("low").has("1")).toBe(true);
        });

        test("indexing with special characters in partition names", () => {
            const table = createTable<string, { category: string }>();
            table.index((value) => value.category);

            table.set("1", { category: "normal" });
            table.set("2", { category: "with space" });
            table.set("3", { category: "with/slash" });
            table.set("4", { category: "with\nnewline" });
            table.set("5", { category: "with\ttab" });

            expect(table.partition("normal").size).toBe(1);
            expect(table.partition("with space").size).toBe(1);
            expect(table.partition("with/slash").size).toBe(1);
            expect(table.partition("with\nnewline").size).toBe(1);
            expect(table.partition("with\ttab").size).toBe(1);
        });

        test("indexing with null and undefined in partition names array", () => {
            const table = createTable<string, { tags: (string | null | undefined)[] }>();
            table.index((value) => value.tags as string[]);

            table.set("1", { tags: ["valid", null, undefined, "another"] });

            // null and undefined should be filtered out
            expect(table.partition("valid").size).toBe(1);
            expect(table.partition("another").size).toBe(1);
            expect(table.partition("null").size).toBe(0);
            expect(table.partition("undefined").size).toBe(0);
        });
    });

    describe("Sorting", () => {
        test("sorting values by comparator", () => {
            const table = createTable<string, IPerson>(true);

            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);

            expect(table.keys()).toYieldOrdered(["2", "1", "3"]);

            table.set("3", { name: "Charlie", age: 10 });

            expect(table.keys()).toYieldOrdered(["3", "2", "1"]);
        });

        test("sort order should be cleared when comparator is null", () => {
            const table = createTable<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            table.sort((a, b) => a.age - b.age);
            expect(table.keys()).toYieldOrdered(["2", "1"]);
            table.sort(null);

            table.set("0", { name: "Someone", age: 35 });
            table.set("3", { name: "Someone", age: 10 });

            // Not a full proof test but will typically be true
            expect(table.keys()).not.toYieldOrdered(["3", "2", "1", "0"]);
        });

        test("sort order consistency when values are added, updated or removed when memoized", () => {
            const table = createTable<string, IPerson>(true /* memo */);
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);

            expect(table.keys()).toYieldOrdered(["2", "1", "3"]);

            table.batch((t) => {
                t.set("3", { name: "Charlie", age: 15 });
                t.delete("2");
                t.set("4", { name: "Dave", age: 40 });
            });

            expect(table.keys()).toYieldOrdered(["3", "1", "4"]);
        });

        test("sort order consistency when values are added, updated or removed when not memoized", () => {
            const table = createTable<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);

            expect(table.keys()).toYieldOrdered(["2", "1", "3"]);

            table.batch((t) => {
                t.set("3", { name: "Charlie", age: 15 });
                t.delete("2");
                t.set("4", { name: "Dave", age: 40 });
            });

            expect(table.keys()).toYieldOrdered(["3", "1", "4"]);
        });

        test("should notify listeners when sort is applied (with empty delta because values themselves weren't updated)", () => {
            const table = createTable<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            const listener = vi.fn();
            table.subscribe(listener);

            table.sort((a, b) => a.age - b.age);
            expect(listener).toHaveBeenCalledWith([]);
        });

        test("should notify listeners when sort is cleared", () => {
            const table = createTable<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.sort((a, b) => a.age - b.age);

            const listener = vi.fn();
            table.subscribe(listener);

            table.sort(null);
            expect(listener).toHaveBeenCalled();
        });

        test("should apply sort order to partitions recursively and eagerly", () => {
            const table = createTable<string, IPerson>();
            table.index((person) => (person.age < 30 ? "Under30" : "Over30"));
            table.sort((a, b) => a.age - b.age); // Eagerly apply sort at root

            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });
            table.set("4", { name: "Dave", age: 20 });

            expect(table.keys()).toYieldOrdered(["4", "2", "1", "3"]);
            expect(table.partition("Under30").keys()).toYieldOrdered(["4", "2"]);
            expect(table.partition("Over30").keys()).toYieldOrdered(["1", "3"]);

            // Apply new sort at root
            table.sort((a, b) => b.age - a.age);

            expect(table.keys()).toYieldOrdered(["3", "1", "2", "4"]);
            expect(table.partition("Under30").keys()).toYieldOrdered(["2", "4"]);
            expect(table.partition("Over30").keys()).toYieldOrdered(["3", "1"]);
        });

        test("Large data set for sorting correctness (numeric keys and memoization)", () => {
            const table = createTable<number, IPerson>(true);

            const totalEntries = 10000;

            // Insert entries with random ages
            table.batch((t) => {
                for (let i = 0; i < totalEntries; i++) {
                    const age = Math.floor(Math.random() * 100);
                    t.set(i, { name: `Person${i}`, age });
                }
            });

            // Sort by age ascending and memoize
            table.sort((a, b) => a.age - b.age);

            // Update some entries with new random ages
            table.batch((t) => {
                for (let i = 0; i < totalEntries; i += 10) {
                    const age = Math.floor(Math.random() * 100);
                    t.set(i, { name: `Person${i}`, age });
                }
            });

            // Validate sort order
            let previousAge = -1;
            for (const person of table.values()) {
                expect(person.age).toBeGreaterThanOrEqual(previousAge);
                previousAge = person.age;
            }

            // Now sort by age descending
            table.sort((a, b) => b.age - a.age);

            previousAge = 101;
            for (const person of table.values()) {
                expect(person.age).toBeLessThanOrEqual(previousAge);
                previousAge = person.age;
            }
        });

        test("re-sorting", () => {
            const table = createTable<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            const sortConfig = {
                ascending: true,
            };

            table.sort((a, b) => (sortConfig.ascending ? a.age - b.age : b.age - a.age));

            expect(table.keys()).toYieldOrdered(["2", "1", "3"]);

            // Change sort configuration
            sortConfig.ascending = false;

            table.sort(); // Re-sort

            expect(table.keys()).toYieldOrdered(["3", "1", "2"]);
        });

        test("re-sorting is no-op if comparator is not provided", () => {
            const table = createTable<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            const before = Array.from(table.keys());
            table.sort();
            const after = Array.from(table.keys());

            expect(after).toEqual(before);
        });

        test("memo -> sort -> clear memo -> re-sort", () => {
            const table = createTable<string, IPerson>(true);
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            table.sort((a, b) => a.age - b.age);

            expect(table.keys()).toYieldOrdered(["2", "1"]);

            table.memo(false);

            table.sort((a, b) => b.age - a.age);

            expect(table.values()).toYieldOrdered([
                { name: "Alice", age: 30 },
                { name: "Bob", age: 25 },
            ]);
        });

        test("sorting with equal values - stability test", () => {
            const table = createTable<string, ITask>();
            // Multiple items with same priority
            table.set("1", { title: "First", priority: 10 });
            table.set("2", { title: "Second", priority: 10 });
            table.set("3", { title: "Third", priority: 10 });
            table.set("4", { title: "Fourth", priority: 10 });

            table.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

            const keys1 = Array.from(table.keys());

            // Re-sort should produce consistent results
            table.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
            const keys2 = Array.from(table.keys());

            // Order should be consistent across sorts with equal values
            expect(keys1).toEqual(keys2);
        });

        test("sorting after clear() and re-adding data", () => {
            const table = createTable<string, ITask>();
            table.set("1", { title: "Task A", priority: 10 });
            table.set("2", { title: "Task B", priority: 5 });

            table.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
            expect(table.keys()).toYieldOrdered(["2", "1"]);

            table.clear();

            // Add data after clear
            table.set("3", { title: "Task C", priority: 3 });
            table.set("4", { title: "Task D", priority: 1 });

            // Sorting should not be active after clear
            expect(table.keys()).toYieldOrdered(["3", "4"]);
        });
    });

    describe("Touch", () => {
        test("touching a key should refresh it's index position and sort order", () => {
            const table = createTable<string, IPerson>();

            // An index config that can be tweaked externally
            const config = {
                ignoreNames: ["A", "B"],
                specialNames: ["X", "Y"], // Always on top
            };

            // An index that defines an "Allowed" partition excluding certain names
            table.index((value) => (config.ignoreNames.includes(value.name) ? null : "Allowed"));

            // Sort by name lexicographically - but keep special names on top
            table.sort((a, b) => {
                if (config.specialNames.includes(a.name) && !config.specialNames.includes(b.name)) {
                    return -1;
                } else if (
                    !config.specialNames.includes(a.name) &&
                    config.specialNames.includes(b.name)
                ) {
                    return 1;
                } else {
                    return a.name.localeCompare(b.name);
                }
            });

            table.set("A", { name: "A", age: 30 });
            table.set("B", { name: "B", age: 25 });
            table.set("C", { name: "C", age: 35 });
            table.set("D", { name: "D", age: 20 });
            table.set("X", { name: "X", age: 20 });
            table.set("Y", { name: "Y", age: 15 });
            table.set("Z", { name: "Z", age: 10 });

            expect(table.partition("Allowed").keys()).toYieldOrdered(["X", "Y", "C", "D", "Z"]);

            // Now, tweak the config to change index and sort behavior and touch affected keys
            table.batch((t) => {
                config.ignoreNames = ["B", "C"]; // Remove C, add A
                config.specialNames = ["Y", "Z"]; // Remove X, add Z

                t.touch("A");
                t.touch("C");
                t.touch("X");
                t.touch("Z");
            });

            // Validate updated positions
            expect(table.partition("Allowed").keys()).toYieldOrdered(["Y", "Z", "A", "D", "X"]);
        });

        test("touch propagates through nested partitions", () => {
            const table = createTable<string, { country: string; age: number }>();

            table.index(
                (v) => v.country,
                (partition) => {
                    partition.index((v) => (v.age < 18 ? "minor" : "adult"));
                },
            );

            table.set("1", { country: "USA", age: 20 });
            expect(table.partition("USA").partition("adult").has("1")).toBe(true);

            // Modify the value in-place
            const person = table.get("1")!;
            person.age = 16;

            // Touch should propagate to nested partition
            table.touch("1");

            expect(table.partition("USA").partition("adult").has("1")).toBe(false);
            expect(table.partition("USA").partition("minor").has("1")).toBe(true);
        });
    });

    describe("Batching", () => {
        test("batch updates track changes correctly", () => {
            const table = createTable<string, ITask>();

            table.batch((t) => {
                t.set("1", { title: "Task One*" });
                t.set("2", { title: "Task Two*" });
                t.delete("3");
                t.set("4", { title: "Task Four*" });
            });

            expect(table.get("1")!.title).toEqual("Task One*");
            expect(table.get("2")!.title).toEqual("Task Two*");
            expect(table.get("3")).toBeUndefined();
            expect(table.get("4")!.title).toEqual("Task Four*");
        });

        test("batch updates notify subscribers once even if there are multiple updates", () => {
            const table = createTable<string, ITask>();

            const callback = vi.fn();
            table.subscribe(callback);

            // Multiple updates in the same batch
            table.batch((t) => {
                t.set("1", { title: "Task One" });
                t.set("2", { title: "Task Two" });
                t.set("3", { title: "Task Three" });
            });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        test("exception during batch - changes should get reverted - no notification", () => {
            const table = createTable<string, ITask>();
            const subscriber = vi.fn();
            table.subscribe(subscriber);

            expect(() => {
                table.batch((t) => {
                    t.set("1", { title: "Task 1" });
                    t.set("2", { title: "Task 2" });
                    throw new Error("Something went wrong");
                });
            }).toThrow();

            // Changes before the error are reverted
            expect(table.size).toBe(0);

            expect(subscriber).not.toHaveBeenCalled();
        });

        test("exception during batch - subsequent batches should work correctly", () => {
            const table = createTable<string, ITask>();

            // First batch throws
            expect(() => {
                table.batch((t) => {
                    t.set("1", { title: "Task 1" });
                    throw new Error("Batch failed");
                });
            }).toThrow();

            // Subsequent batch should work fine
            expect(() => {
                table.batch((t) => {
                    t.set("2", { title: "Task 2" });
                });
            }).not.toThrow();

            expect(table.size).toBe(1);
            expect(table.get("2")?.title).toBe("Task 2");
        });

        test("batch with only deletes of non-existent keys", () => {
            const table = createTable<string, ITask>();
            const subscriber = vi.fn();
            table.subscribe(subscriber);

            table.batch((t) => {
                t.delete("nonexistent1");
                t.delete("nonexistent2");
                t.delete("nonexistent3");
            });

            // Should not notify since nothing actually changed
            expect(subscriber).not.toHaveBeenCalled();
        });

        test("subscriptions for batch operations", () => {
            const table = createTable<string, ITask>();

            const callback = vi.fn();
            table.subscribe(callback);

            table.batch((t) => {
                t.set("1", { title: "Task One" });
                t.set("2", { title: "Task Two" });
                t.delete("2");
                t.delete("3"); // No-op
                t.touch("1"); // No-op because it's already marked for update
                t.touch("4"); // No-op
            });

            expect(callback).toHaveBeenCalledWith(["1"]);
        });

        test("batch with no operations does not trigger notification", () => {
            const table = createTable<string, ITask>();
            const subscriber = vi.fn();
            table.subscribe(subscriber);

            table.batch(() => {
                // Do nothing
            });

            // Should not notify if nothing changed
            expect(subscriber).not.toHaveBeenCalled();
        });

        test("batch with set, delete, set of same key", () => {
            const table = createTable<string, ITask>();
            const subscriber = vi.fn();
            table.subscribe(subscriber);

            table.batch((t) => {
                t.set("1", { title: "First" });
                t.delete("1");
                t.set("1", { title: "Second" });
            });

            expect(table.get("1")?.title).toBe("Second");

            // Should be notified once for key "1"
            expect(subscriber).toHaveBeenCalledWith(["1"]);
        });
    });

    describe("Stability", () => {
        test("multiple operations maintain internal consistency", () => {
            const table = createTable<string, ITaggedValue>();
            table.index((value) => value.tags);

            expect(() => {
                table.batch((t) => {
                    t.set("1", { tags: ["A", "B"] });
                    t.set("2", { tags: ["B", "C"] });
                    t.set("3", { tags: ["C", "D"] });
                    throw new Error("Intentional failure");
                });
            }).toThrow();

            // Table should be empty after failed batch
            expect(table.size).toBe(0);
            expect(table.partition("A").size).toBe(0);
            expect(table.partition("B").size).toBe(0);
            expect(table.partition("C").size).toBe(0);
            expect(table.partition("D").size).toBe(0);

            // Now do a successful batch with sorting
            table.batch((t) => {
                t.set("1", { tags: ["A", "B"] });
                t.set("2", { tags: ["B", "C"] });
                t.set("3", { tags: ["C", "D"] });
            });

            table.sort((a, b) => a.tags.length - b.tags.length);

            expect(table.keys()).toYieldOrdered(["1", "2", "3"]);
            expect(table.partition("A").keys()).toYield(["1"]);
            expect(table.partition("B").keys()).toYieldOrdered(["1", "2"]);
            expect(table.partition("C").keys()).toYieldOrdered(["2", "3"]);
            expect(table.partition("D").keys()).toYield(["3"]);

            table.clear();

            expect(table.size).toBe(0);
            expect(table.partition("A").size).toBe(0);
            expect(table.partition("B").size).toBe(0);
            expect(table.partition("C").size).toBe(0);
            expect(table.partition("D").size).toBe(0);

            // Add more data
            table.batch((t) => {
                t.set("4", { tags: ["A", "D"] });
                t.set("5", { tags: ["B", "E"] });
            });

            expect(table.size).toBe(2);
            expect(table.partition("A").keys()).toYield([]);
            expect(table.partition("B").keys()).toYield([]);
            expect(table.partition("D").keys()).toYield([]);
            expect(table.partition("E").keys()).toYield([]);
        });
    });
});

// Helper function to create a Table with random memoization if not specified (this is to test both memoized and non-memoized scenarios)
function createTable<K, V>(memo?: boolean): Table<K, V> {
    const table = new Table<K, V>();
    table.memo(memo ?? Math.random() < 0.5);
    return table;
}
