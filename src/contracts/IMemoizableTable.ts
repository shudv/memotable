// Interface for a memoizable entity
export interface IMemoizable {
    /**
     * Memoize the table
     *
     * This forces all derived partitions to retain their current state
     * until further notice, preventing automatic cleanup of unused tables.
     * Use this when you need to ensure that certain partitions remain
     * available even if they are not currently referenced.
     */
    memo(flag?: boolean): void;

    /**
     * Check if the table is currently memoized
     * @returns True if the table is memoized, false otherwise
     */
    isMemoized(): boolean;
}
