import { TrackedTable } from "./TrackedTable";

interface TestItem {
    id: string;
    value: number;
}

describe("TrackedTable", () => {
    let table: TrackedTable<TestItem>;
    const equals = (a: TestItem, b: TestItem) => a.id === b.id && a.value === b.value;

    beforeEach(() => {
        table = new TrackedTable<TestItem>(equals);
    });

    describe("set and tracking", () => {
        it("should track new items as modified", () => {
            const item = { id: "1", value: 100 };
            const result = table.set("1", item);

            expect(result).toBe(true);
            expect(table.get("1")).toEqual(item);
            expect(table.nextDelta()).toEqual(["1"]);
        });

        it("should track updated items as modified", () => {
            const item1 = { id: "1", value: 100 };
            const item2 = { id: "1", value: 200 };

            table.set("1", item1);
            table.nextDelta(); // clear delta

            const result = table.set("1", item2);

            expect(result).toBe(true);
            expect(table.get("1")).toEqual(item2);
            expect(table.nextDelta()).toEqual(["1"]);
        });

        it("should not track when setting equal value", () => {
            const item1 = { id: "1", value: 100 };
            const item2 = { id: "1", value: 100 };

            table.set("1", item1);
            table.nextDelta(); // clear delta

            const result = table.set("1", item2);

            expect(result).toBe(false);
            expect(table.nextDelta()).toEqual([]);
        });

        it("should track deletion as modified", () => {
            const item = { id: "1", value: 100 };
            table.set("1", item);
            table.nextDelta(); // clear delta

            const result = table.set("1", null);

            expect(result).toBe(true);
            expect(table.get("1")).toBeNull();
            expect(table.nextDelta()).toEqual(["1"]);
        });

        it("should not track when setting null on non-existent item", () => {
            const result = table.set("1", null);

            expect(result).toBe(false);
            expect(table.nextDelta()).toEqual([]);
        });

        it("should not track when setting null multiple times", () => {
            const item = { id: "1", value: 100 };
            table.set("1", item);
            table.set("1", null);
            table.nextDelta(); // clear delta

            const result = table.set("1", null);

            expect(result).toBe(false);
            expect(table.nextDelta()).toEqual([]);
        });
    });

    describe("nextDelta", () => {
        it("should return empty array when no modifications", () => {
            expect(table.nextDelta()).toEqual([]);
        });

        it("should return all modified IDs", () => {
            table.set("1", { id: "1", value: 100 });
            table.set("2", { id: "2", value: 200 });
            table.set("3", { id: "3", value: 300 });

            const delta = table.nextDelta();
            expect(delta).toHaveLength(3);
            expect(delta).toContain("1");
            expect(delta).toContain("2");
            expect(delta).toContain("3");
        });

        it("should clear returned IDs from tracking", () => {
            table.set("1", { id: "1", value: 100 });
            table.set("2", { id: "2", value: 200 });

            const delta1 = table.nextDelta();
            expect(delta1).toHaveLength(2);

            const delta2 = table.nextDelta();
            expect(delta2).toEqual([]);
        });

        it("should respect maxItems limit", () => {
            table.set("1", { id: "1", value: 100 });
            table.set("2", { id: "2", value: 200 });
            table.set("3", { id: "3", value: 300 });

            const delta1 = table.nextDelta(2);
            expect(delta1).toHaveLength(2);

            const delta2 = table.nextDelta();
            expect(delta2).toHaveLength(1);
        });

        it("should track same ID only once even with multiple modifications", () => {
            table.set("1", { id: "1", value: 100 });
            table.set("1", { id: "1", value: 200 });
            table.set("1", { id: "1", value: 300 });

            const delta = table.nextDelta();
            expect(delta).toEqual(["1"]);
        });

        it("should handle modifications after partial delta retrieval", () => {
            table.set("1", { id: "1", value: 100 });
            table.set("2", { id: "2", value: 200 });

            table.nextDelta(1); // get only 1 item

            table.set("3", { id: "3", value: 300 });

            const delta = table.nextDelta();
            expect(delta).toHaveLength(2);
            expect(delta).toContain("3");
        });
    });
});
