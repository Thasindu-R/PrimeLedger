import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node 24 defines its own `localStorage` global, which stays undefined unless
// the runtime is started with --localstorage-file. It wins over the one jsdom
// would install, leaving `window.localStorage` undefined inside tests, so
// provide a spec-shaped in-memory Storage instead. `Storage` is replaced too so
// `vi.spyOn(Storage.prototype, ...)` observes the object actually in use.
class MemoryStorage implements Storage {
  #entries = new Map<string, string>();

  get length(): number {
    return this.#entries.size;
  }

  key(index: number): string | null {
    return Array.from(this.#entries.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.#entries.get(String(key)) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#entries.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.#entries.delete(String(key));
  }

  clear(): void {
    this.#entries.clear();
  }

  [name: string]: unknown;
}

Object.defineProperty(globalThis, 'Storage', {
  configurable: true,
  writable: true,
  value: MemoryStorage,
});

for (const target of [globalThis, window] as const) {
  Object.defineProperty(target, 'localStorage', {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Recharts' ResponsiveContainer measures its parent, which jsdom always reports
// as 0x0. Without a size the charts render nothing and every chart-bearing test
// drowns in width(0) warnings, so give the container a deterministic box.
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  value: 800,
});
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  value: 400,
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
