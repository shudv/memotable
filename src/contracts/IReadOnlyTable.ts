// Contracts
import { IDelta } from "./IDeltaTrackedTable";
import { IIndexableTable } from "./IIndexableTable";
import { IObservable } from "./IObservable";
import { ISortableTable } from "./ISortableTable";

/**
 * Interface for a read-only table that supports read operations, indexing, sorting.
 * @template T Type of the items in the table
 */
export interface IReadOnlyTable<T>
    extends IIndexableTable<T>,
        ISortableTable<T>,
        IObservable<IDelta> {
    /**
     * Get the table item with the given id
     * @param id Item id
     */
    get(id: string): T | null;

    /**
     * Get all items in the table
     */
    items(): T[];

    /**
     * Get all items in the table
     */
    ids(): string[];
}
