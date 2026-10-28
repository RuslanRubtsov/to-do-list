// Runs before every spec file (`setupFiles` in angular.json).
import { emulateWebLocks } from './web-locks';

// The first test in a file renders lazy-loaded routes cold, which under a parallel run with
// coverage can take longer than Vitest's default 5 seconds
vi.setConfig({ testTimeout: 15_000 });

// Session refreshes coordinate across tabs with the Web Locks API, which jsdom lacks. A fresh one
// for each test, so a lock a failed test still holds can't block the next.
beforeEach(() => emulateWebLocks());
