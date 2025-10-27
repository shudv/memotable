/**
 * Interface for a view that is a read-only collection of items that can be filtered and sorted.
 */
export interface IViewTable<T> {
    /**
     * Apply a new comparator to the table view.
     *
     * @param comparator The comparator function to apply, or null to remove sorting
     */
    applyComparator(comparator: IComparator<T> | null): void;

    /**
     * Apply a new filter to the table view.
     *
     * @param filter The filter function to apply, or null to remove filtering
     */
    applyFilter(filter: IFilter<T> | null): void;

    /**
     * Refresh the view based on the current filter and comparator.
     * This is needed when external factors affect the applied filter/comparator.
     */
    refreshView(): void;
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
