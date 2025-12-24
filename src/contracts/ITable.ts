import { IReadonlyTable } from "./IReadonlyTable";

/**
 * A mutable table supporting incremental updates, recursive derived views,
 * and map-like operations.
 *
 * @template K Type of the keys
 * @template V Type of the stored values
 */
export interface ITable<K, V> extends IReadonlyTable<K, V>, Omit<Map<K, V>, "forEach" | "set"> {
    /**
     * Set or update the value associated with the given key.
     *
     * If the key already exists, its value is replaced. If not, a new
     * key/value pair is added to the table.
     *
     * @param key Key of the item being set.
     * @param value Value to associate with the key.
     */
    set(key: K, value: V): void;

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
     * Runs a group of edits on the table as a single atomic batch.
     *
     * All mutations performed inside the callback are queued and applied
     * only after the callback returns, avoiding intermediate recomputation
     * of derived views and reducing update overhead. This is useful when
     * performing multiple related edits that do not need to be reflected
     * in the table one-by-one.
     *
     * @param fn A function that receives the batch interface for performing
     *           multiple edits.
     */
    batch(fn: (t: IBatch<K, V>) => void): void;
}

/**
 * A narrower table interface used for issuing edit commands in a batch.
 * This does not need read API's because reads can be made from the actual
 * table reference from a consistent snapshot.
 */
export interface IBatch<K, V> extends Pick<ITable<K, V>, "set" | "touch"> {
    /**
     * Remove the given key (and its value) from the table.
     * @param key
     */
    delete(key: K): void;
}
