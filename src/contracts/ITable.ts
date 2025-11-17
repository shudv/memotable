import { IReadOnlyTable } from "./IReadOnlyTable";

/**
 * Interface for a table that also supports mutation operations on top of existing features.
 * @template K Type of the item keys
 * @template V Type of the items in the table
 */
export interface ITable<K, V> extends IReadOnlyTable<K, V> {
    /**
     * Set a value in the table
     * @param key Item key
     * @param value Item value
     */
    set(key: K, value: V): boolean;

    /**
     * Delete a value from the table
     * @param key Item key
     */
    delete(key: K): boolean;

    /**
     * Touch a value in the table
     *
     * This is needed when a value is either mutated in place or when external
     * factors affect the derived structures (indexes or order).
     *
     * @param key Item key
     */
    touch(key: K): void;

    /**
     * Run a batch of operations on the table
     * @param fn Function that receives the table as an argument and performs multiple edit operations on it
     */
    batch(fn: (t: ITable<K, V>) => void): boolean;
}
