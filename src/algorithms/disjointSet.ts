/**
 * Disjoint-Set Union (Union-Find) with path compression and union by rank.
 * Used by Kruskal's algorithm and interactive cycle-detection games.
 */
export class DisjointSet {
  private parent: Record<string, string> = {};
  private rank: Record<string, number> = {};
  private components: number;

  constructor(ids: string[]) {
    for (const id of ids) {
      this.parent[id] = id;
      this.rank[id] = 0;
    }
    this.components = ids.length;
  }

  find(x: string): string {
    if (this.parent[x] === undefined) {
      throw new Error(`Unknown node id in DisjointSet: ${x}`);
    }
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;

    if (this.rank[rootA] < this.rank[rootB]) {
      this.parent[rootA] = rootB;
    } else if (this.rank[rootA] > this.rank[rootB]) {
      this.parent[rootB] = rootA;
    } else {
      this.parent[rootB] = rootA;
      this.rank[rootA] += 1;
    }

    this.components -= 1;
    return true;
  }

  getComponentCount(): number {
    return this.components;
  }

  getComponentMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const id of Object.keys(this.parent)) {
      map[id] = this.find(id);
    }
    return map;
  }

  getComponents(): string[][] {
    const grouped: Record<string, string[]> = {};
    for (const id of Object.keys(this.parent).sort()) {
      const root = this.find(id);
      if (!grouped[root]) grouped[root] = [];
      grouped[root].push(id);
    }
    return Object.values(grouped).sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  }
}
