import { Table } from "./Table";

declare const performance: {
    now: () => number;
};

// ============================================================================
// Configuration
// ============================================================================

interface BenchmarkConfig {
    numLists: number;
    tasksPerList: number;
    completionRate: number;
    importantRate: number;
    numEdits: number;
    numReads: number;
    iterations: number; // Number of times to repeat the benchmark
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
    loadTimeMs: number;
    editTimeMs: number;
    readTimeMs: number;
    numEdits: number;
    numReads: number;
}

interface AggregatedResult {
    scenario: string;
    loadTime: { mean: number; stdDev: number };
    editTime: { mean: number; stdDev: number };
    readTime: { mean: number; stdDev: number };
    totalTime: { mean: number; stdDev: number };
    numEdits: number;
    numReads: number;
}

// Default configuration
const LoadFactor = 1;
const IterationCount = 3;
const ReadWriteRatio = 5; // Must be greater than 1 to simulate read-heavy workloads
const DEFAULT_CONFIG: BenchmarkConfig = {
    numLists: 50 * LoadFactor,
    tasksPerList: 1000 * LoadFactor,
    completionRate: 0.3,
    importantRate: 0.1,
    numEdits: 100 * LoadFactor,
    numReads: ReadWriteRatio * 100 * LoadFactor,
    iterations: IterationCount, // Number of benchmark iterations
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
// Scenario 1: Vanilla implementation
// ============================================================================

class VanillaImplementation {
    private tasks: Map<string, Task> = new Map();

    set(id: string, task: Task | null): void {
        if (task === null) {
            this.tasks.delete(id);
        } else {
            this.tasks.set(id, task);
        }
    }

    getTasksInList(listId: string): Task[] {
        // Full filter + sort on every read
        return Array.from(this.tasks.values())
            .filter((t) => t.listId === listId && !t.isCompleted) // active tasks only
            .sort((a, b) => {
                // Two-factor sort to match Table implementation
                if (a.isImportant !== b.isImportant) {
                    return a.isImportant ? -1 : 1;
                }
                return b.createdAt - a.createdAt;
            });
    }
}

// ============================================================================
// Scenario 2: Table-based implementations
// ============================================================================

function setupTableImplementationByList(tasks: Task[]): Table<string, Task> {
    const table = new Table<string, Task>();

    // Populate the table
    table.batch((t) => {
        for (const task of tasks) {
            t.set(task.id, task);
        }
    });

    // Index by list - only show incomplete tasks
    table.index(
        (task) => task.listId,
        (_, partition) => {
            partition.index((task) => (!task.isCompleted ? "Active" : undefined));
        },
    );

    // Sort by importance + createdAt within each list bucket
    table.sort((a, b) => {
        if (a.isImportant !== b.isImportant) {
            return a.isImportant ? -1 : 1;
        }
        return b.createdAt - a.createdAt;
    });

    return table;
}

// ============================================================================
// Edit Patterns
// ============================================================================

function applyEdits(
    tasks: Task[],
    config: BenchmarkConfig,
    setter: (id: string, task: Task) => void,
): void {
    for (let i = 0; i < config.numEdits; i++) {
        const task = tasks[Math.floor(Math.random() * tasks.length)]!;
        const editType = Math.random();

        if (editType < 0.33) {
            // Toggle completion (impacts filters)
            setter(task.id, {
                ...task,
                isCompleted: !task.isCompleted,
                completedAt: !task.isCompleted ? Date.now() : null,
            });
        } else {
            // Toggle importance (impacts sorting)
            setter(task.id, { ...task, isImportant: !task.isImportant });
        }
    }
}

// ============================================================================
// Benchmarking Functions
// ============================================================================

function benchmarkVanilla(tasks: Task[], config: BenchmarkConfig): BenchmarkResult {
    const impl = new VanillaImplementation();

    // Benchmark initial load
    const loadStart = performance.now();
    for (const task of tasks) {
        impl.set(task.id, task);
    }
    const loadEnd = performance.now();

    // Benchmark edits
    const editStart = performance.now();
    applyEdits(tasks, config, (id, task) => impl.set(id, task));
    const editEnd = performance.now();

    const readStart = performance.now();
    for (let i = 0; i < config.numReads; i++) {
        const listId = `list-${Math.floor(Math.random() * config.numLists)}`;
        impl.getTasksInList(listId);
    }
    const readEnd = performance.now();

    return {
        scenario: "vanilla",
        loadTimeMs: loadEnd - loadStart,
        editTimeMs: editEnd - editStart,
        readTimeMs: readEnd - readStart,
        numEdits: config.numEdits,
        numReads: config.numReads,
    };
}

function benchmarkMemoTable(tasks: Task[], config: BenchmarkConfig): BenchmarkResult {
    // Create two separate tables - one indexed by list, one by importance
    const loadStart = performance.now();
    const tableByList = setupTableImplementationByList(tasks);
    const loadEnd = performance.now();

    // Benchmark edits - need to update both tables
    const editStart = performance.now();
    for (let i = 0; i < config.numEdits; i++) {
        const task = tasks[Math.floor(Math.random() * tasks.length)]!;
        const editType = Math.random();

        let updatedTask: Task;
        if (editType < 0.33) {
            // Toggle completion (impacts filters)
            updatedTask = {
                ...task,
                isCompleted: !task.isCompleted,
                completedAt: !task.isCompleted ? Date.now() : null,
            };
        } else {
            // Toggle importance (impacts sorting)
            updatedTask = { ...task, isImportant: !task.isImportant };
        }

        tableByList.set(task.id, updatedTask);

        // Update the tasks array for consistency
        const taskIndex = tasks.findIndex((t) => t.id === task.id);
        if (taskIndex !== -1) {
            tasks[taskIndex] = updatedTask;
        }
    }
    const editEnd = performance.now();

    // Benchmark reads
    const readStart = performance.now();
    for (let i = 0; i < config.numReads; i++) {
        const listId = `list-${Math.floor(Math.random() * config.numLists)}`;
        tableByList.partition(listId).partition("Active").values();
    }
    const readEnd = performance.now();

    return {
        scenario: "memotable",
        loadTimeMs: loadEnd - loadStart,
        editTimeMs: editEnd - editStart,
        readTimeMs: readEnd - readStart,
        numEdits: config.numEdits,
        numReads: config.numReads,
    };
}

// ============================================================================
// Statistical Analysis Functions
// ============================================================================

function calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateStdDev(values: number[]): number {
    const mean = calculateMean(values);
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = calculateMean(squaredDiffs);
    return Math.sqrt(variance);
}

function aggregateResults(results: BenchmarkResult[]): AggregatedResult {
    const loadTimes = results.map((r) => r.loadTimeMs);
    const editTimes = results.map((r) => r.editTimeMs);
    const readTimes = results.map((r) => r.readTimeMs);
    const totalTimes = results.map((r) => r.loadTimeMs + r.editTimeMs + r.readTimeMs);

    return {
        scenario: results[0]!.scenario,
        loadTime: {
            mean: calculateMean(loadTimes),
            stdDev: calculateStdDev(loadTimes),
        },
        editTime: {
            mean: calculateMean(editTimes),
            stdDev: calculateStdDev(editTimes),
        },
        readTime: {
            mean: calculateMean(readTimes),
            stdDev: calculateStdDev(readTimes),
        },
        totalTime: {
            mean: calculateMean(totalTimes),
            stdDev: calculateStdDev(totalTimes),
        },
        numEdits: results[0]!.numEdits,
        numReads: results[0]!.numReads,
    };
}

function runMultipleBenchmarks(
    benchmarkFn: (tasks: Task[], config: BenchmarkConfig) => BenchmarkResult,
    tasks: Task[],
    config: BenchmarkConfig,
): AggregatedResult {
    const results: BenchmarkResult[] = [];

    for (let i = 0; i < config.iterations; i++) {
        // Create a fresh copy of tasks for each iteration
        const tasksCopy = tasks.map((t) => ({ ...t }));
        const result = benchmarkFn(tasksCopy, config);
        results.push(result);
    }

    return aggregateResults(results);
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Table - Performance Benchmarks", () => {
    let config: BenchmarkConfig;
    let tasks: Task[];

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
        console.log(`  Iterations: ${config.iterations}\n`);

        tasks = generateTasks(config);
    });

    test("memotable vs vanilla performance comparison", () => {
        console.log(`Running ${config.iterations} iterations for each scenario...\n`);

        const vanillaResult = runMultipleBenchmarks(benchmarkVanilla, tasks, config);
        const tableResult = runMultipleBenchmarks(benchmarkMemoTable, tasks, config);

        // Basic sanity checks
        expect(vanillaResult.loadTime.mean).toBeGreaterThan(0);
        expect(vanillaResult.editTime.mean).toBeGreaterThan(0);
        expect(vanillaResult.readTime.mean).toBeGreaterThan(0);
        expect(tableResult.loadTime.mean).toBeGreaterThan(0);
        expect(tableResult.editTime.mean).toBeGreaterThan(0);
        expect(tableResult.readTime.mean).toBeGreaterThan(0);

        // Performance assertions
        const readSpeedup = vanillaResult.readTime.mean / tableResult.readTime.mean;
        const totalSpeedup = vanillaResult.totalTime.mean / tableResult.totalTime.mean;

        // memotable reads should be faster than vanilla
        expect(tableResult.readTime.mean).toBeLessThan(vanillaResult.readTime.mean);

        // memotable overall should be faster than vanilla (for read-heavy workloads)
        expect(tableResult.totalTime.mean).toBeLessThan(vanillaResult.totalTime.mean);

        // Display comparison table
        const numTasksLoaded = config.numLists * config.tasksPerList;
        const COL_WIDTH = 25;
        const TABLE_WIDTH = COL_WIDTH * 5;

        console.log("=".repeat(TABLE_WIDTH));
        console.log("📈 PERFORMANCE COMPARISON (AVERAGE OF " + config.iterations + " RUNS)");
        console.log("=".repeat(TABLE_WIDTH) + "\n");

        const vanillaEditPerOp = vanillaResult.editTime.mean / vanillaResult.numEdits;
        const tableEditPerOp = tableResult.editTime.mean / tableResult.numEdits;

        // Display results with mean ± stddev
        const formatMetric = (mean: number, stdDev: number) => {
            return `${mean.toFixed(1)} ± ${stdDev.toFixed(1)}ms`;
        };

        console.log(
            [
                "Scenario",
                `Load(${numTasksLoaded})`,
                `Edit(${config.numEdits})`,
                `Read(${config.numReads})`,
                "Total",
            ]
                .map((h) => h.padEnd(COL_WIDTH))
                .join(""),
        );
        console.log("-".repeat(TABLE_WIDTH));
        console.log(
            [
                "vanilla",
                formatMetric(vanillaResult.loadTime.mean, vanillaResult.loadTime.stdDev),
                formatMetric(vanillaResult.editTime.mean, vanillaResult.editTime.stdDev),
                formatMetric(vanillaResult.readTime.mean, vanillaResult.readTime.stdDev),
                formatMetric(vanillaResult.totalTime.mean, vanillaResult.totalTime.stdDev),
            ]
                .map((c) => c.padEnd(COL_WIDTH))
                .join(""),
        );
        console.log(
            [
                "memotable",
                formatMetric(tableResult.loadTime.mean, tableResult.loadTime.stdDev),
                formatMetric(tableResult.editTime.mean, tableResult.editTime.stdDev),
                formatMetric(tableResult.readTime.mean, tableResult.readTime.stdDev),
                formatMetric(tableResult.totalTime.mean, tableResult.totalTime.stdDev),
            ]
                .map((c) => c.padEnd(COL_WIDTH))
                .join(""),
        );

        console.log("\n" + "=".repeat(TABLE_WIDTH));

        // Key insights
        const ERROR_MARGIN = 0.1; // 10% margin for "similar" performance
        const loadSlowdown = tableResult.loadTime.mean / vanillaResult.loadTime.mean;
        const editSlowdown = tableEditPerOp / vanillaEditPerOp;
        const readWriteRatio = config.numReads / config.numEdits;

        console.log("\n💡 Key Insights:");
        console.log(
            `  • memotable is ${loadSlowdown.toFixed(1)}x slower for initial load (${vanillaResult.loadTime.mean.toFixed(1)}ms vs ${tableResult.loadTime.mean.toFixed(1)}ms)`,
        );
        console.log(
            `  • memotable is ${readSpeedup.toFixed(1)}x faster for reads but ${editSlowdown.toFixed(1)}x slower for edits`,
        );

        // Overall performance comparison with error margin
        if (Math.abs(totalSpeedup - 1.0) <= ERROR_MARGIN) {
            console.log(
                `  • Overall: memotable performs similar to vanilla for read/write ratio of ${readWriteRatio.toFixed(1)} (${vanillaResult.totalTime.mean.toFixed(1)}ms vs ${tableResult.totalTime.mean.toFixed(1)}ms)`,
            );
        } else {
            console.log(
                `  • Overall: memotable is ${totalSpeedup.toFixed(1)}x ${totalSpeedup > 1 ? "faster" : "slower"} for read/write ratio of ${readWriteRatio.toFixed(1)} (${vanillaResult.totalTime.mean.toFixed(1)}ms vs ${tableResult.totalTime.mean.toFixed(1)}ms)`,
            );
        }

        console.log("\n" + "=".repeat(TABLE_WIDTH) + "\n");
    });
});
