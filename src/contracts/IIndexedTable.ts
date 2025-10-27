import { IReadOnlyTable } from './IReadOnlyTable';

/**
 * Defines an index configuration.
 *
 * An index definition is a simple a accessor function that returns the partition
 * keys for any given item in the table.
 *
 * @example
 * ```typescript
 * // One partition for every unique task status
 * (task) => task.status;
 * ```
 */
export type IIndexDefinition<T> = (
    item: T
) => string | string[] | readonly string[] | null | undefined;

/**
 * Represents an index within a table, providing access to its partitions.
 */
export interface IIndex<T> {
    /**
     * Get all partition keys that exist within this index.
     */
    keys(): string[];

    /**
     * Access a specific partition within this index.
     *
     * While each partition is a full table internally, the public interface
     * (IReadOnlyTable<T>) does not expose mutation capabilities. Items are
     * mutated through the parent table. This enables the recursive structure
     * where partitions can create further indexes and sub-partitions.
     */
    partition(key: string): IReadOnlyTable<T>;
}

/**
 * Interface for a table that supports indexing items
 */
export interface IIndexedTable<T> {
    /**
     * Access an index by name.
     * @param name The name of the index
     *
     * @returns The index with the given name
     */
    index(name: string): IIndex<T>;

    /**
     * Register an index with the given definition if it's not already registered.
     * NOTE: This method is idempotent - will NOT overwrite or rebuild an existing index.
     *
     * This can be used to lazily define indexes on a read path without paying the cost
     * of rebuilding them if they already exist.
     *
     * @param name The name of the index to register
     * @param definition The definition of the index
     * @returns True if the index was registered, false if it already existed
     */
    registerIndex(name: string, definition: IIndexDefinition<T>): boolean;

    /**
     * Refresh an index by name.
     *
     * This will revaluate all items in the table against the index definition. This is
     * needed when an index definition changes because of external changes.
     *
     * @example
     * ```typescript
     * // Change an index definition
     * const indexConfig = { cutoff: 8 };
     * table.registerIndex("highPriority", (task) => task.priority >= indexConfig.cutoff ? "high" : "normal");
     *
     * // External change that updates the index definition
     * indexConfig.cutoff = 5;
     *
     * // Refresh the index to apply the new definition
     * table.refreshIndex("highPriority");
     * ```
     *
     * @param name The name of the index to refresh
     */
    refreshIndex(name: string): void;

    /**
     * Drop an index by name.
     * @param name The name of the index to drop
     * @return True if the index was dropped, false if it did not exist
     */
    dropIndex(name: string): boolean;
}
