// React
import { useEffect, useState } from "react";

// Table contract
import type { IReadOnlyTable } from "../../contracts/IReadOnlyTable";

/**
 * React hook that subscribes to table changes and triggers re-renders.
 * @param table The table instance to subscribe to
 *
 * @example
 * ```tsx
 * const MyComponent = (table) => {
 *   useTable(table);
 *
 *   return (
 *     <ul>
 *       {table.items().map(item => (
 *         <li key={item.id}>{item.name}</li>
 *       ))}
 *     </ul>
 *   );
 * };
 * ```
 */
export function useTable<K, V>(table: IReadOnlyTable<K, V>) {
    const [, tick] = useState(0); // State to trigger re-renders
    useEffect(() => table.subscribe(() => tick((key) => ++key)));
}
