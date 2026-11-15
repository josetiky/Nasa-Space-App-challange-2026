/**
 * Mars Trek · Montículo binario mínimo con desempate determinista (ROUTING_ALGORITHM §8.3).
 * Ordena por menor f, luego menor g, luego menor índice de nodo.
 */
export interface HeapItem {
  readonly node: number;
  readonly f: number;
  readonly g: number;
}

function comesBefore(a: HeapItem, b: HeapItem): boolean {
  if (Math.abs(a.f - b.f) > 1e-12) return a.f < b.f;
  if (Math.abs(a.g - b.g) > 1e-12) return a.g < b.g;
  return a.node < b.node;
}

export class MinHeap {
  private items: HeapItem[] = [];

  get size(): number {
    return this.items.length;
  }

  push(node: number, f: number, g: number): void {
    const a = this.items;
    a.push({ node, f, g });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (comesBefore(a[p]!, a[i]!)) break;
      const tmp = a[p]!;
      a[p] = a[i]!;
      a[i] = tmp;
      i = p;
    }
  }

  pop(): HeapItem | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && comesBefore(a[l]!, a[m]!)) m = l;
        if (r < a.length && comesBefore(a[r]!, a[m]!)) m = r;
        if (m === i) break;
        const tmp = a[m]!;
        a[m] = a[i]!;
        a[i] = tmp;
        i = m;
      }
    }
    return top;
  }
}
