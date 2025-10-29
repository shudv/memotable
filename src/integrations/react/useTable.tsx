// React
import { useEffect, useState } from "react";

// Table contract
import type { IReadOnlyTable } from "../../contracts/IReadOnlyTable";

/**
 * React hook that subscribes to table changes and triggers re-renders.
 *
 * @template T Type of items in the table
 * @param table The table instance to subscribe to
 * @returns Array of items from the table
 *
 * @example
 * ```tsx
 * const MyComponent = (table) => {
 *   const items = useTable(table);
 *
 *   return (
 *     <ul>
 *       {items.map(item => (
 *         <li key={item.id}>{item.name}</li>
 *       ))}
 *     </ul>
 *   );
 * };
 * ```
 */
export function useTable<T>(table: IReadOnlyTable<T>) {
    const [, setRenderKey] = useState(0);
    useEffect(() => table.subscribe(() => setRenderKey((key) => key + 1)));
}
