// Tables
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
export type IIndexDefinition<T> = (item: T) => string | string[] | readonly string[] | null | undefined;

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
     * (IReadOnlyTable<T>) only exposes read, indexing and view capabilities,
     * preventing direct mutations. Items are mutated through the parent table.
     * This enables the recursive structure where partitions (themselves tables)
     * can create further indexes and sub-partitions.
     */
    partition(key: string): IReadOnlyTable<T>;
}

/**
 * Interface for a table that supports indexing items
 */
export interface IIndexedTable<T> {
    /**
     * Access an index by name.
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
     */
    registerIndex(name: string, definition: IIndexDefinition<T>): boolean;

    /**
     * Refresh an index by name.
     *
     * This will revaluate all items in the table against the index definition. This is
     * needed when an index definition changes or if items were modified outside of
     * the table API.
     *
     * @param name The name of the index to refresh
     */
    refreshIndex(name: string): void;

    /**
     * Drop an index by name.
     * @param name The name of the index to drop
     */
    dropIndex(name: string): boolean;
}

/**
 * Interface for a modified batch of items in a table
 */
export interface IModifiedBatch {
    /**
     * Ids that were upserted
     */
    upserted: string[];

    /**
     * Ids that were deleted
     */
    deleted: string[];
}

/**
 * Interface for a table that supports-tracking of modified items.
 */
export interface ITrackedTable {
    /**
     * Get the next modified batch of items that need to be written to the storage
     * @param maxItems Maximum number of items to include in the batch (defaults to mac available items)
     */
    nextModifiedBatch(maxItems?: number): IModifiedBatch;
}

/**
 * Interface for a view that is a read-only collection of items that can be filtered and sorted.
 */
export interface IView<T> {
    /**
     * Apply a new comparator to the table view.
     */
    applyComparator(comparator: IComparator<T> | null): void;

    /**
     * Apply a new filter to the table view.
     */
    applyFilter(filter: IFilter<T> | null): void;
}

/**
 * Function that defines how items should be ordered in the view.
 * The `tablePath` parameter allows customization per partition.
 */
export type IComparator<T> = (item1: T, item2: T, tablePath: string[]) => number;

/**
 * Function that defines which items should be visible in a view
 * The `tablePath` parameter allows customization per partition.
 */
export type IFilter<T> = (item: T, tablePath: string[]) => boolean;


/**
 * Interface for a read-only table that supports read operations, indexing, sorting, filtering and change tracking.
 * @template T Type of the items in the table
 */
export interface IReadOnlyTable<T> extends IIndexedTable<T>, IView<T>, ITrackedTable {
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

    /**
     * Refresh an item.
     *
     * This is needed when an item is either mutated in place or when external
     * factors affect the derived structures (indexes or views).
     *
     * @param id Item id
     */
    refresh(id: string): void;
}

/**
 * Interface for a table that also supports edit operations on top of basic features.
 * @template T Type of the items in the table
 */
export interface ITable<T> extends IReadOnlyTable<T> {
    /**
     * Set an item in the table
     * @param id Item id
     * @param value Item value
     */
    set(id: string, value: T | null): boolean;

    /**
     * Change the key of an existing item in the table
     * @param id Key at which the item is currently mapped
     * @param newId New key to map the item to
     */
    reKey(id: string, newId: string): boolean;

    /**
     * Delete an item from the table
     * @param id Item id
     */
    delete(id: string): boolean;

    /**
     * Execute a batch of operations on the table
     * @param batch Function that receives the table as an argument and performs multiple operations on it
     */
    executeBatch(batch: (table: ITable<T>) => void): boolean;
}
