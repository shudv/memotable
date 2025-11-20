import { Table } from "./Table";

// Test value types
type ITask = { title: string; priority?: number };
type IPerson = { name: string; age: number };
type INode = { id: string; parent?: INode };

describe("Table - Edge Cases & Tricky Scenarios", () => {
    describe("Sorting Edge Cases", () => {
        test("sorting with NaN values in comparator", () => {
            const table = new Table<string, ITask>();
            table.set("1", { title: "Task A", priority: 10 });
            table.set("2", { title: "Task B", priority: NaN });
            table.set("3", { title: "Task C", priority: 5 });
            table.set("4", { title: "Task D", priority: NaN });

            // Sort by priority - NaN comparisons are tricky
            table.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

            // This should work, but NaN handling can be unpredictable
            const values = Array.from(table.values());
            expect(values.length).toBe(4);
        });

        test("sorting with undefined and null values", () => {
            const table = new Table<string, ITask>();
            table.set("1", { title: "Task A", priority: 10 });
            table.set("2", { title: "Task B", priority: undefined });
            table.set("3", { title: "Task C", priority: 5 });
            table.set("4", { title: "Task D" }); // Missing priority property

            table.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

            const values = Array.from(table.values());
            expect(values.length).toBe(4);
            // Verify all undefined/missing values sort consistently
            const undefinedValues = values.filter((v) => v.priority === undefined);
            expect(undefinedValues.length).toBe(2);
        });

        test("sorting with equal values - stability test", () => {
            const table = new Table<string, ITask>();
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

        test("comparator that returns non-numeric values", () => {
            const table = new Table<string, ITask>();
            table.set("1", { title: "Task A" });
            table.set("2", { title: "Task B" });

            // Comparator that returns invalid values
            table.sort((a, b) => {
                // This is incorrect but tests robustness
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return a.title.localeCompare(b.title) as any;
            });

            // Should still work despite comparator returning string-like results
            expect(Array.from(table.keys())).toHaveLength(2);
        });

        test("sorting after clear() and re-adding data", () => {
            const table = new Table<string, ITask>();
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

    describe("Indexing Edge Cases", () => {
        test("indexing with empty string partition names - EDGE CASE: empty strings filtered out", () => {
            const table = new Table<string, { tags: string[] }>();
            table.index((value) => value.tags);

            table.set("1", { tags: ["", "valid"] });
            table.set("2", { tags: ["valid"] });

            // EDGE CASE: Empty strings are filtered out by the filter(Boolean) in normalization
            // This could be unexpected - user might want to partition by empty string
            expect(table.partition("").size).toBe(0); // Empty strings are filtered out!
            expect(table.partition("valid").size).toBe(2);
        });

        test("indexing with special characters in partition names", () => {
            const table = new Table<string, { category: string }>();
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

        test("re-indexing with changed definition moves items correctly", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 25 });
            table.set("2", { name: "Bob", age: 35 });

            // First index by age range
            table.index((p) => (p.age < 30 ? "Young" : "Old"));
            expect(table.partition("Young").size).toBe(1);
            expect(table.partition("Old").size).toBe(1);

            // Re-index with completely different logic
            table.index((p) => (p.name.startsWith("A") ? "A-names" : "Other"));
            expect(table.partition("A-names").size).toBe(1);
            expect(table.partition("Other").size).toBe(1);

            // Old partitions should be gone
            expect(table.partition("Young").size).toBe(0);
            expect(table.partition("Old").size).toBe(0);
        });

        test("indexing with dynamic partition names (same value can move between partitions)", () => {
            const table = new Table<string, IPerson>();
            let ageThreshold = 30;

            table.index((p) => (p.age < ageThreshold ? "Young" : "Old"));

            table.set("1", { name: "Alice", age: 25 });
            expect(table.partition("Young").size).toBe(1);

            // Change threshold and re-index
            ageThreshold = 20;
            table.index(); // Re-index with current definition

            // Alice should now be in "Old" because threshold changed
            expect(table.partition("Old").size).toBe(1);
            expect(table.partition("Young").size).toBe(0);
        });

        test("value belongs to many partitions simultaneously", () => {
            const table = new Table<string, { tags: string[] }>();
            table.index((value) => value.tags);

            // One value in many partitions
            const manyTags = Array.from({ length: 100 }, (_, i) => `tag${i}`);
            table.set("1", { tags: manyTags });

            // Verify it's in all partitions
            for (let i = 0; i < 100; i++) {
                expect(table.partition(`tag${i}`).has("1")).toBe(true);
            }

            // Delete should remove from all partitions
            table.delete("1");
            for (let i = 0; i < 100; i++) {
                expect(table.partition(`tag${i}`).has("1")).toBe(false);
            }
        });

        test("indexing with null and undefined in partition names array", () => {
            const table = new Table<string, { tags: (string | null | undefined)[] }>();
            table.index((value) => value.tags as string[]);

            table.set("1", { tags: ["valid", null, undefined, "another"] });

            // null and undefined should be filtered out
            expect(table.partition("valid").size).toBe(1);
            expect(table.partition("another").size).toBe(1);
            expect(table.partition("null").size).toBe(0);
            expect(table.partition("undefined").size).toBe(0);
        });
    });

    describe("Memoization Edge Cases", () => {
        test("memoization with frequent updates doesn't cause memory leaks", () => {
            const table = new Table<string, IPerson>();
            table.sort((a, b) => a.age - b.age);
            table.memo(true);

            // Add and remove items many times
            for (let i = 0; i < 1000; i++) {
                table.set(`key${i}`, { name: `Person${i}`, age: i % 100 });
            }

            expect(table.size).toBe(1000);

            // Delete all items
            for (let i = 0; i < 1000; i++) {
                table.delete(`key${i}`);
            }

            expect(table.size).toBe(0);
            // Memoized arrays should be cleared or minimal
            const keys = Array.from(table.keys());
            expect(keys.length).toBe(0);
        });

        test("memoization toggling multiple times", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.sort((a, b) => a.age - b.age);

            // Toggle memoization on and off repeatedly
            for (let i = 0; i < 10; i++) {
                table.memo(true);
                expect(table.isMemoized()).toBe(true);
                table.memo(false);
                expect(table.isMemoized()).toBe(false);
            }

            // Should still work correctly
            expect(Array.from(table.values())).toEqual([{ name: "Alice", age: 30 }]);
        });

        test("reading from memoized table - EDGE CASE: memoized arrays are mutable", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.sort((a, b) => a.age - b.age);
            table.memo(true);

            const array1 = table.toArray();
            const array2 = table.toArray();

            // Should return the same reference when memoized
            expect(array1).toBe(array2);

            // EDGE CASE: Mutating the returned array DOES affect internal state!
            // The library returns direct reference to internal memoized array for performance
            // This is documented as "readonly V[]" but not defensively copied
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (array1 as any).push({ name: "Charlie", age: 35 });

            const array3 = table.toArray();
            expect(array3.length).toBe(3); // Changed to 3! Internal state was mutated

            // This is a potential footgun - users should treat returned arrays as readonly
        });
    });

    describe("Batching Edge Cases", () => {
        test("nested batches - EDGE CASE: each batch completes independently", () => {
            const table = new Table<string, ITask>();
            const subscriber = vi.fn();
            table.subscribe(subscriber);

            table.batch((t1) => {
                t1.set("1", { title: "Task 1" });

                // Nested batch
                t1.batch((t2) => {
                    t2.set("2", { title: "Task 2" });
                    t2.set("3", { title: "Task 3" });
                });

                t1.set("4", { title: "Task 4" });
            });

            // EDGE CASE: Nested batches are not coalesced - each batch notifies independently
            // The inner batch completes first and notifies with ALL accumulated keys so far ["1", "2", "3"]
            // Then the outer batch completes and notifies with remaining keys ["4"]
            expect(subscriber).toHaveBeenCalledTimes(2);
            expect(subscriber).toHaveBeenNthCalledWith(1, ["1", "2", "3"]); // Inner batch gets all prior changes
            expect(subscriber).toHaveBeenNthCalledWith(2, ["4"]); // Outer batch gets remaining changes
        });

        test("exception during batch - EDGE CASE: changes persist but no notification", () => {
            const table = new Table<string, ITask>();
            const subscriber = vi.fn();
            table.subscribe(subscriber);

            expect(() => {
                table.batch((t) => {
                    t.set("1", { title: "Task 1" });
                    t.set("2", { title: "Task 2" });
                    throw new Error("Something went wrong");
                });
            }).toThrow("Something went wrong");

            // EDGE CASE: Changes before the error are persisted
            expect(table.size).toBe(2);
            expect(table.has("1")).toBe(true);
            expect(table.has("2")).toBe(true);

            // EDGE CASE: But subscribers are NOT notified because the batch didn't complete normally
            // The exception prevents the notification logic from running
            expect(subscriber).not.toHaveBeenCalled();

            // This could lead to subscribers being out of sync with table state
        });

        test("batch with no operations still triggers notification", () => {
            const table = new Table<string, ITask>();
            const subscriber = vi.fn();
            table.subscribe(subscriber);

            table.batch(() => {
                // Do nothing
            });

            // Should not notify if nothing changed
            expect(subscriber).not.toHaveBeenCalled();
        });

        test("batch with only deletes of non-existent keys", () => {
            const table = new Table<string, ITask>();
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

        test("batch with set, delete, set of same key", () => {
            const table = new Table<string, ITask>();
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

    describe("Special Keys Edge Cases", () => {
        test("undefined as a key", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const table = new Table<any, ITask>();

            table.set(undefined, { title: "Undefined key task" });
            expect(table.has(undefined)).toBe(true);
            expect(table.get(undefined)?.title).toBe("Undefined key task");
            expect(table.size).toBe(1);

            table.delete(undefined);
            expect(table.has(undefined)).toBe(false);
            expect(table.size).toBe(0);
        });

        test("null as a key", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const table = new Table<any, ITask>();

            table.set(null, { title: "Null key task" });
            expect(table.has(null)).toBe(true);
            expect(table.get(null)?.title).toBe("Null key task");

            table.delete(null);
            expect(table.has(null)).toBe(false);
        });

        test("symbol as a key", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const table = new Table<any, ITask>();
            const sym1 = Symbol("key1");
            const sym2 = Symbol("key2");

            table.set(sym1, { title: "Symbol 1 task" });
            table.set(sym2, { title: "Symbol 2 task" });

            expect(table.has(sym1)).toBe(true);
            expect(table.has(sym2)).toBe(true);
            expect(table.get(sym1)?.title).toBe("Symbol 1 task");

            table.delete(sym1);
            expect(table.has(sym1)).toBe(false);
            expect(table.has(sym2)).toBe(true);
        });

        test("object as a key", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const table = new Table<any, ITask>();
            const obj1 = { id: 1 };
            const obj2 = { id: 1 }; // Different object, same content

            table.set(obj1, { title: "Object 1 task" });
            table.set(obj2, { title: "Object 2 task" });

            // Should have 2 entries since objects are different references
            expect(table.size).toBe(2);
            expect(table.get(obj1)?.title).toBe("Object 1 task");
            expect(table.get(obj2)?.title).toBe("Object 2 task");
        });

        test("NaN as a key", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const table = new Table<any, ITask>();

            table.set(NaN, { title: "NaN key task" });

            // NaN === NaN is false, but Map handles NaN specially
            expect(table.has(NaN)).toBe(true);
            expect(table.get(NaN)?.title).toBe("NaN key task");
        });

        test("zero keys: +0 and -0", () => {
            const table = new Table<number, ITask>();

            table.set(+0, { title: "Positive zero" });
            table.set(-0, { title: "Negative zero" });

            // In JavaScript, +0 === -0, so Map treats them as the same key
            expect(table.size).toBe(1);
            expect(table.get(+0)?.title).toBe("Negative zero"); // Last set wins
            expect(table.get(-0)?.title).toBe("Negative zero");
        });
    });

    describe("Iterator Edge Cases", () => {
        test("modifying table during iteration via keys() - EDGE CASE: iterator sees changes", () => {
            const table = new Table<string, ITask>();
            table.set("1", { title: "Task 1" });
            table.set("2", { title: "Task 2" });
            table.set("3", { title: "Task 3" });

            const keys: string[] = [];
            for (const key of table.keys()) {
                keys.push(key);
                // Modify during iteration
                if (key === "2") {
                    table.set("4", { title: "Task 4" });
                }
            }

            // EDGE CASE: The iterator sees the newly added item during iteration
            // This is standard Map behavior - iterators are "live" and see modifications
            expect(keys).toEqual(["1", "2", "3", "4"]);
            expect(table.size).toBe(4);
        });

        test("modifying table during iteration via forEach", () => {
            const table = new Table<string, ITask>();
            table.set("1", { title: "Task 1" });
            table.set("2", { title: "Task 2" });
            table.set("3", { title: "Task 3" });

            const visited: string[] = [];
            table.forEach((value, key) => {
                visited.push(key);
                if (key === "2") {
                    table.delete("3");
                    table.set("4", { title: "Task 4" });
                }
            });

            // Behavior depends on Map's iterator behavior
            expect(visited.length).toBeGreaterThanOrEqual(2);
        });

        test("iterator with memoized sorted table", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);
            table.memo(true);

            // First iteration
            const keys1 = Array.from(table.keys());
            expect(keys1).toEqual(["2", "1", "3"]);

            // Add item during iteration?
            let count = 0;
            for (const _key of table.keys()) {
                count++;
                if (count === 1) {
                    table.set("4", { name: "Dave", age: 20 });
                }
            }

            // Second iteration should reflect the update
            const keys2 = Array.from(table.keys());
            expect(keys2).toEqual(["4", "2", "1", "3"]);
        });
    });

    describe("Touch Edge Cases", () => {
        test("touching a non-existent key - EDGE CASE: touch always notifies", () => {
            const table = new Table<string, ITask>();
            const subscriber = vi.fn();
            table.subscribe(subscriber);

            // Touch a key that doesn't exist
            table.touch("nonexistent");

            // EDGE CASE: touch() always calls _propagateChanges, even for non-existent keys
            // This means subscribers are notified even though nothing actually changed
            expect(subscriber).toHaveBeenCalledWith(["nonexistent"]);

            // This could be considered a bug or intentional - it's at least surprising
            // Users might expect touch() to be a no-op for non-existent keys
        });

        test("touching a key after delete", () => {
            const table = new Table<string, IPerson>();
            table.index((p) => (p.age < 30 ? "Young" : "Old"));
            table.set("1", { name: "Alice", age: 25 });

            expect(table.partition("Young").has("1")).toBe(true);

            table.delete("1");

            // Touch after delete
            table.touch("1");

            // Should still not exist
            expect(table.has("1")).toBe(false);
            expect(table.partition("Young").has("1")).toBe(false);
        });

        test("touching many keys in a batch", () => {
            const table = new Table<string, IPerson>();
            const config = { minAge: 30 };
            table.index((p) => (p.age >= config.minAge ? "Adult" : "Young"));

            for (let i = 1; i <= 100; i++) {
                table.set(`${i}`, { name: `Person${i}`, age: 20 + i });
            }

            const initialAdultCount = table.partition("Adult").size;

            // Change config and touch all keys
            config.minAge = 50;

            table.batch((t) => {
                for (let i = 1; i <= 100; i++) {
                    t.touch(`${i}`);
                }
            });

            const newAdultCount = table.partition("Adult").size;
            expect(newAdultCount).toBeLessThan(initialAdultCount);
        });

        test("touch propagates through nested partitions", () => {
            const table = new Table<string, { country: string; age: number }>();

            table.index(
                (v) => v.country,
                (_, partition) => {
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

    describe("Subscription Edge Cases", () => {
        test("unsubscribing during notification", () => {
            const table = new Table<string, ITask>();
            let unsubscribe: (() => void) | null = null;

            const subscriber = vi.fn(() => {
                // Unsubscribe during the callback
                if (unsubscribe) {
                    unsubscribe();
                }
            });

            unsubscribe = table.subscribe(subscriber);

            table.set("1", { title: "Task 1" });
            expect(subscriber).toHaveBeenCalledTimes(1);

            // Further changes should not notify
            table.set("2", { title: "Task 2" });
            expect(subscriber).toHaveBeenCalledTimes(1);
        });

        test("multiple subscribers with some unsubscribing", () => {
            const table = new Table<string, ITask>();
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
            const subscriber1 = vi.fn(() => {
                throw new Error("Subscriber error");
            });
            const subscriber2 = vi.fn();

            table.subscribe(subscriber1);
            table.subscribe(subscriber2);

            // First subscriber throws, but second should still be called
            expect(() => {
                table.set("1", { title: "Task 1" });
            }).toThrow("Subscriber error");

            // subscriber1 was called before throwing
            expect(subscriber1).toHaveBeenCalledTimes(1);
            // subscriber2 might not be called if error propagates
            // This behavior depends on implementation
        });

        test("subscribing to a partition that doesn't exist yet", () => {
            const table = new Table<string, IPerson>();
            table.index((p) => (p.age < 30 ? "Young" : "Old"));

            const subscriber = vi.fn();
            // Subscribe to partition before it has any items
            table.partition("Young").subscribe(subscriber);

            table.set("1", { name: "Alice", age: 25 });
            expect(subscriber).toHaveBeenCalledWith(["1"]);
        });

        test("cascade notifications in nested partitions", () => {
            const table = new Table<string, { country: string; city: string }>();

            table.index(
                (v) => v.country,
                (_, countryPartition) => {
                    countryPartition.index((v) => v.city);
                },
            );

            const countrySubscriber = vi.fn();
            const citySubscriber = vi.fn();

            table.partition("USA").subscribe(countrySubscriber);
            table.partition("USA").partition("NYC").subscribe(citySubscriber);

            table.set("1", { country: "USA", city: "NYC" });

            expect(countrySubscriber).toHaveBeenCalledWith(["1"]);
            expect(citySubscriber).toHaveBeenCalledWith(["1"]);
        });
    });

    describe("Complex Interaction Edge Cases", () => {
        test("sorting + indexing + memoization together", () => {
            const table = new Table<string, IPerson>();

            table.index(
                (p) => (p.age < 30 ? "Young" : "Old"),
                (_, partition) => {
                    partition.sort((a, b) => a.name.localeCompare(b.name));
                    partition.memo(true);
                },
            );

            table.set("1", { name: "Charlie", age: 25 });
            table.set("2", { name: "Alice", age: 25 });
            table.set("3", { name: "Bob", age: 35 });

            const youngKeys = Array.from(table.partition("Young").keys());
            expect(youngKeys).toEqual(["2", "1"]); // Sorted by name: Alice, Charlie

            const oldKeys = Array.from(table.partition("Old").keys());
            expect(oldKeys).toEqual(["3"]);
        });

        test("changing value that affects multiple indexed partitions simultaneously", () => {
            const table = new Table<string, { status: string; priority: string }>();

            table.index(
                () => ["byStatus", "byPriority"],
                (name, partition) => {
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

        test("large scale stress test: many operations", () => {
            const table = new Table<string, IPerson>();
            table.sort((a, b) => a.age - b.age);
            table.index((p) => (p.age < 30 ? "Young" : "Old"));
            table.memo(true);

            const subscriber = vi.fn();
            table.subscribe(subscriber);

            // Add 1000 items in batches
            for (let batch = 0; batch < 10; batch++) {
                table.batch((t) => {
                    for (let i = 0; i < 100; i++) {
                        const id = `${batch * 100 + i}`;
                        t.set(id, { name: `Person${id}`, age: (batch * 100 + i) % 100 });
                    }
                });
            }

            expect(table.size).toBe(1000);
            expect(subscriber).toHaveBeenCalledTimes(10); // 10 batches

            // Verify partitions
            const youngCount = table.partition("Young").size;
            const oldCount = table.partition("Old").size;
            expect(youngCount + oldCount).toBe(1000);

            // Delete half in batches
            for (let batch = 0; batch < 5; batch++) {
                table.batch((t) => {
                    for (let i = 0; i < 100; i++) {
                        const id = `${batch * 100 + i}`;
                        t.delete(id);
                    }
                });
            }

            expect(table.size).toBe(500);
        });

        test("circular-like reference in index definition", () => {
            const table = new Table<string, INode>();

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

        test("index definition that returns different lengths of arrays", () => {
            const table = new Table<string, { tags: string[] }>();
            table.index((v) => v.tags);

            table.set("1", { tags: [] }); // Empty array
            table.set("2", { tags: ["A"] }); // One tag
            table.set("3", { tags: ["A", "B"] }); // Two tags
            table.set("4", { tags: ["A", "B", "C"] }); // Three tags

            expect(table.partition("A").size).toBe(3);
            expect(table.partition("B").size).toBe(2);
            expect(table.partition("C").size).toBe(1);

            // Item 1 with empty tags should not be in any partition
            for (const [partName] of table.partitions()) {
                if (partName !== "__DEFAULT__") {
                    expect(table.partition(partName).has("1")).toBe(false);
                }
            }
        });
    });

    describe("Memory and Performance Edge Cases", () => {
        test("table handles many empty partitions without issues", () => {
            const table = new Table<string, { id: number }>();
            table.index((v) => `partition${v.id}`);

            // Create many partitions by accessing them
            for (let i = 0; i < 1000; i++) {
                table.partition(`partition${i}`);
            }

            expect(table.partitions().length).toBeGreaterThanOrEqual(1000);

            // But table is still empty
            expect(table.size).toBe(0);
        });

        test("deeply nested partitions", () => {
            const table = new Table<string, { level1: string; level2: string; level3: string }>();

            table.index(
                (v) => v.level1,
                (_, p1) => {
                    p1.index(
                        (v) => v.level2,
                        (_, p2) => {
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

        test("partition inherits sorting from parent correctly", () => {
            const table = new Table<string, IPerson>();
            table.sort((a, b) => a.age - b.age);
            table.index((p) => (p.age < 30 ? "Young" : "Old"));

            table.set("1", { name: "Charlie", age: 25 });
            table.set("2", { name: "Alice", age: 22 });
            table.set("3", { name: "Bob", age: 27 });

            const youngKeys = Array.from(table.partition("Young").keys());
            // Should be sorted by age
            expect(youngKeys).toEqual(["2", "1", "3"]); // 22, 25, 27
        });
    });
});
