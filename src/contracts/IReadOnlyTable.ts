// Contracts
import { IIndexableTable } from "./IIndexableTable";
import { IObservableTable } from "./IObservableTable";
import { ISortableTable } from "./ISortableTable";

/**
 * Interface for a read-only table that supports read operations, indexing, sorting.
 * @template T Type of the items in the table
 */
export interface IReadOnlyTable<K, V>
    extends IIndexableTable<K, V>,
        ISortableTable<V>,
        IObservableTable<K> {
    /**
     * Get the table item with the given id
     * @param id Item id
     */
    get(id: K): V | undefined;

    /**
     * Get all items in the table
     */
    values(): V[];

    /**
     * Get all items in the table
     */
    keys(): K[];
}
