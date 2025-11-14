import { IReadOnlyTable } from "./IReadOnlyTable";

/**
 * Interface for a table that also supports mutation operations on top of basic features.
 * @template T Type of the items in the table
 */
export interface ITable<T> extends IReadOnlyTable<T> {
    /**
     * Set an item in the table
     * @param id Item id
     * @param value Item value
     */
    set(id: string, value: T | null): boolean;

    /**
     * Refresh an item.
     *
     * This is needed when an item is either mutated in place or when external
     * factors affect the derived structures (indexes or views).
     *
     * @param id Item id
     */
    refresh(id: string): void;

    /**
     * Run a batch of operations on the table
     * @param fn Function that receives the table as an argument and performs multiple edit operations on it
     */
    batch(fn: (t: ITable<T>) => void): boolean;
}
