import { ITrackedTable } from "./contracts/ITrackedTable";
import { Table } from "./Table";

export class TrackedTable<T> extends Table<T> implements ITrackedTable {
    private readonly _modifiedIds = new Set<string>();

    public constructor(private readonly equals: (item1: T, item2: T) => boolean) {
        super();
    }

    public override set(id: string, value: T | null): boolean {
        // Step 1: Check if the item needs to be updated
        const currentValue = this.get(id);
        if (
            (currentValue == null && value == null) ||
            (currentValue != null && value != null && this.equals(currentValue, value))
        ) {
            return false;
        }

        // Step 2: Update the item in the table
        super.set(id, value);

        // Step 3: Flag the item as modified
        this._modifiedIds.add(id);

        return true;
    }

    public nextDelta(maxItems?: number): string[] {
        const delta: string[] = [];
        let count = 0;

        for (const id of this._modifiedIds) {
            delta.push(id);
            this._modifiedIds.delete(id); // safe during iteration in JS

            if (maxItems && ++count >= maxItems) break;
        }

        return delta;
    }
}
