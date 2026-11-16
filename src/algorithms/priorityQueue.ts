export interface HeapItem<T> {
  priority: number;
  tieBreaker: string;
  value: T;
}

/**
 * Deterministic Binary Min-Heap Priority Queue.
 * Orders by ascending numeric priority, breaking ties lexicographically by tieBreaker.
 */
export class MinPriorityQueue<T> {
  private heap: HeapItem<T>[] = [];

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  push(value: T, priority: number, tieBreaker = ''): void {
    this.heap.push({ value, priority, tieBreaker });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): HeapItem<T> | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return min;
  }

  peek(): HeapItem<T> | undefined {
    return this.heap[0];
  }

  toArray(): HeapItem<T>[] {
    return [...this.heap].sort((a, b) => this.compare(a, b));
  }

  private compare(a: HeapItem<T>, b: HeapItem<T>): number {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.tieBreaker.localeCompare(b.tieBreaker);
  }

  private bubbleUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.compare(this.heap[i], this.heap[parent]) < 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(index: number): void {
    let i = index;
    const n = this.heap.length;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;

      if (left < n && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < n && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      } else {
        break;
      }
    }
  }
}
