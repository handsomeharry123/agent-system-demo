/**
 * 8-1 安全治理总览 (V1.3)
 * 上半部 · 风险大盘:
 *   区域 1 - 4 卡片:全部事件 / 待处理 / 处理中 / 本月已关闭
 *   区域 2 - 6 维 V1.2 卡片:题头 + 大数字 + 三色比例条 + 读数行
 *   区域 3 - 六维风险雷达图 + 近 30 天安全事件趋势
 *
 * 下半部 · 六维度风险监测 (V1.3 新增):
 *   顶部 Tab 切换 6 维度（系统/网络/身份/数据/模型/应用）
 *   每个 Tab 显示该维度的检查项列表（名称 / 风险等级 / 检查结果 / 频率 / 最近检查 / 受影响智能体数 / 操作）
 *   支持手动触发检查；点击检查项打开详情抽屉（描述 / 最近检查明细 / 处置建议 / 历史记录）
 *   抽屉底部「编辑策略」按钮 → 8-3 治理规则管理（带当前维度参数跳转）
 *
 * URL 协议(跳 8-2 EventManage):
 *   ?tab=all                                                全部事件
 *   ?tab=all&status=待处理                                  待处理
 *   ?tab=all&status=处理中                                  处理中
 *   ?tab=all&status=closed_or_ignored&month=current         本月已关闭
 *   ?tab=all&dimension={dim}&status=active                  6 维卡片主区:维度+未关闭
 *   ?tab=all&dimension={dim}&status=active&level={lv}       6 维卡片读数行:再叠加级别
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Typography,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Drawer,
  Tooltip,
  message,
  Timeline,
  Empty,
} from 'antd';
import {
  SafetyOutlined,
  GlobalOutlined,
  LockOutlined,
  DatabaseOutlined,
  RobotOutlined,
  AppstoreOutlined,
  AlertOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  EditOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { Radar, Line } from '@ant-design/charts';
import PageHeader from '../../components/PageHeader';
import {
  dimensionScores,
  alertEventTrend,
  getDimensionEventStats,
  getEventOverviewStatsV12,
  getCheckItemsByDimension,
} from '../../mock/security';
import {
  dimensionColor,
  checkItemLevelColor,
  checkItemResultColor,
  type SecurityDimension,
  type EventLevel,
  type CheckItem,
  type CheckItemLevel,
  type CheckItemResult,
} from '../../types/security';

const { Text, Paragraph } = Typography;

// 6 维索引 - 大盘卡片用
const dimensionMeta: Record<SecurityDimension, { color: string; icon: React.ReactNode }> = {
  系统: { color: dimensionColor.系统, icon: <SafetyOutlined /> },
  网络: { color: dimensionColor.网络, icon: <GlobalOutlined /> },
  身份: { color: dimensionColor.身份, icon: <LockOutlined /> },
  数据: { color: dimensionColor.数据, icon: <DatabaseOutlined /> },
  模型: { color: dimensionColor.模型, icon: <RobotOutlined /> },
  应用: { color: dimensionColor.应用, icon: <AppstoreOutlined /> },
};

const allDimensions: SecurityDimension[] = ['系统', '网络', '身份', '数据', '模型', '应用'];

// 事件级别 token
const levelColorToken: Record<EventLevel, string> = {
  紧急: '#FF4D4F',
  重要: '#FA8C16',
  一般: '#1677FF',
};
const levelStatKey: Record<EventLevel, 'urgent' | 'important' | 'normal'> = {
  紧急: 'urgent',
  重要: 'important',
  一般: 'normal',
};

// V1.3:可在本模块自配的维度(可跳「编辑策略」 → 8-3)
const SELF_CONFIG_DIMS: SecurityDimension[] = ['系统', '网络'];

const Overview = () => {
  const navigate = useNavigate();

  // ====== 上半部数据 ======
  const overviewStats = useMemo(() => getEventOverviewStatsV12(), []);
  const dimensionEventStats = useMemo(() => getDimensionEventStats(), []);

  // ====== 下半部 · 六维度风险监测(V1.3) ======
  const [activeDim, setActiveDim] = useState<SecurityDimension>('系统');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<CheckItem | null>(null);
  // 手动触发检查 loading 标记(按维度)
  const [checkingDim, setCheckingDim] = useState<SecurityDimension | null>(null);

  const currentCheckItems = useMemo(
    () => getCheckItemsByDimension(activeDim),
    [activeDim],
  );

  // ====== 区域 3:雷达 / 折线 配置(保持不变) ======
  const radarConfig = {
    data: dimensionScores.map((d) => ({ dimension: d.dimension, value: d.score })),
    xField: 'dimension',
    yField: 'value',
    color: '#1677FF',
    area: { style: { fill: '#1677FF33' } },
    yAxis: { min: 0, max: 100 },
  };
  const trendConfig = {
    data: alertEventTrend,
    xField: 'timestamp',
    yField: 'value',
    smooth: true,
    color: '#FA8C16',
    point: { size: 2, shape: 'circle' },
    area: { style: { fill: 'l(270) 0:#FA8C1600 1:#FA8C1633' } },
    yAxis: { min: 0, label: { formatter: (v: string) => `${v}件` } },
  };

  // 手动触发检查(V1.3)
  const handleManualCheck = (dim: SecurityDimension) => {
    setCheckingDim(dim);
    message.loading({ content: `正在触发「${dim}风险」检查...`, key: 'manual-check', duration: 0 });
    setTimeout(() => {
      setCheckingDim(null);
      message.success({ content: `${dim}风险检查已完成，共扫描 ${getCheckItemsByDimension(dim).length} 项`, key: 'manual-check' });
    }, 1200);
  };

  // 列定义 - 下半部检查项表格
  const checkColumns = [
    {
      title: '检查项名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (_: string, r: CheckItem) => (
        <a onClick={() => { setSelectedCheck(r); setDrawerOpen(true); }}>
          <Space size={4} wrap>
            <Text strong>{r.name}</Text>
            <Text type="secondary" code style={{ fontSize: 11 }}>{r.id}</Text>
          </Space>
        </a>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (l: CheckItemLevel) => <Tag color={checkItemLevelColor[l]}>{l}</Tag>,
    },
    {
      title: '检查结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (r: CheckItemResult) => <Tag color={checkItemResultColor[r]}>{r}</Tag>,
    },
    {
      title: '检查频率',
      dataIndex: 'frequency',
      key: 'frequency',
      width: 100,
    },
    {
      title: '最近检查时间',
      dataIndex: 'lastCheckTime',
      key: 'lastCheckTime',
      width: 150,
      render: (t: string) => <Text type="secondary">{t}</Text>,
    },
    {
      title: '受影响智能体数',
      dataIndex: 'affectedAgentCount',
      key: 'affectedAgentCount',
      width: 130,
      render: (n: number) => (
        <Text type={n > 0 ? 'danger' : 'secondary'}>{n}</Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, r: CheckItem) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedCheck(r); setDrawerOpen(true); }}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      <PageHeader
        title="统一安全治理中心"
        subTitle="六维安全风险总览 · 全维度态势感知"
        breadcrumb={[
          { path: '/app/security', breadcrumbName: '统一安全治理中心' },
          { path: '/app/security', breadcrumbName: '安全治理总览' },
        ]}
      />

      {/* ===== 上半部 · 风险大盘 ===== */}
      {/* 区域 1:安全事件统计 V1.2(4 卡片) */}
      <Row gutter={[16, 16]} style={{ marginTop: 16, marginBottom: 16 }}>
        {/* 1. 全部事件 */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() => navigate('/app/security/events?tab=all')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: 8,
                  background: '#E6F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                <AlertOutlined style={{ color: '#1677FF' }} />
              </div>
              <div>
                <Text type="secondary">全部事件</Text>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#1677FF' }}>{overviewStats.total}</div>
              </div>
            </div>
          </Card>
        </Col>
        {/* 2. 待处理事件 */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() => navigate('/app/security/events?tab=all&status=待处理')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: 8,
                  background: '#FFF2E8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                <ClockCircleOutlined style={{ color: '#FF4D4F' }} />
              </div>
              <div>
                <Text type="secondary">待处理事件</Text>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#FF4D4F' }}>{overviewStats.pending}</div>
              </div>
            </div>
          </Card>
        </Col>
        {/* 3. 处理中的事件 */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() => navigate('/app/security/events?tab=all&status=处理中')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: 8,
                  background: '#FFFBE6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                <SyncOutlined style={{ color: '#FAAD14' }} />
              </div>
              <div>
                <Text type="secondary">处理中的事件</Text>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#FAAD14' }}>{overviewStats.processing}</div>
              </div>
            </div>
          </Card>
        </Col>
        {/* 4. 本月已关闭 */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() => navigate('/app/security/events?tab=all&status=closed_or_ignored&month=current')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: 8,
                  background: '#F6FFED', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                <CheckCircleOutlined style={{ color: '#52C41A' }} />
              </div>
              <div>
                <Text type="secondary">本月已关闭</Text>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#52C41A' }}>{overviewStats.closedThisMonth}</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 区域 2:六维 V1.3 卡片(题头 + 大数字 + 读数 chip) */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {allDimensions.map((dim) => {
          const meta = dimensionMeta[dim];
          const stat = dimensionEventStats[dim];
          const total = stat.urgent + stat.important + stat.normal;
          const isEmpty = total === 0;

          // 0 态:数字用浅灰;有事件:用对应级别主色
          const mainColor = isEmpty
            ? 'rgba(0,0,0,0.25)'
            : stat.urgent > 0
              ? levelColorToken.紧急
              : stat.important > 0
                ? levelColorToken.重要
                : levelColorToken.一般;

          // 卡片底色:白底(对齐上方 4 卡片),带左侧 4px 维度色条
          const cardStyle: React.CSSProperties = {
            background: '#FFFFFF',
            borderLeft: `4px solid ${meta.color}`,
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            transition: 'box-shadow .2s ease, transform .2s ease',
          };

          // 维度副标(让卡片有"语义",不再只是"系统风险"四个字)
          const dimSubtitle: Record<SecurityDimension, string> = {
            系统: '主机 · 中间件 · 配置',
            网络: '流量 · 端口 · 入侵',
            身份: '账号 · 权限 · 越权',
            数据: '资产 · 合规 · 流转',
            模型: '推理 · 越狱 · 幻觉',
            应用: 'API · 接口 · 调用',
          };

          return (
            <Col xs={12} sm={8} lg={4} key={dim}>
              <Card
                hoverable
                style={cardStyle}
                bodyStyle={{ padding: '14px 16px' }}
                onClick={() =>
                  navigate(
                    `/app/security/events?tab=all&dimension=${encodeURIComponent(dim)}&status=active`,
                  )
                }
              >
                {/* 行 1:题头 - 维度色图标块 + 标题(对齐上方 4 卡片视觉强度) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: `${meta.color}1F`,
                      color: meta.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      flex: '0 0 auto',
                    }}
                  >
                    {meta.icon}
                  </div>
                  <Text strong style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>
                    {dim}风险
                  </Text>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(0,0,0,0.45)',
                    marginBottom: 14,
                    letterSpacing: 0.2,
                  }}
                >
                  {dimSubtitle[dim]}
                </div>

                {/* 行 2:大数字 44px + "件" 12px;0 态用浅灰 */}
                <div style={{ marginBottom: 14, lineHeight: 1, display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontSize: 44,
                      fontWeight: 600,
                      color: mainColor,
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      fontFeatureSettings: '"tnum"',
                      letterSpacing: -0.5,
                    }}
                  >
                    {total}
                  </span>
                  <span
                    style={{
                      marginLeft: 4,
                      fontSize: 12,
                      color: isEmpty ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.55)',
                    }}
                  >
                    {isEmpty ? '件 · 无风险' : '件'}
                  </span>
                </div>

                {/* 行 3:三色读数 chip - 0 态空心灰;有事件按级别实心 */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['紧急', '重要', '一般'] as EventLevel[]).map((lv) => {
                    const n = stat[levelStatKey[lv]];
                    const lvlColor = levelColorToken[lv];
                    const hasEvent = n > 0;
                    return (
                      <span
                        key={lv}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/app/security/events?tab=all&dimension=${encodeURIComponent(
                              dim,
                            )}&status=active&level=${encodeURIComponent(lv)}`,
                          );
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 11,
                          lineHeight: '16px',
                          cursor: 'pointer',
                          background: hasEvent ? `${lvlColor}14` : 'transparent',
                          color: hasEvent ? lvlColor : 'rgba(0,0,0,0.35)',
                          border: hasEvent ? `1px solid ${lvlColor}33` : '1px solid rgba(0,0,0,0.08)',
                          transition: 'all .15s ease',
                        }}
                      >
                        <span
                          style={{
                            width: hasEvent ? 6 : 4,
                            height: hasEvent ? 6 : 4,
                            borderRadius: '50%',
                            background: hasEvent ? lvlColor : 'rgba(0,0,0,0.25)',
                            display: 'inline-block',
                          }}
                        />
                        <span>{lv}</span>
                        <span
                          style={{
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            color: hasEvent ? lvlColor : 'rgba(0,0,0,0.45)',
                          }}
                        >
                          {n}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* ===== 区域 3:风险趋势图表 ===== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="六维安全雷达图" style={{ height: 340 }}>
            <div style={{ height: 260 }}>
              <Radar {...radarConfig} style={{ height: '100%' }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="近 30 天安全事件趋势" style={{ height: 340 }}>
            <div style={{ height: 260 }}>
              <Line {...trendConfig} style={{ height: '100%' }} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* ===== 下半部 · 六维度风险监测 (V1.3 新增) ===== */}
      <Card
        title={
          <Space size={8}>
            <Text strong style={{ fontSize: 16 }}>六维度风险监测</Text>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
              Tab 切换 6 维度 · 查看检查项与详情 · 支持手动触发检查
            </Text>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined spin={checkingDim === activeDim} />}
              loading={checkingDim === activeDim}
              onClick={() => handleManualCheck(activeDim)}
            >
              手动触发「{activeDim}风险」检查
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeDim}
          onChange={(k) => setActiveDim(k as SecurityDimension)}
          items={allDimensions.map((dim) => {
            const meta = dimensionMeta[dim];
            const items = getCheckItemsByDimension(dim);
            return {
              key: dim,
              label: (
                <Space size={6}>
                  <span style={{ color: meta.color }}>{meta.icon}</span>
                  <span>{dim}风险</span>
                  <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>{items.length} 项</Tag>
                </Space>
              ),
            };
          })}
        />

        <Table
          rowKey="id"
          size="middle"
          columns={checkColumns as any}
          dataSource={currentCheckItems}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1000 }}
          locale={{
            emptyText: <Empty description={`「${activeDim}风险」暂无检查项`} />,
          }}
        />
      </Card>

      {/* 下半部 · 检查项详情抽屉 */}
      <Drawer
        title={selectedCheck ? `检查项详情 · ${selectedCheck.name}` : '检查项详情'}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedCheck(null); }}
        width={640}
        extra={
          selectedCheck && (
            <Space>
              {SELF_CONFIG_DIMS.includes(selectedCheck.dimension) ? (
                <Tooltip title="跳转 8-3 治理规则管理(对应维度 Tab)">
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() =>
                      navigate(`/app/security/rules?dimension=${encodeURIComponent(selectedCheck.dimension)}`)
                    }
                  >
                    编辑策略
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip title="该维度规则在源模块或监控中心配置">
                  <Button
                    icon={<LinkOutlined />}
                    onClick={() =>
                      navigate(`/app/security/rules?dimension=${encodeURIComponent(selectedCheck.dimension)}`)
                    }
                  >
                    去规则管理查看
                  </Button>
                </Tooltip>
              )}
            </Space>
          )
        }
      >
        {selectedCheck && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card size="small" title="基本信息">
              <Space wrap size={8}>
                <Tag color={dimensionColor[selectedCheck.dimension]}>{selectedCheck.dimension}风险</Tag>
                <Tag color={checkItemLevelColor[selectedCheck.level]}>{selectedCheck.level}</Tag>
                <Tag color={checkItemResultColor[selectedCheck.result]}>{selectedCheck.result}</Tag>
                <Text type="secondary" code style={{ fontSize: 12 }}>{selectedCheck.id}</Text>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">检查频率：</Text><Text>{selectedCheck.frequency}</Text>
              </div>
              <div>
                <Text type="secondary">最近检查时间：</Text><Text>{selectedCheck.lastCheckTime}</Text>
              </div>
              <div>
                <Text type="secondary">受影响智能体数：</Text>
                <Text type={selectedCheck.affectedAgentCount > 0 ? 'danger' : undefined}>
                  {selectedCheck.affectedAgentCount}
                </Text>
              </div>
              {selectedCheck.agentName && selectedCheck.agentName !== '—' && (
                <div>
                  <Text type="secondary">关联智能体：</Text><Text>{selectedCheck.agentName}</Text>
                </div>
              )}
            </Card>

            <Card size="small" title="规则说明">
              <Paragraph style={{ marginBottom: 0 }}>{selectedCheck.description}</Paragraph>
            </Card>

            <Card size="small" title="最近检查结果明细">
              <Paragraph style={{ marginBottom: 0 }}>{selectedCheck.lastCheckDetail}</Paragraph>
            </Card>

            <Card size="small" title="处置建议">
              <Paragraph style={{ marginBottom: 0 }}>{selectedCheck.suggestion}</Paragraph>
            </Card>

            <Card size="small" title="历史检查记录">
              {selectedCheck.history.length === 0 ? (
                <Text type="secondary">暂无历史记录</Text>
              ) : (
                <Timeline
                  items={selectedCheck.history.map((h) => ({
                    color: checkItemResultColor[h.result] === 'success' ? 'green' : checkItemResultColor[h.result] === 'error' ? 'red' : 'gray',
                    children: (
                      <Space direction="vertical" size={2}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{h.time}</Text>
                        <Space>
                          <Tag color={checkItemResultColor[h.result]}>{h.result}</Tag>
                          <Text>{h.summary}</Text>
                        </Space>
                      </Space>
                    ),
                  }))}
                />
              )}
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default Overview;
