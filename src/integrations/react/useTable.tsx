// React
import { useEffect, useState } from "react";

// Table contract
import type { IReadonlyTable } from "../../contracts/IReadonlyTable";

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
 *       {Array.from(table, ([id, value]) => (
 *         <li key={id}>{value}</li>
 *       ))}
 *     </ul>
 *   );
 * };
 * ```
 */
export function useTable<K, V>(table: IReadonlyTable<K, V>) {
    const [, tick] = useState(0); // State to trigger re-renders
    useEffect(() => table.subscribe(() => tick((key) => ++key)));
}
