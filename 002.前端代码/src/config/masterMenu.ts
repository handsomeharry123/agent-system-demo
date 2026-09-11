// Compatibility stub for Vite dev server module graph that may still hold
// a reference to this path from before the rename to masterMenu.tsx.
// All real code imports from './masterMenu' (no extension), which Vite
// resolves to the .tsx file. This stub exists only so old URL references
// return 200 instead of 404 during dev.
export * from './masterMenu.tsx';
