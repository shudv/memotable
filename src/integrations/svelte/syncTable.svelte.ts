// Svelte
import { onMount, onDestroy } from "svelte";
import { writable, type Writable } from "svelte/store";

// Table contract
import type { IReadonlyTable } from "../../contracts/IReadonlyTable";

/**
 * Svelte function that subscribes to table changes and triggers re-renders.
 * @param table The table instance to subscribe to
 * @param memo Whether to memoize the table
 * @returns A writable store that increments on each table update
 *
 * @example
 * ```svelte
 * <script lang="ts">
 * import { syncTable } from 'memotable/svelte';
 *
 * let { table } = $props();
 * const version = syncTable(table);
 * </script>
 *
 * {#each table as [id, value] (id)}
 *   <li>{value}</li>
 * {/each}
 * ```
 */
export function syncTable<K, V>(
    table: IReadonlyTable<K, V>,
    memo: boolean = true,
): Writable<number> {
    const version = writable(0);
    let unsubscribe: (() => void) | undefined;

    onMount(() => {
        // Memoize the table for efficient reads from the UI
        table.memo(memo);

        // Subscribe to the table updates
        unsubscribe = table.subscribe(() => version.update((v) => v + 1));
    });

    onDestroy(() => {
        // On component unmount, un-memoize and unsubscribe from changes
        table.memo(false);
        unsubscribe?.();
    });

    return version;
}
