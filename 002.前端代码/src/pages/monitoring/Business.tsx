/**
 * 8-4 业务监控（Business）
 * 需求文档：统一运行监控中心-需求说明文档 v1.4
 *
 * 布局规范（v1.4）：
 * - 顶部信息条 48px：左段标题+副标题，右段筛选
 * - 4 KPI 卡片：一行 4 卡等宽，高度 88px
 *   卡片内「标题 12px + 主指标 28px 加粗 + 阈值/环比 12px」同一行紧邻
 *   不含趋势缩略图，趋势统一在下方 Tab 图表区
 * - 3 Tab：调用与任务 / 内容输出质量 / 用户反馈与协同
 * - Tab 1：6 项指标 → 3×2 等宽网格，单图固定 220px
 * - Tab 2：5 项指标 → 3×2 网格末位「高风险拦截数」大 KPI 跨 2 列
 * - Tab 3：4 项指标 → 2×2 网格
 * - 右下角悬浮按钮「📊 查看明细」唤起 800px 宽右侧抽屉
 */
import { Fragment, useRef, useState } from 'react';
import {
  Card, Row, Col, Space, Typography, Tabs, Button, Select, FloatButton, Drawer,
} from 'antd';
import {
  RiseOutlined, LockOutlined, StarOutlined, ReloadOutlined,
  BarChartOutlined, FilterOutlined, CaretDownOutlined, CaretUpOutlined,
} from '@ant-design/icons';
import { Line, Column, Pie, Bar } from '@ant-design/charts';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartConfig = any;
import { ProTable, type ProColumns, type ActionType } from '@ant-design/pro-components';
import MetricLabel from '../../components/MetricLabel';
import { mockBusinessDetailRows, type BusinessDetailRow } from '../../mock/monitoring';

const { Text } = Typography;

// 图表基础配置（固定高度由外层 Card 统一约束为 220px）
const chartBaseConfig: ChartConfig = {
  autoFit: true,
  pixelRatio: window.devicePixelRatio,
  appendPadding: [4, 0, 16, 0],
  xAxis: { label: { autoHide: false, autoRotate: false, style: { fontSize: 10 } } },
  yAxis: { label: { style: { fontSize: 10 } } },
  legend: { position: 'top', itemName: { style: { fontSize: 11 } } },
  animation: false,
};

// KPI 卡片共用样式
const kpiCardStyle: React.CSSProperties = {
  height: 88, overflow: 'hidden',
};
const kpiCardBodyStyle: React.CSSProperties = {
  padding: '12px 16px', height: '100%',
  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
};

// 图表卡片共用样式
const chartCardStyle: React.CSSProperties = {
  height: 220, overflow: 'hidden',
};
const chartCardBodyStyle: React.CSSProperties = {
  padding: 12, height: 'calc(100% - 38px)',
};

const Business = () => {
  const [activeTab, setActiveTab] = useState('calls');
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [department, setDepartment] = useState<string[]>([]);
  const [agent, setAgent] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const actionRef = useRef<ActionType | undefined>(undefined);

  // 4 KPI 数据
  const kpi = {
    callCount: { value: 128340, wow: 0.082 },
    activeUsers: { dau: 18564, mau: 52340, dauWow: 0.125 },
    taskCompletionRate: { value: 98.2, threshold: 95 },
    noncomplianceRate: { value: 0.32, threshold: 0.5 },
  };

  // 通用图表卡片封装
  const ChartCard = ({ title, extra, children, span }: { title: string; extra?: React.ReactNode; children: React.ReactNode; span: number }) => (
    <Col span={span}>
      <Card bordered={false} title={<MetricLabel name={title} />} extra={extra ?? <Button type="link" size="small">查看详情</Button>} bodyStyle={chartCardBodyStyle} style={chartCardStyle}>
        {children}
      </Card>
    </Col>
  );

  // Tab 1: 调用与任务完成（6 项 → 3×2）
  const callsTab = (
    <Row gutter={[16, 16]}>
      <ChartCard title="业务调用总量" span={8}>
        <Column
          {...chartBaseConfig}
          data={[
            { date: '06-25', count: 10200 }, { date: '06-26', count: 11500 },
            { date: '06-27', count: 10800 }, { date: '06-28', count: 12200 },
            { date: '06-29', count: 11900 }, { date: '06-30', count: 12500 },
            { date: '07-01', count: 12834 },
          ]}
          xField="date" yField="count" color="#1677FF" legend={false}
        />
      </ChartCard>
      <ChartCard title="活跃用户数（DAU/MAU）" span={8}>
        <Line
          {...chartBaseConfig}
          data={[
            { date: '06-25', DAU: 16800, MAU: 50200 },
            { date: '06-26', DAU: 17200, MAU: 50800 },
            { date: '06-27', DAU: 17500, MAU: 51200 },
            { date: '06-28', DAU: 18000, MAU: 51800 },
            { date: '06-29', DAU: 18200, MAU: 52100 },
            { date: '06-30', DAU: 18400, MAU: 52200 },
            { date: '07-01', DAU: 18564, MAU: 52340 },
          ]}
          xField="date" yField={['DAU', 'MAU']} smooth color={['#1677FF', '#722ED1']}
        />
      </ChartCard>
      <ChartCard title="科室覆盖数（Top 10）" span={8}>
        <Bar
          {...chartBaseConfig}
          data={[
            { dept: '心内科', count: 28 }, { dept: '影像科', count: 24 },
            { dept: '医务科', count: 22 }, { dept: '药剂科', count: 20 },
            { dept: '急诊科', count: 18 }, { dept: '内科', count: 16 },
            { dept: '门诊部', count: 14 }, { dept: '体检科', count: 12 },
            { dept: '外科', count: 10 }, { dept: '儿科', count: 8 },
          ]}
          xField="count" yField="dept" color="#52C41A" legend={false}
        />
      </ChartCard>
      <ChartCard title="任务完成率" span={8}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: '100%' }}>
          <div style={{ flex: '0 0 96px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 88, height: 88 }}>
              <svg viewBox="0 0 88 88" width="88" height="88">
                <circle cx="44" cy="44" r="38" stroke="#F0F0F0" strokeWidth="6" fill="none" />
                <circle
                  cx="44" cy="44" r="38" stroke="#52C41A" strokeWidth="6" fill="none"
                  strokeDasharray={`${(2 * Math.PI * 38 * kpi.taskCompletionRate.value) / 100} ${2 * Math.PI * 38}`}
                  strokeLinecap="round" transform="rotate(-90 44 44)"
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', lineHeight: 1.1,
              }}>
                <Text strong style={{ fontSize: 18, color: '#52C41A' }}>{kpi.taskCompletionRate.value}%</Text>
                <Text type="secondary" style={{ fontSize: 10 }}>完成率</Text>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, height: '100%' }}>
            <Line
              {...chartBaseConfig}
              data={[
                { date: '06-25', v: 97.8 }, { date: '06-26', v: 98.0 },
                { date: '06-27', v: 98.1 }, { date: '06-28', v: 98.0 },
                { date: '06-29', v: 98.3 }, { date: '06-30', v: 98.4 },
                { date: '07-01', v: 98.2 },
              ]}
              xField="date" yField="v" smooth color="#52C41A" legend={false}
              yAxis={{ label: { style: { fontSize: 10 } } }}
            />
          </div>
        </div>
      </ChartCard>
      <ChartCard title="任务中断率" span={8}>
        <Column
          {...chartBaseConfig}
          data={[
            { date: '06-25', 异常: 1.2, 用户放弃: 0.6, 超时: 0.3 },
            { date: '06-26', 异常: 1.1, 用户放弃: 0.5, 超时: 0.4 },
            { date: '06-27', 异常: 0.9, 用户放弃: 0.6, 超时: 0.3 },
            { date: '06-28', 异常: 1.0, 用户放弃: 0.7, 超时: 0.4 },
            { date: '06-29', 异常: 0.8, 用户放弃: 0.5, 超时: 0.3 },
            { date: '06-30', 异常: 0.9, 用户放弃: 0.6, 超时: 0.3 },
            { date: '07-01', 异常: 0.8, 用户放弃: 0.5, 超时: 0.3 },
          ]}
          xField="date" yField={['异常', '用户放弃', '超时']} stack
          color={['#FF4D4F', '#FA8C16', '#722ED1']}
        />
      </ChartCard>
      <ChartCard title="平均会话轮次" span={8}>
        <Column
          {...chartBaseConfig}
          data={[
            { bucket: '1-3', count: 320 }, { bucket: '4-6', count: 580 },
            { bucket: '7-9', count: 720 }, { bucket: '10-12', count: 460 },
            { bucket: '13-15', count: 280 }, { bucket: '16-20', count: 120 },
            { bucket: '>20', count: 38 },
          ]}
          xField="bucket" yField="count" color="#722ED1" legend={false}
        />
      </ChartCard>
    </Row>
  );

  // Tab 2: 内容输出质量（5 项 → 3×2 末位跨 2 列大 KPI）
  const qualityTab = (
    <Row gutter={[16, 16]}>
      <ChartCard title="不合规回答率（P0 核心）" span={8}>
        <Line
          {...chartBaseConfig}
          data={[
            { date: '06-25', v: 0.42 }, { date: '06-26', v: 0.38 },
            { date: '06-27', v: 0.45 }, { date: '06-28', v: 0.36 },
            { date: '06-29', v: 0.34 }, { date: '06-30', v: 0.30 },
            { date: '07-01', v: 0.32 },
          ]}
          xField="date" yField="v" smooth color="#FF4D4F" legend={false}
        />
      </ChartCard>
      <ChartCard title="过度承诺 / 绝对化表述率" span={8}>
        <Line
          {...chartBaseConfig}
          data={[
            { date: '06-25', v: 0.38 }, { date: '06-26', v: 0.42 },
            { date: '06-27', v: 0.36 }, { date: '06-28', v: 0.34 },
            { date: '06-29', v: 0.30 }, { date: '06-30', v: 0.32 },
            { date: '07-01', v: 0.28 },
          ]}
          xField="date" yField="v" smooth color="#FA8C16" legend={false}
        />
      </ChartCard>
      <ChartCard title="不当语气 / 态度异常率" span={8}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%' }}>
          <div style={{ flex: '0 0 90px', height: '100%' }}>
            <Pie
              {...chartBaseConfig}
              data={[
                { type: '冷漠', value: 18 },
                { type: '强硬', value: 12 },
                { type: '不耐烦', value: 8 },
                { type: '其它', value: 6 },
              ]}
              angleField="value" colorField="type"
              radius={0.85} innerRadius={0.55} legend={false}
              color={['#FF4D4F', '#FA8C16', '#722ED1', '#8C8C8C']}
              label={false}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            {[
              { name: '冷漠', value: 18, color: '#FF4D4F' },
              { name: '强硬', value: 12, color: '#FA8C16' },
              { name: '不耐烦', value: 8, color: '#722ED1' },
              { name: '其它', value: 6, color: '#8C8C8C' },
            ].map((it) => (
              <div key={it.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: it.color, borderRadius: 2 }} />
                  <Text style={{ fontSize: 12 }}>{it.name}</Text>
                </span>
                <Text strong style={{ fontSize: 12 }}>{it.value}</Text>
              </div>
            ))}
            <Text type="secondary" style={{ fontSize: 11, marginTop: 2 }}>总计 44 次 · 阈值 ≤ 1%</Text>
          </div>
        </div>
      </ChartCard>
      <ChartCard title="用词不当率（命中频次降序）" span={8}>
        <Bar
          {...chartBaseConfig}
          data={[
            { word: '一定', count: 32 }, { word: '绝对', count: 28 },
            { word: '根治', count: 18 }, { word: '100%', count: 16 },
            { word: '保证', count: 12 }, { word: '立刻', count: 9 },
          ]}
          xField="count" yField="word" color="#722ED1" legend={false}
        />
      </ChartCard>
      <Col span={16}>
        <Card
          bordered={false}
          title={<MetricLabel name="高风险输出拦截数（日历热力图 + 大数字 KPI）" />}
          extra={<Button type="link" size="small">查看详情</Button>}
          bodyStyle={{ padding: 16, height: 'calc(100% - 38px)' }}
          style={chartCardStyle}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, height: '100%' }}>
            <Space direction="vertical" size={2} style={{ flex: '0 0 auto' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>当日</Text>
              <Text style={{ fontSize: 36, fontWeight: 600, color: '#FF4D4F', lineHeight: 1.1 }}>18</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>累计 156</Text>
            </Space>
            <div style={{ flex: 1 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>近 56 天 · 拦截事件数</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 3 }}>
                {Array.from({ length: 56 }).map((_, i) => {
                  const intensity = Math.min(1, Math.max(0.1, (Math.sin(i * 0.6) + 1) / 2));
                  return (
                    <div
                      key={i}
                      title={`D-${56 - i}：${Math.round(intensity * 30)} 次`}
                      style={{
                        height: 16, borderRadius: 2,
                        background: `rgba(255,77,79,${0.2 + intensity * 0.8})`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  );

  // Tab 3: 用户反馈与协同（4 项 → 2×2）
  const feedbackTab = (
    <Row gutter={[16, 16]}>
      <ChartCard title="满意度评分（辅助）" span={12}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: '100%' }}>
          <Space direction="vertical" align="center" size={2} style={{ flex: '0 0 auto' }}>
            <Text style={{ fontSize: 32, fontWeight: 600, color: '#FAAD14', lineHeight: 1.1 }}>4.6</Text>
            <Space size={0}>{[1, 2, 3, 4, 5].map((i) => (<span key={i} style={{ color: i <= 4 ? '#FAAD14' : '#D9D9D9', fontSize: 14 }}>★</span>))}</Space>
            <Text type="secondary" style={{ fontSize: 11 }}>目标 ≥ 4.2</Text>
          </Space>
          <div style={{ flex: 1, height: '100%' }}>
            <Line
              {...chartBaseConfig}
              data={[
                { date: '06-25', v: 4.4 }, { date: '06-26', v: 4.5 },
                { date: '06-27', v: 4.5 }, { date: '06-28', v: 4.6 },
                { date: '06-29', v: 4.6 }, { date: '06-30', v: 4.6 },
                { date: '07-01', v: 4.6 },
              ]}
              xField="date" yField="v" smooth color="#FAAD14" legend={false}
            />
          </div>
        </div>
      </ChartCard>
      <ChartCard title="正向反馈率（辅助）" span={12}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: '100%' }}>
          <div style={{ flex: '0 0 96px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 88, height: 88 }}>
              <svg viewBox="0 0 88 88" width="88" height="88">
                <circle cx="44" cy="44" r="38" stroke="#F0F0F0" strokeWidth="6" fill="none" />
                <circle
                  cx="44" cy="44" r="38" stroke="#52C41A" strokeWidth="6" fill="none"
                  strokeDasharray={`${(2 * Math.PI * 38 * 92.5) / 100} ${2 * Math.PI * 38}`}
                  strokeLinecap="round" transform="rotate(-90 44 44)"
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', lineHeight: 1.1,
              }}>
                <Text strong style={{ fontSize: 18, color: '#52C41A' }}>92.5%</Text>
                <Text type="secondary" style={{ fontSize: 10 }}>正向</Text>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, height: '100%' }}>
            <Line
              {...chartBaseConfig}
              data={[
                { date: '06-25', v: 90.5 }, { date: '06-26', v: 91.0 },
                { date: '06-27', v: 91.5 }, { date: '06-28', v: 92.0 },
                { date: '06-29', v: 92.0 }, { date: '06-30', v: 92.3 },
                { date: '07-01', v: 92.5 },
              ]}
              xField="date" yField="v" smooth color="#52C41A" legend={false}
            />
          </div>
        </div>
      </ChartCard>
      <ChartCard title="投诉与工单数（按状态分层）" span={12}>
        <Column
          {...chartBaseConfig}
          data={[
            { date: '06-25', status: '新建', value: 3 },
            { date: '06-25', status: '处理中', value: 5 },
            { date: '06-25', status: '已闭环', value: 3 },
            { date: '06-26', status: '新建', value: 2 },
            { date: '06-26', status: '处理中', value: 4 },
            { date: '06-26', status: '已闭环', value: 4 },
            { date: '06-27', status: '新建', value: 4 },
            { date: '06-27', status: '处理中', value: 6 },
            { date: '06-27', status: '已闭环', value: 5 },
            { date: '06-28', status: '新建', value: 3 },
            { date: '06-28', status: '处理中', value: 5 },
            { date: '06-28', status: '已闭环', value: 6 },
            { date: '06-29', status: '新建', value: 2 },
            { date: '06-29', status: '处理中', value: 4 },
            { date: '06-29', status: '已闭环', value: 5 },
            { date: '06-30', status: '新建', value: 3 },
            { date: '06-30', status: '处理中', value: 5 },
            { date: '06-30', status: '已闭环', value: 6 },
            { date: '07-01', status: '新建', value: 3 },
            { date: '07-01', status: '处理中', value: 5 },
            { date: '07-01', status: '已闭环', value: 3 },
          ]}
          xField="date" yField="value" stack
          colorField="status"
          color={['#FF4D4F', '#FAAD14', '#52C41A']}
        />
      </ChartCard>
      <ChartCard title="协同任务成功率" span={12}>
        <Line
          {...chartBaseConfig}
          data={[
            { date: '06-25', v: 96.2 }, { date: '06-26', v: 96.5 },
            { date: '06-27', v: 96.8 }, { date: '06-28', v: 97.0 },
            { date: '06-29', v: 96.9 }, { date: '06-30', v: 97.1 },
            { date: '07-01', v: 97.2 },
          ]}
          xField="date" yField="v" smooth color="#52C41A" legend={false}
          yAxis={{ label: { formatter: (v: number) => `${v}%`, style: { fontSize: 10 } } }}
        />
      </ChartCard>
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
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>调用总量</Text><input placeholder="数字范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>活跃用户数</Text><input placeholder="数字范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>任务完成率</Text><input placeholder="百分比范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>不合规回答率</Text><input placeholder="百分比范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>过度承诺率</Text><input placeholder="百分比范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>高风险拦截数</Text><input placeholder="数字范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>投诉工单数</Text><input placeholder="数字范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>趋势</Text><Select placeholder="全部" style={{ width: '100%' }} options={[{ label: '上升', value: 'up' }, { label: '下降', value: 'down' }, { label: '平稳', value: 'flat' }]} /></Col>
          <Col span={12} />
          <Col span={6} style={{ textAlign: 'right' }}>
            <Space><Button>重置</Button><Button type="primary">查询</Button></Space>
          </Col>
        </Row>
      )}
    </Card>
  );

  const businessTableColumns: ProColumns<BusinessDetailRow>[] = [
    { title: '智能体名称', dataIndex: 'agentName', key: 'agentName', width: 200, fixed: 'left', ellipsis: true, render: (n: any) => <a>{n}</a> },
    { title: '归属科室', dataIndex: 'department', key: 'department', width: 100, valueType: 'select', valueEnum: { 心内科: { text: '心内科' }, 影像科: { text: '影像科' }, 医务科: { text: '医务科' }, 药剂科: { text: '药剂科' }, 急诊科: { text: '急诊科' }, 内科: { text: '内科' }, 门诊部: { text: '门诊部' }, 体检科: { text: '体检科' } } },
    { title: '调用总量', dataIndex: 'callCount', key: 'callCount', width: 110, sorter: (a, b) => a.callCount - b.callCount, render: (v: number) => v.toLocaleString() },
    { title: '活跃用户数', dataIndex: 'activeUsers', key: 'activeUsers', width: 110, sorter: (a, b) => a.activeUsers - b.activeUsers, render: (v: number) => v.toLocaleString() },
    { title: '任务完成率', dataIndex: 'taskCompletionRate', key: 'taskCompletionRate', width: 120, sorter: (a, b) => a.taskCompletionRate - b.taskCompletionRate, render: (v: number) => <Text type={v * 100 >= 95 ? 'success' : v * 100 >= 90 ? 'warning' : 'danger'}>{(v * 100).toFixed(1)}%</Text> },
    { title: '不合规回答率', dataIndex: 'noncomplianceRate', key: 'noncomplianceRate', width: 130, sorter: (a, b) => a.noncomplianceRate - b.noncomplianceRate, render: (v: number) => <Text type={v * 100 > 0.5 ? 'danger' : v * 100 > 0.2 ? 'warning' : 'secondary'}>{(v * 100).toFixed(2)}%</Text> },
    { title: '过度承诺率', dataIndex: 'overpromiseRate', key: 'overpromiseRate', width: 120, sorter: (a, b) => a.overpromiseRate - b.overpromiseRate, render: (v: number) => <Text type={v * 100 > 0.5 ? 'danger' : v * 100 > 0.2 ? 'warning' : 'secondary'}>{(v * 100).toFixed(2)}%</Text> },
    { title: '高风险拦截数', dataIndex: 'blockedCount', key: 'blockedCount', width: 120, sorter: (a, b) => a.blockedCount - b.blockedCount, render: (v: number) => <Text type={v > 10 ? 'danger' : v > 5 ? 'warning' : 'secondary'}>{v}</Text> },
    { title: '投诉工单数', dataIndex: 'complaintTickets', key: 'complaintTickets', width: 110, sorter: (a, b) => a.complaintTickets - b.complaintTickets, render: (v: number) => <Text type={v > 3 ? 'danger' : v > 1 ? 'warning' : 'secondary'}>{v}</Text> },
    { title: '趋势', key: 'trend', width: 80, fixed: 'right', render: () => <Text type="secondary" style={{ fontSize: 12 }}>↗ 2.3%</Text> },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      {/* ① 顶部信息条 48px */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        minHeight: 48, padding: '6px 16px', background: '#fff', borderRadius: 8, marginBottom: 16,
      }}>
        <Space size={8} align="baseline">
          <Text strong style={{ fontSize: 16 }}>业务监控</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>智能体回答合不合规、有没有过度承诺或语气不当</Text>
        </Space>
        <Space size={8} wrap>
          <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}
            options={[{ label: '今日', value: 'today' }, { label: '近 7 天', value: '7d' }, { label: '近 30 天', value: '30d' }, { label: '自定义', value: 'custom' }]} />
          <Select mode="multiple" placeholder="科室筛选" style={{ width: 140 }} value={department} onChange={setDepartment} allowClear maxTagCount="responsive"
            options={['心内科', '影像科', '医务科', '药剂科', '急诊科', '内科', '门诊部', '体检科'].map((v) => ({ label: v, value: v }))} />
          <Select mode="multiple" placeholder="智能体筛选" style={{ width: 160 }} value={agent} onChange={setAgent} allowClear maxTagCount="responsive" showSearch
            options={['心电图智能辅助诊断系统', '胸部 CT 影像智能分析平台', '病历智能生成与质控系统', '处方智能审核与用药安全系统', '智能导诊与分诊系统', '智能问诊系统'].map((v) => ({ label: v, value: v }))} />
          <Button icon={<ReloadOutlined />} style={{ width: 32, height: 32, padding: 0 }} />
        </Space>
      </div>

      {/* ② 4 KPI 卡片（v1.4：标题 12px + 主指标 28px + 阈值/环比 12px 同一行紧邻） */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false} hoverable style={kpiCardStyle} bodyStyle={kpiCardBodyStyle}>
            <MetricLabel name="业务调用总量" variant="kpi" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <Text strong style={{ fontSize: 28, fontWeight: 600, color: '#1677FF', lineHeight: 1.1 }}>
                {kpi.callCount.value.toLocaleString()}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>次 · 环比 ↑ 8.2%</Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable style={kpiCardStyle} bodyStyle={kpiCardBodyStyle}>
            <MetricLabel name="活跃用户数" variant="kpi" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <Text strong style={{ fontSize: 28, fontWeight: 600, color: '#52C41A', lineHeight: 1.1 }}>
                {kpi.activeUsers.dau.toLocaleString()}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>/ {kpi.activeUsers.mau.toLocaleString()}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>DAU / MAU · 环比 ↑ 12.5%</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable style={kpiCardStyle} bodyStyle={kpiCardBodyStyle}>
            <MetricLabel name="任务完成率" variant="kpi" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <Text strong style={{ fontSize: 28, fontWeight: 600, color: '#52C41A', lineHeight: 1.1 }}>{kpi.taskCompletionRate.value}%</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>阈值 ≥ {kpi.taskCompletionRate.threshold}%</Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable style={{ ...kpiCardStyle, background: '#FFF1F0' }} bodyStyle={kpiCardBodyStyle}>
            <MetricLabel name="不合规回答率（P0 核心）" variant="kpi" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <Text strong style={{ fontSize: 28, fontWeight: 600, color: '#FF4D4F', lineHeight: 1.1 }}>{kpi.noncomplianceRate.value}%</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>阈值 ≤ {kpi.noncomplianceRate.threshold}%</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ③ Tab 内容区 */}
      <Card bordered={false} style={{ marginBottom: 16, overflow: 'hidden' }} bodyStyle={{ paddingTop: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'calls', label: <Space><RiseOutlined />调用与任务</Space>, children: callsTab },
            { key: 'quality', label: <Space><LockOutlined />内容输出质量</Space>, children: qualityTab },
            { key: 'feedback', label: <Space><StarOutlined />用户反馈与协同</Space>, children: feedbackTab },
          ]}
        />
      </Card>

      {/* ④ 右下角悬浮按钮：查看明细 */}
      <FloatButton
        icon={<BarChartOutlined />}
        tooltip="查看明细"
        type="primary"
        style={{ right: 24, bottom: 24 }}
        onClick={() => setDrawerOpen(true)}
      />

      {/* ⑤ 800px 宽右侧抽屉：业务指标明细表 */}
      <Drawer
        title="业务指标明细"
        placement="right"
        width={800}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {renderAdvancedFilter()}
        <ProTable<BusinessDetailRow>
          rowKey="agentId"
          actionRef={actionRef}
          search={false}
          columns={businessTableColumns}
          dataSource={mockBusinessDetailRows}
          pagination={{
            defaultPageSize: 20, showSizeChanger: true, showQuickJumper: true,
            pageSizeOptions: ['20', '50', '100'], showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1400 }}
          toolBarRender={() => [
            <Button key="reload" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>刷新</Button>,
          ]}
        />
      </Drawer>
    </div>
  );
};

export default Business;
