import { ITable } from "./contracts/ITable";
import { IComparator } from "./contracts/ISortableTable";
import { IIndexDefinition } from "./contracts/IIndexableTable";
import { IDelta } from "./contracts/IDeltaTrackedTable";
import { ITableConfig } from "./contracts/ITableConfig";
import { IReadOnlyTable } from "./contracts/IReadOnlyTable";

/**
 * Table implementation that supports basic CRUD, batching, indexing, views and change tracking
 */
export class Table<T> implements ITable<T> {
    // Table configuration with defaults
    private readonly _config: ITableConfig<T> = {
        equals: (item1: T, item2: T) => item1 === item2, // Default equality check
        track: true, // Delta tracking enabled by default
    };

    /**
     * Create a new Table
     * @param configOverrides Partial table configuration to override defaults
     */
    public constructor(configOverrides: Partial<ITableConfig<T>> = {}) {
        this._config = { ...this._config, ...configOverrides };
    }

    // #region BASIC OPERATIONS

    // All the items in the table
    private _items: Record<string, T> = {};

    // Flag to indicate if a batch operation is in progress
    private _isBatchOperationInProgress = false;
    private _idsUpdatedInCurrentBatch = new Set<string>();

    public get(id: string): T | null {
        return this._items[id] ?? null;
    }

    public items(): T[] {
        return this.ids().map((id) => this._items[id]!);
    }

    public ids(): string[] {
        return this._sorted ? this._sorted : Object.keys(this._items);
    }

    public set(id: string, value: T | null) {
        // Step 1: Check if the item needs to be updated
        const currentValue = this.get(id);
        if (
            (currentValue === null && value === null) ||
            (currentValue !== null && value !== null && this._config.equals(currentValue, value))
        ) {
            return false;
        }

        // Step 2: Update the item in the table
        if (value !== null) {
            this._items[id] = value;
        } else {
            delete this._items[id];
        }

        // Step 3: Propagate changes to derived structures (index, view, subscribers)
        this._propagateChanges([id]);

        // Step 4: Flag the item as modified
        if (this._config.track) {
            this._modifiedIds.add(id);
        }

        return true;
    }

    public refresh(id: string) {
        this._propagateChanges([id]);
    }

    public batch(fn: (t: ITable<T>) => void): boolean {
        // Step 1: Run the batch of operations and mark start and end to disable change propagation on every set/delete
        this._isBatchOperationInProgress = true;
        fn(this);
        this._isBatchOperationInProgress = false;

        // Step 2: After the batch is complete, propagate all accumulated changes
        if (this._idsUpdatedInCurrentBatch.size > 0) {
            this._propagateChanges(Array.from(this._idsUpdatedInCurrentBatch));
            this._idsUpdatedInCurrentBatch.clear();
            return true;
        }

        return false;
    }

    // #endregion

    // #region SUBSCRIPTIONS

    // Set of listeners subscribed to changes in the table
    private _listeners: Set<(delta: IDelta) => void> = new Set();

    public subscribe = (listener: (delta: IDelta) => void): (() => void) => {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    };

    // #endregion

    // #region VIEW

    // The materialized view of the table that satisfies the current filter and comparator
    private _sorted: string[] | null = null;
    private _comparator: IComparator<T> | null = null;

    public sort(comparator: IComparator<T> | null) {
        this._comparator = comparator;

        // Materialize the view if needed
        if (!this._sorted && this._comparator) {
            this._sorted = this.ids();
        }

        // OR Unmaterialize the view if it is no longer needed
        if (this._sorted && !this._comparator) {
            this._sorted = null;
        }

        this._notifyListeners([]);
    }

    // #endregion

    // #region INDEXING

    /**
     * The in-memory indexes for this table and a partition key map for each item.
     * Example index: { "plan": (task => task.planId) }
     * Example partition key map: { "task1": { "plan": ["plan1"] }, "task2": { "plan": ["plan2"] } }
     */
    public _definition: ((item: T | null) => readonly string[]) | null = null;

    /** All partitions for this index */
    private _buckets: Record<string, ITable<T>> = {};
    private _bucketValues: Record<string, string[]> = {};

    public bucket(value: string): IReadOnlyTable<T> {
        const table = this._buckets[value];
        if (!table) {
            /**
             * Return a dummy empty unregistered index. We could also throw an exception here but we do not
             * want to risk the caller (typically in a render loop) crashing in case of a temporary misconfiguration.
             */
            return new Table();
        }

        return table;
    }

    public buckets(): string[] {
        return Object.keys(this._buckets);
    }

    public indexBy(definition: IIndexDefinition<T> | null) {
        if (!definition) {
            this._definition = null;
            this._buckets = {};
            this._bucketValues = {};
            return;
        }

        // Normalize the definition
        this._definition = (item: T | null) => {
            if (!item) {
                return [] as readonly string[];
            }

            const keyOrKeys = definition(item);
            if (!keyOrKeys) {
                return [] as readonly string[];
            }

            if (Array.isArray(keyOrKeys)) {
                return keyOrKeys as readonly string[];
            } else {
                return [keyOrKeys] as readonly string[];
            }
        };

        this._applyIndexUpdate(this.ids()); // Build index membership for all existing items
    }

    // #endregion

    // #region TRACKING

    // Set of ids that have been modified in-memory
    private readonly _modifiedIds = new Set<string>();

    public nextDelta(maxItems?: number): string[] {
        const delta: string[] = [];
        let count = 0;

        for (const id of this._modifiedIds) {
            delta.push(id);
            this._modifiedIds.delete(id); // safe during iteration in JS

            if (maxItems && ++count >= maxItems) break;
        }

        return delta;
    }

    // #endregion

    // #region PRIVATE HELPERS

    /**
     * Propagate changes to indexes, views and notify subscribers.
     * @param updatedIds Array of item IDs that have been updated
     */
    private _propagateChanges(updatedIds: string[]) {
        if (this._isBatchOperationInProgress) {
            // If a batch operation is in progress, we record the updated id for later processing
            for (const id of updatedIds) {
                this._idsUpdatedInCurrentBatch.add(id);
            }
        } else {
            // Step 1: Update indexes if any
            this._applyIndexUpdate(updatedIds);

            // Step 2: Update view
            this._applyViewUpdate(updatedIds);

            // Step 3: Notify subscribers about the changes
            this._notifyListeners(updatedIds);
        }
    }

    /**
     * Apply updates to the indexes for the given ids.
     * This method recalculates the partition keys for each item and updates the indexes accordingly.
     * @param updatedIds Array of ids for which index membership needs to be recalculated
     * @param indexNames Array of index names to update. Defaults to all indexes.
     */
    private _applyIndexUpdate(updatedIds: string[]): void {
        // Step 1: Calculate update batches for all partitions for given id's
        const batch: Record<string, Record<string, T | null>> = {};
        for (const id of updatedIds) {
            const current = this._bucketValues[id] ?? [];
            const target = this._definition ? this._definition(this.get(id)) : [];

            // Remove from all current partitions
            for (const key of current) {
                _deepInsert(batch, key, id, null);
            }

            // Add to all target partitions
            for (const key of target) {
                _deepInsert(batch, key, id, this.get(id));
            }

            _deepInsert(this._bucketValues, id, target);
        }

        // Step 2: Recursively apply the batch updates to all partitions
        for (const [value, entries] of Object.entries(batch)) {
            this._buckets[value]?.batch((t) => {
                for (const [id, item] of Object.entries(entries)) {
                    t.set(id, item);
                }
            });
        }
    }

    /**
     * Apply updates to the view when some id's are updated.
     *
     * @param updatedIds Array of ids which have been updated
     */
    private _applyViewUpdate(updatedIds: string[]) {
        const { _comparator } = this;
        let { _sorted } = this;

        // If view is not materialized, no action is needed
        if (!_sorted || !_comparator) {
            return;
        }

        // If no comparator is defined, we can just append the new id's to the view
        // Step 1: Sort the new id's if there are multiple
        if (updatedIds.length > 1) {
            updatedIds.sort((id1, id2) => _comparator(this._items[id1]!, this._items[id2]!));
        }

        const updatedIdsSet = new Set(updatedIds);
        _sorted = _sorted.filter((id) => !updatedIdsSet.has(id)); // Remove updated ids from current view

        // Step 2: Merge the current view and updatedIds one by one, satisfying the order constraint
        const mergedView = _allocateEmptyArray<string>(_sorted.length);
        let i = 0; // Iterator for current view array
        let j = 0; // Iterator for updatedIds array
        while (i < _sorted.length || j < updatedIds.length) {
            // Pick one id from current view and one from updatedIds array
            const currentId = i < _sorted.length ? _sorted[i] : null;
            const newId = j < updatedIds.length ? updatedIds[j] : null;

            // Add the id from the existing view if newIds array is empty or it comes before the id from the newIds array
            if (
                currentId &&
                (!newId || _comparator(this._items[currentId]!, this._items[newId]!) <= 0)
            ) {
                mergedView.push(currentId);
                i++;
            } else {
                mergedView.push(newId!);
                j++;
            }
        }
        return mergedView;
    }

    /**
     * Notify all subscribed listeners about the delta of modified ids.
     * @param delta The list of modified item ids
     */
    private _notifyListeners(delta: IDelta): void {
        for (const listener of this._listeners) {
            listener(delta);
        }
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

/**
 * Deeply inserts a value into an object at the specified path.
 * Usage: _deepInsert(obj, 'a', 'b', 'c', value) will insert `value` at `obj.a.b.c`.
 *
 * @param obj The object to insert into
 * @param args The path to insert the value at, with the last argument being the value to insert
 */
function _deepInsert(
    obj: Record<string, any>,
    key1: string,
    ...remainingKeysAndValue: any[]
): void {
    const value = remainingKeysAndValue.pop();
    let current = obj;

    // Add key1 to the front of the path
    const keys = [key1, ...remainingKeysAndValue];

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key]) {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
}

// #endregion
