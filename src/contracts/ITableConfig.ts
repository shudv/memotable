/**
 * Configuration options for table initialization.
 * @template T Type of items stored in the table
 */
export interface ITableConfig<T> {
    /**
     * Unique identifier for the table.
     */
    name: string;

    /**
     * Function to determine if two items are equal.
     * Used to detect meaningful changes and avoid unnecessary updates.
     */
    isEqual: (item1: T, item2: T) => boolean;

    /**
     * Enable tracking of modifications (upserts/deletes) for change detection.
     */
    deltaTracking: boolean;

    /**
     * Determine whether a table node should be materialized in memory.
     *
     * @param path Hierarchical path to this node
     * @param isTerminal Whether this is a leaf node with no further partitions
     * @returns true to keep node in memory, false to compute on-demand
     */
    shouldMaterialize: (path: string[], isTerminal: boolean) => boolean;
}
