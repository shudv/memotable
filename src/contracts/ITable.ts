import { IBatchableTable } from "./IBatchableTable";
import { IReadonlyTable } from "./IReadonlyTable";

/**
 * A mutable table supporting incremental updates, recursive derived views,
 * and map-like operations.
 *
 * @template K Type of the keys
 * @template V Type of the stored values
 */
export interface ITable<K, V>
    extends IReadonlyTable<K, V>,
        Omit<Map<K, V>, "forEach" | "set">,
        IBatchableTable<K, V> {
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
}
