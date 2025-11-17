// Type of delta update (a list of keys that were added, updated, or deleted)
export type IDelta<K> = readonly K[];

/**
 * Interface for an observable that allows subscribing to delta updates.
 */
export interface IObservableTable<K> {
    /**
     * Subscribe to delta updates.
     * @param listener The listener function to call when a delta is available.
     * @returns A function to unsubscribe the listener.
     */
    subscribe(listener: (delta: IDelta<K>) => void): () => void;
}
