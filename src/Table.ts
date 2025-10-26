// Table
import { ITable, IIndexDefinition, IIndex, IModifiedBatch, IComparator, IFilter } from "./ITable";

/**
 * A delimiter to separate path tokens in the internal table path naming scheme.
 * This is chosen so that it is unlikely to appear in partition keys.
 *
 * Example: "task////plan////{planId}////bucket////{bucketId}" represents the path to the bucket
 * partition within a task table, partitioned by plan and then bucket. The planId and bucketId
 * values are unlikely to contain the delimiter, hence preserving correctness.
 *
 * Note: The path tokens are supplied to the filter and comparator functions to allow
 * partition-specific filtering and sorting. For example, you can apply a filter on a
 * parent partition that has conditional behavior depending upon the child partition key.
 * Applying comparator/filter on a parent is beneficial because it implicitly applies to all child
 * partitions that get created later dynamically as items are added to the table. Otherwise
 * the filter/comparator would need to be applied to each child partition individually.
 */
const TablePathDelimiter = "////";

/**
 * Table implementation that supports basic CRUD, batching, indexing, views and change tracking
 */
export class Table<T> implements ITable<T> {
    /**
     * Create a new Table
     * @param name The name of the table
     * @param isEqual Function to compare two items for equality. Defaults to strict equality (===).
     * @param trackingEnabled Whether change tracking is enabled for this table. Defaults to true.
     */
    public constructor(
        protected readonly name: string,
        private readonly isEqual: (item1: T, item2: T) => boolean = (item1, item2) => item1 === item2,
        private readonly trackingEnabled: boolean = true,
    ) {}

    // #region BASIC OPERATIONS

    // All the items in the table
    protected _items: Record<string, T> = {};

    // Flag to indicate if a batch operation is in progress
    private _isBatchOperationInProgress = false;
    private _idsUpdatedInCurrentBatch = new Set<string>();

    public get(id: string): T | null {
        return this._items[id] ?? null;
    }

    public items(): T[] {
        return this.itemIds().map((id) => this._items[id]!);
    }

    public itemIds(): string[] {
        if (this._view) {
            // If the view has already materialized, return it directly (this is super quick and avoids re-computation)
            return this._view;
        } else {
            // If the view has not materialized yet, apply filter and comparator to the items at read time
            const { _filter, _comparator } = this;
            const allIds = this.allItemIds();
            const filteredIds = _filter ? allIds.filter((id) => _filter(this._items[id]!, this.getTablePathTokens())) : allIds;
            const orderedFilteredIds = _comparator
                ? filteredIds.sort((id1, id2) => _comparator(this._items[id1]!, this._items[id2]!, this.getTablePathTokens()))
                : filteredIds;
            return orderedFilteredIds;
        }
    }

    public set(id: string, value: T | null): boolean {
        return this.setInternal(id, value);
    }

    public reKey(id: string, newId: string): boolean {
        return this.executeBatch(() => {
            this.setInternal(newId, this.get(id));
            this.delete(id);
        });
    }

    public delete(id: string): boolean {
        return this.setInternal(id, null);
    }

    public refresh(id: string) {
        this.updateIndexAndView([id]);
    }

    public executeBatch(batch: (table: ITable<T>) => void): boolean {
        // Step 1: Run the batch of operations and mark start and end to disable index/view updates
        this._isBatchOperationInProgress = true;
        batch(this);
        this._isBatchOperationInProgress = false;

        // Step 2: Update the index and view corresponding to the updated ids
        if (this._idsUpdatedInCurrentBatch.size > 0) {
            this.updateIndexAndView(Array.from(this._idsUpdatedInCurrentBatch));
            this._idsUpdatedInCurrentBatch.clear();
            return true;
        }

        return false;
    }

    // #endregion

    // #region VIEW

    /**
     * A filtered sorted view of the table based on the filter and comparator
     * NOTE: It materializes lazily when a filter or a comparator is applied
     */
    private _view: string[] | null = null;
    private _filter: IFilter<T> | null = null;
    private _comparator: IComparator<T> | null = null;

    /**
     * Following implementation of applyFilter guarantees O(N + M*log2(M)) time complexity,
     * where N is the number of current items in the view and M is the number of new items
     * that need to be added to the view. This is only consequential when N>>M, otherwise
     * the practical performance is close the naive O(N*log2N) implementation.
     */
    public applyFilter(filter: IFilter<T> | null) {
        this._filter = filter;
        const path = this.getTablePathTokens();

        // Recursion case: If this table has partitions, apply the filter to all child partitions
        if (this.hasPartitions()) {
            for (const partition of this.partitions()) {
                partition.applyFilter(filter);
            }
        }
        // Base case: If this is a terminal partition and view has already materialized, then apply the new filter
        else if (this._view && filter) {
            // Step 1: Apply filter to the current view so that any existing id's in view that do not pass the new filter are removed (also create a set for the next pass))
            const currentViewSet = new Set<string>();
            const currentView = this._view; // already ordered by the current comparator
            this._view = [];
            for (const id of currentView) {
                if (filter(this._items[id]!, path)) {
                    currentViewSet.add(id);
                    this._view.push(id);
                }
            }

            // Step 2: Scan the entire table and add the id's not in view that now pass the new filter
            const newIds: string[] = [];
            for (const id of this.allItemIds()) {
                if (!currentViewSet.has(id) && filter(this._items[id]!, path)) {
                    newIds.push(id);
                }
            }

            // Step 3: Merge the new id's into the view
            if (newIds.length > 0) {
                this._view = this.mergeIntoView(this._view, newIds);
            }
        }

        this.refreshViewMaterialization(); // Because filter might have been removed
    }

    public applyComparator(comparator: IComparator<T> | null) {
        this._comparator = comparator;
        const path = this.getTablePathTokens();

        // Recursion case: If this is an intermediate partition, apply the comparator to all child partitions
        if (this.hasPartitions()) {
            for (const partition of this.partitions()) {
                partition.applyComparator(comparator);
            }
        }
        // Base case: If this is a terminal partition and view has already materialized, then just re-order it
        else if (this._view && comparator) {
            // If the view has already materialized, we need to re-sort it based on the new comparator
            this._view.sort((id1, id2) => comparator(this._items[id1]!, this._items[id2]!, path));
        }

        this.refreshViewMaterialization(); // Because comparator might have been removed
    }

    // #endregion

    // #region INDEXING

    /**
     * The in-memory indexes for this table and a partition key map for each item.
     * Example index: { "plan": (task => task.planId) }
     * Example partition key map: { "task1": { "plan": ["plan1"] }, "task2": { "plan": ["plan2"] } }
     */
    private readonly _indexes: Record<string, IRuntimeIndex<T>> = {};
    private readonly _partitionKeys: Record<string, Record<string, string[]>> = {};

    public index(name: string): IIndex<T> {
        const index = this._indexes[name];
        if (!index) {
            /**
             * Return a dummy empty unregistered index. We could also throw an exception here but we do not
             * want to risk the caller (typically in a render loop) crashing in case of a temporary misconfiguration.
             */
            return {
                keys: () => [],
                partition: () => new Table(name),
            };
        }

        return index;
    }

    public registerIndex(name: string, definition: IIndexDefinition<T>): boolean {
        if (name.includes(TablePathDelimiter)) {
            throw new Error(`InvalidIndexName [Name=${name}]`);
        }

        if (!this._indexes[name]) {
            this._indexes[name] = new RuntimeIndex(
                `${this.name}${TablePathDelimiter}${name}`,
                definition,
                () => this._filter,
                () => this._comparator,
            );
            this.refreshIndex(name);
            this.refreshViewMaterialization(); // Because adding an index makes this a non-terminal partition
            return true;
        }

        return false;
    }

    public refreshIndex(name: string): void {
        const index = this._indexes[name];
        if (!index) {
            throw new Error(`IndexNotFound [Name=${name}]`);
        }

        this.applyIndexUpdate(this.allItemIds(), [name]); // Recalculate index membership for all items for this index only
    }

    public dropIndex(name: string): boolean {
        if (this._indexes[name]) {
            delete this._indexes[name];
            this.refreshViewMaterialization(); // Because dropping an index may make this a terminal partition
            return true;
        }

        return false;
    }

    // #endregion

    // #region TRACKING

    // Set of ids that have been modified in-memory
    private readonly _modifiedIds = new Set<string>();

    public nextModifiedBatch(maxItems?: number): IModifiedBatch {
        const batch: IModifiedBatch = { upserted: [], deleted: [] };

        // Prepare batch
        let count = 0;
        const ids = Array.from(this._modifiedIds);
        for (const id of ids) {
            const item = this.get(id);
            if (item) {
                batch.upserted.push(id);
            } else {
                batch.deleted.push(id);
            }

            // Remove the id from the modified set
            this._modifiedIds.delete(id);

            // If maxItems is specified, stop if we reached the limit
            if (maxItems && ++count >= maxItems) {
                break;
            }
        }

        return batch;
    }

    // #endregion

    // #region HELPERS VISIBLE TO SUBCLASSES

    // Flag an item as modified, which will be included in the next modified batch
    protected flag(id: string): void {
        this._modifiedIds.add(id);
    }

    // #endregion

    // #region PRIVATE HELPERS

    /**
     * Update the indexes and view based on the updated ids.
     * @param updatedIds Array of item IDs that have been updated
     */
    private updateIndexAndView(updatedIds: string[]) {
        if (this._isBatchOperationInProgress) {
            // If a batch operation is in progress, we record the updated id for later processing
            for (const id of updatedIds) {
                this._idsUpdatedInCurrentBatch.add(id);
            }
        } else {
            // Step 1: Update indexes if any
            if (Object.keys(this._indexes).length > 0) {
                this.applyIndexUpdate(updatedIds);
            }

            // Step 2: Update view if it has materialized
            if (this._view) {
                this.applyViewUpdate(this._view, updatedIds);
            }
        }
    }

    /**
     * Core item update method with change detection and subsequent updates
     * to ensure index and view consistency.
     *
     * @param id Item id
     * @param value Item value
     * @param shouldFlag Whether to flag the item as modified. Defaults to true.
     * @returns True item was actually updated, false otherwise
     */
    private setInternal(id: string, value: T | null, shouldFlag: boolean = true): boolean {
        // Step 1: Check if the item needs to be updated
        const currentValue = this.get(id);
        if ((currentValue === null && value === null) || (currentValue !== null && value !== null && this.isEqual(currentValue, value))) {
            return false;
        }

        // Step 2: Update the item in the table
        if (value !== null) {
            this._items[id] = value;
        } else {
            delete this._items[id];
        }

        // Step 3: Refresh item so that indexes and views are updated
        this.refresh(id);

        // Step 4: Flag the item as modified
        if (shouldFlag && this.trackingEnabled) {
            this.flag(id);
        }

        return true;
    }

    /**
     * Apply updates to the indexes for the given ids.
     * This method recalculates the partition keys for each item and updates the indexes accordingly.
     * @param updatedIds Array of ids for which index membership needs to be recalculated
     * @param indexNames Array of index names to update. Defaults to all indexes.
     */
    private applyIndexUpdate(updatedIds: string[], indexNames: string[] = Object.keys(this._indexes)): void {
        // Step 1: Calculate update batches for all partitions for given id's
        const batch: Record<string, Record<string, Record<string, T | null>>> = {};
        for (const id of updatedIds) {
            for (const indexName of indexNames) {
                const current = this._partitionKeys[id]?.[indexName] ?? [];
                const target = this._indexes[indexName]!.accessor(this.get(id));

                // Remove from all current partitions
                for (const key of current) {
                    deepInsert(batch, indexName, key, id, null);
                }

                // Add to all target partitions
                for (const key of target) {
                    deepInsert(batch, indexName, key, id, this.get(id));
                }

                deepInsert(this._partitionKeys, id, indexName, target);
            }
        }

        // Step 2: Recursively apply the batch updates to all partitions
        for (const indexName of Object.keys(batch)) {
            for (const partitionKey of Object.keys(batch[indexName]!)) {
                const partition = this._indexes[indexName]!.partition(partitionKey);
                partition.executeBatch((t) => {
                    for (const [id, value] of Object.entries(batch[indexName]![partitionKey]!)) {
                        t.set(id, value);
                    }
                });
            }
        }
    }

    /**
     * Apply updates to the view when some id's are updated.
     *
     * @param currentView The current view of the table
     * @param updatedIds Array of ids which have been updated
     */
    private applyViewUpdate(currentView: string[], updatedIds: string[]) {
        const { _filter, _comparator } = this;
        const path = this.getTablePathTokens();

        // Step 1: Split the ids into upserts and deletes
        const upserts = allocateEmptyArray<string>(updatedIds.length);
        const deletes = allocateEmptyArray<string>(updatedIds.length);
        for (const id of updatedIds) {
            const item = this.get(id);
            if (item && _filter ? _filter(item, path) : !!item) {
                upserts.push(id);
            } else {
                deletes.push(id);
            }
        }

        /**
         * Step 2: Construct a view that maintains ordering invariants:
         * 1. Remove deleted items: Items marked for removal are excluded from the view.
         * 2. Preserve existing order: Items not being upserted keep their relative positions.
         *    When no comparator exists, ALL existing items preserve their positions.
         * 3. Avoid duplicates: Items already in the view and the upsert batch
         *    are de-duped to prevent duplication during the final merge.
         */
        const upsertSet = new Set(upserts);
        const deleteSet = new Set(deletes);

        // Reset view to an empty array
        const updatedView = allocateEmptyArray<string>(currentView.length + upserts.length - deletes.length);

        let duplicateUpserts = false; // Flag to track if we have duplicate upserts
        for (const id of currentView) {
            // Case 1: If id needs to be removed, skip it and move to next
            if (deleteSet.has(id)) {
                continue;
            }

            /**
             * Case 2: If id is in the upsert set as well, but comparator isn't defined, we should add it to the
             * view to preserve existing order and remove from upsert set to avoid duplicates.
             */
            const isInUpsertSet = upsertSet.has(id);
            if (isInUpsertSet && !_comparator) {
                updatedView.push(id);
                upsertSet.delete(id);
                duplicateUpserts = true; // We have duplicate upserts
            }

            // Case 3: Id is not in the upsert set, move to view as is (preserves order among id's not in the upsert set)
            if (!isInUpsertSet) {
                updatedView.push(id);
            }
        }

        // Step 3: Merge the new ids into the view
        const newIds = duplicateUpserts ? Array.from(upsertSet) : upserts;
        this._view = this.mergeIntoView(updatedView, newIds);
    }

    /**
     * Merge id's into view using a 2-way merge strategy and preserve ordering invariants.
     * For existing view size N and newId size M, this takes O(N + M*log(M)) time. This is
     * close to linear time for M<<<N (most common case for user triggered singular edits).
     *
     * @param newIds Array of new ids to merge into the view
     * @param currentView The current view of the table
     */
    private mergeIntoView(currentView: string[], newIds: string[]): string[] {
        const { _comparator } = this;
        const path = this.getTablePathTokens();

        // If no comparator is defined, we can just append the new id's to the view
        if (!_comparator) {
            return currentView.concat(newIds);
        } else {
            // Step 1: Sort the new id's if there are multiple
            if (newIds.length > 1) {
                newIds.sort((id1, id2) => _comparator(this._items[id1]!, this._items[id2]!, path));
            }

            // Step 2: Merge the current view and newIds one by one, satisfying the order constraint
            const mergedView = allocateEmptyArray<string>(currentView.length + newIds.length);
            let i = 0; // Iterator for current view array
            let j = 0; // Iterator for newIds array
            while (i < currentView.length || j < newIds.length) {
                // Pick one id from current view and one from newIds array
                const currentId = i < currentView.length ? currentView[i] : null;
                const newId = j < newIds.length ? newIds[j] : null;

                // Add the id from the existing view if newIds array is empty or it comes before the id from the newIds array
                if (currentId && (!newId || _comparator(this._items[currentId]!, this._items[newId]!, path) <= 0)) {
                    mergedView.push(currentId);
                    i++;
                } else if (newId) {
                    mergedView.push(newId);
                    j++;
                }
            }
            return mergedView;
        }
    }

    // Check if this table has sub-partitions defined via indexes (i.e., it is not a terminal partition)
    private hasPartitions(): boolean {
        return Object.keys(this._indexes).length > 0;
    }

    /**
     * View-materialization enables fast full table reads. Typically filter and comparator are applied at
     * read time, which could be slow for large tables and cpu-heavy if done within tight render loops.
     * To prevent that, we materialize terminal partitions (i.e., tables without sub-partitions) when
     * a filter or comparator is applied. Typically terminal partitions are the ones that serve data for
     * a view on the UI so materializing them is beneficial. Keeping the intermediate tables un-materialized
     * allows us to avoid unnecessary memory overhead and CPU cost associated with materializing the view.
     */
    private refreshViewMaterialization() {
        /*
         * Case 1: Materialize the view if following conditions are met:
         * 1. The view is not already materialized (i.e., _view is null).
         * 2. Either a filter or a comparator is applied.
         * 3. The table does not have sub-partitions (i.e., it is a terminal partition).
         */
        if (!this._view && (this._filter || this._comparator) && !this.hasPartitions()) {
            this._view = this.itemIds();
        }

        /*
         * Case 2: Un-materialize the view if following conditions are met:
         * 1. The view is materialized (i.e., _view is not null).
         * 2. No filter and comparator is defined OR the table has sub-partitions.
         */
        if (this._view && ((!this._comparator && !this._filter) || this.hasPartitions())) {
            this._view = null;
        }
    }

    /**
     * A custom iterator that yields all partitions across all indexes.
     * @yields ITable<T> - Each partition of the table
     */
    private *partitions() {
        for (const index of Object.values(this._indexes)) {
            for (const key of index.keys()) {
                yield index.partition(key);
            }
        }
    }

    // Helper to get path tokens for this table
    private getTablePathTokens(): string[] {
        return this.name.split(TablePathDelimiter);
    }

    // Helper to get all item ids in the table (bypassing any applied filter)
    private allItemIds(): string[] {
        return Object.keys(this._items);
    }

    // #endregion
}

// #region INTERNAL RUNTIME CONTRACTS

/**
 * Defines the runtime index for internal table operations. This interface is
 * private to the table and only meant for internal operations.
 */
interface IRuntimeIndex<T> extends IIndex<T> {
    /**
     * A normalized accessor function that always returns an array of strings,
     * representing partition keys associated with the given item for this index.
     */
    readonly accessor: (item: T | null) => readonly string[];

    /**
     * Access a specific runtime partition within this index.
     */
    partition(key: string): ITable<T>;
}

// #endregion

// #region INTERNAL RUNTIME OBJECTS

/**
 * Runtime index implementation that partitions table items and manages access to those partitions.
 * Each partition is itself a table with optional sorting and filtering, enabling the recursive
 * table structure that allows sophisticated data organization and query patterns.
 */
class RuntimeIndex<T> implements IRuntimeIndex<T> {
    public readonly accessor: (item: T | null) => readonly string[];

    /** All partitions for this index */
    private readonly partitions: Record<string, ITable<T>> = {};

    /**
     * This constructor initializes a runtime index for a table.
     * @param name The name of the index.
     * @param definition The index accessor function that defines which partitions an item belongs to.
     * @param getParentFilter A function that returns the filter for the parent table, if any.
     * @param getParentComparator A function that returns the comparator for the parent table, if any.
     */
    public constructor(
        private readonly name: string,
        definition: IIndexDefinition<T>,
        private readonly getParentFilter: () => IFilter<T> | null,
        private readonly getParentComparator: () => IComparator<T> | null,
    ) {
        // Normalize the definition
        this.accessor = (item: T | null) => {
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
    }

    public keys(): string[] {
        return Object.keys(this.partitions);
    }

    public partition(key: string): ITable<T> {
        if (key.includes(TablePathDelimiter)) {
            throw new Error(`InvalidPartitionKey [Index=${this.name}][Partition=${key}]`);
        }

        // Lazily initialize the partition if it does not exist
        if (!this.partitions[key]) {
            this.partitions[key] = new Table(
                `${this.name}${TablePathDelimiter}${key}`,
                /*
                 * It's important to disable equality checks for sub-partitions because the item would
                 * already be updated in the parent table. And because we do not clone the item across
                 * partitions the equality check will always fail. Disabling the equality check allows
                 * the updates to recursively propagate to all sub-partitions.
                 */
                (_, __) => false,
                /*
                 * Change tracking is not needed for sub-partitions because these cannot be edited directly
                 * via the public API. The edits made via the parent table are already tracked at the root
                 * table and hence tracking at any layer below the root is unnecessary.
                 */
                false,
            );

            // Propagate the parent filter and comparator to the partition
            this.partitions[key].applyFilter(this.getParentFilter());
            this.partitions[key].applyComparator(this.getParentComparator());
        }

        return this.partitions[key];
    }
}

// #endregion

// #region UTILITIES

/**
 * Allocates an empty array of the specified size. This helps avoid runtime cost associated with
 * dynamically resizing the array in cases where the final size estimate is known.
 */
function allocateEmptyArray<T>(size: number): T[] {
    const array: T[] = new Array(size > 1 ? size : 1);
    array.length = 0; // Ensure the array is empty
    return array;
}

/**
 * Deeply inserts a value into an object at the specified path.
 * Usage: deepInsert(obj, 'a', 'b', 'c', value) will insert `value` at `obj.a.b.c`.
 *
 * @param obj The object to insert into
 * @param args The path to insert the value at, with the last argument being the value to insert
 */
function deepInsert(obj: Record<string, any>, key1: string, ...remainingKeysAndValue: any[]): void {
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
