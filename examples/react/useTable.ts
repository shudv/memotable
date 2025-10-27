import { useEffect, useState } from "react";
import type { IReadOnlyTable } from "../../src/contracts/IReadOnlyTable";

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
export function useTable<T>(table: IReadOnlyTable<T>): T[] {
    const [items, setItems] = useState(table.items());

    useEffect(
        () =>
            table.subscribe(() => {
                setItems(table.items());
            }),
        [table.subscribe]
    );

    return items;
}
