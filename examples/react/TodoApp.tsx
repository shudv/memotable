import React from "react";
import { Table } from "../../src/Table";
import { useTable } from "../../src/integrations/react";
import { IReadonlyTable } from "../../src/contracts/IReadonlyTable";
import { styles } from "./styles";
import { ITodo } from "./ITodo";

// Config data
const ImportantPartition = "Important";
const VisiblePartition = "Visible";
const RenderedLists = ["List 1", "List 2"];

// Setup todo table
const todoTable = new Table<string, ITodo>();

// Register partition index
todoTable.index(
    (todo) => {
        const partitions: string[] = [];

        // Every important todo goes into "Important" partition
        if (todo.isImportant) {
            partitions.push(ImportantPartition);
        }

        // Every todo goes into its list partition
        partitions.push(todo.listId);

        return partitions;
    },
    (_, partition) => {
        // All partition should be ordered based on 2-factor sorting
        partition.sort((a, b) => {
            if (a.isImportant && !b.isImportant) {
                return -1;
            } else if (!a.isImportant && b.isImportant) {
                return 1;
            } else {
                return a.createdDate.getTime() - b.createdDate.getTime();
            }
        });
    },
);

const RenderedPartitions = [...RenderedLists, ImportantPartition];

// Utility to apply keyword filter to all rendered partitions
function applyFilter(keyword: string) {
    for (const key of RenderedPartitions) {
        todoTable.partition(key).index(
            (todo) =>
                todo.title.toLowerCase().includes(keyword.toLowerCase())
                    ? VisiblePartition
                    : undefined,
            (_, partition) => {
                // Memoize the visible partitions for performance
                partition.memo();
            },
        );
    }
}

applyFilter(""); // Apply once to innitialze visible partitions

// Generic ListView component
function ListView({ title, table }: { title: string; table: IReadonlyTable<string, ITodo> }) {
    useTable(table);

    return (
        <div style={styles.listView}>
            <h3 style={styles.listViewTitle}>{title}</h3>
            <ul style={styles.listViewList}>
                {table.toArray().map((todo) => (
                    <li key={todo.id} style={styles.listViewItem}>
                        <div style={styles.listViewItemTitle}>{todo.title}</div>
                        <div style={styles.listViewItemMeta}>
                            Created: {todo.createdDate.toLocaleDateString()} | Due:{" "}
                            {todo.dueDate.toLocaleDateString()}
                            {todo.isImportant && <span style={styles.importantBadge}>⭐</span>}
                        </div>
                    </li>
                ))}
            </ul>
            <div style={styles.listViewCount}>Total: {table.size} tasks</div>
        </div>
    );
}

// Full todo app
export function TodoApp() {
    const [keyword, setKeyword] = React.useState("");

    const addTodo = (listId: string, isImportant: boolean = false) => {
        const id = `todo-${Date.now()}-${Math.random()}`;
        const now = new Date();
        const dueDate = new Date(now.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000);

        todoTable.set(id, {
            id,
            title: `Task ${todoTable.size + 1}`,
            listId,
            isImportant,
            createdDate: now,
            dueDate,
        });
    };

    const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setKeyword(value);
        applyFilter(value);
    };

    return (
        <div style={styles.container}>
            <h1>Todo List Demo</h1>

            <div style={styles.filterContainer}>
                <input
                    type="text"
                    placeholder="Filter by keyword..."
                    value={keyword}
                    onChange={handleKeywordChange}
                    style={styles.filterInput}
                />
            </div>

            <div style={styles.buttonContainer}>
                <button onClick={() => addTodo("List 1", false)} style={styles.button}>
                    Add to List 1
                </button>
                <button onClick={() => addTodo("List 2", false)} style={styles.button}>
                    Add to List 2
                </button>
                <button onClick={() => addTodo("List 1", true)} style={styles.button}>
                    Add Important to List 1
                </button>
                <button onClick={() => addTodo("List 2", true)} style={styles.button}>
                    Add Important to List 2
                </button>
            </div>

            <div style={styles.gridContainer}>
                {RenderedPartitions.map((partitionKey) => (
                    <ListView
                        key={partitionKey}
                        title={partitionKey}
                        table={todoTable.partition(partitionKey).partition(VisiblePartition)}
                    />
                ))}
            </div>
        </div>
    );
}
