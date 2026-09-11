/**
 * 智能体名称模糊匹配公共工具
 *
 * 解决接入中心 / 台账中心 / 评测中心三方 mock 命名口径不一致问题（如：
 *   接入中心 name = 「心电图智能辅助诊断」
 *   台账 mock name = 「心电图智能辅助诊断系统」
 *   接入中心 name = 「智能导诊分诊」
 *   台账 mock name = 「智能导诊与分诊系统」）
 *
 * 采用与台账列表页（List.tsx autoOpenEffect）同源的 4 级匹配策略：
 *   1) 精确相等
 *   2) 去尾缀后相等（系统/平台/智能/助手/引擎/服务/机器人/模块）
 *   3) 名称互为子串（任一方向包含）
 *   4) 2 字 bigram min-归一化相似度（要求交集 ≥ 2 且 ratio ≥ 0.3）
 *      · 平局规则：isActive 优先 → 交集数高 → 占比高
 *
 * @example
 *   matchAgentByName('心电图智能辅助诊断', mockAgents)
 *   // => { id: 'agent-001', name: '心电图智能辅助诊断系统', ... }
 *
 *   matchAgentByName('心电图智能辅助诊断', ledgerList, {
 *     isActive: (a) => a.lifecycleStatus !== '已禁用' && a.lifecycleStatus !== '已归档',
 *   })
 */
export interface MatchOptions<T> {
  /** 活跃性判定;返回 true 表示该候选应优先(用于同分 tiebreaker) */
  isActive?: (item: T) => boolean;
  /** bigram 阶段最低交集数(默认 2) */
  minIntersect?: number;
  /** bigram 阶段最低相似度(默认 0.3) */
  minRatio?: number;
}

/**
 * 去除「系统|平台|智能|助手|引擎|服务|机器人|模块」等常见尾缀,
 * 让两侧命名口径归一(只去尾缀一次,不去中段)
 */
export const stripAgentNameTail = (s: string): string =>
  s.replace(/(系统|平台|智能|助手|引擎|服务|机器人|模块)$/g, '').trim();

/**
 * 2 字中文片段切分(用于弱匹配关键词命中)
 * 仅切中文字符,英文/数字跳过
 */
export const chineseBigrams = (s: string): string[] => {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) {
    const t = s.slice(i, i + 2);
    if (/[一-鿿]/.test(t)) out.push(t);
  }
  return out;
};

/**
 * 按名称 4 级匹配出最相近的智能体。
 * T 只需有 name:string 字段;List.tsx 传完整 LedgerAgent,
 * CreateTask 传 Agent/MockAgent 均可。
 */
export function matchAgentByName<T extends { name: string }>(
  query: string,
  candidates: T[],
  opts?: MatchOptions<T>,
): T | undefined {
  const minIntersect = opts?.minIntersect ?? 2;
  const minRatio = opts?.minRatio ?? 0.3;
  const isActive = opts?.isActive;

  // 1) 精确相等
  let matched = candidates.find((a) => a.name === query);
  if (matched) return matched;

  // 2) 去除尾缀后再相等
  if (!matched) {
    const stripped = stripAgentNameTail(query);
    matched = candidates.find((a) => stripAgentNameTail(a.name) === stripped);
    if (matched) return matched;
  }

  // 3) 名称互为子串(任一方向包含)
  if (!matched) {
    matched = candidates.find(
      (a) => a.name.includes(query) || query.includes(a.name),
    );
    if (matched) return matched;
  }

  // 4) 2 字 bigram min-归一化相似度
  //    短名称(< 2 个 bigram)直接放弃,防「智能」片段硬撞
  if (!matched) {
    const queryBg = chineseBigrams(query);
    if (queryBg.length < minIntersect) return undefined;

    type Scored = { a: T; inter: number; ratio: number; active: boolean };
    const scored: Scored[] = candidates.map((a) => {
      const aBg = chineseBigrams(a.name);
      const setQ = new Set(queryBg);
      const setA = new Set(aBg);
      let inter = 0;
      setQ.forEach((x) => {
        if (setA.has(x)) inter += 1;
      });
      // 用较小集合的基数归一化 —— 解决「短名 vs 长名」时常规相似度偏低的问题
      const ratio = inter / Math.min(queryBg.length, aBg.length);
      return { a, inter, ratio, active: isActive ? !!isActive(a) : true };
    });

    const filtered = scored
      .filter((c) => c.inter >= minIntersect && c.ratio >= minRatio)
      // 排序:活跃优先 > 交集数 > 占比
      .sort((x, y) => {
        if (x.active !== y.active) return x.active ? -1 : 1;
        if (y.inter !== x.inter) return y.inter - x.inter;
        return y.ratio - x.ratio;
      });

    if (filtered.length > 0) return filtered[0].a;
  }

  return undefined;
}