import { Table } from "../../src/Table";
import { useTable } from "../../src/integrations/react";
import { IReadonlyTable } from "../../src/contracts/IReadonlyTable";
import { styles } from "./styles";
import { ITodo } from "./ITodo";

// #region BUSINESS LOGIC
const KEYWORD_CONFIG_ID = "filter-keyword";

// Global app state
const TodoTable = new Table<string, ITodo>(); // Table containing all todos
const ConfigTable = new Table<string, string>(); // Configuration table (contains filter keyword)

// Register partition index
TodoTable.index(
    (todo) => [todo.listId, todo.isImportant ? "Important" : null], // Specify which all partitions a todo belongs to
    (p) => {
        // Every parition is further filtered by keyword from config table
        p.index(
            (todo) =>
                todo.title
                    .toLowerCase()
                    .includes((ConfigTable.get(KEYWORD_CONFIG_ID) ?? "").toLowerCase()),

            // Memoize the filtered partitions for better read performance
            (p) => p.memo(),
        );

        // Sort todos within each partition using 2-factor sorting: important first, then by created date
        p.sort(
            (a, b) =>
                Number(b.isImportant) - Number(a.isImportant) ||
                a.createdDate.getTime() - b.createdDate.getTime(),
        );
    },
);

// Utility to apply keyword filter
function applyKeywordFilter(keyword: string) {
    ConfigTable.set(KEYWORD_CONFIG_ID, keyword);
    for (const [_, partition] of TodoTable.partitions()) {
        partition.index();
    }
}

// Utility to add a random todos
function addRandomTodo(count: number) {
    TodoTable.batch((t) => {
        for (let i = 0; i < count; i++) {
            const id = `todo-${Date.now()}-${Math.random()}`;
            t.set(id, {
                id,
                title: `Task ${i + 1}`,
                listId: "List " + Math.floor(1 + Math.random() * 5),
                isImportant: Math.random() < 0.3,
                createdDate: new Date(),
                dueDate: new Date(new Date().getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000),
            });
        }
    });
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
                {Array.from(table, ([id, todo]) => (
                    <li key={id} style={styles.listViewItem}>
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
    useTable(ConfigTable);
    useTable(TodoTable);

    return (
        <div style={styles.container}>
            <h1>Todo List Demo</h1>

            <div style={styles.filterContainer}>
                <input
                    type="text"
                    placeholder="Filter by keyword..."
                    value={ConfigTable.get(KEYWORD_CONFIG_ID)}
                    onChange={(e) => applyKeywordFilter(e.target.value)}
                    style={styles.filterInput}
                />
            </div>

            <div style={styles.buttonContainer}>
                <button onClick={() => addRandomTodo(100)} style={styles.button}>
                    Add 100 random tasks
                </button>
            </div>

            <div style={styles.gridContainer}>
                {TodoTable.partitions().map(([listId, list]) => (
                    <ListView key={listId} title={listId} table={list.partition()} />
                ))}
            </div>
        </div>
    );
}

// #endregion
