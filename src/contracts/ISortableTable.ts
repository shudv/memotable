/**
 * Interface for a view that is a read-only collection of items that can be filtered and sorted.
 */
export interface ISortableTable<T> {
    /**
     * Sort the table view.
     *
     * @param comparator The comparator function to apply, or null to remove sorting
     */
    sort(comparator: IComparator<T> | null): void;
}

/**
 * Function that defines how items should be ordered in the view.
 * The `tablePath` parameter allows customization per partition.
 */
export type IComparator<T> = (item1: T, item2: T) => number;
