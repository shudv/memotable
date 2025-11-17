/**
 * Interface for a table that can supports sorting.
 */
export interface ISortableTable<V> {
    /**
     * Sort the table.
     *
     * @param comparator The comparator function to apply, or null to remove sorting
     */
    sort(comparator: IComparator<V> | null): void;
}

/**
 * Function that defines how values should be ordered in the table.
 */
export type IComparator<V> = (value1: V, value2: V) => number;
