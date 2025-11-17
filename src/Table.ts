// Contracts
import { ITable, TBatch } from "./contracts/ITable";
import { IComparator } from "./contracts/ISortableTable";
import { IDelta } from "./contracts/IObservableTable";
import { IIndexDefinition } from "./contracts/IIndexableTable";
import { IReadOnlyTable } from "./contracts/IReadOnlyTable";

/**
 * Table implementation that supports basic CRUD, batching, indexing and sorting.
 * @template T Type of the values in the table
 */
export class Table<K, V> implements ITable<K, V> {
    // #region BASIC OPERATIONS

    // A map to hold the actual values in the table
    private _map: Map<K, V> = new Map();

    // Flag to indicate if a batch operation is in progress
    private _isBatchOperationInProgress = false;
    private _keysUpdatedInCurrentBatch = new Set<K>();

    public get(key: K): V | undefined {
        return this._map.get(key);
    }

    public values(): V[] {
        return this.keys().map((key) => this._map.get(key)!);
    }

    public keys(): K[] {
        // Return the materialized sorted keys if available, otherwise sort at read time
        return this._sortedKeys ? this._sortedKeys : this._sortKeys(this._comparator);
    }

    public set(key: K, value: V): void {
        this._map.set(key, value);
        this._propagateChanges([key]);
    }

    public delete(key: K): boolean {
        if (!this._map.has(key)) {
            return false;
        }

        this._map.delete(key);
        this._propagateChanges([key]);
        return true;
    }

    public touch(key: K) {
        this._propagateChanges([key]);
    }

    public batch(fn: (t: TBatch<K, V>) => void): void {
        // Step 1: Run the batch of operations and mark start and end to disable change propagation on every set/delete
        this._isBatchOperationInProgress = true;
        fn(this);
        this._isBatchOperationInProgress = false;

        // Step 2: After the batch is complete, propagate all accumulated changes
        if (this._keysUpdatedInCurrentBatch.size > 0) {
            this._propagateChanges(Array.from(this._keysUpdatedInCurrentBatch));
            this._keysUpdatedInCurrentBatch.clear();
        }
    }

    // #endregion

    // #region SUBSCRIPTIONS

    // Set of listeners subscribed to changes in the table
    private _listeners: Set<(delta: IDelta<K>) => void> = new Set();

    public subscribe = (listener: (delta: IDelta<K>) => void): (() => void) => {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    };

    // #endregion

    // #region SORTING

    // The materialized view of the table that satisfies the current filter and comparator
    private _sortedKeys: K[] | null = null;
    private _comparator: IComparator<V> | null = null;

    public sort(comparator: IComparator<V> | null) {
        this._comparator = comparator;

        // Step 1: Apply sorting to all partitions
        for (const partition of Object.values(this._partitions)) {
            partition.sort(comparator);
        }

        // Step 2: Reset current materialized view, if any
        this._sortedKeys = null;

        // Step 3: Refresh the materialized view based on the new comparator
        this._refereshMaterialization();

        // Step 4: Notify listeners about the change in order
        if (comparator) {
            this._notifyListeners([]);
        }
    }

    // #endregion

    // #region INDEXING

    /** Normalized index accessor function that returns latest partition names a give value should be in */
    private _indexAccessor: ((value: V | undefined) => readonly string[]) | null = null;

    /** Optional partition initializer function */
    private _partitionInitializer?: (name: string, partition: IReadOnlyTable<K, V>) => void;

    /** Map of keys to their current partition names (used for diffing against new updates) */
    private _partitionNames: Map<K, readonly string[]> = new Map();

    /** All partitions created by this index */
    private _partitions: Record<string, ITable<K, V>> = {};

    public index(
        definition: IIndexDefinition<V>,
        partitionInitializer?: (name: string, partition: IReadOnlyTable<K, V>) => void,
    ): void;
    public index(definition: null): void;
    public index(
        definition: IIndexDefinition<V> | null,
        partitionInitializer?: (name: string, partition: IReadOnlyTable<K, V>) => void,
    ): void {
        if (definition == null) {
            this._indexAccessor = null;
            this._partitions = {};
            this._partitionNames = new Map();
            this._partitionInitializer = undefined;
            return;
        }

        // Normalize the definition
        this._indexAccessor = (value: V | undefined) => {
            if (value == undefined) {
                return [] as readonly string[];
            }

            const keyOrKeys = definition(value);
            if (keyOrKeys == null /** or undefined */) {
                return [] as readonly string[];
            }

            return Array.isArray(keyOrKeys)
                ? (keyOrKeys as readonly string[])
                : ([keyOrKeys] as readonly string[]);
        };
        this._partitionInitializer = partitionInitializer;

        this._applyIndexUpdate(this.keys(), false); // Build index membership for all existing values
        this._refereshMaterialization();
    }

    public partition(name: string): IReadOnlyTable<K, V> {
        return this._getPartition(name);
    }

    public partitions(): string[] {
        return Object.keys(this._partitions).filter(
            (name) => this._getPartition(name).keys().length > 0,
        );
    }

    // #endregion

    // #region PRIVATE HELPERS

    private _getPartition(name: string): ITable<K, V> {
        return (
            this._partitions[name] ??
            (() => {
                // Step 1: Create a new partition table
                const table = new Table<K, V>();

                // Step 2: Propagate parent sorting to the partition
                table.sort(this._comparator);

                // Step 3: Initialize the partition if an initializer is provided
                this._partitionInitializer?.(name, table);

                // Step 4: Store and return the partition
                return (this._partitions[name] = table);
            })()
        );
    }

    /**
     * Propagate changes to indexes, views and notify subscribers.
     * @param updatedKeys Array of keys that have been updated
     */
    private _propagateChanges(updatedKeys: K[]) {
        if (this._isBatchOperationInProgress) {
            // If a batch operation is in progress, we record the updated key for later processing
            for (const key of updatedKeys) {
                this._keysUpdatedInCurrentBatch.add(key);
            }
        } else {
            // Step 1: Update indexes if any
            this._applyIndexUpdate(updatedKeys);

            // Step 2: Update view
            this._applyViewUpdate(updatedKeys);

            // Step 3: Notify subscribers about the changes
            this._notifyListeners(updatedKeys);
        }
    }

    /**
     * Apply updates to the indexes for the given keys.
     * This method recalculates the partition keys for each value and updates the indexes accordingly.
     * @param updatedKeys Array of keys for which index membership needs to be recalculated
     * @param valuesUpdated Flag indicating whether the values themselves were updated (true) or just refreshed (false)
     */
    private _applyIndexUpdate(updatedKeys: K[], valuesUpdated: boolean = true) {
        // Step 1: Calculate update batches for all partitions for given key's
        // E.g. { "P1": Map { "key1" => value1, "key2" => null } } represents that key1 should be added/updated and key2 should be removed from partition "P1"
        const batches: Record<string, Map<K, V | null>> = {};
        for (const key of updatedKeys) {
            const currentPartitions = this._partitionNames.get(key) ?? [];
            const targetPartitions = this._indexAccessor
                ? this._indexAccessor(this._map.get(key))
                : [];

            // Mark for removal from all current partitions
            for (const name of currentPartitions) {
                batches[name] ??= new Map<K, V | null>();
                batches[name].set(key, null);
            }

            // Mark for addition to all target partitions
            for (const name of targetPartitions) {
                batches[name] ??= new Map<K, V | null>();

                /**
                 * If the key is marked for deletion in this partition (implies it already existd in that partition) and
                 * the value itself was not updated, we can simply remove it from the batch as no change is needed.
                 * This optimization avoids unnecessary touch operations on partitions when only re-indexing is needed.
                 *
                 * Otherwise, we mark the key for addition/update in the partition.
                 */
                if (!valuesUpdated && batches[name].get(key) === null) {
                    batches[name].delete(key);
                } else {
                    batches[name].set(key, this._map.get(key)!);
                }
            }

            // Update the partition names map
            if (targetPartitions.length === 0) {
                this._partitionNames.delete(key);
            } else {
                this._partitionNames.set(key, targetPartitions);
            }
        }

        // Step 2: Recursively apply the batch updates to all partitions
        for (const [name, batch] of Object.entries(batches)) {
            this._getPartition(name).batch((t) => {
                for (const [key, value] of batch) {
                    if (value === null) {
                        t.delete(key);
                    } else {
                        t.set(key, value);
                    }
                }
            });
        }
    }

    /**
     * Apply updates to the view when some key's are updated.
     *
     * @param updatedKeys Array of keys which have been updated
     */
    private _applyViewUpdate(updatedKeys: K[]) {
        const { _sortedKeys, _comparator } = this;
        if (!_sortedKeys || !_comparator) return; // No view to update

        // Sort the updated keys based on the current comparator
        updatedKeys = updatedKeys
            .filter((key) => this._map.has(key))
            .sort(this._keyComparator(_comparator));

        const updatedKeysSet = new Set(updatedKeys);
        const unchangedKeys = _sortedKeys.filter(
            (key) => !updatedKeysSet.has(key) && this._map.has(key),
        );

        this._sortedKeys = _allocateEmptyArray<K>(_sortedKeys.length);

        let i = 0; // Iterator for current view array
        let j = 0; // Iterator for updatedKeys array
        while (i < unchangedKeys.length || j < updatedKeys.length) {
            // Pick one key from current view and one from updatedKeys array
            const unchangedId = i < unchangedKeys.length ? unchangedKeys[i] : null;
            const newId = j < updatedKeys.length ? updatedKeys[j] : null;

            // Add the key from the existing view if newIds array is empty or it comes before the key from the newIds array
            if (
                unchangedId &&
                (!newId ||
                    !this._map.get(newId) ||
                    this._keyComparator(_comparator)(unchangedId, newId) <= 0)
            ) {
                this._sortedKeys.push(unchangedId);
                i++;
            } else {
                this._sortedKeys.push(newId!);
                j++;
            }
        }
    }

    /**
     * Notify all subscribed listeners about the delta of modified keys.
     * @param delta The list of modified value keys
     */
    private _notifyListeners(delta: IDelta<K>) {
        for (const listener of this._listeners) {
            listener(delta);
        }
    }

    /**
     * Refresh the materialized view of the table based on current sorting and indexing.
     */
    private _refereshMaterialization(): void {
        const { _sortedKeys, _comparator, _indexAccessor } = this;

        // Table should be materialized when an on order is defined and no partitions exist
        const shouldMaterialize = _comparator !== null && _indexAccessor === null;

        // Case 1: Materialize order if a comparator is set and no partitions
        if (_sortedKeys === null && shouldMaterialize) {
            this._sortedKeys = this._sortKeys(_comparator);
        }

        // Case 2: Clear materialized order if partitions exist
        if (_sortedKeys !== null && !shouldMaterialize) {
            this._sortedKeys = null;
        }
    }

    /* Helper to sort the keys based on the given comparator */
    private _sortKeys(comparator: IComparator<V> | null): K[] {
        const keys = Array.from(this._map.keys());
        return comparator ? keys.sort(this._keyComparator(comparator)) : keys;
    }

    /* Helper to create a key comparator from a value comparator */
    private _keyComparator(_comparator: IComparator<V>): IComparator<K> {
        // Assume all keys exist in the map when this is called
        return (k1, k2) => _comparator(this._map.get(k1)!, this._map.get(k2)!);
    }

    // #endregion
}

// #endregion

// #region UTILITIES

/**
 * Allocates an empty array of the specified size. This helps avoid runtime cost associated with
 * dynamically resizing the array in cases where the final size estimate is known.
 */
function _allocateEmptyArray<T>(size: number): T[] {
    const array: T[] = new Array(size > 1 ? size : 1);
    array.length = 0; // Ensure the array is empty
    return array;
}

// #endregion
