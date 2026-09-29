/**
 * Per-endpoint cache of "describe endpoint" results and the UI state of the panel.
 *
 * The cache is stored under its own storage key (separate from the main Matgui config),
 * so that a full localStorage quota never wipes the user's tabs because of cached describe results.
 */
import type { DescribeBinding } from "./describeQueries";
import type { EndpointMetadata } from "./metadataSources";

export interface DescribeResult {
  status: "done" | "error";
  vars: string[];
  bindings: DescribeBinding[];
  fetchedAt: number;
  durationMs?: number;
  error?: string;
  /** True when a following page may exist */
  hasMore?: boolean;
  /** True when rows were dropped before persisting */
  truncated?: boolean;
}

export interface EndpointEntry {
  lastUsed: number;
  metadata?: EndpointMetadata;
  results: { [queryId: string]: DescribeResult };
}

export interface PanelUiState {
  open: boolean;
  pinned: boolean;
  collapsed: boolean;
  width: number;
  expandedCategories: string[];
}

export interface StoredDescribeState {
  ui: PanelUiState;
  endpoints: { [endpoint: string]: EndpointEntry };
}

export interface StorageAdapter {
  get(): StoredDescribeState | undefined;
  set(state: StoredDescribeState): void;
}

export const MAX_ENDPOINTS = 20;
export const MAX_PERSISTED_ROWS = 200;
/** Rough maximum size of the serialized cache (in characters) */
export const MAX_PERSISTED_SIZE = 1_500_000;

export function getDefaultUiState(): PanelUiState {
  return { open: false, pinned: false, collapsed: false, width: 420, expandedCategories: ["overview", "schema"] };
}

export default class DescribeStore {
  private state: StoredDescribeState;
  constructor(private storage?: StorageAdapter) {
    let stored: StoredDescribeState | undefined;
    try {
      stored = storage?.get();
    } catch {
      stored = undefined;
    }
    this.state = {
      ui: { ...getDefaultUiState(), ...(stored?.ui || {}) },
      endpoints: stored?.endpoints && typeof stored.endpoints === "object" ? stored.endpoints : {},
    };
  }

  public getUiState(): PanelUiState {
    return this.state.ui;
  }
  public setUiState(update: Partial<PanelUiState>) {
    this.state.ui = { ...this.state.ui, ...update };
    this.persist();
  }

  public getEntry(endpoint: string): EndpointEntry | undefined {
    return this.state.endpoints[endpoint];
  }
  private getOrCreateEntry(endpoint: string): EndpointEntry {
    let entry = this.state.endpoints[endpoint];
    if (!entry) {
      entry = { lastUsed: Date.now(), results: {} };
      this.state.endpoints[endpoint] = entry;
    }
    entry.lastUsed = Date.now();
    return entry;
  }

  public getResult(endpoint: string, queryId: string): DescribeResult | undefined {
    return this.state.endpoints[endpoint]?.results[queryId];
  }
  public setResult(endpoint: string, queryId: string, result: DescribeResult) {
    this.getOrCreateEntry(endpoint).results[queryId] = result;
    this.persist();
  }
  public getMetadata(endpoint: string): EndpointMetadata | undefined {
    return this.state.endpoints[endpoint]?.metadata;
  }
  public setMetadata(endpoint: string, metadata: EndpointMetadata) {
    this.getOrCreateEntry(endpoint).metadata = metadata;
    this.persist();
  }
  public touch(endpoint: string) {
    if (this.state.endpoints[endpoint]) this.state.endpoints[endpoint].lastUsed = Date.now();
  }
  public clearEndpoint(endpoint: string) {
    delete this.state.endpoints[endpoint];
    this.persist();
  }
  public getEndpoints(): string[] {
    return Object.keys(this.state.endpoints);
  }

  /**
   * Returns the state as it will be persisted: at most MAX_ENDPOINTS endpoints (least recently used are dropped),
   * at most MAX_PERSISTED_ROWS rows per result, and a total size of roughly MAX_PERSISTED_SIZE.
   */
  public getPersistableState(): StoredDescribeState {
    const endpoints = Object.keys(this.state.endpoints)
      .sort((a, b) => this.state.endpoints[b].lastUsed - this.state.endpoints[a].lastUsed)
      .slice(0, MAX_ENDPOINTS);
    // Evict from memory as well, so the in-memory cache doesn't grow unbounded
    for (const endpoint of Object.keys(this.state.endpoints)) {
      if (endpoints.indexOf(endpoint) < 0) delete this.state.endpoints[endpoint];
    }
    const persisted: StoredDescribeState = { ui: this.state.ui, endpoints: {} };
    for (const endpoint of endpoints) {
      const entry = this.state.endpoints[endpoint];
      const results: EndpointEntry["results"] = {};
      for (const queryId in entry.results) {
        const result = entry.results[queryId];
        results[queryId] =
          result.bindings.length > MAX_PERSISTED_ROWS
            ? { ...result, bindings: result.bindings.slice(0, MAX_PERSISTED_ROWS), truncated: true, hasMore: false }
            : result;
      }
      persisted.endpoints[endpoint] = { ...entry, results };
    }
    // Drop least recently used endpoints until the serialized cache is small enough
    let size = JSON.stringify(persisted).length;
    while (size > MAX_PERSISTED_SIZE && endpoints.length > 1) {
      const evicted = endpoints.pop()!;
      delete persisted.endpoints[evicted];
      size = JSON.stringify(persisted).length;
    }
    return persisted;
  }

  private persist() {
    if (!this.storage) return;
    try {
      this.storage.set(this.getPersistableState());
    } catch (e) {
      // Storage full or unavailable: the cache simply isn't persisted
      console.warn("Could not persist endpoint describe cache", e);
    }
  }
}
