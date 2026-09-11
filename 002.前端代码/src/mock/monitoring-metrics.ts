/**
 * 医疗智能体监控指标定义
 * 来源：医疗智能体监控指标体系V1.1
 *
 * 用途：统一运行监控中心的所有卡片和图表在指标名称旁展示悬浮气泡，
 *       鼠标悬停时展示该指标的定义、计算口径、阈值等说明。
 * 交互：参考「监控中心-告警管理配置」中的 QuestionCircleOutlined + Tooltip 模式。
 */

export interface MetricMeta {
  /** 指标名称（监控中心页面中展示的文字） */
  name: string;
  /** 定义与计算口径 */
  definition: string;
  /** 单位（可空） */
  unit?: string;
  /** 建议阈值（可空） */
  threshold?: string;
  /** 指标分级：P0 核心 / P1 重要 / P2 一般（V1.7 气泡规范第 4 行） */
  priority?: 'P0 核心' | 'P1 重要' | 'P2 一般';
}

const M: Record<string, MetricMeta> = {
  // —— 总览（Home，8-1） ——
  '今日调用量': {
    name: '今日调用量',
    definition: '统计当日 0 点至今智能体被调用的总次数（去重前）',
    unit: '次',
    priority: 'P1 重要',
  },
  '平均响应时长': {
    name: '平均响应时长',
    definition: '统计周期内，智能体从接收请求到返回首个完整结果的平均耗时',
    unit: 'ms',
    threshold: '≤ 2000 ms',
  },
  '运行状态分布': {
    name: '运行状态分布',
    definition: '智能体实例当前状态计数：运行中 / 暂停 / 异常 / 离线',
    priority: 'P0 核心',
  },
  '本月成本': {
    name: '本月成本',
    definition: '按月汇总各资源类用量（核·h、GB·月、GB、tokens、次）后由平台按单价换算得到的金额',
    unit: '元',
    priority: 'P1 重要',
  },
  '调用量趋势': {
    name: '调用量趋势',
    definition: '统计周期内每日智能体被调用的总次数（按 5min/1h/日 粒度）',
    unit: '次',
    priority: 'P1 重要',
  },
  '响应时长趋势 (P50/P95)': {
    name: '响应时长趋势 (P50/P95)',
    definition: '50% / 95% 请求的响应时延不超过该值；P50 反映典型体验，P95 反映尾部劣化',
    unit: 'ms',
    threshold: 'P95 ≤ 5000 ms',
  },
  '错误率趋势': {
    name: '错误率趋势',
    definition: '返回 5xx 或业务异常的请求占比',
    unit: '%',
    threshold: '≤ 0.5%',
  },
  '成本趋势': {
    name: '成本趋势',
    definition: '按日汇总各资源类消耗量；金额视图待单价配置后由平台自动启用',
    unit: '元',
    priority: 'P1 重要',
  },
  '告警趋势（按级别）': {
    name: '告警趋势（按级别）',
    definition: '按 P0/P1/P2 等级统计周期内告警触发次数的堆叠趋势',
    unit: '次',
    priority: 'P0 核心',
  },
  '智能体健康排行 (Top 7)': {
    name: '智能体健康排行 (Top 7)',
    definition: '按综合健康度（可用率 / 准确率 / 异常事件数）排序的智能体清单',
    priority: 'P0 核心',
  },
  // V1.6 新增总览 KPI
  '待处理告警数': {
    name: '待处理告警数',
    definition: '当前未处理（含处理中）的告警事件总数，按最高级别着色',
    unit: '个',
    threshold: '目标 = 0',
    priority: 'P0 核心',
  },
  // V1.6 新增总览图表
  '任务完成率趋势': {
    name: '任务完成率趋势',
    definition: '统计周期内每日/每小时任务完成率（≥ 95% 为达标）',
    unit: '%',
    threshold: '≥ 95%',
    priority: 'P0 核心',
  },
  '运行状态分布趋势': {
    name: '运行状态分布趋势',
    definition: '按时间统计运行中/离线/异常实例数量的变化趋势',
    unit: '个',
    priority: 'P0 核心',
  },

  // —— 性能监控（Performance，8-2）— KPI ——
  '平均响应时延': {
    name: '平均响应时延',
    definition: '统计周期内，智能体从接收请求到返回首个完整结果的平均耗时',
    unit: 'ms',
    threshold: '≤ 2000 ms',
  },
  'P95 响应时延': {
    name: 'P95 响应时延',
    definition: '95% 的请求响应时延不超过该值',
    unit: 'ms',
    threshold: '≤ 5000 ms',
  },
  '回答准确率 (P0 核心)': {
    name: '回答准确率 (P0 核心)',
    definition: '基于评测样本与抽检反馈，回答正确的请求占比',
    unit: '%',
    threshold: '≥ 95%',
  },
  '服务可用率 (SLA)': {
    name: '服务可用率 (SLA)',
    definition: '统计周期内服务正常可用时长占比',
    unit: '%',
    threshold: '≥ 99.9%',
  },

  // —— 性能 Tab 1：响应时延 ——
  'P95 / P99 响应时延（多线）': {
    name: 'P95 / P99 响应时延（多线）',
    definition: '95% / 99% 请求的响应时延不超过该值；P95 反映尾部体验，P99 反映极值毛刺',
    unit: 'ms',
    threshold: 'P95 ≤ 5000 ms / P99 ≤ 8000 ms',
  },
  'P99 响应时延': {
    name: 'P99 响应时延',
    definition: '99% 的请求响应时延不超过该值，反映最差尾部体感',
    unit: 'ms',
    threshold: '≤ 8000 ms',
  },
  '首 Token 时延 (TTFT)': {
    name: '首 Token 时延 (TTFT)',
    definition: '流式输出场景下，从请求到首个 Token 返回的耗时',
    unit: 'ms',
    threshold: '≤ 800 ms',
  },

  // —— 性能 Tab 2：并发与吞吐 ——
  '峰值并发数（QPS）': {
    name: '峰值并发数（QPS）',
    definition: '统计周期内单位时间承载的最大并发请求数',
    unit: 'QPS',
    threshold: '≥ 设计容量 80%',
  },
  '平均吞吐量（req/s）': {
    name: '平均吞吐量（req/s）',
    definition: '单位时间内成功处理的请求数',
    unit: 'req/s',
  },
  '排队等待时长（均值 + P95）': {
    name: '排队等待时长（均值 + P95）',
    definition: '请求进入队列至开始处理的平均耗时',
    unit: 'ms',
    threshold: '≤ 500 ms',
  },
  '请求拒绝率（5min 粒度）': {
    name: '请求拒绝率（5min 粒度）',
    definition: '因超载、限流被拒绝的请求占比',
    unit: '%',
    threshold: '≤ 0.5%',
  },

  // —— 性能 Tab 3：准确率与稳定性 ——
  '回答准确率（大数字 + 趋势）': {
    name: '回答准确率（大数字 + 趋势）',
    definition: '基于评测样本与抽检反馈，回答正确的请求占比',
    unit: '%',
    threshold: '≥ 95%',
  },
  '幻觉率': {
    name: '幻觉率',
    definition: '输出中出现事实性错误或编造内容的占比',
    unit: '%',
    threshold: '≤ 2%',
  },
  '错误率（趋势 + 错误码堆叠）': {
    name: '错误率（趋势 + 错误码堆叠）',
    definition: '返回 5xx/4xx/timeout 等异常的请求占比',
    unit: '%',
    threshold: '≤ 0.5%',
  },

  // —— 性能 Tab 4：智能体行为 ——
  '平均工具调用次数': {
    name: '平均工具调用次数',
    definition: '单次会话中智能体调用工具/外部 API 的平均次数',
    unit: '次',
  },
  '工具调用循环深度分布': {
    name: '工具调用循环深度分布',
    definition: '同一会话内对同一工具的最大循环调用深度分布',
    unit: '层',
    threshold: '≤ 5 层',
  },
  '循环超限率': {
    name: '循环超限率',
    definition: '循环深度或推理步数超过预设阈值的会话占比',
    unit: '%',
    threshold: '≤ 1%',
  },
  '工具调用失败率（按工具拆分）': {
    name: '工具调用失败率（按工具拆分）',
    definition: '工具/外部 API 返回失败的调用占比（按工具拆分）',
    unit: '%',
    threshold: '≤ 2%',
  },
  '工具调用 P95 耗时': {
    name: '工具调用 P95 耗时',
    definition: '各工具调用耗时的 P95 值，按工具拆分',
    unit: 'ms',
  },
  '推理步数超限率': {
    name: '推理步数超限率',
    definition: 'ReAct/Plan 推理步数超过阈值的会话占比',
    unit: '%',
    threshold: '≤ 2%',
  },

  // —— 状态监控（Status，8-3）— KPI ——
  '全部实例数': {
    name: '全部实例数',
    definition: '当前已接入监控中心的智能体实例总数',
    unit: '个',
  },
  '运行中实例数': {
    name: '运行中实例数',
    definition: '当前状态为「运行中」的智能体实例数',
    unit: '个',
  },
  '异常实例数': {
    name: '异常实例数',
    definition: '当前状态为「异常」的智能体实例数',
    unit: '个',
  },
  '离线实例数': {
    name: '离线实例数',
    definition: '当前状态为「离线」的智能体实例数',
    unit: '个',
  },

  // —— 状态监控 — 资源健康检查 ——
  'CPU 使用率': {
    name: 'CPU 使用率',
    definition: '实例 CPU 平均使用率',
    unit: '%',
    threshold: '≤ 80%',
  },
  '内存使用率': {
    name: '内存使用率',
    definition: '实例内存平均使用率',
    unit: '%',
    threshold: '≤ 80%',
  },
  'GPU 显存使用率': {
    name: 'GPU 显存使用率',
    definition: '模型推理实例显存使用率',
    unit: '%',
    threshold: '≤ 85%',
  },
  '磁盘使用率': {
    name: '磁盘使用率',
    definition: '实例本地磁盘使用率',
    unit: '%',
    threshold: '≤ 80%',
  },

  // —— 状态监控 — 异常与依赖（抽屉） ——
  '异常事件次数（按级别堆叠）': {
    name: '异常事件次数（按级别堆叠）',
    definition: '按 P0/P1/P2 等级统计周期内触发的异常告警事件总数',
    unit: '次',
  },
  '依赖服务可用率（近 24 个 5min 窗口）': {
    name: '依赖服务可用率（近 24 个 5min 窗口）',
    definition: '底座模型、知识库、工具 API 等依赖项在 5min 粒度窗口内的可用率',
    unit: '%',
    threshold: '≥ 99.9%',
  },
  // V1.6 新增状态列表列头指标
  '心跳成功率': {
    name: '心跳成功率',
    definition: '统计周期内智能体心跳探测成功次数 / 总探测次数',
    unit: '%',
    threshold: '≥ 99.95%',
  },
  '运行版本 / 台账版本': {
    name: '运行版本 / 台账版本',
    definition: '智能体实际运行版本与台账登记版本对照；不一致时告警',
  },
  '持续时长': {
    name: '持续时长',
    definition: '智能体保持当前状态（运行中/异常/离线/暂停）的累计时长',
  },

  // —— 业务监控（Business，8-4）— KPI ——
  '业务调用总量': {
    name: '业务调用总量',
    definition: '统计周期内智能体被调用的总次数',
    unit: '次',
    priority: 'P2 一般',
  },
  '活跃用户数': {
    name: '活跃用户数',
    definition: '统计周期内发起调用的去重用户数（DAU/MAU）',
    unit: '人',
    priority: 'P2 一般',
  },
  '任务完成率': {
    name: '任务完成率',
    definition: '成功完成的业务任务数 / 发起任务总数',
    unit: '%',
    threshold: '≥ 95%',
    priority: 'P1 重要',
  },
  '不合规回答率（P0 核心）': {
    name: '不合规回答率（P0 核心）',
    definition: '违反诊疗规范、超出执业范围等不合规输出的占比',
    unit: '%',
    threshold: '≤ 0.5%',
    priority: 'P0 核心',
  },

  // —— 业务 Tab 1：调用与任务 ——
  '业务调用总量（按日）': {
    name: '业务调用总量（按日）',
    definition: '统计周期内每日智能体被调用的总次数（柱状图按日 + 累计折线双轴）',
    unit: '次',
    priority: 'P2 一般',
  },
  '活跃用户数（DAU/MAU）': {
    name: '活跃用户数（DAU/MAU）',
    definition: '统计周期内发起调用的去重用户数（DAU/MAU 双线）',
    unit: '人',
    priority: 'P2 一般',
  },
  '科室覆盖数（Top 10）': {
    name: '科室覆盖数（Top 10）',
    definition: '实际使用智能体的科室数量，按调用次数降序展示 Top 10',
    unit: '个',
    priority: 'P2 一般',
  },
  '任务中断率': {
    name: '任务中断率',
    definition: '因异常或用户主动放弃而中断的任务占比（按异常/用户放弃/超时拆分）',
    unit: '%',
    threshold: '≤ 5%',
    priority: 'P1 重要',
  },
  '平均会话轮次': {
    name: '平均会话轮次',
    definition: '单次任务从开始到结束的平均交互轮数',
    unit: '轮',
    priority: 'P2 一般',
  },

  // —— 业务 Tab 2：内容输出质量 ——
  '不合规回答率': {
    name: '不合规回答率',
    definition: '违反诊疗规范、超出执业范围等不合规输出的占比（P0 核心）',
    unit: '%',
    threshold: '≤ 0.5%',
    priority: 'P0 核心',
  },
  '过度承诺 / 绝对化表述率': {
    name: '过度承诺 / 绝对化表述率',
    definition: '检出「一定/绝对/100% 治愈」等过度肯定表述的输出占比（5.29 演示重点要求）',
    unit: '%',
    threshold: '≤ 0.5%',
    priority: 'P0 核心',
  },
  '不当语气 / 态度异常率': {
    name: '不当语气 / 态度异常率',
    definition: '冷漠、强硬、不耐烦等不当语气分类器命中的输出占比（5.29 演示重点要求）',
    unit: '%',
    threshold: '≤ 1%',
    priority: 'P0 核心',
  },
  '用词不当率（命中频次降序）': {
    name: '用词不当率（命中频次降序）',
    definition: '歧视性、非专业、口语化不规范等用词命中的输出占比（5.29 演示重点要求）',
    unit: '%',
    threshold: '≤ 1%',
    priority: 'P0 核心',
  },
  '高风险输出拦截数（日历热力图 + 大数字 KPI）': {
    name: '高风险输出拦截数（日历热力图 + 大数字 KPI）',
    definition: '被安全治理中心实时阻断的高风险输出条数（与安全治理联动）',
    unit: '条',
    priority: 'P0 核心',
  },

  // —— 业务 Tab 3：用户反馈与协同 ——
  '满意度评分（辅助）': {
    name: '满意度评分（辅助）',
    definition: '用户对单次输出的平均评分（5 分制）。数据可得性低，仅作辅助参考',
    unit: '分',
    threshold: '≥ 4.2',
    priority: 'P2 一般',
  },
  '正向反馈率（辅助）': {
    name: '正向反馈率（辅助）',
    definition: '👍 反馈数 /（👍+👎）反馈总数。数据可得性低，仅作辅助参考',
    unit: '%',
    threshold: '≥ 90%',
    priority: 'P2 一般',
  },
  '投诉与工单数（按状态分层）': {
    name: '投诉与工单数（按状态分层）',
    definition: '统计周期内涉及该智能体的工单数量（按新建/处理中/已闭环分层）',
    unit: '件',
    priority: 'P1 重要',
  },
  '协同任务成功率': {
    name: '协同任务成功率',
    definition: '多智能体编排流程端到端成功完成的任务占比',
    unit: '%',
    threshold: '≥ 95%',
    priority: 'P1 重要',
  },

  // —— 成本监控（Cost，8-5）— KPI ——
  '周期总消耗 / 总成本': {
    name: '周期总消耗 / 总成本',
    definition: '按日/周/月/年汇总各资源类用量（核·h、GB·月、GB、tokens、次）；金额视图待单价配置后由平台自动启用',
    unit: '元',
    priority: 'P1 重要',
  },
  '单次调用 Token 消耗': {
    name: '单次调用 Token 消耗',
    definition: '统计周期内总 Token 消耗 / 总调用次数（不依赖单价，可立即启用）',
    unit: 'tokens/次',
    priority: 'P2 一般',
  },
  '实例闲置率': {
    name: '实例闲置率',
    definition: '低于设定负载阈值的实例数 / 总实例数',
    unit: '%',
    threshold: '≤ 15%',
    priority: 'P2 一般',
  },
  '超量 / 超支预警次数': {
    name: '超量 / 超支预警次数',
    definition: '触发用量阈值或预算阈值预警的次数',
    unit: '次',
    threshold: '目标 = 0',
    priority: 'P1 重要',
  },

  // —— 成本 Tab 1：资源消耗 ——
  '算力消耗（CPU·h / GPU·h）': {
    name: '算力消耗（CPU·h / GPU·h）',
    definition: '统计周期内所有实例 CPU 累计占用核时 + GPU 累计占用卡时',
    unit: '核·h / 卡·h',
    priority: 'P2 一般',
  },
  '存储用量（块·云盘 / 对象·向量库）': {
    name: '存储用量（块·云盘 / 对象·向量库）',
    definition: '实例本地盘、云盘、对象存储（文档/日志/模型权重）+ 向量索引平均占用容量',
    unit: 'GB·月',
    priority: 'P2 一般',
  },
  '出向网络流量（按日 + 累计折线）': {
    name: '出向网络流量（按日 + 累计折线）',
    definition: '出向公网流量累计（多数云厂商按出向计费，入向通常免费）',
    unit: 'GB',
    priority: 'P2 一般',
  },
  '模型 Token 总消耗（趋势 + 7 日基线）': {
    name: '模型 Token 总消耗（趋势 + 7 日基线）',
    definition: '调用底座/外部模型累计 input + output tokens，对照 7 日基线识别波动',
    unit: 'tokens',
    priority: 'P1 重要',
  },

  // —— 成本 Tab 2：资源利用 ——
  '低负载时长占比（24h 热力图）': {
    name: '低负载时长占比（24h 热力图）',
    definition: '负载低于 20% 的运行时长占比（24h × 7d 网格）',
    unit: '%',
    threshold: '≤ 20%',
    priority: 'P2 一般',
  },
  '无效调用占比（折线 + 原因分类饼图）': {
    name: '无效调用占比（折线 + 原因分类饼图）',
    definition: '未产生有效业务结果的调用占比，按参数错误/超时/空回/重复拆分',
    unit: '%',
    threshold: '≤ 3%',
    priority: 'P1 重要',
  },
  'GPU 平均利用率（多线）': {
    name: 'GPU 平均利用率（多线）',
    definition: '统计周期内 GPU 平均使用率（按卡多线展示）',
    unit: '%',
    threshold: '≥ 60%',
    priority: 'P2 一般',
  },

  // —— 成本 Tab 3：汇总与趋势 ——
  '单次调用 Token 消耗（均值 + 折线）': {
    name: '单次调用 Token 消耗（均值 + 折线）',
    definition: '统计周期内总 Token 消耗 / 总调用次数，叠加 7 日基线对比',
    unit: 'tokens/次',
    priority: 'P2 一般',
  },
  'Token 消耗（输入 + 输出）': {
    name: 'Token 消耗（输入 + 输出）',
    definition: '调用底座/外部模型累计 input + output tokens（多数厂商 output 单价高于 input）',
    unit: 'tokens',
    priority: 'P1 重要',
  },
  '周期总消耗 / 总成本（4 类资源堆叠）': {
    name: '周期总消耗 / 总成本（4 类资源堆叠）',
    definition: '按日/周/月/年汇总算力/存储/流量/Token 4 类资源消耗量堆叠展示',
    unit: '各资源原生单位 / 元',
    priority: 'P1 重要',
  },
  '各维度成本占比': {
    name: '各维度成本占比',
    definition: '算力 / 存储 / 流量 / 模型 4 类消耗量各自占比；待单价配置后切换为金额口径',
    unit: '%',
    priority: 'P2 一般',
  },
  '消耗 / 成本波动率（双向柱状图）': {
    name: '消耗 / 成本波动率（双向柱状图）',
    definition: '（当期 - 上期）/ 上期；消耗量口径先行，金额口径随单价启用后并行',
    unit: '%',
    threshold: '|波动| ≤ 20%',
    priority: 'P2 一般',
  },
  // V1.6 新增告警事件处置列表列头指标
  '事件级别': {
    name: '事件级别',
    definition: '告警事件的影响等级：严重（红）/ 警告（橙）/ 提示（蓝），决定通知策略与首页待办优先级',
  },
  '触发条件': {
    name: '触发条件',
    definition: '告警规则中配置的「运算符 + 阈值 + 实际值」三段式；触发时定格现场值',
  },
  '规则名称': {
    name: '规则名称',
    definition: '触发该事件的告警规则名；点击跳转到 8-6 告警管理 规则详情',
  },
  '处置状态': {
    name: '处置状态',
    definition: '告警事件处置进度：待处理 / 处理中 / 已关闭 / 已忽略',
  },
  '发现时间': {
    name: '发现时间',
    definition: '告警事件首次触发的精确时间（精确到秒）',
  },
  '超量 / 超支预警次数（KPI + 日历热力图）': {
    name: '超量 / 超支预警次数（KPI + 日历热力图）',
    definition: '触发用量阈值或预算阈值预警的次数（按日色块展示）',
    unit: '次',
    threshold: '目标 = 0',
  },
};

/** 根据指标名获取指标元数据，找不到时回退到「name + 通用说明」 */
export function getMetricMeta(name: string): MetricMeta {
  return M[name] || { name, definition: '该指标的定义与计算口径参见《医疗智能体监控指标体系V1.1》对应章节' };
}
