/**
 * 8-5 成本监控（Cost）
 * 需求文档：统一运行监控中心-需求说明文档 v1.4
 *
 * 布局规范：
 * - 顶部信息条 48px：左段标题+副标题+「日/周/月/年」时间粒度分段，右段全局筛选+视图切换
 * - 4 KPI 卡片：一行4卡，高度 88px
 * - 3 Tab：资源消耗 / 资源利用 / 汇总与趋势
 * - Tab 1：4 类资源聚合 → 2×2 网格
 * - Tab 2：4 项资源利用 → 2×2 网格
 * - Tab 3：6 项汇总与趋势 → 3×2 网格
 * - 右下角悬浮按钮「📊 查看明细」唤起右侧抽屉
 * - 视图切换：消耗量 / 金额（金额在单价未配置时禁用并显示 ⓘ 提示）
 */
import { Fragment, useRef, useState } from 'react';
import {
  Card, Row, Col, Space, Button, Segmented, Typography, Tabs, Tooltip, Statistic, FloatButton, Drawer, Select,
} from 'antd';
import {
  ReloadOutlined, ThunderboltOutlined, DatabaseOutlined, GlobalOutlined, ApiOutlined, WarningOutlined,
  HddOutlined, AreaChartOutlined, FilterOutlined, CaretDownOutlined, CaretUpOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { Line, Column, Area, Pie } from '@ant-design/charts';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartConfig = any;
import { ProTable, type ProColumns, type ActionType } from '@ant-design/pro-components';
import MetricLabel from '../../components/MetricLabel';
import { mockAgentCostDetails, type AgentCostDetail } from '../../mock/monitoring';

const { Text } = Typography;
const chartBaseConfig: ChartConfig = {
  autoFit: true, pixelRatio: window.devicePixelRatio,
  appendPadding: [8, 8, 28, 8],
  xAxis: { label: { autoHide: false, autoRotate: false } },
};

type TimeGranularity = 'day' | 'week' | 'month' | 'year';
type CostView = 'consumption' | 'amount';

const Cost = () => {
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('day');
  const [costView, setCostView] = useState<CostView>('consumption');
  const [activeTab, setActiveTab] = useState('consumption');
  const [department, setDepartment] = useState<string[]>([]);
  const [agent, setAgent] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const actionRef = useRef<ActionType | undefined>(undefined);

  const columns: ProColumns<AgentCostDetail>[] = [
    { title: '智能体名称', dataIndex: 'agentName', key: 'agentName', width: 200, fixed: 'left', ellipsis: true, render: (n: any) => <a>{n}</a> },
    { title: '归属科室', dataIndex: 'department', key: 'department', width: 100, valueType: 'select', valueEnum: { 心内科: { text: '心内科' }, 影像科: { text: '影像科' }, 医务科: { text: '医务科' }, 药剂科: { text: '药剂科' }, 急诊科: { text: '急诊科' }, 内科: { text: '内科' }, 门诊部: { text: '门诊部' }, 体检科: { text: '体检科' } } },
    { title: 'CPU 核时 / GPU 卡时', key: 'cpuGpu', width: 160, render: (_, r) => <Text>{r.cpuCoreHours.toFixed(1)} 核·h / {r.gpuCardHours.toFixed(1)} 卡·h</Text>, sorter: (a, b) => a.cpuCoreHours + a.gpuCardHours * 24 - (b.cpuCoreHours + b.gpuCardHours * 24) },
    { title: '存储用量 (GB·月)', dataIndex: 'storageGbMonth', key: 'storageGbMonth', width: 130, sorter: (a, b) => a.storageGbMonth - b.storageGbMonth, render: (v: number) => v.toFixed(0) },
    { title: '出向流量 (GB)', dataIndex: 'egressGb', key: 'egressGb', width: 120, sorter: (a, b) => a.egressGb - b.egressGb, render: (v: number) => v.toFixed(1) },
    { title: 'Token 消耗', dataIndex: 'tokenConsumption', key: 'tokenConsumption', width: 130, sorter: (a, b) => a.tokenConsumption - b.tokenConsumption, render: (v: number) => `${(v / 1000).toFixed(0)}k` },
    { title: '单次调用 Token', dataIndex: 'tokenPerCall', key: 'tokenPerCall', width: 130, sorter: (a, b) => a.tokenPerCall - b.tokenPerCall, render: (v: number) => v.toLocaleString() },
    { title: '实例闲置率', dataIndex: 'idleRate', key: 'idleRate', width: 110, sorter: (a, b) => a.idleRate - b.idleRate, render: (v: number) => <Text type={v * 100 > 15 ? 'danger' : v * 100 > 10 ? 'warning' : 'secondary'}>{(v * 100).toFixed(1)}%</Text> },
    { title: '环比变化', key: 'change', width: 110, render: (_, r) => <Text type={r.totalCost > 30000 ? 'danger' : 'success'}>{r.totalCost > 30000 ? '↑' : '↓'} {(Math.random() * 20 - 10).toFixed(1)}%</Text> },
    { title: '金额', key: 'amount', width: 110, render: (_, r) => <Text type="secondary">{r.amount == null ? '—' : `¥ ${r.amount.toLocaleString()}`}</Text> },
    { title: '趋势', key: 'trend', width: 80, fixed: 'right', render: () => <Text type="secondary" style={{ fontSize: 12 }}>↘ -3%</Text> },
  ];

  // Tab 1: 资源消耗（4 类资源 2×2）
  const consumptionTab = (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="算力消耗（CPU·h / GPU·h）" />} extra={
          <Segmented
            options={[{ label: 'CPU·h', value: 'cpu' }, { label: 'GPU·h', value: 'gpu' }]}
            defaultValue="cpu" size="small" />
        } styles={{ body: { padding: 12, height: 200, overflow: 'hidden' } }} style={{ height: 248 }}>
          <Area
            {...chartBaseConfig}
            height={188}
            data={[
              { date: '06-25', CPU: 8200, GPU: 1280 },
              { date: '06-26', CPU: 8800, GPU: 1380 },
              { date: '06-27', CPU: 8500, GPU: 1320 },
              { date: '06-28', CPU: 9200, GPU: 1450 },
              { date: '06-29', CPU: 9000, GPU: 1400 },
              { date: '06-30', CPU: 9500, GPU: 1480 },
              { date: '07-01', CPU: 9200, GPU: 1430 },
            ]}
            xField="date" yField={['CPU', 'GPU']} color={['#1677FF', '#722ED1']} legend={{ position: 'top' }}
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="存储用量（块·云盘 / 对象·向量库）" />} extra={
          <Segmented
            options={[{ label: '块·云盘', value: 'block' }, { label: '对象·向量库', value: 'object' }]}
            defaultValue="block" size="small" />
        } styles={{ body: { padding: 12, height: 200, overflow: 'hidden' } }} style={{ height: 248 }}>
          <Area
            {...chartBaseConfig}
            height={188}
            data={[
              { date: '06-25', 系统盘: 1200, 数据盘: 980, 快照: 320 },
              { date: '06-26', 系统盘: 1220, 数据盘: 1000, 快照: 340 },
              { date: '06-27', 系统盘: 1210, 数据盘: 990, 快照: 330 },
              { date: '06-28', 系统盘: 1230, 数据盘: 1010, 快照: 360 },
              { date: '06-29', 系统盘: 1240, 数据盘: 1000, 快照: 350 },
              { date: '06-30', 系统盘: 1260, 数据盘: 1020, 快照: 380 },
              { date: '07-01', 系统盘: 1250, 数据盘: 1010, 快照: 370 },
            ]}
            xField="date" yField={['系统盘', '数据盘', '快照']} stack
            color={['#1677FF', '#52C41A', '#FA8C16']} legend={{ position: 'top' }}
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="出向网络流量（按日 + 累计折线）" />} extra={<Button type="link" size="small">查看详情</Button>} styles={{ body: { padding: 12, height: 200, overflow: 'hidden' } }} style={{ height: 248 }}>
          <Column
            {...chartBaseConfig}
            height={188}
            data={[
              { date: '06-25', value: 86 }, { date: '06-26', value: 92 },
              { date: '06-27', value: 88 }, { date: '06-28', value: 96 },
              { date: '06-29', value: 94 }, { date: '06-30', value: 99 },
              { date: '07-01', value: 96 },
            ]}
            xField="date" yField="value" color="#FA8C16" legend={false}
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="模型 Token 总消耗（趋势 + 7 日基线）" />} extra={<Button type="link" size="small">查看详情</Button>} styles={{ body: { padding: 12, height: 200, overflow: 'hidden' } }} style={{ height: 248 }}>
          <Space size="middle" style={{ width: '100%' }}>
            <Statistic title="当前均值" value={1820} suffix="tokens/次" valueStyle={{ fontSize: 22, color: '#1677FF' }} />
            <div style={{ flex: 1 }}>
              <Line
                {...chartBaseConfig}
                height={172}
                data={[
                  { date: '06-25', 当前: 1900, 基线: 1850 },
                  { date: '06-26', 当前: 1880, 基线: 1850 },
                  { date: '06-27', 当前: 1860, 基线: 1850 },
                  { date: '06-28', 当前: 1840, 基线: 1850 },
                  { date: '06-29', 当前: 1830, 基线: 1850 },
                  { date: '06-30', 当前: 1820, 基线: 1850 },
                  { date: '07-01', 当前: 1820, 基线: 1850 },
                ]}
                xField="date" yField={['当前', '基线']} smooth color={['#1677FF', '#D9D9D9']} legend={{ position: 'top' }}
              />
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  );

  // Tab 2: 资源利用（4 项 2×2）
  const utilizationTab = (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="实例闲置率（折线 + TOP 10 横向条形）" />} extra={<Button type="link" size="small">查看详情</Button>} styles={{ body: { padding: 12, height: 200, overflow: 'hidden' } }} style={{ height: 248 }}>
          <Space size="middle" style={{ width: '100%' }}>
            <Space direction="vertical" size={2} style={{ flex: '0 0 auto' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>当前值</Text>
              <Text style={{ fontSize: 24, fontWeight: 600, color: '#FA8C16' }}>12.5%</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>阈值 ≤ 15%</Text>
            </Space>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Line
                {...chartBaseConfig}
                height={172}
                data={[
                  { date: '06-25', v: 14.2 }, { date: '06-26', v: 12.8 },
                  { date: '06-27', v: 15.3 }, { date: '06-28', v: 11.9 },
                  { date: '06-29', v: 13.5 }, { date: '06-30', v: 12.1 },
                  { date: '07-01', v: 12.5 },
                ]}
                xField="date" yField="v" smooth color="#FA8C16" legend={false}
              />
            </div>
          </Space>
        </Card>
      </Col>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="低负载时长占比（24h 热力图）" />} extra={<Button type="link" size="small">查看详情</Button>} styles={{ body: { padding: 12, height: 200, overflow: 'hidden' } }} style={{ height: 248 }}>
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>24h × 7d 热力图（负载阈值 &lt; 20%）</Text>
            <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(24, 1fr)', gap: 2 }}>
              <div />
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} style={{ fontSize: 10, color: '#8c8c8c', textAlign: 'center' }}>{h}</div>
              ))}
              {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day) => (
                <Fragment key={day}>
                  <div style={{ fontSize: 11, color: '#595959' }}>{day}</div>
                  {Array.from({ length: 24 }).map((_, h) => {
                    const v = Math.random() * 0.4;
                    return (
                      <div
                        key={`${day}-${h}`}
                        title={`${day} ${h}:00 · 负载 ${(v * 100).toFixed(0)}%`}
                        style={{
                          height: 14, borderRadius: 1,
                          background: v < 0.2 ? `rgba(255,77,79,${0.3 + v})` : `rgba(82,196,26,${0.3 + v})`,
                        }}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>阈值 ≤ 20%</Text>
          </Space>
        </Card>
      </Col>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="无效调用占比（折线 + 原因分类饼图）" />} extra={<Button type="link" size="small">查看详情</Button>} styles={{ body: { padding: 12, height: 200, overflow: 'hidden' } }} style={{ height: 248 }}>
          <Space size="middle" style={{ width: '100%' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Line
                {...chartBaseConfig}
                height={188}
                data={[
                  { date: '06-25', v: 2.6 }, { date: '06-26', v: 2.4 },
                  { date: '06-27', v: 2.8 }, { date: '06-28', v: 2.2 },
                  { date: '06-29', v: 2.5 }, { date: '06-30', v: 2.7 },
                  { date: '07-01', v: 2.8 },
                ]}
                xField="date" yField="v" smooth color="#FF4D4F" legend={false}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Pie
                {...chartBaseConfig}
                height={188}
                data={[
                  { type: '参数错误', value: 38 },
                  { type: '超时', value: 26 },
                  { type: '空回', value: 18 },
                  { type: '重复', value: 12 },
                  { type: '其它', value: 6 },
                ]}
                angleField="value" colorField="type" radius={0.7} legend={{ position: 'bottom' }}
                color={['#FF4D4F', '#FA8C16', '#722ED1', '#1677FF', '#8C8C8C']}
              />
            </div>
          </Space>
        </Card>
      </Col>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="GPU 平均利用率（多线）" />} extra={<Button type="link" size="small">查看详情</Button>} styles={{ body: { padding: 12, height: 200, overflow: 'hidden' } }} style={{ height: 248 }}>
          <Line
            {...chartBaseConfig}
            height={188}
            data={[
              { date: '06-25', GPU1: 65, GPU2: 58, GPU3: 72 },
              { date: '06-26', GPU1: 68, GPU2: 62, GPU3: 75 },
              { date: '06-27', GPU1: 70, GPU2: 64, GPU3: 78 },
              { date: '06-28', GPU1: 72, GPU2: 66, GPU3: 80 },
              { date: '06-29', GPU1: 74, GPU2: 68, GPU3: 82 },
              { date: '06-30', GPU1: 76, GPU2: 70, GPU3: 84 },
              { date: '07-01', GPU1: 78, GPU2: 72, GPU3: 85 },
            ]}
            xField="date" yField={['GPU1', 'GPU2', 'GPU3']} smooth
            color={['#1677FF', '#722ED1', '#EB2F96']} legend={{ position: 'top' }}
          />
        </Card>
      </Col>
    </Row>
  );

  // Tab 3: 汇总与趋势（6 项 3×2，单图固定 220px，KPI 与图表分上下行避免挤压）
  const summaryTab = (
    <Row gutter={[16, 16]}>
      {/* 1. 单次调用 Token 消耗：大数字 KPI + 折线趋势 */}
      <Col span={8}>
        <Card
          bordered={false}
          title={<MetricLabel name="单次调用 Token 消耗（均值 + 折线）" />}
          extra={<Button type="link" size="small">查看详情</Button>}
          styles={{ body: { padding: 12, height: 220, overflow: 'hidden' } }}
          style={{ height: 268 }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <Space direction="vertical" size={0}>
              <Text type="secondary" style={{ fontSize: 12 }}>当前均值</Text>
              <Text style={{ fontSize: 24, fontWeight: 600, color: '#1677FF', lineHeight: 1.2 }}>1,820</Text>
            </Space>
            <Text type="success" style={{ fontSize: 12 }}>↓ 3.2% vs 7 日基线</Text>
          </div>
          <Line
            {...chartBaseConfig}
            height={150}
            data={[
              { date: '06-25', v: 1900 }, { date: '06-26', v: 1880 },
              { date: '06-27', v: 1860 }, { date: '06-28', v: 1840 },
              { date: '06-29', v: 1830 }, { date: '06-30', v: 1820 },
              { date: '07-01', v: 1820 },
            ]}
            xField="date" yField="v" smooth color="#1677FF" legend={false}
          />
        </Card>
      </Col>

      {/* 2. Token 消耗（输入 + 输出）：堆叠柱状图 */}
      <Col span={8}>
        <Card
          bordered={false}
          title={<MetricLabel name="Token 消耗（输入 + 输出）" />}
          extra={<Button type="link" size="small">查看详情</Button>}
          styles={{ body: { padding: 12, height: 220, overflow: 'hidden' } }}
          style={{ height: 268 }}
        >
          <Column
            {...chartBaseConfig}
            height={200}
            data={[
              { date: '06-25', 输入: 3200, 输出: 1800 },
              { date: '06-26', 输入: 3500, 输出: 1900 },
              { date: '06-27', 输入: 3300, 输出: 1750 },
              { date: '06-28', 输入: 3800, 输出: 2000 },
              { date: '06-29', 输入: 3600, 输出: 1900 },
              { date: '06-30', 输入: 3900, 输出: 2100 },
              { date: '07-01', 输入: 3700, 输出: 2000 },
            ]}
            xField="date" yField={['输入', '输出']} stack
            color={['#1677FF', '#722ED1']} legend={{ position: 'top' }}
          />
        </Card>
      </Col>

      {/* 3. 周期总消耗 / 总成本：堆叠柱状图 */}
      <Col span={8}>
        <Card
          bordered={false}
          title={<MetricLabel name="周期总消耗 / 总成本（4 类资源堆叠）" />}
          extra={<Button type="link" size="small">查看详情</Button>}
          styles={{ body: { padding: 12, height: 220, overflow: 'hidden' } }}
          style={{ height: 268 }}
        >
          <Column
            {...chartBaseConfig}
            height={200}
            data={[
              { date: '06-25', 算力: 8200, 存储: 3200, 流量: 1800, Token: 6200 },
              { date: '06-26', 算力: 8800, 存储: 3400, 流量: 1900, Token: 6800 },
              { date: '06-27', 算力: 8500, 存储: 3300, 流量: 1850, Token: 6500 },
              { date: '06-28', 算力: 9200, 存储: 3600, 流量: 2000, Token: 7100 },
              { date: '06-29', 算力: 9000, 存储: 3500, 流量: 1950, Token: 6900 },
              { date: '06-30', 算力: 9500, 存储: 3800, 流量: 2100, Token: 7300 },
              { date: '07-01', 算力: 9200, 存储: 3700, 流量: 2050, Token: 7050 },
            ]}
            xField="date" yField={['算力', '存储', '流量', 'Token']} stack
            color={['#1677FF', '#52C41A', '#FA8C16', '#722ED1']} legend={{ position: 'top' }}
          />
        </Card>
      </Col>

      {/* 4. 各维度成本占比：环形图 + 4 张数字卡 */}
      <Col span={8}>
        <Card
          bordered={false}
          title={<MetricLabel name="各维度成本占比" />}
          extra={<Button type="link" size="small">查看详情</Button>}
          styles={{ body: { padding: 12, height: 220, overflow: 'hidden' } }}
          style={{ height: 268 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 196 }}>
            <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
              <Pie
                {...chartBaseConfig}
                height={196}
                data={[
                  { type: '算力', value: 39 },
                  { type: '存储', value: 14 },
                  { type: '流量', value: 8 },
                  { type: 'Token', value: 39 },
                ]}
                angleField="value" colorField="type" radius={0.85} innerRadius={0.55}
                legend={false}
                color={['#1677FF', '#52C41A', '#FA8C16', '#722ED1']}
                label={false}
              />
            </div>
            <Space direction="vertical" size={6} style={{ flex: '0 0 auto', fontSize: 12 }}>
              <Space size={4}><span style={{ width: 8, height: 8, background: '#1677FF', display: 'inline-block', borderRadius: 1 }} /><Text style={{ fontSize: 12 }}>算力 39% ↑2%</Text></Space>
              <Space size={4}><span style={{ width: 8, height: 8, background: '#52C41A', display: 'inline-block', borderRadius: 1 }} /><Text style={{ fontSize: 12 }}>存储 14% ↓1%</Text></Space>
              <Space size={4}><span style={{ width: 8, height: 8, background: '#FA8C16', display: 'inline-block', borderRadius: 1 }} /><Text style={{ fontSize: 12 }}>流量 8% 持平</Text></Space>
              <Space size={4}><span style={{ width: 8, height: 8, background: '#722ED1', display: 'inline-block', borderRadius: 1 }} /><Text style={{ fontSize: 12 }}>Token 39% ↑3%</Text></Space>
            </Space>
          </div>
        </Card>
      </Col>

      {/* 5. 消耗 / 成本波动率：双向柱状图 */}
      <Col span={8}>
        <Card
          bordered={false}
          title={<MetricLabel name="消耗 / 成本波动率（双向柱状图）" />}
          extra={<Button type="link" size="small">查看详情</Button>}
          styles={{ body: { padding: 12, height: 220, overflow: 'hidden' } }}
          style={{ height: 268 }}
        >
          <Column
            {...chartBaseConfig}
            height={200}
            data={[
              { type: '算力', value: 8.2 },
              { type: '存储', value: -3.4 },
              { type: '流量', value: 5.6 },
              { type: 'Token', value: 12.3 },
              { type: '总成本', value: 6.0 },
            ]}
            xField="type" yField="value" color={({ value }: { value: number }) => (value >= 0 ? '#52C41A' : '#FF4D4F')} legend={false}
          />
        </Card>
      </Col>

      {/* 6. 超量 / 超支预警次数：大数字 KPI + 日历热力图 */}
      <Col span={8}>
        <Card
          bordered={false}
          title={<MetricLabel name="超量 / 超支预警次数（KPI + 日历热力图）" />}
          extra={<Button type="link" size="small">查看详情</Button>}
          styles={{ body: { padding: 12, height: 220, overflow: 'hidden' } }}
          style={{ height: 268 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Space direction="vertical" size={0} style={{ flex: '0 0 auto' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>当日</Text>
              <Text style={{ fontSize: 26, fontWeight: 600, color: '#FA8C16', lineHeight: 1.2 }}>3</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>累计 15 · 目标 = 0</Text>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 3 }}>
            {Array.from({ length: 56 }).map((_, i) => {
              const intensity = Math.min(1, Math.max(0.1, (Math.sin(i * 0.5) + 1) / 2));
              return (
                <div
                  key={i}
                  title={`D-${56 - i}：${Math.round(intensity * 5)} 次`}
                  style={{ height: 14, borderRadius: 2, background: `rgba(250,140,22,${0.2 + intensity * 0.8})` }}
                />
              );
            })}
          </div>
        </Card>
      </Col>
    </Row>
  );

  // 抽屉内高级筛选
  const renderAdvancedFilter = () => (
    <Card bordered={false} size="small" style={{ marginBottom: 12, background: '#FAFAFA' }}>
      <Space style={{ marginBottom: filterExpanded ? 12 : 0 }} onClick={() => setFilterExpanded((v) => !v)}>
        <FilterOutlined /><Text strong style={{ fontSize: 13 }}>高级筛选</Text>
        {filterExpanded ? <CaretUpOutlined /> : <CaretDownOutlined />}
      </Space>
      {filterExpanded && (
        <Row gutter={[16, 8]}>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>智能体名称</Text><input placeholder="模糊匹配" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>归属科室</Text><Select mode="multiple" placeholder="全部" style={{ width: '100%' }} options={['心内科', '影像科', '医务科', '药剂科', '急诊科', '内科', '门诊部', '体检科'].map((v) => ({ label: v, value: v }))} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>资源类型</Text><Select mode="multiple" placeholder="全部" style={{ width: '100%' }} options={[{ label: '算力', value: 'compute' }, { label: '存储', value: 'storage' }, { label: '流量', value: 'network' }, { label: '模型 Token', value: 'token' }]} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>CPU 核时 / GPU 卡时</Text><input placeholder="数字范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>存储用量 (GB·月)</Text><input placeholder="数字范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>出向流量 (GB)</Text><input placeholder="数字范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>Token 消耗</Text><input placeholder="数字范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>单次调用 Token</Text><input placeholder="数字范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>实例闲置率</Text><input placeholder="百分比范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>环比变化</Text><input placeholder="百分比范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>趋势</Text><Select placeholder="全部" style={{ width: '100%' }} options={[{ label: '上升', value: 'up' }, { label: '下降', value: 'down' }, { label: '平稳', value: 'flat' }]} /></Col>
          <Col span={12} />
          <Col span={6} style={{ textAlign: 'right' }}>
            <Space><Button>重置</Button><Button type="primary">查询</Button></Space>
          </Col>
        </Row>
      )}
    </Card>
  );

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      {/* 标题 + 筛选条（同一行） */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        minHeight: 48, padding: '8px 16px', background: '#fff', borderRadius: 8, marginBottom: 16,
      }}>
        <Space size={8} align="baseline">
          <Text strong style={{ fontSize: 16 }}>成本监控</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>智能体花了多少钱、花在哪里</Text>
        </Space>
        <Space size={8} wrap>
          <Segmented
            value={timeGranularity}
            onChange={(v) => setTimeGranularity(v as TimeGranularity)}
            size="small"
            options={[
              { label: '日', value: 'day' },
              { label: '周', value: 'week' },
              { label: '月', value: 'month' },
              { label: '年', value: 'year' },
            ]}
          />
          <Select defaultValue="thisMonth" style={{ width: 140 }}
            options={[{ label: '本月', value: 'thisMonth' }, { label: '上月', value: 'lastMonth' }, { label: '本季度', value: 'thisQuarter' }, { label: '自定义', value: 'custom' }]} />
          <Select mode="multiple" placeholder="科室筛选" style={{ width: 120 }} value={department} onChange={setDepartment} allowClear maxTagCount="responsive"
            options={['心内科', '影像科', '医务科', '药剂科', '急诊科', '内科', '门诊部', '体检科'].map((v) => ({ label: v, value: v }))} />
          <Select mode="multiple" placeholder="智能体筛选" style={{ width: 140 }} value={agent} onChange={setAgent} allowClear maxTagCount="responsive" showSearch
            options={['心电图智能辅助诊断系统', '胸部 CT 影像智能分析平台', '病历智能生成与质控系统', '智能导诊与分诊系统'].map((v) => ({ label: v, value: v }))} />
          <Space size={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>视图：</Text>
            <Segmented
              value={costView}
              onChange={(v) => setCostView(v as CostView)}
              size="small"
              options={[
                { label: '消耗量', value: 'consumption' },
                {
                  label: (
                    <Tooltip title="待单价配置后启用">
                      金额 <WarningOutlined />
                    </Tooltip>
                  ),
                  value: 'amount',
                  disabled: true,
                },
              ]}
            />
          </Space>
          <Button icon={<ReloadOutlined />} style={{ width: 32, height: 32, padding: 0 }} />
        </Space>
      </div>

      {/* 4 KPI 卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false} hoverable styles={{ body: { padding: '12px 16px', height: 96, overflow: 'hidden' } }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <MetricLabel name="周期总消耗 / 总成本" variant="kpi" />
              <Text strong style={{ fontSize: 24, fontWeight: 600, color: '#1677FF', lineHeight: 1.2 }}>284,010</Text>
              <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>元 · 环比 ↑ 6.0%</Text>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable styles={{ body: { padding: '12px 16px', height: 96, overflow: 'hidden' } }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <MetricLabel name="单次调用 Token 消耗" variant="kpi" />
              <Text strong style={{ fontSize: 24, fontWeight: 600, color: '#722ED1', lineHeight: 1.2 }}>1,820</Text>
              <Text type="success" style={{ fontSize: 12, lineHeight: 1.4 }}>↓ 3.2% vs 7 日基线</Text>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable styles={{ body: { padding: '12px 16px', height: 96, overflow: 'hidden' } }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <MetricLabel name="实例闲置率" variant="kpi" />
              <Text strong style={{ fontSize: 24, fontWeight: 600, color: '#FA8C16', lineHeight: 1.2 }}>12.5%</Text>
              <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>阈值 ≤ 15%</Text>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable styles={{ body: { padding: '12px 16px', height: 96, overflow: 'hidden' } }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <MetricLabel name="超量 / 超支预警次数" variant="kpi" />
              <Text strong style={{ fontSize: 24, fontWeight: 600, color: '#FA8C16', lineHeight: 1.2 }}>3</Text>
              <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>当日 / 累计 15 · 目标 = 0</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Tab 内容区 */}
      <Card bordered={false} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'consumption', label: <Space><ThunderboltOutlined />资源消耗</Space>, children: consumptionTab },
            { key: 'utilization', label: <Space><DatabaseOutlined />资源利用</Space>, children: utilizationTab },
            { key: 'summary', label: <Space><ApiOutlined />汇总与趋势</Space>, children: summaryTab },
          ]}
        />
      </Card>

      {/* 右下角悬浮按钮：查看明细 */}
      <FloatButton
        icon={<BarChartOutlined />}
        tooltip="查看明细"
        type="primary"
        style={{ right: 24, bottom: 24 }}
        onClick={() => setDrawerOpen(true)}
      />

      {/* 800px 宽右侧抽屉：成本明细表 */}
      <Drawer
        title="成本明细"
        placement="right"
        width={800}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {renderAdvancedFilter()}
        <ProTable<AgentCostDetail>
          rowKey="agentId"
          actionRef={actionRef}
          search={false}
          columns={columns}
          dataSource={mockAgentCostDetails}
          pagination={{
            defaultPageSize: 20, showSizeChanger: true, showQuickJumper: true,
            pageSizeOptions: ['20', '50', '100'], showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1500 }}
          toolBarRender={() => [
            <Button key="reload" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>刷新</Button>,
          ]}
        />
      </Drawer>
    </div>
  );
};

export default Cost;
