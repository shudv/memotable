import { styles } from "./styles";
import { ITodo } from "./ITodo";
import { useState } from "react";

// #region BUSINESS LOGIC
const KEYWORD_CONFIG_ID = "filter-keyword";

// Global app state
const todos = new Map<string, ITodo>();
const config = new Map<string, string>();

function getTodos(filter: (todo: ITodo) => boolean): ITodo[] {
    return Array.from(todos.values())
        .filter(
            (todo) =>
                filter(todo) &&
                todo.title
                    .toLowerCase()
                    .includes((config.get(KEYWORD_CONFIG_ID) ?? "").toLowerCase()),
        )
        .sort((a, b) => {
            if (a.isImportant && !b.isImportant) {
                return -1;
            } else if (!a.isImportant && b.isImportant) {
                return 1;
            } else {
                return a.createdDate.getTime() - b.createdDate.getTime();
            }
        });
}

// Utility to get all list IDs
function getLists(): string[] {
    const listSet = new Set<string>();
    for (const todo of todos.values()) {
        listSet.add(todo.listId);
    }
    return Array.from(listSet).sort();
}

// Utility to add a random todos
function addRandomTodo(count: number) {
    for (let i = 0; i < count; i++) {
        const id = `todo-${Date.now()}-${Math.random()}`;
        todos.set(id, {
            id,
            title: `Task ${todos.size + 1}`,
            listId: "List " + Math.floor(1 + Math.random() * 5),
            isImportant: Math.random() < 0.3,
            createdDate: new Date(),
            dueDate: new Date(new Date().getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000),
        });
    }
}

// #endregion

// #region PRESENTATIONAL REACT COMPONENTS

// Generic ListView component
function ListView({ title, todos }: { title: string; todos: ITodo[] }) {
    return (
        <div style={styles.listView}>
            <h3 style={styles.listViewTitle}>{title}</h3>
            <ul style={styles.listViewList}>
                {todos.map((todo) => (
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
            <div style={styles.listViewCount}>Total: {todos.length} tasks</div>
        </div>
    );
}

// Full todo app
export function TodoApp() {
    const [_, setState] = useState(0);
    const rerender = () => setState((s) => s + 1);
    const IMP = "Important";

    return (
        <div style={styles.container}>
            <h1>Todo List Demo</h1>

            <div style={styles.filterContainer}>
                <input
                    type="text"
                    placeholder="Filter by keyword..."
                    value={config.get(KEYWORD_CONFIG_ID)}
                    onChange={(e) => {
                        config.set(KEYWORD_CONFIG_ID, e.target.value);
                        rerender();
                    }}
                    style={styles.filterInput}
                />
            </div>

            <div style={styles.buttonContainer}>
                <button
                    onClick={() => {
                        addRandomTodo(100);
                        rerender();
                    }}
                    style={styles.button}
                >
                    Add 100 random tasks
                </button>
            </div>

            <div style={styles.gridContainer}>
                {getLists().map((id) => (
                    <ListView key={id} title={id} todos={getTodos((todo) => todo.listId == id)} />
                ))}
                <ListView key={IMP} title={IMP} todos={getTodos((todo) => todo.isImportant)} />
            </div>
        </div>
    );
}

// #endregion
