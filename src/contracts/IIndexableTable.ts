import { IReadOnlyTable } from "./IReadOnlyTable";

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
    item: T,
) => string | string[] | readonly string[] | null | undefined;

/**
 * Interface for a table that supports indexing items
 */
export interface IIndexableTable<T> {
    /**
     * Access an index by name.
     * @param name The name of the index
     *
     * @returns The index with the given name
     */
    partition(value: string): IReadOnlyTable<T>;

    partitions(): string[];

    /**
     * Register an index with the given definition if it's not already registered.
     * NOTE: This method is idempotent - will NOT overwrite or rebuild an existing index.
     *
     * This can be used to lazily define indexes on a read path without paying the cost
     * of rebuilding them if they already exist.
     *
     * @param name The name of the index to register
     * @param definition The definition of the index
     */
    index(definition: IIndexDefinition<T> | null): void;
}
