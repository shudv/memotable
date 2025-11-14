import { ITable } from "./contracts/ITable";
import { IComparator } from "./contracts/ISortableTable";
import { IIndexDefinition } from "./contracts/IIndexableTable";
import { IDelta } from "./contracts/ITrackedTable";
import { IReadOnlyTable } from "./contracts/IReadOnlyTable";

/**
 * Table implementation that supports basic CRUD, batching, indexing and sorting.
 * @template T Type of the items in the table
 */
export class Table<T> implements ITable<T> {
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
        // Step 1: Update the item in the table
        if (value != null) {
            this._items[id] = value;
        } else {
            delete this._items[id];
        }

        // Step 2: Propagate changes to derived structures (index, sorting, subscribers)
        this._propagateChanges([id]);
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

    // #region SORTING

    // The materialized view of the table that satisfies the current filter and comparator
    private _sorted: string[] | null = null;
    private _comparator: IComparator<T> | null = null;

    public sort(comparator: IComparator<T> | null) {
        this._comparator = comparator;

        for (const bucket of Object.values(this._partitions)) {
            bucket.sort(comparator);
        }

        this._sorted =
            comparator && this.partitions().length === 0
                ? this.ids().sort((id1, id2) => comparator(this._items[id1]!, this._items[id2]!))
                : null;

        this._notifyListeners([]);
    }

    // #endregion

    // #region INDEXING

    /**
     * The in-memory indexes for this table and a partition key map for each item.
     * Example index: { "plan": (task => task.planId) }
     * Example partition key map: { "task1": { "plan": ["plan1"] }, "task2": { "plan": ["plan2"] } }
     */
    public _definition: ((item: T | null | undefined) => readonly string[]) | null = null;

    /** All partitions for this index */
    private _partitions: Record<string, ITable<T>> = {};
    private _partitionKeys: Record<string, readonly string[]> = {};

    public partition(value: string): IReadOnlyTable<T> {
        return this._partitions[value] ?? new Table<T>();
    }

    public partitions(): string[] {
        return Object.keys(this._partitions);
    }

    public index(definition: IIndexDefinition<T> | null) {
        if (definition == null) {
            this._definition = null;
            this._partitions = {};
            this._partitionKeys = {};
            return;
        }

        // Normalize the definition
        this._definition = (item: T | null | undefined) => {
            if (!item) {
                return [] as readonly string[];
            }

            const keyOrKeys = definition(item);
            // also covers undefined
            if (keyOrKeys == null) {
                return [] as readonly string[];
            }

            return Array.isArray(keyOrKeys)
                ? (keyOrKeys as readonly string[])
                : ([keyOrKeys] as readonly string[]);
        };

        this._applyIndexUpdate(this.ids()); // Build index membership for all existing items
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
    private _applyIndexUpdate(updatedIds: string[]) {
        // Step 1: Calculate update batches for all partitions for given id's
        const batches: Record<string, Record<string, T | null>> = {};
        for (const id of updatedIds) {
            const current = this._partitionKeys[id] ?? [];
            const target = this._definition ? this._definition(this._items[id]) : [];

            // Remove from all current partitions
            for (const value of current) {
                _deepInsert(batches, value, id, null);
            }

            // Add to all target partitions
            for (const value of target) {
                _deepInsert(batches, value, id, this._items[id]);
            }

            //this._partitionKeys[id] = target;

            _deepInsert(this._partitionKeys, id, target);
        }

        // Step 2: Recursively apply the batch updates to all partitions
        for (const [key, batch] of Object.entries(batches)) {
            this._partitions[key] ??= new Table<T>();
            this._partitions[key].batch((t) => {
                for (const [id, item] of Object.entries(batch)) {
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
        const { _sorted, _comparator } = this;
        if (!_sorted || !_comparator) return; // No view to update

        const updatedIdsSet = new Set(updatedIds);
        const unchangedIds = _sorted.filter((id) => !updatedIdsSet.has(id));

        this._sorted = _allocateEmptyArray<string>(_sorted.length);

        let i = 0; // Iterator for current view array
        let j = 0; // Iterator for updatedIds array
        while (i < unchangedIds.length || j < updatedIds.length) {
            // Pick one id from current view and one from updatedIds array
            const unchangedId = i < unchangedIds.length ? unchangedIds[i] : null;
            const newId = j < updatedIds.length ? updatedIds[j] : null;

            // Add the id from the existing view if newIds array is empty or it comes before the id from the newIds array
            if (
                unchangedId &&
                (!newId ||
                    !this._items[newId] ||
                    _comparator(this._items[unchangedId]!, this._items[newId]!) <= 0)
            ) {
                this._sorted.push(unchangedId);
                i++;
            } else {
                if (this._items[newId!]) this._sorted.push(newId!);
                j++;
            }
        }
    }

    /**
     * Notify all subscribed listeners about the delta of modified ids.
     * @param delta The list of modified item ids
     */
    private _notifyListeners(delta: IDelta) {
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
