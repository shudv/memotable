/**
 * Interface for an observable that allows subscribing to delta updates.
 */
export interface IObservable<TDelta> {
    /**
     * Subscribe to delta updates.
     * @param listener The listener function to call when a delta is available.
     * @returns A function to unsubscribe the listener.
     */
    subscribe(listener: (delta: TDelta) => void): () => void;
}
