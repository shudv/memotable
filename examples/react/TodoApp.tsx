import React, { useState } from "react";
import { Table } from "../../src/Table";
import { useTable } from "../../src/integrations/react";
import { IReadonlyTable } from "../../src/contracts/IReadonlyTable";
import { styles } from "./styles";
import { ITodo } from "./ITodo";

// #region BUSINESS LOGIC

// Config data
const ImportantPartition = "Important";

// Global state
const AppState = {
    todoTable: new Table<string, ITodo>(),
    keyword: "",
};

// Register partition index
AppState.todoTable.index(
    (todo) => [todo.listId, todo.isImportant ? ImportantPartition : null],
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

        // Apply keyword filtering within each partition
        partition.index(
            (todo) => todo.title.toLowerCase().includes(AppState.keyword.toLowerCase()),

            // Memoize the filtered partitions for better performance
            (_, partition) => partition.memo(),
        );
    },
);

// Utility to add a random todo
function addRandomTodo() {
    const id = `todo-${Date.now()}-${Math.random()}`;
    AppState.todoTable.set(id, {
        id,
        title: `Task ${AppState.todoTable.size + 1}`,
        listId: "List " + Math.floor(1 + Math.random() * 5),
        isImportant: Math.random() < 0.3,
        createdDate: new Date(),
        dueDate: new Date(new Date().getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000),
    });
}

// Utility to apply keyword filter
function applyKeywordFilter(keyword: string) {
    AppState.keyword = keyword;
    for (const partitionKey of AppState.todoTable.partitions()) {
        AppState.todoTable.partition(partitionKey).index();
    }
}

// #endregion

// #region PRESENTATIONAL REACT COMPONENTS

// Generic ListView component
function ListView({ title, table }: { title: string; table: IReadonlyTable<string, ITodo> }) {
    useTable(table);

    // Each render just renders the todos in the table without applying filter/sort during render pass
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
    const { todoTable } = AppState;

    useTable(todoTable);
    const [keyword, setKeyword] = useState(AppState.keyword);

    return (
        <div style={styles.container}>
            <h1>Todo List Demo</h1>

            <div style={styles.filterContainer}>
                <input
                    type="text"
                    placeholder="Filter by keyword..."
                    value={keyword}
                    onChange={(e) => {
                        const keyword = e.target.value;
                        setKeyword(keyword);
                        applyKeywordFilter(keyword);
                    }}
                    style={styles.filterInput}
                />
            </div>

            <div style={styles.buttonContainer}>
                <button onClick={addRandomTodo} style={styles.button}>
                    Add random task
                </button>
            </div>

            <div style={styles.gridContainer}>
                {todoTable.partitions().map((partitionKey) => (
                    <>
                        <ListView
                            key={partitionKey}
                            title={partitionKey}
                            table={todoTable.partition(partitionKey).partition()}
                        />
                    </>
                ))}
            </div>
        </div>
    );
}

// #endregion
