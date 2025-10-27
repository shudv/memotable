// Contracts
import { IDelta } from "./IDeltaTrackedTable";
import { IIndexedTable } from "./IIndexedTable";
import { IObservable } from "./IObservable";
import { IViewTable } from "./IViewTable";

/**
 * Interface for a read-only table that supports read operations, indexing, sorting, filtering.
 * @template T Type of the items in the table
 */
export interface IReadOnlyTable<T> extends IIndexedTable<T>, IViewTable<T>, IObservable<IDelta> {
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
    itemIds(): string[];
}
