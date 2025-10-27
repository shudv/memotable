import { IDeltaTrackedTable } from './IDeltaTrackedTable';
import { IReadOnlyTable } from './IReadOnlyTable';

/**
 * Interface for a table that also supports mutation operations on top of basic features.
 * @template T Type of the items in the table
 */
export interface ITable<T> extends IReadOnlyTable<T>, IDeltaTrackedTable {
    /**
     * Set an item in the table
     * @param id Item id
     * @param value Item value
     */
    set(id: string, value: T | null): boolean;

    /**
     * Refresh an item.
     *
     * This is needed when an item is either mutated in place or when external
     * factors affect the derived structures (indexes or views).
     *
     * @param id Item id
     */
    refresh(id: string): void;

    /**
     * Delete an item from the table
     * @param id Item id
     */
    delete(id: string): boolean;

    /**
     * Run a batch of operations on the table
     * @param batch Function that receives the table as an argument and performs multiple operations on it
     */
    runBatch(batch: (t: ITable<T>) => void): boolean;
}
