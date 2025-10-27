/**
 * Interface for a table that supports tracking which items have been modified.
 */
export interface IDeltaTrackedTable {
    /**
     * Get the next batch of modified ids since the last call.
     * @param maxItems Maximum number of id's to include in the batch (defaults to max available items)
     */
    nextDelta(maxItems?: number): string[];
}
