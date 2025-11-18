// Contracts
import { IIndexableTable } from "./IIndexableTable";
import { IObservableTable } from "./IObservableTable";
import { ISortableTable } from "./ISortableTable";

/**
 * Interface for a read-only table that supports read operations, indexing, sorting.
 *
 * @template K Type of the keys
 * @template V Type of the values in the table
 */
export interface IReadOnlyTable<K, V>
    extends IIndexableTable<K, V>,
        ISortableTable<V>,
        IObservableTable<K> {
    /**
     * Get value with the given key
     * @param key Item key
     */
    get(key: K): V | undefined;

    /**
     * Get all keys in the table
     */
    keys(): K[];

    /**
     * Get all values in the table
     */
    values(): V[];

    size(): number;
}
