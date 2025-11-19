// Contracts
import { IIndexableTable } from "./IIndexableTable";
import { IMemoizable } from "./IMemoizableTable";
import { IObservableTable } from "./IObservableTable";
import { ISortableTable } from "./ISortableTable";

/**
 * A derived view of a table.
 *
 * A derived table combines four capabilities:
 *   - read access to key/value pairs (Map-like)
 *   - recursive partitioning (indexing)
 *   - sorting with automatic downward propagation
 *   - subscription to changes at this node
 *   - memoization of its and its children's views
 *
 * Derived tables never expose mutation operations. They represent stable
 * views in the table tree, and all state changes propagate from their parent.
 *
 * @template K Type of the keys
 * @template V Type of the stored values
 */
export interface IReadonlyTable<K, V>
    extends ReadonlyMap<K, V>,
        IIndexableTable<K, V>,
        ISortableTable<V>,
        IObservableTable<K>,
        IMemoizable {
    /**
     * Enable or disable memoization of this table's view.
     *
     * When enabled, the table stores its computed sorted keys and values so
     * subsequent reads are fast. When disabled, the table computes ordering
     * lazily on demand and does not retain cached arrays. It's a trade-off
     * between memory usage and read performance.
     *
     * @param flag Whether to enable materialized view caching.
     */
    memo(flag?: boolean): void;

    /**
     * Returns the values in this table as a concrete array in iteration order.
     *
     * If the table is materialized, this returns the cached array used internally
     * for fast reads. Otherwise, it produces a new array by consuming the table's
     * value iterator. The returned array always reflects the table's ordered view.
     *
     * This method is intended for environments (such as React) that require arrays
     * for list rendering. For general iteration, prefer the `values()` iterator.
     *
     * @returns An array containing the table's values in the correct iteration order.
     */
    toArray(): readonly V[];
}
