import React from "react";
import { Table } from "../../src/Table";
import { useTable } from "./useTable";
import { IReadOnlyTable } from "../../src/contracts/IReadOnlyTable";

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
todoTable.registerIndex("View", (todo) => getPartitions(todo));

// Apply filter with sorting logic
todoTable.applyComparator((a, b, path) => {
    if (path.length > 1 && path.at(-1) === "Important") {
        // not root
        return a.dueDate.getTime() - b.dueDate.getTime();
    }
    // Default: sort by created date
    return a.createdDate.getTime() - b.createdDate.getTime();
});

// ListView component
function ListView({ title, table }: { title: string; table: IReadOnlyTable<Todo> }) {
    const items = useTable(table);

    return (
        <div
            style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "16px",
                backgroundColor: "#f9f9f9",
                minWidth: "300px",
            }}
        >
            <h3 style={{ marginTop: 0, color: "#333" }}>{title}</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
                {items.map((todo) => (
                    <li
                        key={todo.id}
                        style={{
                            padding: "8px",
                            marginBottom: "8px",
                            backgroundColor: "white",
                            borderRadius: "4px",
                            border: "1px solid #ddd",
                        }}
                    >
                        <div style={{ fontWeight: "bold" }}>{todo.title}</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                            Created: {todo.createdDate.toLocaleDateString()} | Due:{" "}
                            {todo.dueDate.toLocaleDateString()}
                            {todo.isImportant && (
                                <span style={{ color: "red", marginLeft: "8px" }}>⭐</span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            <div style={{ fontSize: "12px", color: "#999" }}>Total: {items.length} items</div>
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
            todoTable.applyFilter(null);
        } else {
            todoTable.applyFilter((todo) => todo.title.toLowerCase().includes(value.toLowerCase()));
        }
    };

    // Get all partition keys
    const partitions = ["List 1", "List 2", "Important"];

    return (
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
            <h1>Todo List Demo</h1>

            <div style={{ marginBottom: "20px" }}>
                <input
                    type="text"
                    placeholder="Filter by keyword..."
                    value={keyword}
                    onChange={handleKeywordChange}
                    style={{
                        padding: "8px 12px",
                        fontSize: "14px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        width: "300px",
                        marginBottom: "12px",
                    }}
                />
            </div>

            <div style={{ marginBottom: "20px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button onClick={() => addTodo("List 1", false)} style={buttonStyle}>
                    Add to List 1
                </button>
                <button onClick={() => addTodo("List 2", false)} style={buttonStyle}>
                    Add to List 2
                </button>
                <button onClick={() => addTodo("List 1", true)} style={buttonStyle}>
                    Add Important to List 1
                </button>
                <button onClick={() => addTodo("List 2", true)} style={buttonStyle}>
                    Add Important to List 2
                </button>
                <button onClick={removeTodo} style={{ ...buttonStyle, backgroundColor: "#dc3545" }}>
                    Remove Last
                </button>
                <button onClick={clearAll} style={{ ...buttonStyle, backgroundColor: "#6c757d" }}>
                    Clear All
                </button>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: "16px",
                }}
            >
                {partitions.map((partitionKey) => (
                    <ListView
                        key={partitionKey}
                        title={partitionKey}
                        table={todoTable.index("View").partition(partitionKey)}
                    />
                ))}
            </div>
        </div>
    );
}

const buttonStyle: React.CSSProperties = {
    padding: "8px 16px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
};
