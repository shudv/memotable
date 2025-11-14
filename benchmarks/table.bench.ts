import { bench, describe } from "vitest";
import { Table } from "../src/Table";

describe("Table Benchmarks", () => {
    describe("Basic Operations", () => {
        bench("set 1000 items", () => {
            const table = new Table<{ value: number }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), { value: i });
            }
        });

        bench("get 1000 items", () => {
            const table = new Table<{ value: number }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), { value: i });
            }

            for (let i = 0; i < 1000; i++) {
                table.get(String(i));
            }
        });

        bench("batch set 1000 items", () => {
            const table = new Table<{ value: number }>();
            table.batch((t) => {
                for (let i = 0; i < 1000; i++) {
                    t.set(String(i), { value: i });
                }
            });
        });

        bench("delete 1000 items", () => {
            const table = new Table<{ value: number }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), { value: i });
            }

            for (let i = 0; i < 1000; i++) {
                table.set(String(i), null);
            }
        });
    });

    describe("Sorting", () => {
        bench("sort 1000 items", () => {
            const table = new Table<{ value: number }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), { value: Math.random() });
            }

            table.sort((a, b) => a.value - b.value);
        });

        bench("update sorted table with 100 changes", () => {
            const table = new Table<{ value: number }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), { value: i });
            }
            table.sort((a, b) => a.value - b.value);

            for (let i = 0; i < 100; i++) {
                table.set(String(i), { value: 1000 - i });
            }
        });
    });

    describe("Indexing", () => {
        bench("create index on 1000 items with 10 buckets", () => {
            const table = new Table<{ id: string; bucket: number }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), { id: String(i), bucket: i % 10 });
            }

            table.index((item) => String(item.bucket));
        });

        bench("update indexed table with 100 changes", () => {
            const table = new Table<{ id: string; bucket: number }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), { id: String(i), bucket: i % 10 });
            }
            table.index((item) => String(item.bucket));

            for (let i = 0; i < 100; i++) {
                table.set(String(i), { id: String(i), bucket: (i + 1) % 10 });
            }
        });

        bench("multi-value index on 1000 items", () => {
            const table = new Table<{ id: string; tags: string[] }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), {
                    id: String(i),
                    tags: [String(i % 5), String(i % 7)],
                });
            }

            table.index((item) => item.tags);
        });

        bench("access bucket 100 times", () => {
            const table = new Table<{ id: string; bucket: number }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), { id: String(i), bucket: i % 10 });
            }
            table.index((item) => String(item.bucket));

            for (let i = 0; i < 100; i++) {
                table.partition(String(i % 10)).ids();
            }
        });
    });

    describe("Subscriptions", () => {
        bench("notify 100 subscribers on change", () => {
            const table = new Table<{ value: number }>();
            const listeners = Array.from({ length: 100 }, () => () => {});
            listeners.forEach((listener) => table.subscribe(listener));

            table.set("1", { value: 1 });
        });
    });

    describe("Delta Tracking", () => {
        bench("track 1000 modifications", () => {
            const table = new Table<{ value: number }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), { value: i });
            }

            table.nextDelta();
        });

        bench("track with maxItems=100", () => {
            const table = new Table<{ value: number }>();
            for (let i = 0; i < 1000; i++) {
                table.set(String(i), { value: i });
            }

            table.nextDelta(100);
        });
    });
});
