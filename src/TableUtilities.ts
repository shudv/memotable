import { IReadonlyTable } from "./contracts/IReadonlyTable";

/**
 * Utility function to print the structure of a table and its partitions to the console.
 * @param table The table instance to print
 * @param toString Function to convert values to string for display
 * @param title Title of the root table
 */
export function toString<K, V>(
    table: IReadonlyTable<K, V>,
    toString: (value: V) => string,
    title: string = "root",
): string {
    return toStringInternal(table, toString, title, "", true);
}

/**
 * Utility function to print the structure of a table and its partitions to the console.
 * @param table The table instance to print
 * @param indent Current indentation level (used for recursion)
 * @param title Title of the current table or partition
 * @param isLast Whether this is the last partition at the current level
 */
function toStringInternal<K, V>(
    table: IReadonlyTable<K, V>,
    toString: (value: V) => string,
    title: string,
    indent: string,
    isLast: boolean,
): string {
    const prefix = indent + (isLast ? "└── " : "├── ");
    let result = `${prefix}${title} (${table.size})\n`;

    const partitions = table.partitions();
    const childIndent = indent + (isLast ? "    " : "│   ");

    if (partitions.length === 0 && table.size > 0) {
        // Leaf node - print the items
        const values = [...table.values()];
        for (let i = 0; i < values.length; i++) {
            const value = values[i]!;
            const isLastItem = i === values.length - 1;
            result += `${childIndent + (isLastItem ? "└── " : "├── ")}${toString(value)}` + "\n";
        }
    } else {
        // Recurse into partitions
        for (let i = 0; i < partitions.length; i++) {
            const partitionTitle = partitions[i]![0];
            const partition = table.partition(partitionTitle);
            const isLastPartition = i === partitions.length - 1;
            result += toStringInternal(
                partition,
                toString,
                partitionTitle,
                childIndent,
                isLastPartition,
            );
        }
    }

    return result;
}
