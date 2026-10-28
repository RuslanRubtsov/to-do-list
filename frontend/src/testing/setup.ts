// Runs before every spec file (`setupFiles` in angular.json).

// The first test in a file renders lazy-loaded routes cold, which under a parallel run with
// coverage can take longer than Vitest's default 5 seconds
vi.setConfig({ testTimeout: 15_000 });
