import { IReadonlyTable } from "./IReadonlyTable";

/**
 * Defines how values in a table are indexed and partitioned.
 *
 * An index definition maps a value to one or more partition names. Each name
 * represents a child table in the recursive table tree. Returning `null` or
 * `undefined` means the value does not belong to any partition.
 *
 * @example
 * ```ts
 * // One partition per task status
 * task => task.status
 *
 * // Multiple partitions for a value
 * todo => [
 *   todo.isImportant ? "important" : "regular",
 *   todo.listId
 * ];
 * ```
 */
export type IIndexDefinition<V> = (
    value: V,
) =>
    | string
    | null
    | undefined
    | boolean
    | (string | null | undefined)[]
    | readonly (string | null | undefined)[];

/**
 * A table that supports partitioning its values into derived tables
 * based on an index definition.
 *
 * Indexing creates a tree of derived tables. Each partition is itself
 * an `IReadonlyTable`, and can be further indexed or sorted recursively.
 */
export interface IIndexableTable<K, V> {
    /**
     * Set or update the index definition for this table.
     *
     * Partitioning is determined entirely by the definition; changing it
     * rebuilds the partitions. The optional initializer is called whenever
     * a new partition is created, allowing customization of each child table
     * (e.g., adding further indexing or sorting).
     *
     * @param definition Function that assigns partition names to a value.
     * @param partitionInitializer Optional callback invoked for every newly created partition. Returns true if this partition needs to be memoized
     */
    index(
        definition: IIndexDefinition<V>,
        partitionInitializer?: (
            name: string,
            partition: Pick<IReadonlyTable<K, V>, "sort" | "index" | "memo">,
        ) => void,
    ): void;

    /**
     * Remove the current index definition and clear all partitions.
     *
     * Passing `null` disables indexing for this table.
     */
    index(definition: null): void;

    /**
     * Re-index the table using the existing index definition.
     */
    index(): void;

    /**
     * Access a partition by name.
     *
     * Returns a derived table for the given partition name. If the partition
     * does not exist (empty or never created), an empty derived table is returned.
     *
     * @param name Name of the partition (uses default unnamed partition if not provided).
     */
    partition(name?: string): IReadonlyTable<K, V>;

    /**
     * Get the names of all (potentially empty) partitions in this table.
     */
    partitions(): readonly string[];
}
