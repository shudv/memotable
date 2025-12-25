// Contracts
import { IComparator } from "./contracts/ISortableTable";
import { IIndexDefinition } from "./contracts/IIndexableTable";
import { IReadonlyTable } from "./contracts/IReadonlyTable";
import { ITableSubscriber } from "./contracts/IObservableTable";
import { ITable, IBatch } from "./contracts/ITable";

/**
 * Table implementation that supports basic CRUD, batching, indexing and sorting.
 * @template T Type of the values in the table
 */
export class Table<K, V> implements ITable<K, V> {
    // #region READS

    // A map to hold the actual values in the table
    private _map: Map<K, V> = new Map();

    public get(key: K): V | undefined {
        return this._map.get(key);
    }

    public has(key: K): boolean {
        return this._map.has(key);
    }

    public get size() {
        return this._map.size;
    }

    public keys(): MapIterator<K> {
        // Return the memoized keys if available
        if (this._sortedKeys) {
            return this._sortedKeys[Symbol.iterator]();
        }

        // Otherwise, if comparator is available sort at read time, else return native iterator
        return this._comparator
            ? Array.from(this._map.keys())
                  .sort((k1, k2) => this._comparator!(this._map.get(k1)!, this._map.get(k2)!))
                  [Symbol.iterator]()
            : this._map.keys();
    }

    public *values(): MapIterator<V> {
        for (const key of this.keys()) {
            yield this._map.get(key)!;
        }
    }

    public *entries(): MapIterator<[K, V]> {
        for (const key of this.keys()) {
            yield [key, this._map.get(key)!];
        }
    }

    public [Symbol.iterator](): MapIterator<[K, V]> {
        return this.entries();
    }

    public touch(key: K): void {
        this._propagateChanges([key]);
    }

    // #endregion

    // #region MEMOIZATION
    private _shouldMemoize: boolean = false;

    public memo(flag?: boolean): void {
        this._shouldMemoize = flag ?? true;

        // Step 1: Propagate memoization to all partitions
        for (const partition of this._partitions.values()) {
            partition.memo(flag);
        }

        // Step 2: Refresh memoization for the current table
        this._refreshMemoizedData();
    }

    // #endregion

    // #region WRITES

    public set(key: K, value: V): void {
        this._map.set(key, value);
        this._propagateChanges([key]);
    }

    public delete(key: K): boolean {
        if (!this._map.delete(key)) {
            return false;
        }

        this._propagateChanges([key]);
        return true;
    }

    public clear(): void {
        // Step 1: Clear all indexes and partitions
        this.index(null);

        // Step 2: Clear sorting
        this._comparator = null;

        // Step 3: Refresh memoization
        this._refreshMemoizedData();

        // Step 4: Notify subscribers about all cleared keys
        this._notifyListeners(this._map.keys());

        // Step 5: Clear the internal map
        this._map.clear();
    }

    // #endregion

    // #region BATCHING

    public batch(fn: (t: IBatch<K, V>) => void): void {
        // Tracks keys (and the new values) that have been updated in this batch
        const _updates = new Map<K, V>();

        // Tracks keys that have been deleted in this batch
        const _deletes = new Set<K>();

        fn({
            set: (key: K, value: V) => {
                _updates.set(key, value);
                _deletes.delete(key); // In case it was marked for deletion earlier
            },
            delete: (key: K) => {
                _updates.delete(key); // In case it was marked for update earlier

                // Only mark for deletion if the key exists in the target map
                if (this._map.has(key)) {
                    _deletes.add(key);
                }
            },
            touch: (key: K): void => {
                const currentValue = this._map.get(key);
                if (currentValue !== undefined) {
                    _updates.set(key, currentValue);
                    _deletes.delete(key); // In case it was marked for deletion earlier
                }
            },
        });

        // Step 2: Apply all changes to the internal map and reset batch
        for (const [key, value] of _updates) {
            this._map.set(key, value);
        }

        for (const key of _deletes) {
            this._map.delete(key);
        }

        // Step 3: Propagate all changes as a batch
        const keys = [..._updates.keys(), ..._deletes];
        if (keys.length > 0) {
            this._propagateChanges(keys);
        }
    }

    // #endregion

    // #region SUBSCRIPTIONS

    // Set of subscribers subscribed to changes in the table
    private _subscribers: Set<ITableSubscriber<K>> = new Set();

    public subscribe = (subscriber: ITableSubscriber<K>): (() => void) => {
        this._subscribers.add(subscriber);
        return () => this._subscribers.delete(subscriber);
    };

    // #endregion

    // #region SORTING

    // The memoized view of the table that satisfies the current filter and comparator
    private _sortedKeys: K[] | null = null;
    private _comparator: IComparator<V> | null = null;

    public sort(comparator?: IComparator<V> | null) {
        // If comparator is not provided, re-apply the existing comparator
        if (comparator === undefined) {
            comparator = this._comparator;
        }

        this._comparator = comparator;

        // Step 1: Apply sorting to all partitions
        for (const partition of this._partitions.values()) {
            partition.sort(comparator);
        }

        // Step 2: Refresh memoization based on the new comparator
        this._refreshMemoizedData();

        // Step 3: Notify subscribers because we fallback to internal map enforced order
        this._notifyListeners([]);
    }

    // #endregion

    // #region INDEXING

    /** Normalized index accessor function that returns latest partition names a give value should be in */
    private _indexAccessor: ((value: V | undefined) => readonly string[]) | null = null;

    /** Optional partition initializer function */
    private _partitionInitializer?: (partition: IReadonlyTable<K, V>, name: string) => void;

    /** Map of keys to their current partition names (used for diffing against new updates) */
    private _partitionNames: Map<K, readonly string[]> = new Map();

    /** All partitions created by this index */
    private _partitions: Map<string, ITable<K, V>> = new Map();

    public index(
        definition?: IIndexDefinition<V> | null,
        partitionInitializer?: (partition: IReadonlyTable<K, V>, name: string) => void,
    ): void {
        // Step 1: Handle clearing the index
        if (definition === null) {
            this._indexAccessor = null;
            this._partitions.clear();
            this._partitionNames.clear();
            this._partitionInitializer = undefined;
            return;
        }

        // Step 2: Setup normalized index accessor if a new definition is provided
        this._indexAccessor = definition
            ? (value: V | undefined) => {
                  if (value == null /** or undefined */) {
                      return [] as readonly string[];
                  }

                  const keyOrKeys = definition(value);
                  if (!keyOrKeys) {
                      return [] as readonly string[];
                  }

                  return Array.isArray(keyOrKeys)
                      ? (keyOrKeys.filter(Boolean) as readonly string[])
                      : ([keyOrKeys] as readonly string[]);
              }
            : this._indexAccessor;

        // Step 3: Store the partition initializer if provided
        this._partitionInitializer = partitionInitializer;

        // Step 4: Build index membership for all existing values
        if (this._indexAccessor) {
            this._applyIndexUpdate(this.keys(), false /* values themselves are not updated */);
        }
    }

    public partition(name: string): IReadonlyTable<K, V> {
        return this._getPartition(name);
    }

    public partitions(): MapIterator<[string, IReadonlyTable<K, V>]> {
        return this._partitions.entries();
    }

    // #endregion

    // #region PRIVATE HELPERS

    private _getPartition(name: string): ITable<K, V> {
        if (!this._partitions.has(name)) {
            // Step 1: Create a new partition table
            const partition = new Table<K, V>();

            // Step 2: Propagate parent sorting to the partition
            partition.sort(this._comparator);

            // Step 3: Propagate memoization status to the partition
            partition.memo(this._shouldMemoize);

            // Step 4: Initialize the partition if an initializer is provided
            this._partitionInitializer?.(partition, name);

            // Step 5: Store and return the partition
            this._partitions.set(name, partition);
        }

        return this._partitions.get(name)!;
    }

    /**
     * Propagate changes to indexes, views and notify subscribers.
     * @param updatedKeys Array of keys that have been updated
     */
    private _propagateChanges(updatedKeys: Iterable<K>): void {
        // Step 1: Update indexes if any
        this._applyIndexUpdate(updatedKeys);

        // Step 2: Update view
        this._refreshMemoizedData();

        // Step 3: Notify subscribers about the changes
        this._notifyListeners(updatedKeys);
    }

    /**
     * Apply updates to the indexes for the given keys.
     * This method recalculates the partition keys for each value and updates the indexes accordingly.
     * @param updatedKeys Array of keys for which index membership needs to be recalculated
     * @param valuesUpdated Flag indicating whether the values themselves were updated (true) or just refreshed (false)
     */
    private _applyIndexUpdate(updatedKeys: Iterable<K>, valuesUpdated: boolean = true) {
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
                 * If the key is marked for deletion in this partition (implies it already existed in that partition) and
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
            this._partitionNames.set(key, targetPartitions);
        }

        // Step 2: Recursively apply the batch updates to all partitions
        for (const [name, batch] of Object.entries(batches)) {
            const partition = this._getPartition(name);
            partition.batch((t) => {
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
     * Notify all subscribed subscribers about the delta of modified keys.
     * @param delta The list of modified value keys
     */
    private _notifyListeners(modifiedKeys: Iterable<K>) {
        if (this._subscribers.size > 0) {
            const keys = Array.from(modifiedKeys);
            for (const listener of this._subscribers) {
                listener(keys);
            }
        }
    }

    /**
     * Refresh the memoized data based on the current comparator and memoization flag.
     */
    private _refreshMemoizedData(): void {
        this._sortedKeys = null;

        // Table should be memoized when a comparator is set (otherwise memoization is not helpful)
        if (this._shouldMemoize && this._comparator !== null) {
            this._sortedKeys = Array.from(this.keys());
        }
    }

    // #endregion
}

// #endregion
