/**
 * Back/forward navigation history of the shared describe panel, like a browser.
 * DOM free so it can be unit-tested.
 */
import type { DescribeDirection } from "./resourceQuery";

export interface DescribeHistoryEntry {
  iri: string;
  direction: DescribeDirection;
  source?: string;
}

export class DescribeHistory {
  private entries: DescribeHistoryEntry[] = [];
  private index = -1;

  /** Start a fresh history holding only `entry`. */
  reset(entry: DescribeHistoryEntry): void {
    this.entries = [entry];
    this.index = 0;
  }

  /** Add `entry` after the current one, dropping entries left by going back. */
  push(entry: DescribeHistoryEntry): void {
    const current = this.current();
    if (current && current.iri === entry.iri && current.direction === entry.direction) return;
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(entry);
    this.index = this.entries.length - 1;
  }

  /** Replace the current entry (e.g. when switching direction on the same resource). */
  replace(entry: DescribeHistoryEntry): void {
    if (this.index < 0) return this.reset(entry);
    this.entries[this.index] = entry;
  }

  current(): DescribeHistoryEntry | undefined {
    return this.entries[this.index];
  }

  canGoBack(): boolean {
    return this.index > 0;
  }

  canGoForward(): boolean {
    return this.index < this.entries.length - 1;
  }

  /** Move by `delta` entries; returns the new current entry, or undefined when out of range. */
  go(delta: number): DescribeHistoryEntry | undefined {
    return this.goTo(this.index + delta);
  }

  goTo(index: number): DescribeHistoryEntry | undefined {
    if (index < 0 || index >= this.entries.length || index === this.index) return undefined;
    this.index = index;
    return this.entries[index];
  }

  getEntries(): DescribeHistoryEntry[] {
    return [...this.entries];
  }

  getIndex(): number {
    return this.index;
  }

  get length(): number {
    return this.entries.length;
  }
}
