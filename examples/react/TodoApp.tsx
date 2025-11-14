import React from "react";
import { Table } from "../../src/Table";
import { useTable } from "../../src/integrations/react";
import { IReadOnlyTable } from "../../src/contracts/IReadOnlyTable";
import { styles } from "./styles";

interface Todo {
    id: string;
    title: string;
    listId: string;
    isImportant: boolean;
    createdDate: Date;
    dueDate: Date;
}

function getPartitions(todo: Todo): string[] {
    const partitions: string[] = [];
    if (todo.isImportant) {
        partitions.push("Important");
    }
    partitions.push(todo.listId);
    return partitions;
}

// Create the root table
const todoTable = new Table<Todo>();

// Register partition index
todoTable.indexBy("View", (todo) => getPartitions(todo));

// Apply filter with sorting logic
todoTable.sort((a, b, path) => {
    if (path.length > 1 && path.at(-1) === "Important") {
        // not root
        return a.dueDate.getTime() - b.dueDate.getTime();
    }
    // Default: sort by created date
    return a.createdDate.getTime() - b.createdDate.getTime();
});

// ListView component
function ListView({ title, table }: { title: string; table: IReadOnlyTable<Todo> }) {
    useTable(table);

    return (
        <div style={styles.listView}>
            <h3 style={styles.listViewTitle}>{title}</h3>
            <ul style={styles.listViewList}>
                {table.items().map((todo) => (
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
            <div style={styles.listViewCount}>Total: {table.items().length} items</div>
        </div>
    );
}

export function TodoApp() {
    const [keyword, setKeyword] = React.useState("");

    const addTodo = (listId: string, isImportant: boolean = false) => {
        const id = `todo-${Date.now()}-${Math.random()}`;
        const now = new Date();
        const dueDate = new Date(now.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000);

        todoTable.set(id, {
            id,
            title: `Task ${todoTable.items().length + 1}`,
            listId,
            isImportant,
            createdDate: now,
            dueDate,
        });
    };

    const removeTodo = () => {
        const items = todoTable.items();
        if (items.length > 0) {
            todoTable.delete(items[items.length - 1].id);
        }
    };

    const clearAll = () => {
        const items = todoTable.items();
        items.forEach((todo) => todoTable.delete(todo.id));
    };

    const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setKeyword(value);

        if (value.trim() === "") {
            todoTable.filter(null);
        } else {
            todoTable.filter((todo) => todo.title.toLowerCase().includes(value.toLowerCase()));
        }
    };

    const partitions = ["List 1", "List 2", "Important"];

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
                <button onClick={removeTodo} style={styles.buttonDanger}>
                    Remove Last
                </button>
                <button onClick={clearAll} style={styles.buttonSecondary}>
                    Clear All
                </button>
            </div>

            <div style={styles.gridContainer}>
                {partitions.map((partitionKey) => (
                    <ListView
                        key={partitionKey}
                        title={partitionKey}
                        table={todoTable.bucket("View").partition(partitionKey)}
                    />
                ))}
            </div>
        </div>
    );
}
