import { useRef, useState } from 'react';
import { Button, Card, Col, Row, Space, Table, Tag, Typography, message } from 'antd';
import { DownloadOutlined, EyeOutlined, FileTextOutlined, LeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import PageHeader from '../../components/PageHeader';
import { useDemoSettings } from '../../hooks/useDemoSettings';
import {
  alertOverviewKpiV18,
  businessKpiV18,
  costKpiV18,
  mockAlertEventsV18,
  statusKpiV18,
} from '../../mock/monitoringV18';

const { Text, Title, Paragraph } = Typography;

const MonitoringReport = () => {
  const navigate = useNavigate();
  const { demoRole } = useDemoSettings();
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const isItAdmin = demoRole === '信息科管理员';
  const scope = isItAdmin ? '全院' : '本科室';
  const templateName = isItAdmin
    ? '全院智能体运行监控情况报告模板.docx'
    : '科室智能体运行监控情况报告模板.docx';
  const title = `${scope}智能体运行监控情况报告`;
  const reportTitle = isItAdmin ? '全院智能体运行监控情况报告' : '科室智能体运行监控情况报告';
  const orgName = isItAdmin ? '××××医院' : '××××医院  ××科';
  const compileUnit = isItAdmin ? '信息科' : '××科（科室管理员）';
  const scopeText = isItAdmin ? '全院（含分院区）' : '本科室全部纳管智能体（示例：放射科）';
  const onlineRate = ((statusKpiV18.online / statusKpiV18.total) * 100).toFixed(1);
  const topAlerts = mockAlertEventsV18.slice(0, 4).map((item, index) => ({
    key: item.id,
    agent: item.agentName,
    level: index < 2 ? '高' : index === 2 ? '中' : '低',
    metric: item.triggerContent.trigger_condition.metric,
    status: item.status,
  }));

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 1.8,
        backgroundColor: '#FFFFFF',
        useCORS: true,
        logging: false,
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const image = canvas.toDataURL('image/jpeg', 0.92);
      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(image, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgHeight - heightLeft);
        pdf.addImage(image, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }
      pdf.save(`${title}_${new Date().toISOString().slice(0, 10)}.pdf`);
      message.success('已导出报告');
    } catch {
      message.error('PDF 报告下载失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: 24, background: '#F5F7FA', minHeight: '100%' }}>
      <PageHeader
        title={title}
        subTitle={`依据当前角色自动套用：${templateName}`}
        extra={(
          <Space>
            <Button icon={<LeftOutlined />} onClick={() => navigate('/app/home/overview')}>
              返回对话
            </Button>
            <Button icon={<EyeOutlined />} onClick={() => window.print()}>
              查看报告详情
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} loading={exporting} onClick={downloadPdf}>
              导出报告
            </Button>
          </Space>
        )}
      />

      <div ref={reportRef} style={{ maxWidth: 980, margin: '0 auto', background: '#FFFFFF', padding: 36 }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1677FF', paddingBottom: 24, marginBottom: 24 }}>
          <FileTextOutlined style={{ color: '#1677FF', fontSize: 34 }} />
          <Text type="secondary">{templateName.replace('.docx', '')}</Text>
          <Title level={2} style={{ marginTop: 12 }}>{reportTitle}</Title>
          <Space direction="vertical" size={2}>
            <Text>{orgName}</Text>
            <Text>统计周期：2026年1月1日 — 2026年6月30日</Text>
            <Text>统计范围：{scopeText}</Text>
            <Text>编制单位：{compileUnit} · 编制日期：2026年7月</Text>
          </Space>
        </div>

        <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
          <Title level={4} style={{ marginTop: 0 }}>目 录</Title>
          <Row gutter={[8, 8]}>
            {[
              `一、${isItAdmin ? '监控总体情况' : '科室监控总体情况'}`,
              '二、业务监控情况',
              '三、状态监控情况',
              '四、成本监控情况',
              '五、安全监控情况',
              '六、监控告警与处置情况',
              '七、报告总结',
            ].map((item) => (
              <Col span={12} key={item}><Text>{item}</Text></Col>
            ))}
          </Row>
          <Text type="secondary">提示：在 Word 中右键点击目录区域，选择“更新域”自动生成/刷新目录。</Text>
        </Card>

        <Title level={4}>一、{isItAdmin ? '监控总体情况' : '科室监控总体情况'}</Title>
        <Title level={5}>（一）总体监控概览</Title>
        <Row gutter={[12, 12]}>
          {[
            [isItAdmin ? '纳管智能体总数' : '科室纳管智能体', isItAdmin ? '42 个' : '8 个', '#1677FF'],
            ['累计调用次数', isItAdmin ? '126.8 万' : '28.6 万', '#13C2C2'],
            ['任务执行成功率', isItAdmin ? '96.8%' : '96.2%', '#52C41A'],
            ['智能体在线率', isItAdmin ? '85.7%' : '87.5%', '#FA8C16'],
            ['使用成本', isItAdmin ? '38.6 万元' : '8.2 万元', '#722ED1'],
          ].map(([label, value, color]) => (
            <Col span={isItAdmin ? 4 : 5} key={label}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <Text type="secondary">{label}</Text>
                <div style={{ color, fontSize: 24, fontWeight: 700, marginTop: 6 }}>{value}</div>
              </Card>
            </Col>
          ))}
        </Row>
        <Paragraph style={{ marginTop: 12 }}>
          口径：累计调用次数、任务执行成功率为统计周期累计值；在线率＝实时在线智能体数量÷纳管智能体总数；使用成本为统计周期内算力、许可、运维等各类成本之和。
        </Paragraph>
        <Paragraph>
          {isItAdmin
            ? '截至2026年6月30日，全院纳管智能体42个，统计周期内累计调用126.8万次，任务执行成功率96.8%，实时在线率85.7%，使用成本合计38.6万元。业务、状态、成本、安全四个维度监控指标总体处于受控区间，全院智能体运行平稳。'
            : '截至2026年6月30日，本科室纳管智能体8个，统计周期内累计调用28.6万次，任务执行成功率96.2%，实时在线率87.5%，使用成本合计8.2万元。科室智能体运行总体平稳，1个智能体当前处于异常状态，详见第三部分。'}
        </Paragraph>
        <Title level={5}>（二）监控告警维度分布</Title>
        <Table
          size="small"
          pagination={false}
          columns={[
            { title: '监控维度', dataIndex: 'dimension' },
            { title: '告警次数', dataIndex: 'count' },
            { title: '占比', dataIndex: 'rate' },
          ]}
          dataSource={[
            { key: 'biz', dimension: '业务监控', count: isItAdmin ? 30 : 6, rate: isItAdmin ? '44%' : '43%' },
            { key: 'status', dimension: '状态监控', count: isItAdmin ? 21 : 4, rate: isItAdmin ? '31%' : '29%' },
            { key: 'cost', dimension: '成本监控', count: isItAdmin ? 9 : 2, rate: isItAdmin ? '13%' : '14%' },
            { key: 'safe', dimension: '安全监控', count: isItAdmin ? 8 : 2, rate: isItAdmin ? '12%' : '14%' },
          ]}
        />

        <Title level={4}>二、业务监控情况</Title>
        <Table
          size="small"
          pagination={false}
          columns={[
            { title: '章节', dataIndex: 'section' },
            { title: '核心指标', dataIndex: 'metric' },
            { title: '本期情况', dataIndex: 'summary' },
          ]}
          dataSource={[
            { key: 'task', section: '（一）任务执行情况', metric: '任务执行成功率、任务中断率、自助解决率', summary: isItAdmin ? '成功率96.8%，中断率2.1%，自助解决率83.5%。' : '成功率96.2%，中断率2.4%，自助解决率81.9%。' },
            { key: 'call', section: '（二）调用情况', metric: '累计调用次数、当日调用次数、TOP占比', summary: isItAdmin ? '累计调用126.8万次，当日调用1.12万次，TOP10占比71%。' : '累计调用28.6万次，当日调用2560次，TOP1占比43%。' },
            { key: 'perf', section: '（三）响应性能', metric: '平均响应时间、P95/P99、超时率、并发、吞吐量', summary: isItAdmin ? '平均1.7秒，P95 4.0秒，P99 6.2秒，超时率0.9%。' : '平均1.8秒，P95 4.1秒，P99 6.2秒，超时率1.1%。' },
            { key: 'tool', section: '（四）任务链路与工具调用质量', metric: '推理步数、工具调用时延、工具执行成功率、知识库命中率', summary: isItAdmin ? '推理4.6步，工具时延320毫秒，知识库命中率88.7%。' : '推理4.2步，工具时延290毫秒，知识库命中率90.2%。' },
            { key: 'adopt', section: '（五）医生采纳与用户满意度', metric: '医生采纳率、用户满意度', summary: isItAdmin ? '医生采纳率76.4%，用户满意度4.6分。' : '医生采纳率76.8%，用户满意度4.5分。' },
          ]}
        />

        <Title level={4}>三、状态监控情况</Title>
        <Paragraph>
          {isItAdmin
            ? `截至报告导出时，全院42个纳管智能体中在线36个、离线2个、异常2个、禁用2个；累计异常智能体4个，平均异常持续时长38分钟。在线率实时值 ${onlineRate}%（系统当前监控口径）。`
            : '截至报告导出时，科室8个智能体中在线7个、异常1个，无离线、禁用智能体。当前异常智能体为影像质控助手，因PACS接口网关超时导致质控任务响应失败。'}
        </Paragraph>
        {!isItAdmin && (
          <Table
            size="small"
            pagination={false}
            columns={[
              { title: '智能体名称', dataIndex: 'agent' },
              { title: '当前状态', dataIndex: 'status' },
              { title: '本期异常次数', dataIndex: 'abnormal' },
              { title: '处理情况', dataIndex: 'handle' },
            ]}
            dataSource={[
              { key: 'a', agent: '影像报告解读助手', status: '在线', abnormal: 1, handle: '已恢复' },
              { key: 'b', agent: '影像质控助手', status: '异常', abnormal: 2, handle: '处置中' },
              { key: 'c', agent: '危急值提醒助手', status: '在线', abnormal: 0, handle: '—' },
              { key: 'd', agent: '检查预约助手', status: '在线', abnormal: 0, handle: '—' },
            ]}
          />
        )}

        <Title level={4}>四、成本监控情况</Title>
        <Paragraph>
          {isItAdmin
            ? '单次会话平均成本0.31元、单任务平均成本0.42元，使用成本合计38.6万元。CPU累计使用4.2万核·时、GPU累计使用1.8万卡·时、内存累计使用8.6万GB·时；Token累计使用12.5亿。'
            : `单次会话平均成本0.29元、单任务平均成本0.38元，使用成本合计8.2万元。科室GPU当日使用率74.2%，Token累计使用2.6亿；系统当前今日Token监控值为 ${costKpiV18.token.today.toLocaleString()}。`}
        </Paragraph>

        <Title level={4}>五、安全监控情况</Title>
        <Table
          size="small"
          pagination={false}
          columns={[
            { title: '安全维度', dataIndex: 'dimension' },
            { title: '监控指标', dataIndex: 'metric' },
            { title: '本期值', dataIndex: 'value' },
            { title: '管理目标', dataIndex: 'target' },
            { title: '达标情况', dataIndex: 'result' },
          ]}
          dataSource={[
            { key: 'p', dimension: '输入安全', metric: 'Prompt注入攻击成功率', value: isItAdmin ? '0.02%' : '0.01%', target: '≤0.1%', result: '达标' },
            { key: 'h', dimension: '输出安全', metric: '幻觉检测率', value: isItAdmin ? '1.8%' : '1.6%', target: '≤2.0%', result: '达标' },
            { key: 'c', dimension: '输出安全', metric: '输出内容合规率', value: isItAdmin ? '99.6%' : '99.7%', target: '≥99.5%', result: '达标' },
            { key: 'd', dimension: '数据安全', metric: 'PHI/PII泄露率', value: '0', target: '0', result: '达标' },
          ]}
        />

        <Title level={4}>六、监控告警与处置情况</Title>
        <Space size={8} wrap style={{ marginBottom: 12 }}>
          <Tag color="orange">告警次数 {isItAdmin ? 68 : 14}</Tag>
          <Tag color="red">故障次数 {isItAdmin ? 3 : 1}</Tag>
          <Tag color="blue">平均恢复 {isItAdmin ? 42 : 35} 分钟</Tag>
          <Tag color="green">系统当前已处理 {alertOverviewKpiV18.handled}</Tag>
        </Space>
        <Table
          size="small"
          pagination={false}
          columns={[
            { title: '智能体', dataIndex: 'agent' },
            { title: '级别', dataIndex: 'level', render: (v) => <Tag color={v === '高' ? 'red' : 'orange'}>{v}</Tag> },
            { title: '触发指标', dataIndex: 'metric' },
            { title: '当前状态', dataIndex: 'status' },
          ]}
          dataSource={topAlerts}
        />

        <Title level={4}>七、报告总结</Title>
        <Title level={5}>（一）存在的问题</Title>
        <Paragraph>
          {isItAdmin
            ? '一是高峰期性能余量不足；二是知识库支撑能力偏弱；三是算力与Token成本增长较快；四是个别安全细项需持续关注。'
            : '一是头部智能体依赖度高；二是部分智能体采纳率偏低；三是GPU配额余量收窄；四是影像质控助手异常尚未闭环。'}
        </Paragraph>
        <Title level={5}>（二）下一步工作建议</Title>
        <Paragraph>
          {isItAdmin
            ? '建议实施高峰期资源保障专项、开展知识库补链行动、完善成本配额管理、强化安全纵深防御。'
            : '建议配合信息科完成接口治理与性能优化，组织低采纳率智能体使用反馈评议，提交GPU配额评估申请，并持续落实高度关注类智能体输出人工复核。'}
        </Paragraph>

        <Paragraph style={{ textAlign: 'right' }}>
          {isItAdmin ? '××××医院信息科' : '××××医院××科（科室管理员）'}
          <br />
          2026年7月×日
        </Paragraph>

        <Title level={4}>{isItAdmin ? '附1：监控指标体系及口径说明' : '附：编制说明'}</Title>
        <Paragraph>
          {isItAdmin
            ? '全院智能体监控指标体系分为业务、状态、成本、安全四个维度，共70项指标，指标数据由智能体管理平台自动采集与计算。'
            : '本报告由智能体管理平台按科室范围一键生成，面向科室管理员，数据范围为本科室全部纳管智能体，统计周期与筛选条件见封面；监控指标体系与口径同《全院智能体运行监控情况报告》附1。'}
        </Paragraph>
      </div>
    </div>
  );
};

export default MonitoringReport;
