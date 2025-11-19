// Type for a table subscriber
export type ITableSubscriber<K> = (modifiedKeys: readonly K[]) => void;

/**
 * Provides a way to observe changes in a table.
 *
 * Subscribers are notified whenever this table changes, and receive
 * the set of modified keys. The subscrber can also be notified when
 * the order of values changes, if the table is sorted.
 */
export interface IObservableTable<K> {
    /**
     * Subscribe to changes in this table.
     *
     * The listener is called after updates are applied and batching (if any)
     * completes. It receives a readonly array of keys that were touched,
     * inserted, updated, or removed.
     *
     * @param listener Callback invoked when this table changes.
     * @returns A function that unsubscribes the listener.
     */
    subscribe(subscriber: ITableSubscriber<K>): () => void;
}
