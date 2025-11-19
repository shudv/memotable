/**
 * A comparison function used to determine ordering.
 *
 * It follows the same contract as `Array.prototype.sort`: negative if `a < b`,
 * zero if equal, positive if `a > b`.
 */
export type IComparator<V> = (a: V, b: V) => number;

/**
 * Adds sorting capabilities to a table or derived table.
 *
 * Sorting defines the order of values in this table. Once applied, the order
 * automatically propagates to all descendant partitions unless they define
 * their own local comparator.
 */
export interface ISortableTable<V> {
    /**
     * Set or clear the comparator used to sort this table.
     *
     * Passing a comparator enables sorting; passing `null` removes it and
     * restores insertion order. Changing the comparator re-sorts the table
     * immediately and updates all affected partitions.
     *
     * @param comparator Comparison function, or `null` to disable sorting.
     */
    sort(comparator: IComparator<V> | null): void;
}
