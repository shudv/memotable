import { IReadOnlyTable } from "./IReadOnlyTable";

// Define a type that includes only the mutation methods of ITable that can be batched
export type TBatch<K, V> = Pick<ITable<K, V>, "set" | "delete" | "touch">;

/**
 * Interface for a table that also supports mutation operations on top of existing features.
 * @template K Type of the keys
 * @template V Type of the values in the table
 */
export interface ITable<K, V> extends IReadOnlyTable<K, V> {
    /**
     * Set a value in the table
     * @param key Item key
     * @param value Item value
     */
    set(key: K, value: V): void;

    /**
     * Delete a value from the table
     * @param key Item key
     *
     * @returns True if the key was deleted, false if the key was not found
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
    batch(fn: (t: TBatch<K, V>) => void): void;
}
