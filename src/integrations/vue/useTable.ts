// Vue
import { onMounted, onUnmounted, triggerRef, shallowRef } from "vue";

// Table contract
import type { IReadonlyTable } from "../../contracts/IReadonlyTable";

/**
 * Vue composable that subscribes to table changes and triggers re-renders.
 * @param table The table instance to subscribe to
 * @param memo Whether to memoize the table
 *
 * @example
 * ```vue
 * <script setup>
 * const props = defineProps<{ table: IReadonlyTable<string, Todo> }>();
 * useTable(props.table);
 * </script>
 *
 * <template>
 *   <ul>
 *     <li v-for="[id, value] in props.table" :key="id">{{ value }}</li>
 *   </ul>
 * </template>
 * ```
 */
export function useTable<K, V>(table: IReadonlyTable<K, V>, memo: boolean = true) {
    const trigger = shallowRef(0);
    let unsubscribe: (() => void) | undefined;

    onMounted(() => {
        // Memoize the table for efficient reads from the UI
        table.memo(memo);

        // Subscribe to the table updates
        unsubscribe = table.subscribe(() => {
            trigger.value++;
            triggerRef(trigger);
        });
    });

    onUnmounted(() => {
        // On component unmount, un-memoize and unsubscribe from changes
        table.memo(false);
        unsubscribe?.();
    });

    return trigger;
}
