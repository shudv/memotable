import { IReadonlyTable } from "./IReadonlyTable";

/**
 * A restricted view of a table that is safe to use inside a batch.
 *
 * During a batch, only data mutations (`set`, `delete`, `touch`) may be
 * performed. Structural changes — such as defining new derived tables or
 * changing sorting/indexing rules — are not allowed and must be configured
 * before the batch begins.
 *
 * This type prevents accidental structural edits during batch execution.
 */
export type TBatchable<K, V> = Exclude<ITable<K, V>, "sort" | "index">;

/**
 * A mutable table supporting incremental updates, recursive derived views,
 * and map-like operations.
 *
 * @template K Type of the keys
 * @template V Type of the stored values
 */
export interface ITable<K, V> extends IReadonlyTable<K, V>, Map<K, V> {
    /**
     * Marks a value as changed without replacing it.
     *
     * Use this when a value is mutated in place, or when external factors
     * require the table to re-evaluate indexing or sorting for this key.
     *
     * @param key Key of the item being refreshed.
     */
    touch(key: K): void;

    /**
     * Executes multiple mutations as a single grouped update.
     *
     * Inside a batch, you may perform data edits (`set`, `delete`, `touch`),
     * but you must not alter the table's structure (e.g., by defining new
     * derived tables or changing sorting rules). Structural configuration
     * must be done before the batch starts.
     *
     * The batch function receives a restricted table type that enforces this.
     *
     * @param fn Function that performs multiple data-level edits on the table.
     */
    batch(fn: (t: TBatchable<K, V>) => void): void;

    /**
     * Executes a provided function once for each key/value pair in the table.
     * @param callbackfn Function to execute for each element.
     * @param thisArg Value to use as `this` when executing `callbackfn`.
     */
    forEach<T>(callbackfn: (value: V, key: K, table: ITable<K, V>) => void, thisArg?: T): void;
}
