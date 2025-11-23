// Contracts
import { IIndexableTable } from "./IIndexableTable";
import { IMemoizable } from "./IMemoizable";
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
    extends Omit<ReadonlyMap<K, V>, "forEach">,
        IIndexableTable<K, V>,
        ISortableTable<V>,
        IObservableTable<K>,
        IMemoizable {}
