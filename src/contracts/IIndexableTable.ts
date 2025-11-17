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
     * Access a partition by name.
     * @param name The name of the partition
     *
     * @returns The partition with the given name
     */
    partition(name: string): IReadOnlyTable<K, V>;

    /**
     * Index values in the table based on the given definition.
     *
     * @param definition A funtion that defines how to index items, or null to remove indexing
     */
    index(definition: IIndexDefinition<V> | null): void;
}
