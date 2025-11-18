import { Table } from "./Table";

// Test value types
type ITask = { title: string };
type ITaggedValue = { tags: string[] };
type IPerson = { name: string; age: number };

describe("Table", () => {
    describe("Basic Operations", () => {
        test("set() and get()", () => {
            const table = new Table<string, ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });
            table.set("3", { title: "Task Three" });

            expect(table.get("1")?.title).toEqual("Task One");
            expect(table.keys()).toEqual(["1", "2", "3"]);
            expect(table.values().length).toEqual(3);
        });

        test("delete() - should remove value", () => {
            const table = new Table<string, ITask>();

            table.set("1", { title: "Task One" });
            expect(table.delete("1")).toBe(true);
            expect(table.delete("1")).toBe(false); // No-op
            expect(table.delete("1")).toBe(false); // No-op

            expect(table.get("1")).toBeUndefined();
        });

        test("values() - should return all values", () => {
            const table = new Table<string, ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            const values = table.values();
            expect(values.length).toBe(2);
            expect(values).toEqual(
                expect.arrayContaining([{ title: "Task One" }, { title: "Task Two" }]),
            );
        });

        test("keys() - should return all keys", () => {
            const table = new Table<string, ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            expect(table.keys().sort()).toEqual(["1", "2"]);
        });

        test("size() - should return the number of items in the table", () => {
            const table = new Table<string, ITask>();
            expect(table.size()).toBe(0);

            table.set("1", { title: "Task One" });
            expect(table.size()).toBe(1);

            table.set("2", { title: "Task Two" });
            expect(table.size()).toBe(2);

            table.delete("1");
            expect(table.size()).toBe(1);

            table.delete("2");
            expect(table.size()).toBe(0);
        });
    });

    describe("Subscriptions", () => {
        test("subscribe() - should notify on changes", () => {
            const table = new Table<string, ITask>();

            const callback = vi.fn();
            table.subscribe(callback);

            table.set("1", { title: "Task One" });
            expect(callback).toHaveBeenCalledWith(["1"]);

            table.set("2", { title: "Task Two" });
            expect(callback).toHaveBeenCalledWith(["2"]);
        });

        test("unsubscription - should stop notifications after unsubscribe", () => {
            const table = new Table<string, ITask>();

            const callback = vi.fn();
            const unsubscribe = table.subscribe(callback);

            table.set("1", { title: "Task One" });
            expect(callback).toHaveBeenCalledWith(["1"]);

            unsubscribe();

            table.set("2", { title: "Task Two" });
            expect(callback).toHaveBeenCalledTimes(1); // No new calls after unsubscribe
        });

        test("notification deltas should contain all modified keys", () => {
            const table = new Table<string, ITask>();

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
            const table = new Table<string, ITaggedValue>();
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
    });

    describe("Indexing", () => {
        test("should create partitions based on index definition", () => {
            const table = new Table<string, ITaggedValue>();
            table.set("1", { tags: ["A", "B"] });
            table.set("2", { tags: ["B", "C"] });
            table.set("3", { tags: ["C", "D"] });

            table.index((value) => value.tags);

            expect(table.partition("A").keys()).toEqual(["1"]);
            expect(table.partition("B").keys().sort()).toEqual(["1", "2"]);
            expect(table.partition("C").keys().sort()).toEqual(["2", "3"]);
            expect(table.partition("D").keys()).toEqual(["3"]);
        });

        test("partitions() - should return all non-empty partition names", () => {
            const table = new Table<string, ITaggedValue>();
            table.set("1", { tags: ["A", "B"] });
            table.set("2", { tags: ["B", "C"] });
            table.set("3", { tags: ["C", "D"] });

            table.index((value) => value.tags);

            // Eagerly access a partition to create it
            table.partition("E").sort(() => 0);

            const partitions = table.partitions().sort();
            expect(partitions).toEqual(["A", "B", "C", "D"]); // Should not include empty "E" partition

            table.set("4", { tags: ["E"] });
            const updatedPartitions = table.partitions().sort();
            expect(updatedPartitions).toEqual(["A", "B", "C", "D", "E"]);
        });

        test("should update partitions correctly when values are added, updated or removed", () => {
            const table = new Table<string, ITaggedValue>();
            table.index((value) => value.tags);

            // Add values
            table.set("1", { tags: ["A", "B"] });
            table.set("2", { tags: ["B", "C"] });

            expect(table.partition("A").keys()).toEqual(["1"]);
            expect(table.partition("B").keys().sort()).toEqual(["1", "2"]);
            expect(table.partition("C").keys()).toEqual(["2"]);

            // Update value
            table.set("2", { tags: ["C", "D"] });

            expect(table.partition("A").keys()).toEqual(["1"]);
            expect(table.partition("B").keys()).toEqual(["1"]); // 2 removed
            expect(table.partition("C").keys()).toEqual(["2"]);
            expect(table.partition("D").keys()).toEqual(["2"]);

            // Delete value
            table.delete("1");

            expect(table.partition("A").keys()).toEqual([]);
            expect(table.partition("B").keys()).toEqual([]);
            expect(table.partition("C").keys()).toEqual(["2"]);
            expect(table.partition("D").keys()).toEqual(["2"]);
        });

        test("eager subscriptions - should be able to subscribe before a value is added", () => {
            const table = new Table<string, ITaggedValue>();
            table.index((value) => value.tags);

            const callback = vi.fn();

            // Subscribe to a partition
            table.partition("A").subscribe(callback);

            // Add a value to the subscribed partition
            table.set("1", { tags: ["A"] });

            expect(callback).toHaveBeenCalledWith(["1"]);
        });

        test("should return empty table for non-existent partition", () => {
            const table = new Table<string, ITaggedValue>();
            table.index((value) => value.tags);

            const partition = table.partition("NonExistent");
            expect(partition.keys()).toEqual([]);
        });

        test("should handle null/undefined values in index definition", () => {
            const table = new Table<string, ITaggedValue>();
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

            expect(table.partition("A").keys()).toEqual([]);
            expect(table.partition("B").keys()).toEqual([]);
            expect(table.partition("C").keys()).toEqual(["3"]);
        });

        test("should re-index when index definition is changed", () => {
            const table = new Table<string, ITaggedValue>();
            table.set("1", { tags: ["A"] });
            table.set("2", { tags: ["B"] });
            table.set("3", { tags: ["C"] });

            table.index((value) => value.tags);

            expect(table.partition("A").keys()).toEqual(["1"]);
            expect(table.partition("B").keys()).toEqual(["2"]);
            expect(table.partition("C").keys()).toEqual(["3"]);

            // Change index definition
            table.index((value) => value.tags.map((tag) => (tag === "A" ? tag + "*" : tag)));

            expect(table.partition("A").keys()).toEqual([]);
            expect(table.partition("A*").keys()).toEqual(["1"]); // Re-indexed
            expect(table.partition("B").keys()).toEqual(["2"]);
            expect(table.partition("C").keys()).toEqual(["3"]);
        });

        test("should delete partitions when index is removed", () => {
            const table = new Table<string, ITaggedValue>();
            table.set("1", { tags: ["A"] });
            table.set("2", { tags: ["B"] });

            table.index((value) => value.tags);

            expect(table.partition("A").keys()).toEqual(["1"]);
            expect(table.partition("B").keys()).toEqual(["2"]);

            // Remove indexing
            table.index(null);

            expect(table.partition("A").keys()).toEqual([]);
            expect(table.partition("B").keys()).toEqual([]);
        });

        test("creating filtered views via indexing", () => {
            const table = new Table<string, ITaggedValue>();

            table.set("1", { tags: ["include"] });
            table.set("2", { tags: ["exclude"] });
            table.set("3", { tags: ["include"] });

            // Create a filtered view that only includes values with "include" tag
            table.index((value) => (value.tags.includes("include") ? "Included" : undefined));

            expect(table.partition("Included").keys().sort()).toEqual(["1", "3"]);
            expect(table.partition("Excluded").keys()).toEqual([]);

            // Update a value to move it into the included partition
            table.set("2", { tags: ["include"] });
            expect(table.partition("Included").keys().sort()).toEqual(["1", "2", "3"]);

            // Update a value to move it out of the included partition
            table.set("1", { tags: ["exclude"] });
            expect(table.partition("Included").keys().sort()).toEqual(["2", "3"]);
        });

        test("custom partition initialization", () => {
            const table = new Table<string, ITaggedValue>();
            table.set("1", { tags: ["A", "IGNORE", "C"] });
            table.set("2", { tags: ["B", "IGNORE"] });
            table.set("3", { tags: ["A"] });

            table.index(
                (value) => value.tags,
                (name, partition) => {
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

            expect(table.partition("A").keys()).toEqual(["3", "1"]); // Sorted by tag count ascending
            expect(table.partition("IGNORE").keys()).toEqual(["1", "2"]); // Sorted by tag count descending
        });
    });

    describe("Sorting", () => {
        test("sorting values by comparator", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);

            expect(table.keys()).toEqual(["2", "1", "3"]);
        });

        test("sort order should be cleared when comparator is null", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            table.sort((a, b) => a.age - b.age);
            expect(table.keys()).toEqual(["2", "1"]);
            table.sort(null);

            table.set("0", { name: "Someone", age: 35 });
            table.set("3", { name: "Someone", age: 10 });

            // Not a full proof test but will typically be true
            expect(table.keys()).not.toEqual(["3", "2", "1", "0"]);
        });

        test("sort order consistency when values are added, updated or removed", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);
            expect(table.keys()).toEqual(["2", "1", "3"]);

            table.set("3", { name: "Charlie", age: 15 });
            table.delete("2");
            table.set("4", { name: "Dave", age: 40 });

            expect(table.keys()).toEqual(["3", "1", "4"]);
        });

        test("should notify listeners when sort is applied (with empty delta because values themselves weren't updated)", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            const listener = vi.fn();
            table.subscribe(listener);

            table.sort((a, b) => a.age - b.age);
            expect(listener).toHaveBeenCalledWith([]);
        });

        test("should not notify listeners when sort is cleared (because it's unnecessary)", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.sort((a, b) => a.age - b.age);

            const listener = vi.fn();
            table.subscribe(listener);

            table.sort(null);
            expect(listener).not.toHaveBeenCalled();
        });

        test("should apply sort order to partitions recursively and eagerly", () => {
            const table = new Table<string, IPerson>();
            table.index((person) => (person.age < 30 ? "Under30" : "Over30"));
            table.sort((a, b) => a.age - b.age); // Eagerly apply sort at root

            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });
            table.set("4", { name: "Dave", age: 20 });

            expect(table.keys()).toEqual(["4", "2", "1", "3"]);
            expect(table.partition("Under30").keys()).toEqual(["4", "2"]);
            expect(table.partition("Over30").keys()).toEqual(["1", "3"]);

            // Apply new sort at root
            table.sort((a, b) => b.age - a.age);

            expect(table.keys()).toEqual(["3", "1", "2", "4"]);
            expect(table.partition("Under30").keys()).toEqual(["2", "4"]);
            expect(table.partition("Over30").keys()).toEqual(["3", "1"]);
        });
    });

    describe("Memoization", () => {
        test("should memoize sorted keys for terminal partitions", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });
            table.set("4", { name: "Dave", age: 20 });

            table.index((person) => (person.age < 30 ? "Under30" : "Over30"));

            // Apply sort
            table.sort((a, b) => a.age - b.age);

            // Root should  not be materialized because it has partitions
            expect(table.keys()).not.toBe(table.keys()); // Evey read returns a new reference (indirect proxy to test whether materialization happened)

            // Terminal partitions should be materialized
            expect(table.partition("Under30").keys()).toBe(table.partition("Under30").keys());
            expect(table.partition("Over30").keys()).toBe(table.partition("Over30").keys());
        });

        test("should un-memoize keys when sort is cleared", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            // Apply sort
            table.sort((a, b) => a.age - b.age);

            // Keys should be materialized
            expect(table.keys()).toBe(table.keys());

            // Clear sort
            table.sort(null);

            // Keys should no longer be materialized
            expect(table.keys()).not.toBe(table.keys());
        });

        test("should un-memoize keys when partitioning is applied", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            // Apply sort
            table.sort((a, b) => a.age - b.age);

            // Keys should be materialized
            expect(table.keys()).toBe(table.keys());

            // Apply partitioning
            table.index((person) => (person.age < 30 ? "Under30" : "Over30"));

            // Keys should no longer be materialized
            expect(table.keys()).not.toBe(table.keys());
        });
    });

    describe("Touch", () => {
        test("touching a key should refresh it's index position and sort order", () => {
            const table = new Table<string, IPerson>();

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

            expect(table.partition("Allowed").keys()).toEqual(["X", "Y", "C", "D", "Z"]);

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
            expect(table.partition("Allowed").keys()).toEqual(["Y", "Z", "A", "D", "X"]);
        });
    });

    describe("Batching", () => {
        test("batch updates track changes correctly", () => {
            const table = new Table<string, ITask>();

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
            const table = new Table<string, ITask>();

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
    });
});
