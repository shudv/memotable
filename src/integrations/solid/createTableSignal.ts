// Solid
import { createSignal, onMount, onCleanup } from "solid-js";

// Table contract
import type { IReadonlyTable } from "../../contracts/IReadonlyTable";

/**
 * Solid primitive that subscribes to table changes and triggers re-renders.
 * @param table The table instance to subscribe to
 * @param memo Whether to memoize the table
 *
 * @example
 * ```tsx
 * const MyComponent = (props) => {
 *   const version = createTableSignal(props.table);
 *
 *   return (
 *     <ul>
 *       <For each={[...props.table]}>
 *         {([id, value]) => <li>{value}</li>}
 *       </For>
 *     </ul>
 *   );
 * };
 * ```
 */
export function createTableSignal<K, V>(table: IReadonlyTable<K, V>, memo: boolean = true) {
    const [version, setVersion] = createSignal(0);

    onMount(() => {
        // Memoize the table for efficient reads from the UI
        table.memo(memo);

        // Subscribe to the table updates
        const unsubscribe = table.subscribe(() => setVersion((v) => v + 1));

        // On component unmount, un-memoize and unsubscribe from changes
        onCleanup(() => {
            table.memo(false);
            unsubscribe();
        });
    });

    return version;
}
