import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts", "src/integrations/React.ts"],
    format: ["cjs", "esm"],
    dts: true,
    minify: true,
    clean: true,
    splitting: false,
    sourcemap: true,
    esbuildOptions(options) {
        options.mangleProps = /^_/; // Mangle properties starting with underscore
    },
    terserOptions: {
        mangle: {
            properties: {
                regex: /^_/, // Mangle private properties (starting with _)
            },
        },
        compress: {
            passes: 5,
        },
    },
});
