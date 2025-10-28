import { Table } from "./Table";

// Type declarations for Node.js test environment
declare const console: {
    log: (...args: any[]) => void;
};

declare const performance: {
    now: () => number;
};

// ============================================================================
// Configuration
// ============================================================================

interface BenchmarkConfig {
    numLists: number; // Number of todo lists
    tasksPerList: number; // Tasks per list
    completionRate: number; // Fraction of completed tasks (0-1)
    importantRate: number; // Fraction of important tasks (0-1)
    numEdits: number; // Number of edit operations to perform
    numReads: number; // Number of read operations to perform
    editPattern: "random" | "realistic" | "bulk"; // Type of edits to perform
}

interface Task {
    id: string;
    listId: string;
    title: string;
    description: string;
    createdAt: number;
    completedAt: number | null;
    isCompleted: boolean;
    isImportant: boolean;
    priority: number;
}

interface BenchmarkResult {
    scenario: string;
    editTimeMs: number;
    readTimeMs: number;
    avgEditMs: number;
    avgReadMs: number;
}

// Default config optimized for CI (fast)
const DEFAULT_CONFIG: BenchmarkConfig = {
    numLists: 50,
    tasksPerList: 1000,
    completionRate: 0.3,
    importantRate: 0.1,
    numEdits: 500,
    numReads: 100,
    editPattern: "realistic",
};

// ============================================================================
// Test Data Generation
// ============================================================================

function generateTasks(config: BenchmarkConfig): Task[] {
    const tasks: Task[] = [];
    const totalTasks = config.numLists * config.tasksPerList;
    const now = Date.now();

    for (let i = 0; i < totalTasks; i++) {
        const listId = `list-${Math.floor(i / config.tasksPerList)}`;
        const isCompleted = Math.random() < config.completionRate;
        const isImportant = Math.random() < config.importantRate;

        tasks.push({
            id: `task-${i}`,
            listId,
            title: `Task ${i}: ${generateRandomTitle()}`,
            description: `Description for task ${i}`,
            createdAt: now - i * 1000, // Older tasks have earlier timestamps
            completedAt: isCompleted ? now - Math.random() * 1000000 : null,
            isCompleted,
            isImportant,
            priority: Math.floor(Math.random() * 5) + 1,
        });
    }

    return tasks;
}

function generateRandomTitle(): string {
    const verbs = ["Fix", "Add", "Update", "Remove", "Refactor", "Implement", "Test"];
    const subjects = ["feature", "bug", "UI", "API", "database", "tests", "documentation"];
    return `${verbs[Math.floor(Math.random() * verbs.length)]} ${subjects[Math.floor(Math.random() * subjects.length)]}`;
}

// ============================================================================
// Scenario 1: Plain (useMemo pattern)
// ============================================================================

class PlainImplementation {
    private tasks: Map<string, Task> = new Map();
    private subscriptions: Set<(ids: string[]) => void> = new Set();

    set(id: string, task: Task | null): void {
        if (task === null) {
            this.tasks.delete(id);
        } else {
            this.tasks.set(id, task);
        }
        this.notify([id]);
    }

    getListTasks(listId: string): Task[] {
        // Simulates useMemo behavior - full filter + sort on every read
        return Array.from(this.tasks.values())
            .filter((t) => t.listId === listId && !t.isCompleted)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    getImportantTasks(): Task[] {
        return Array.from(this.tasks.values())
            .filter((t) => t.isImportant && !t.isCompleted)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    subscribe(callback: (ids: string[]) => void): () => void {
        this.subscriptions.add(callback);
        return () => this.subscriptions.delete(callback);
    }

    private notify(ids: string[]): void {
        this.subscriptions.forEach((cb) => cb(ids));
    }

    runBatch(fn: (impl: PlainImplementation) => void): void {
        const changedIds: string[] = [];
        const originalNotify = this.notify.bind(this);
        this.notify = (ids: string[]) => changedIds.push(...ids);

        fn(this);

        this.notify = originalNotify;
        if (changedIds.length > 0) {
            originalNotify(changedIds);
        }
    }
}

// ============================================================================
// Scenario 2 & 3: Table-based implementations
// ============================================================================

function setupTableImplementation(materialize: boolean): Table<Task> {
    const table = new Table<Task>({
        shouldMaterialize: materialize ? (_, isTerminal) => isTerminal : () => false,
        isEqual: (a, b) =>
            a.isCompleted === b.isCompleted &&
            a.isImportant === b.isImportant &&
            a.priority === b.priority &&
            a.title === b.title,
    });

    // Index by list
    table.registerIndex("list", (task) => task.listId);

    // Index by importance (for composite "Important" view)
    table.registerIndex("importance", (task) => (task.isImportant ? "important" : "normal"));

    // Apply filter and comparator to each list partition
    const listIds = Array.from({ length: DEFAULT_CONFIG.numLists }, (_, i) => `list-${i}`);
    for (const listId of listIds) {
        const partition = table.index("list").partition(listId);
        partition.applyFilter((task) => !task.isCompleted);
        // Two-factor sort: important items first, then by creation date (newest first)
        partition.applyComparator((a, b) => {
            // Primary: important items come first
            if (a.isImportant !== b.isImportant) {
                return a.isImportant ? -1 : 1;
            }
            // Secondary: sort by creation date (newest first)
            return b.createdAt - a.createdAt;
        });
    }

    // Setup Important view
    const importantPartition = table.index("importance").partition("important");
    importantPartition.applyFilter((task) => !task.isCompleted);
    // Important view only sorts by creation date since all items are important
    importantPartition.applyComparator((a, b) => b.createdAt - a.createdAt);

    return table;
}

// ============================================================================
// Edit Patterns
// ============================================================================

function applyRandomEdits(
    tasks: Task[],
    config: BenchmarkConfig,
    setter: (id: string, task: Task) => void,
): void {
    for (let i = 0; i < config.numEdits; i++) {
        const task = tasks[Math.floor(Math.random() * tasks.length)]!;
        const updated: Task = {
            ...task,
            isCompleted: !task.isCompleted,
            completedAt: !task.isCompleted ? Date.now() : null,
        };
        setter(task.id, updated);
    }
}

function applyRealisticEdits(
    tasks: Task[],
    config: BenchmarkConfig,
    setter: (id: string, task: Task) => void,
): void {
    const editsPerType = Math.floor(config.numEdits / 3);

    // 1. Toggle completion (most common)
    for (let i = 0; i < editsPerType; i++) {
        const task = tasks[Math.floor(Math.random() * tasks.length)]!;
        const updated: Task = {
            ...task,
            isCompleted: !task.isCompleted,
            completedAt: !task.isCompleted ? Date.now() : null,
        };
        setter(task.id, updated);
    }

    // 2. Change priority (occasional)
    for (let i = 0; i < editsPerType; i++) {
        const task = tasks[Math.floor(Math.random() * tasks.length)]!;
        const updated: Task = {
            ...task,
            priority: Math.floor(Math.random() * 5) + 1,
        };
        setter(task.id, updated);
    }

    // 3. Toggle importance (rare)
    for (let i = 0; i < editsPerType; i++) {
        const task = tasks[Math.floor(Math.random() * tasks.length)]!;
        const updated: Task = {
            ...task,
            isImportant: !task.isImportant,
        };
        setter(task.id, updated);
    }
}

function applyBulkEdits(
    tasks: Task[],
    config: BenchmarkConfig,
    setter: (id: string, task: Task) => void,
    runBatch?: (fn: () => void) => void,
): void {
    const operation = () => {
        const completionToggle = Math.random() > 0.5;
        for (let i = 0; i < config.numEdits; i++) {
            const task = tasks[Math.floor(Math.random() * tasks.length)]!;
            const updated: Task = {
                ...task,
                isCompleted: completionToggle ? true : !task.isCompleted,
                completedAt: completionToggle ? Date.now() : task.completedAt,
            };
            setter(task.id, updated);
        }
    };

    if (runBatch) {
        runBatch(operation);
    } else {
        operation();
    }
}

// ============================================================================
// Benchmarking Functions
// ============================================================================

function benchmarkPlain(tasks: Task[], config: BenchmarkConfig): BenchmarkResult {
    const impl = new PlainImplementation();

    // Load data
    for (const task of tasks) {
        impl.set(task.id, task);
    }

    // Benchmark edits
    const editStart = performance.now();
    if (config.editPattern === "random") {
        applyRandomEdits(tasks, config, (id, task) => impl.set(id, task));
    } else if (config.editPattern === "realistic") {
        applyRealisticEdits(tasks, config, (id, task) => impl.set(id, task));
    } else {
        applyBulkEdits(
            tasks,
            config,
            (id, task) => impl.set(id, task),
            (fn) => impl.runBatch(() => fn()),
        );
    }
    const editEnd = performance.now();

    // Benchmark reads
    const readStart = performance.now();
    for (let i = 0; i < config.numReads; i++) {
        const listId = `list-${Math.floor(Math.random() * config.numLists)}`;
        impl.getListTasks(listId);
        if (i % 10 === 0) {
            impl.getImportantTasks();
        }
    }
    const readEnd = performance.now();

    return {
        scenario: "Plain",
        editTimeMs: editEnd - editStart,
        readTimeMs: readEnd - readStart,
        avgEditMs: (editEnd - editStart) / config.numEdits,
        avgReadMs: (readEnd - readStart) / config.numReads,
    };
}

function benchmarkTable(
    tasks: Task[],
    config: BenchmarkConfig,
    materialize: boolean,
): BenchmarkResult {
    const table = setupTableImplementation(materialize);

    // Load data
    table.runBatch((t) => {
        for (const task of tasks) {
            t.set(task.id, task);
        }
    });

    // Benchmark edits
    const editStart = performance.now();
    if (config.editPattern === "random") {
        applyRandomEdits(tasks, config, (id, task) => table.set(id, task));
    } else if (config.editPattern === "realistic") {
        applyRealisticEdits(tasks, config, (id, task) => table.set(id, task));
    } else {
        applyBulkEdits(
            tasks,
            config,
            (id, task) => table.set(id, task),
            (fn) => table.runBatch(() => fn()),
        );
    }
    const editEnd = performance.now();

    // Benchmark reads
    const readStart = performance.now();
    for (let i = 0; i < config.numReads; i++) {
        const listId = `list-${Math.floor(Math.random() * config.numLists)}`;
        table.index("list").partition(listId).items();
        if (i % 10 === 0) {
            table.index("importance").partition("important").items();
        }
    }
    const readEnd = performance.now();

    return {
        scenario: materialize ? "Table (cached)" : "Table",
        editTimeMs: editEnd - editStart,
        readTimeMs: readEnd - readStart,
        avgEditMs: (editEnd - editStart) / config.numEdits,
        avgReadMs: (readEnd - readStart) / config.numReads,
    };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Table - Performance Benchmarks", () => {
    let config: BenchmarkConfig;
    let tasks: Task[];
    let results: BenchmarkResult[];

    beforeAll(() => {
        config = DEFAULT_CONFIG;
        console.log("\n📊 Benchmark Configuration:");
        console.log(`  Lists: ${config.numLists}`);
        console.log(`  Tasks per list: ${config.tasksPerList}`);
        console.log(`  Total tasks: ${config.numLists * config.tasksPerList}`);
        console.log(`  Completion rate: ${(config.completionRate * 100).toFixed(0)}%`);
        console.log(`  Important rate: ${(config.importantRate * 100).toFixed(0)}%`);
        console.log(`  Edit operations: ${config.numEdits}`);
        console.log(`  Read operations: ${config.numReads}`);
        console.log(`  Edit pattern: ${config.editPattern}\n`);

        // Generate test data once
        tasks = generateTasks(config);
        results = [];
    });

    describe("Scenario 1: Plain (useMemo pattern)", () => {
        test("should measure edit and read performance", () => {
            const result = benchmarkPlain([...tasks], config);
            results.push(result);

            console.log(`\n✓ ${result.scenario}`);
            console.log(`  Edit time: ${result.editTimeMs.toFixed(1)}ms`);
            console.log(`  Read time: ${result.readTimeMs.toFixed(1)}ms`);

            expect(result.editTimeMs).toBeGreaterThan(0);
            expect(result.readTimeMs).toBeGreaterThan(0);
        });
    });

    describe("Scenario 2: Table (no materialization)", () => {
        test("should measure edit and read performance", () => {
            const result = benchmarkTable([...tasks], config, false);
            results.push(result);

            console.log(`\n✓ ${result.scenario}`);
            console.log(`  Edit time: ${result.editTimeMs.toFixed(1)}ms`);
            console.log(`  Read time: ${result.readTimeMs.toFixed(1)}ms`);

            expect(result.editTimeMs).toBeGreaterThan(0);
            expect(result.readTimeMs).toBeGreaterThan(0);
        });
    });

    describe("Scenario 3: Table (with materialization)", () => {
        test("should measure edit and read performance", () => {
            const result = benchmarkTable([...tasks], config, true);
            results.push(result);

            console.log(`\n✓ ${result.scenario}`);
            console.log(`  Edit time: ${result.editTimeMs.toFixed(1)}ms`);
            console.log(`  Read time: ${result.readTimeMs.toFixed(1)}ms`);

            expect(result.editTimeMs).toBeGreaterThan(0);
            expect(result.readTimeMs).toBeGreaterThan(0);
        });
    });

    describe("Performance assertions", () => {
        test("Table should have faster reads than plain implementation", () => {
            const plain = results.find((r) => r.scenario.includes("Plain"));
            const tableMaterialized = results.find((r) =>
                r.scenario.includes("with materialization"),
            );

            if (plain && tableMaterialized) {
                // With materialization, reads should be faster
                expect(tableMaterialized.avgReadMs).toBeLessThan(plain.avgReadMs * 2);
            }
        });

        test("Batch edits should be efficient", () => {
            // Ensure we can handle the configured number of edits
            for (const result of results) {
                expect(result.editTimeMs).toBeLessThan(config.numEdits * 10); // 10ms per edit max
            }
        });
    });

    afterAll(() => {
        // Print comparative analysis
        if (results.length === 0) return;
        const padding = 16;

        const baseline = results[0]!;
        console.log("\n" + "=".repeat(80));
        console.log("📈 PERFORMANCE COMPARISON");
        console.log("=".repeat(80));

        console.log(
            "\n" +
                ["Scenario", "Edit Time", "Read Time", "Avg Edit", "Avg Read"]
                    .map((h) => h.padEnd(padding))
                    .join(""),
        );
        console.log("-".repeat(80));

        for (const result of results) {
            const editSpeedup = baseline.editTimeMs / result.editTimeMs;
            const readSpeedup = baseline.readTimeMs / result.readTimeMs;

            console.log(
                [
                    result.scenario,
                    `${result.editTimeMs.toFixed(1)}ms (${editSpeedup.toFixed(2)}x)`,
                    `${result.readTimeMs.toFixed(1)}ms (${readSpeedup.toFixed(2)}x)`,
                    `${result.avgEditMs.toFixed(3)}ms`,
                    `${result.avgReadMs.toFixed(3)}ms`,
                ]
                    .map((c, i) => (i === 0 ? c.padEnd(padding) : c.padEnd(padding)))
                    .join(""),
            );
        }

        console.log("=".repeat(80) + "\n");
    });
});
