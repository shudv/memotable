export interface IBatchableTable<K, V> {
    /**
     * Runs a group of edits on the table as a single atomic batch.
     *
     * All mutations performed inside the callback are queued and applied
     * only after the callback returns, avoiding intermediate recomputation
     * of derived views and reducing update overhead. This is useful when
     * performing multiple related edits that do not need to be reflected
     * in the table one-by-one.
     *
     * @param fn A function that receives a batch interface for performing
     *           multiple data-level edits.
     */
    batch(fn: (t: IBatch<K, V>) => void): void;
}

export interface IBatch<K, V> {
    /**
     * Set or update the value associated with the given key.
     */
    set(key: K, value: V): void;

    /**
     * Remove the given key (and its value) from the table.
     */
    delete(key: K): void;

    /**
     * Mark the key as modified without changing its value.
     * Useful for triggering downstream recomputation when the
     * value itself is stable but its metadata or ordering may change.
     */
    touch(key: K): void;
}
