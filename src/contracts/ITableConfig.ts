/**
 * Configuration options for table initialization.
 * @template T Type of items stored in the table
 */
export interface ITableConfig<T> {
    /**
     * Function to determine if two items are equal.
     * Used to detect meaningful changes and avoid unnecessary updates.
     */
    equals: (item1: T, item2: T) => boolean;

    /**
     * Enable tracking of modifications (upserts/deletes) for change detection.
     */
    track: boolean;
}
