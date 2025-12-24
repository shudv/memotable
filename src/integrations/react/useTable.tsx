// React
import { useEffect, useState } from "react";

// Table contract
import type { IReadonlyTable } from "../../contracts/IReadonlyTable";

/**
 * React hook that subscribes to table changes and triggers re-renders.
 * @param table The table instance to subscribe to
 * @param memo Whether to memoize the table
 *
 * @example
 * ```tsx
 * const MyComponent = (table) => {
 *   useTable(table);
 *
 *   return (
 *     <ul>
 *       {Array.from(table, ([id, value]) => (
 *         <li key={id}>{value}</li>
 *       ))}
 *     </ul>
 *   );
 * };
 * ```
 */
export function useTable<K, V>(table: IReadonlyTable<K, V>, memo: boolean = true) {
    const [, tick] = useState(0); // State to trigger re-renders
    useEffect(() => {
        // Memoize the table for efficient reads from the UI
        table.memo(memo);

        // Subsribe to the table updates
        const unsubscribe = table.subscribe(() => tick((key) => ++key));

        // On component unmount, un-memoize and unsubsribe from changes
        return () => {
            table.memo(false);
            unsubscribe();
        };
    });
}
