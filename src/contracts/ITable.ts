import { IBatchableTable } from "./IBatchableTable";
import { IReadonlyTable } from "./IReadonlyTable";

/**
 * A mutable table supporting incremental updates, recursive derived views,
 * and map-like operations.
 *
 * @template K Type of the keys
 * @template V Type of the stored values
 */
export interface ITable<K, V> extends IReadonlyTable<K, V>, Map<K, V>, IBatchableTable<K, V> {
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
     * Executes a provided function once for each key/value pair in the table.
     * @param callbackfn Function to execute for each element.
     * @param thisArg Value to use as `this` when executing `callbackfn`.
     */
    forEach<T>(callbackfn: (value: V, key: K, table: ITable<K, V>) => void, thisArg?: T): void;
}
