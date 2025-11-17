import { IReadOnlyTable } from "./IReadOnlyTable";

/**
 * Defines an index configuration.
 *
 * An index definition is a simple a accessor function that returns the partition
 * names for any given value in the table.
 *
 * @example
 * ```typescript
 * // One partition for every unique task status
 * (task) => task.status;
 * ```
 */
export type IIndexDefinition<V> = (
    value: V,
) => string | string[] | readonly string[] | null | undefined;

/**
 * Interface for a table that supports indexing contained values.
 */
export interface IIndexableTable<K, V> {
    /**
     * Index values in the table based on the given definition.
     *
     * @param definition A funtion that defines how to index values
     * @param partitionInitializer Optional function that is called whenever a new partition is created, allowing to customize it (e.g., adding indexes or sorting)
     */
    index(
        definition: IIndexDefinition<V>,
        partitionInitializer?: (name: string, partition: IReadOnlyTable<K, V>) => void,
    ): void;

    /**
     * Remove index from the table.
     *
     * @param definition Must be null to remove existing index
     */
    index(definition: null): void;

    /**
     * Access a partition by name.
     * @param name The name of the partition
     *
     * @returns The partition with the given name
     */
    partition(name: string): IReadOnlyTable<K, V>;

    /**
     * Get all non-empty partition names in the table.
     *
     * @returns An array with all partition names
     */
    partitions(): string[];
}
