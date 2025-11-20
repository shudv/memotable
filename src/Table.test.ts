import { Table } from "./Table";
import { print } from "./TableUtilities";

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
            expect(table.keys()).toYieldOrdered(["1", "2", "3"]);
            expect(table.size).toEqual(3);
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

            expect(table.size).toBe(2);
            expect(table.values()).toYield([{ title: "Task One" }, { title: "Task Two" }]);
        });

        test("keys() - should return all keys", () => {
            const table = new Table<string, ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            expect(table.keys()).toYield(["1", "2"]);
        });

        test("size - should return the number of items in the table", () => {
            const table = new Table<string, ITask>();
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
            const table = new Table<string, ITask>();
            expect(table.has("1")).toBe(false);
            table.set("1", { title: "Task One" });
            expect(table.has("1")).toBe(true);
            expect(table.has("2")).toBe(false);
        });

        test("entries() - should return all key/value pairs", () => {
            const table = new Table<string, ITask>();
            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            expect(table.entries()).toYield([
                ["1", { title: "Task One" }],
                ["2", { title: "Task Two" }],
            ]);
        });

        test("default iterator - should iterate over key/value pairs", () => {
            const table = new Table<string, ITask>();
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

        test("forEach() - should execute callback for each key/value pair", () => {
            const table = new Table<string, ITask>();

            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            const callback = vi.fn();
            table.forEach(callback);
            expect(callback).toHaveBeenCalledWith({ title: "Task One" }, "1", table);
            expect(callback).toHaveBeenCalledWith({ title: "Task Two" }, "2", table);
        });

        test("toArray() - should return values as an array", () => {
            const table = new Table<string, ITask>();

            table.set("1", { title: "Task One" });
            table.set("2", { title: "Task Two" });

            expect(table.toArray()).toEqual([{ title: "Task One" }, { title: "Task Two" }]);
        });

        test("clear() - should remove all items and clear indexing and sorting", () => {
            const table = new Table<string, ITask>();

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
            const table = new Table<string, ITask>();

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

    describe("Memoization", () => {
        test("should memoize partitions which opt-in", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });
            table.set("4", { name: "Dave", age: 20 });

            table.index(
                (person) => (person.age < 30 ? "Under30" : "Over30"),
                (name, partition) => {
                    partition.memo(name === "Under30"); // Enable memoization for partitions
                },
            );

            // Apply sort and track comparator calls
            table.sort((a, b) => a.age - b.age);

            expect(table.isMemoized()).toBe(false);
            expect(table.partition("Under30").isMemoized()).toBe(true);
            expect(table.partition("Over30").isMemoized()).toBe(false);

            // Memoize the entire table
            table.memo();

            expect(table.isMemoized()).toBe(true);
            expect(table.partition("Under30").isMemoized()).toBe(true);
            expect(table.partition("Over30").isMemoized()).toBe(true);

            expect(table.keys()).toYieldOrdered(["4", "2", "1", "3"]);
            expect(table.values()).toYieldOrdered([
                { name: "Dave", age: 20 },
                { name: "Bob", age: 25 },
                { name: "Alice", age: 30 },
                { name: "Charlie", age: 35 },
            ]);

            // Unmemoize the entire table
            table.memo(false);

            expect(table.isMemoized()).toBe(false);
            expect(table.partition("Under30").isMemoized()).toBe(false);
            expect(table.partition("Over30").isMemoized()).toBe(false);
        });
    });

    describe("Indexing", () => {
        test("default partition", () => {
            const table = new Table<string, ITaggedValue>();

            table.index((value) => !value.tags.includes("IGNORE"));

            table.set("1", { tags: ["A", "B"] });
            table.set("2", { tags: ["IGNORE", "C"] });
            table.set("3", { tags: ["D"] });

            expect(table.partition().keys()).toYield(["1", "3"]);
        });

        test("should create partitions based on index definition", () => {
            const table = new Table<string, ITaggedValue>();
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
            const table = new Table<string, ITaggedValue>();
            table.set("1", { tags: ["A"] });

            table.index((_) => "");
            expect(table.partitions().length).toEqual(0);

            table.index((_) => false);
            expect(table.partitions().length).toEqual(0);

            table.index((_) => null);
            expect(table.partitions().length).toEqual(0);

            table.index((_) => []);
            expect(table.partitions().length).toEqual(0);

            table.index((_) => ["VALID", "", null]);
            expect(table.partitions().length).toEqual(1);
            expect(table.partition("VALID").size).toEqual(1);
        });

        test("partitions() - should return all partition names", () => {
            const table = new Table<string, ITaggedValue>();
            table.set("1", { tags: ["A", "B"] });
            table.set("2", { tags: ["B", "C"] });
            table.set("3", { tags: ["C", "D"] });

            table.index((value) => value.tags);

            // Eagerly access a partition to create it
            table.partition("E").sort(() => 0);

            expect(table.partitions().map(([key]) => key)).toEqual(["A", "B", "C", "D", "E"]); // Should include empty "E" partition
        });

        test("should update partitions correctly when values are added, updated or removed", () => {
            const table = new Table<string, ITaggedValue>();
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
            expect(partition.keys()).toYield([]);
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

            expect(table.partition("A").keys()).toYield([]);
            expect(table.partition("B").keys()).toYield([]);
            expect(table.partition("C").keys()).toYield(["3"]);
        });

        test("should re-index when index definition is changed", () => {
            const table = new Table<string, ITaggedValue>();
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
            const table = new Table<string, ITaggedValue>();
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
            const table = new Table<string, ITaggedValue>();

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

            expect(table.partition("A").keys()).toYield(["3", "1"]); // Sorted by tag count ascending
            expect(table.partition("IGNORE").keys()).toYield(["1", "2"]); // Sorted by tag count descending
        });

        test("rich hierarchical partitioning - geographic organization", () => {
            type Location = {
                id: string;
                country: string;
                region: string;
                city: string;
                district: string;
                population: number;
            };

            const table = new Table<string, Location>();
            const locationsData: [string, string, string, string, string, number][] = [
                // USA
                ["1", "USA", "West", "San Francisco", "Mission", 50000],
                ["2", "USA", "West", "San Francisco", "SOMA", 30000],
                ["3", "USA", "West", "Los Angeles", "Downtown", 60000],
                ["4", "USA", "West", "Seattle", "Capitol Hill", 40000],
                ["5", "USA", "East", "New York", "Manhattan", 100000],
                ["6", "USA", "East", "New York", "Brooklyn", 80000],
                ["7", "USA", "East", "Boston", "Back Bay", 35000],
                // Canada
                ["8", "Canada", "West", "Vancouver", "Downtown", 45000],
                ["9", "Canada", "West", "Vancouver", "Gastown", 25000],
                ["10", "Canada", "West", "Victoria", "Inner Harbour", 20000],
                ["11", "Canada", "East", "Toronto", "Downtown", 90000],
                ["12", "Canada", "East", "Toronto", "Yorkville", 40000],
                ["13", "Canada", "East", "Montreal", "Old Montreal", 50000],
                // UK
                ["14", "UK", "South", "London", "Westminster", 70000],
                ["15", "UK", "South", "London", "Camden", 55000],
                ["16", "UK", "South", "Brighton", "North Laine", 30000],
                ["17", "UK", "North", "Manchester", "Northern Quarter", 45000],
                ["18", "UK", "North", "Edinburgh", "Old Town", 40000],
                // Germany
                ["19", "Germany", "South", "Munich", "Altstadt", 60000],
                ["20", "Germany", "North", "Berlin", "Mitte", 80000],
                // India
                ["21", "India", "North", "Delhi", "Connaught Place", 120000],
                ["22", "India", "North", "Delhi", "Karol Bagh", 95000],
                ["23", "India", "North", "Chandigarh", "Sector 17", 55000],
                ["24", "India", "West", "Mumbai", "Colaba", 110000],
                ["25", "India", "West", "Mumbai", "Bandra", 85000],
                ["26", "India", "West", "Pune", "Koregaon Park", 65000],
                ["27", "India", "South", "Bangalore", "Indiranagar", 105000],
                ["28", "India", "South", "Bangalore", "Koramangala", 90000],
                ["29", "India", "South", "Chennai", "T Nagar", 75000],
                ["30", "India", "East", "Kolkata", "Park Street", 88000],
                ["31", "India", "East", "Kolkata", "Salt Lake", 70000],
            ];

            const locations: Location[] = locationsData.map(
                ([id, country, region, city, district, population]) => ({
                    id,
                    country,
                    region,
                    city,
                    district,
                    population,
                }),
            );

            // Add all locations
            for (const loc of locations) {
                table.set(loc.id, loc);
            }

            // Define multi-level hierarchical partitioning
            table.index(
                () => ["nested", "byCountry", "byCity"], // 3 top level partitions
                (name, partition) => {
                    switch (name) {
                        case "nested":
                            partition.index(
                                // Nested level 1: Index by country
                                (l) => l.country,
                                (_, country) => {
                                    // Nested level 2: Within each country, index by region
                                    country.index(
                                        (l) => l.region,
                                        (_, region) => {
                                            // Nested level 3: Within each region, index by city
                                            region.index(
                                                (l) => l.city,
                                                (_, city) => {
                                                    // Sort each city partition by population
                                                    city.sort(
                                                        (a, b) => b.population - a.population,
                                                    );
                                                },
                                            );
                                        },
                                    );
                                },
                            );
                            break;
                        case "byCountry":
                            partition.index(
                                (l) => l.country,
                                (countryName, country) => {
                                    // Sort each country partition by population
                                    country.sort((a, b) => b.population - a.population);

                                    // IMPORTANT: Memoize only (large + frequently read) partitions
                                    if (countryName === "India" || countryName === "USA") {
                                        country.memo();
                                    }
                                },
                            );
                            break;
                        case "byCity":
                            partition.index(
                                (l) => l.city,
                                (_, city) => {
                                    // Sort each city partition by name
                                    city.sort((a, b) => a.city.localeCompare(b.city));
                                },
                            );
                            break;
                    }
                },
            );

            // Print the full tree structure
            print(table, (location) => `${location.district} (${location.population})`, "🌍 World");
        });

        test("re-indexing", () => {
            const table = new Table<string, ITaggedValue>();
            table.set("1", { tags: ["A", "B"] });
            table.set("2", { tags: ["B", "C"] });

            const indexConfig = {
                ignoredTag: "A",
            };

            table.index((value) => !value.tags.some((tag) => tag === indexConfig.ignoredTag));

            expect(table.partition().keys()).toYield(["2"]);

            // Change index configuration
            indexConfig.ignoredTag = "C";

            table.index(); // Re-index

            expect(table.partition().keys()).toYield(["1"]);
        });

        test("re-index is no-op if index definition is not provided", () => {
            const table = new Table<string, ITaggedValue>();
            table.set("1", { tags: ["A"] });
            table.index();
            expect(table.partitions().length).toBe(0);
        });
    });

    describe("Sorting", () => {
        test("sorting values by comparator", () => {
            const table = new Table<string, IPerson>();
            table.memo(true);
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);

            expect(table.keys()).toYieldOrdered(["2", "1", "3"]);

            table.set("3", { name: "Charlie", age: 10 });

            expect(table.keys()).toYieldOrdered(["3", "2", "1"]);
        });

        test("sort order should be cleared when comparator is null", () => {
            const table = new Table<string, IPerson>();
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
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);
            table.memo(); // Enable memoization to retain order

            expect(table.keys()).toYieldOrdered(["2", "1", "3"]);

            table.batch(() => {
                table.set("3", { name: "Charlie", age: 15 });
                table.delete("2");
                table.set("4", { name: "Dave", age: 40 });
            });

            expect(table.keys()).toYieldOrdered(["3", "1", "4"]);
        });

        test("sort order consistency when values are added, updated or removed when not memoized", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.set("3", { name: "Charlie", age: 35 });

            table.sort((a, b) => a.age - b.age);

            expect(table.keys()).toYieldOrdered(["2", "1", "3"]);

            table.batch(() => {
                table.set("3", { name: "Charlie", age: 15 });
                table.delete("2");
                table.set("4", { name: "Dave", age: 40 });
            });

            expect(table.keys()).toYieldOrdered(["3", "1", "4"]);
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

        test("should notify listeners when sort is cleared", () => {
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });
            table.sort((a, b) => a.age - b.age);

            const listener = vi.fn();
            table.subscribe(listener);

            table.sort(null);
            expect(listener).toHaveBeenCalled();
        });

        test("should apply sort order to partitions recursively and eagerly", () => {
            const table = new Table<string, IPerson>();
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
            const table = new Table<number, IPerson>();

            const totalEntries = 10000;

            // Insert entries with random ages
            table.batch((t) => {
                for (let i = 0; i < totalEntries; i++) {
                    const age = Math.floor(Math.random() * 100);
                    t.set(i, { name: `Person${i}`, age });
                }
            });

            table.memo();

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
            const table = new Table<string, IPerson>();
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
            const table = new Table<string, IPerson>();
            table.set("1", { name: "Alice", age: 30 });
            table.set("2", { name: "Bob", age: 25 });

            const before = Array.from(table.keys());
            table.sort();
            const after = Array.from(table.keys());

            expect(after).toEqual(before);
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
