/**
 * 多环辐射布局算法
 *
 * 输入节点数组(每个带 ring: 1..N),按 ring 分组后均匀分布在不同半径的圆周上,
 * 返回带绝对坐标的布局结果,供 SVG / HTML 节点直接消费。
 *
 * 与单层环形 (`ProfileView360.tsx:281-302`) 相比:
 * - 支持 3-5 层环,半径递减/递增
 * - 每层独立起始角度,避免上下对称过死
 * - 自动做"抖动偏移",防止层级相同时节点垂直堆叠
 * - ring 越外 → 半径越大、节点卡片可读性越宽容
 */

export type RingLevel = 1 | 2 | 3 | 4 | 5;

export interface RingNode {
  id: string;
  ring?: RingLevel;
  angleDeg?: number;
  parentId?: string;
}

export interface RingPosition<T extends RingNode = RingNode> {
  node: T;
  x: number;
  y: number;
  angle: number;
  ring: RingLevel;
}

export interface LayoutOptions {
  cx: number;
  cy: number;
  /** 每层半径,索引 i 对应 ring i+1。 */
  rings?: readonly number[];
  /** 横向缩放,用于在宽屏拓扑中形成椭圆放射网。 */
  xScale?: number;
  /** 每层起始角度(弧度),默认 -π/2 (12 点钟方向) */
  ringStartAngles?: readonly number[];
  /** 节点最小占位尺寸,用于避免卡片互相贴边或重叠。 */
  nodeSize?: { width: number; height: number };
  /** 节点之间额外留白。 */
  nodeGap?: number;
  /** 节点中心点允许活动的安全区域。 */
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
  /** 碰撞规避迭代次数。 */
  collisionIterations?: number;
}

const DEFAULT_RINGS = [110, 175, 235, 300];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function relaxNodeCollisions<T extends RingNode>(
  positions: Array<RingPosition<T>>,
  options: LayoutOptions,
): Array<RingPosition<T>> {
  const nodeSize = options.nodeSize;
  if (!nodeSize || positions.length < 2) {
    return positions;
  }

  const gap = options.nodeGap ?? 14;
  const minDx = nodeSize.width + gap;
  const minDy = nodeSize.height + gap;
  const bounds = options.bounds;
  const iterations = options.collisionIterations ?? 60;
  const anchors = positions.map((p) => ({ x: p.x, y: p.y }));
  const next = positions.map((p) => ({ ...p }));
  const byId = new Map(next.map((p) => [p.node.id, p]));

  next.forEach((p, i) => {
    const parent = p.node.parentId ? byId.get(p.node.parentId) : undefined;
    if (!parent) {
      return;
    }

    const angleDiff = Math.abs(Math.atan2(Math.sin(p.angle - parent.angle), Math.cos(p.angle - parent.angle)));
    if (angleDiff > 0.5) {
      return;
    }

    const direction = i % 2 === 0 ? 1 : -1;
    const tangentX = -Math.sin(p.angle);
    const tangentY = Math.cos(p.angle);
    p.x += tangentX * 34 * direction;
    p.y += tangentY * 34 * direction;
  });

  for (let pass = 0; pass < iterations; pass += 1) {
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i];
        const b = next[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = minDx - Math.abs(dx);
        const overlapY = minDy - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

        if (overlapX < overlapY) {
          const push = overlapX / 2 + 1;
          const dir = dx >= 0 ? 1 : -1;
          a.x -= push * dir;
          b.x += push * dir;
        } else {
          const push = overlapY / 2 + 1;
          const dir = dy >= 0 ? 1 : -1;
          a.y -= push * dir;
          b.y += push * dir;
        }
      }
    }

    next.forEach((p, i) => {
      // 轻微回拉到原本极坐标锚点,保留放射布局的方向感；节点清晰度优先。
      p.x += (anchors[i].x - p.x) * 0.006;
      p.y += (anchors[i].y - p.y) * 0.006;

      if (bounds) {
        p.x = clamp(p.x, bounds.minX, bounds.maxX);
        p.y = clamp(p.y, bounds.minY, bounds.maxY);
      }
    });
  }

  for (let pass = 0; pass < 24; pass += 1) {
    let moved = false;
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i];
        const b = next[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = minDx - Math.abs(dx);
        const overlapY = minDy - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

        moved = true;
        if (overlapX < overlapY) {
          const push = overlapX / 2 + 2;
          const dir = dx >= 0 ? 1 : -1;
          a.x -= push * dir;
          b.x += push * dir;
        } else {
          const push = overlapY / 2 + 2;
          const dir = dy >= 0 ? 1 : -1;
          a.y -= push * dir;
          b.y += push * dir;
        }
      }
    }

    next.forEach((p) => {
      if (bounds) {
        p.x = clamp(p.x, bounds.minX, bounds.maxX);
        p.y = clamp(p.y, bounds.minY, bounds.maxY);
      }
    });

    if (!moved) {
      break;
    }
  }

  return next.map((p) => ({
    ...p,
    angle: Math.atan2(p.y - options.cy, (p.x - options.cx) / (options.xScale ?? 1)),
  }));
}

/**
 * @param nodes 节点列表(每节点必含 id 和 ring)
 * @param options 布局参数
 * @returns 带坐标的布局结果数组,每个元素含原 node + x/y/angle/ring
 */
export function multiRingLayout<T extends RingNode>(
  nodes: T[],
  options: LayoutOptions,
): Array<RingPosition<T>> {
  const { cx, cy, xScale = 1 } = options;
  const rings = options.rings ?? DEFAULT_RINGS;
  const startAngles = options.ringStartAngles ?? [];

  // 按 ring 分桶
  const buckets = new Map<RingLevel, T[]>();
  nodes.forEach((n) => {
    const arr = buckets.get(n.ring) ?? [];
    arr.push(n);
    buckets.set(n.ring, arr);
  });

  const positions = nodes.map((node) => {
    const ringIdx = Math.min(Math.max(node.ring - 1, 0), rings.length - 1);
    const r = rings[ringIdx];
    const sameRing = buckets.get(node.ring) ?? [];
    const idxInRing = sameRing.indexOf(node);
    const count = sameRing.length;
    const start = startAngles[ringIdx] ?? -Math.PI / 2;
    const stagger = ringIdx % 2 === 0 ? 0 : Math.PI / Math.max(count, 1);
    const angle =
      typeof node.angleDeg === 'number'
        ? (node.angleDeg * Math.PI) / 180
        : start + stagger + (idxInRing * 2 * Math.PI) / Math.max(count, 1);

    return {
      node,
      x: cx + Math.cos(angle) * r * xScale,
      y: cy + Math.sin(angle) * r,
      angle,
      ring: node.ring,
    };
  });

  return relaxNodeCollisions(positions, options);
}

/**
 * 给定环数和节点数,推荐一个合适的"最大半径"上限,避免节点在
 * viewBox 边缘溢出。
 */
export function suggestMaxRadius(
  ringCount: number,
  baseRadius = 110,
  step = 65,
): number[] {
  return Array.from({ length: ringCount }, (_, i) => baseRadius + step * i);
}
