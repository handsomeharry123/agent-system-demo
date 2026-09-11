/**
 * 统一台账中心 - 智能化升级 Demo
 * §3.3 报告总结(报告生成 + 在线编辑 + 导出)
 *
 * 依据《台账中心智能化升级-需求说明V1》§3.3：
 *   - §3.3.1 总览报告入口:一键生成
 *   - §3.3.2 报告内容规则:11 大模块(建设概况 / 关联资源对接 / 准入评测 / 运行健康 / 问题与建议)
 *   - §3.3.3 报告编辑页:在线编辑 + 自动保存草稿 + 导出 Word/PDF(导出即完成)
 *
 * V1.1 升级要点(2026-07-03):
 *   - 报告草稿自动保存到 localStorage(per-scope 隔离),刷新不丢失
 *   - 导出 PDF:用 jspdf + html2canvas 把报告 DOM 节点 切片成多页 PDF(已对齐 ReportPdf 模式)
 *   - 导出 Word:把报告文本按结构化 HTML 写入 .doc(MS Word 可直接打开)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Statistic,
  Tooltip,
  Divider,
  Input,
  Empty,
  Dropdown,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EditOutlined,
  CheckOutlined,
  CloudSyncOutlined,
  BarChartOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import { useAuth } from '../../../hooks/useAuth';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ============ 报告类型 ============
type SectionType =
  | 'cover'
  | 'toc'
  | 'title'
  | 'h2'
  | 'h3'
  | 'p'
  | 'kpi'
  | 'chart'
  | 'table'
  | 'matrix'
  | 'colophon'
  | 'quote';

interface ReportNode {
  id: string;
  type: SectionType;
  // 文本内容(p/h2/h3/quote/title 用)
  text?: string;
  // 批注列表
  comments: { id: string; author: string; text: string }[];
  // KPI 节点:多组指标
  kpis?: Array<{ label: string; value: string; unit?: string; color?: string }>;
  // 图表节点
  chart?: {
    title: string;
    chartType: 'bar' | 'pie' | 'line';
    data: Array<{ name: string; value: number }>;
  };
  // 表格节点
  table?: {
    title: string;
    headers: string[];
    rows: Array<{ key: string; cells: string[] }>;
  };
  // 矩阵热力图(对接矩阵)
  matrix?: {
    title: string;
    rows: string[];
    cols: string[];
    data: number[][];
    legend?: string;
  };
  // 封面节点
  cover?: {
    hospital: string;
    reportTitle: string;
    deptName: string;
    period: string;
    generatedBy: string;
    reportDate: string;
    templateNote: string;
  };
  // 目录节点
  toc?: {
    items: Array<{ anchor: string; label: string }>;
  };
  // 编制说明
  colophon?: {
    generator: string;
    reportDate: string;
    note: string;
  };
}

// ============ 默认报告草稿(全院智能体管理情况) ============
// §3.3 信息科管理员草稿(原 buildDraft 改名,语义更清晰)
const buildPlatformDraft = (): ReportNode[] => [
  {
    id: 'n1',
    type: 'title',
    text: '全院智能体运行管理情况报告',
    comments: [],
  },
  {
    id: 'n2',
    type: 'p',
    text:
      '本报告基于统一台账中心 2026 年上半年(2026-01-01 至 2026-06-30)聚合数据,覆盖接入中心、准入评测沙盒、统一运行监控中心及院内数据系统,用于向院领导及上级主管部门汇报全院智能体建设与运行情况。',
    comments: [],
  },
  // ===== §1 全院智能体总体建设情况 =====
  {
    id: 'n3',
    type: 'h2',
    text: '一、全院智能体总体建设情况',
    comments: [],
  },
  // (一)总体规模与关键指标
  {
    id: 'n3-1',
    type: 'h3',
    text: '(一)总体规模与关键指标',
    comments: [],
  },
  {
    id: 'n4',
    type: 'kpi',
    kpis: [
      { label: '纳管智能体总数', value: '42', unit: '个', color: '#1677FF' },
      { label: '总调用量', value: '126.8', unit: '万', color: '#13C2C2' },
      { label: '科室覆盖率', value: '68.4', unit: '%', color: '#722ED1' },
      { label: '正常运行率', value: '95.2', unit: '%', color: '#52C41A' },
      { label: '使用成本', value: '38.6', unit: '万元', color: '#FA8C16' },
    ],
    comments: [],
  },
  {
    id: 'n4-note',
    type: 'quote',
    text:
      '口径:使用成本为统计周期内智能体所耗费的算力、许可、运维等各类成本之和;正常运行率 = 状态非异常、禁用的智能体数量 ÷ 总数。',
    comments: [],
  },
  {
    id: 'n4-p',
    type: 'p',
    text:
      '截至 2026 年 6 月 30 日,全院累计纳管智能体 42 个,覆盖 54 个科室,科室覆盖率 68.4%;统计周期内总调用量 126.8 万次,正常运行率 95.2%,使用成本合计 38.6 万元。全院智能体应用规模持续扩大,运行总体平稳。',
    comments: [],
  },
  // (二)调用量趋势
  {
    id: 'n3-2',
    type: 'h3',
    text: '(二)调用量趋势',
    comments: [],
  },
  {
    id: 'n6',
    type: 'chart',
    chart: {
      title: '图 1-1 全院智能体月度调用量趋势(万次)',
      chartType: 'line',
      data: [
        { name: '1月', value: 14.2 },
        { name: '2月', value: 16.8 },
        { name: '3月', value: 19.5 },
        { name: '4月', value: 22.4 },
        { name: '5月', value: 25.1 },
        { name: '6月', value: 28.8 },
      ],
    },
    comments: [],
  },
  {
    id: 'n6-p',
    type: 'p',
    text:
      '统计周期内月度调用量由 1 月的 14.2 万次增长至 6 月的 28.8 万次,累计增长 102.8%,月均环比增长 15.2%,反映智能体应用已逐步融入日常诊疗与管理流程。',
    comments: [],
  },
  // (三)纳管智能体数量趋势
  {
    id: 'n3-3',
    type: 'h3',
    text: '(三)纳管智能体数量趋势',
    comments: [],
  },
  {
    id: 'n6b',
    type: 'chart',
    chart: {
      title: '图 1-2 每月新增纳管智能体数量(个)',
      chartType: 'bar',
      data: [
        { name: '1月', value: 4 },
        { name: '2月', value: 3 },
        { name: '3月', value: 5 },
        { name: '4月', value: 8 },
        { name: '5月', value: 6 },
        { name: '6月', value: 9 },
      ],
    },
    comments: [],
  },
  {
    id: 'n6b-p',
    type: 'p',
    text:
      '上半年累计新增纳管智能体 35 个,其中 4 月、6 月为接入高峰,分别新增 8 个、9 个,主要来自影像、检验等医技科室的批量接入。',
    comments: [],
  },
  // (四)科室分布情况
  {
    id: 'n3-4',
    type: 'h3',
    text: '(四)科室分布情况',
    comments: [],
  },
  {
    id: 'n7',
    type: 'chart',
    chart: {
      title: '图 1-3 智能体科室分布(个)',
      chartType: 'bar',
      data: [
        { name: '放射科', value: 8 },
        { name: '检验科', value: 6 },
        { name: '心内科', value: 5 },
        { name: '呼吸科', value: 5 },
        { name: '药剂科', value: 4 },
        { name: '病理科', value: 3 },
        { name: '超声科', value: 3 },
        { name: '急诊科', value: 2 },
        { name: '内分泌科', value: 2 },
        { name: '其他', value: 4 },
      ],
    },
    comments: [],
  },
  {
    id: 'n7-p',
    type: 'p',
    text:
      '智能体主要集中于放射科(8 个)、检验科(6 个)等医技科室,合计占比 33.3%;心内科、呼吸科等临床科室各 5 个。全院尚有 25 个科室未接入智能体,临床科室覆盖率仍有提升空间。',
    comments: [],
  },
  // (五)诊疗环节分布情况
  {
    id: 'n3-5',
    type: 'h3',
    text: '(五)诊疗环节分布情况',
    comments: [],
  },
  {
    id: 'n8',
    type: 'chart',
    chart: {
      title: '图 1-4 智能体诊疗环节分布(占比)',
      chartType: 'pie',
      data: [
        { name: '辅助诊断', value: 10 },
        { name: '辅助检查', value: 7 },
        { name: '辅助治疗', value: 5 },
        { name: '导诊分诊', value: 4 },
        { name: '预问诊', value: 3 },
        { name: '预约挂号', value: 2 },
        { name: '病历生成', value: 4 },
        { name: '用药审核', value: 4 },
        { name: '手术辅助', value: 2 },
        { name: '其他', value: 1 },
      ],
    },
    comments: [],
  },
  {
    id: 'n8-p',
    type: 'p',
    text:
      '按诊疗环节划分,辅助诊断类智能体最多(10 个,占 24%),其次为辅助检查类(7 个,占 17%)与辅助治疗类(5 个,占 12%);导诊分诊、预问诊、预约挂号等诊前环节合计 9 个(占 21%)。手术辅助环节智能体仅 2 个,可结合外科手术管理需求适度补强。',
    comments: [],
  },
  // (六)来源分布情况
  {
    id: 'n3-6',
    type: 'h3',
    text: '(六)来源分布情况',
    comments: [],
  },
  {
    id: 'n9',
    type: 'chart',
    chart: {
      title: '图 1-5 智能体来源分布(个)',
      chartType: 'pie',
      data: [
        { name: '第三方', value: 26 },
        { name: '自研', value: 9 },
        { name: '合作研发', value: 7 },
      ],
    },
    comments: [],
  },
  {
    id: 'n9-p',
    type: 'p',
    text:
      '第三方厂商产品 26 个(占 62%)、自研 9 个(占 21%)、合作研发 7 个(占 17%)。第三方产品占比较高,建议持续加强供应商服务质量考核与交付验收管理,同时培育院内自研能力。',
    comments: [],
  },
  // (七)风险分级情况
  {
    id: 'n3-7',
    type: 'h3',
    text: '(七)风险分级情况',
    comments: [],
  },
  {
    id: 'n10',
    type: 'chart',
    chart: {
      title: '图 1-6 智能体风险分级分布(个)',
      chartType: 'bar',
      data: [
        { name: '高度关注', value: 5 },
        { name: '中度关注', value: 14 },
        { name: '一般关注', value: 23 },
      ],
    },
    comments: [],
  },
  {
    id: 'n10-p',
    type: 'p',
    text:
      '按平台风险分级管理办法,高度关注类智能体 5 个(占 12%),均为直接参与临床决策类,已全部落实输出内容人工复核机制;中度关注类 14 个(占 33%)、一般关注类 23 个(占 55%)。本期无风险等级上调事项。',
    comments: [],
  },
  // (八)高频调用智能体排行(TOP10)
  {
    id: 'n3-8',
    type: 'h3',
    text: '(八)高频调用智能体排行(TOP10)',
    comments: [],
  },
  {
    id: 'n10b',
    type: 'table',
    table: {
      title: '表 1 · 高频调用智能体 TOP10(日均调用次数,标注所属科室)',
      headers: ['排名', '智能体', '所属科室', '日均调用次数'],
      rows: [
        { key: 'top1', cells: ['1', '影像报告解读助手', '放射科', '4,200'] },
        { key: 'top2', cells: ['2', '检验结果解读助手', '检验科', '3,860'] },
        { key: 'top3', cells: ['3', '预问诊助手', '门诊部', '2,950'] },
        { key: 'top4', cells: ['4', '心电智能分析系统', '心内科', '2,140'] },
        { key: 'top5', cells: ['5', '用药审核助手', '药剂科', '1,820'] },
        { key: 'top6', cells: ['6', '病历质控助手', '医务科', '1,640'] },
        { key: 'top7', cells: ['7', '冠脉 CTA 评估助手', '心内科', '1,420'] },
        { key: 'top8', cells: ['8', '肺结节智能筛查系统', '放射科', '1,180'] },
        { key: 'top9', cells: ['9', '智能预问诊 v2.1', '门诊部', '980'] },
        { key: 'top10', cells: ['10', '随访管理助手', '护理部', '760'] },
      ],
    },
    comments: [],
  },
  {
    id: 'n10b-p',
    type: 'p',
    text:
      '影像报告解读助手(放射科)以日均 4,200 次居首,检验结果解读助手(检验科)、预问诊助手(门诊部)分列第二、三位。TOP10 智能体日均调用量合计占全院总调用量的 71%,头部集中效应明显,建议对高频智能体优先保障算力资源并加密质量抽检频次。',
    comments: [],
  },
  // ===== §2 医院资源管理情况 =====
  {
    id: 'n11',
    type: 'h2',
    text: '二、医院资源管理情况',
    comments: [],
  },
  // (一)对接业务系统总量
  {
    id: 'n11-1',
    type: 'h3',
    text: '(一)对接业务系统总量',
    comments: [],
  },
  {
    id: 'n11-1-kpi',
    type: 'kpi',
    kpis: [
      { label: '医院资源管理中心对接业务系统数量(个)', value: '12', color: '#1677FF' },
    ],
    comments: [],
  },
  {
    id: 'n11-1-p',
    type: 'p',
    text:
      '医院资源管理中心已对接 HIS、EMR、LIS、PACS、手麻、病案等 12 个业务系统,为智能体提供统一的数据与服务接入通道。',
    comments: [],
  },
  // (二)各智能体对接系统数量排行
  {
    id: 'n11-2',
    type: 'h3',
    text: '(二)各智能体对接系统数量排行',
    comments: [],
  },
  {
    id: 'n11-2-c',
    type: 'chart',
    chart: {
      title: '图 2-1 各智能体对接业务系统数量排行(个)',
      chartType: 'bar',
      data: [
        { name: '影像报告解读助手', value: 5 },
        { name: '病历质控助手', value: 5 },
        { name: '冠脉 CTA 评估助手', value: 4 },
        { name: '检验结果解读助手', value: 4 },
        { name: '用药审核助手', value: 4 },
        { name: '肺结节智能筛查系统', value: 3 },
        { name: '心电智能分析系统', value: 3 },
        { name: '预问诊助手', value: 2 },
        { name: '随访管理助手', value: 2 },
        { name: '智能预问诊 v2.1', value: 2 },
      ],
    },
    comments: [],
  },
  {
    id: 'n11-2-p',
    type: 'p',
    text:
      '影像报告解读助手与病历质控助手各对接 5 个业务系统,为对接复杂度最高的智能体;对接 3 个及以上系统的智能体共 7 个,此类智能体接口依赖多,须重点纳入接口变更影响评估范围。',
    comments: [],
  },
  // (三)各智能体对接系统具体情况(对接矩阵热力图)
  {
    id: 'n11-3',
    type: 'h3',
    text: '(三)各智能体对接系统具体情况',
    comments: [],
  },
  {
    id: 'n11-3-matrix',
    type: 'matrix',
    matrix: {
      title: '图 2-2 智能体 × 业务系统对接矩阵',
      rows: ['影像报告解读助手', '病历质控助手', '冠脉 CTA 评估助手', '检验结果解读助手', '用药审核助手', '肺结节智能筛查', '心电智能分析', '预问诊助手', '随访管理助手'],
      cols: ['HIS', 'EMR', 'LIS', 'PACS', '手麻', '病案', 'CDR', 'RIS'],
      data: [
        [12000, 8400, 3200, 9800, 1200, 800, 4200, 5600],
        [10500, 12200, 7800, 2400, 3200, 6800, 5400, 1100],
        [9800, 5200, 1800, 11200, 4800, 2400, 3600, 1800],
        [8600, 9200, 11400, 1200, 800, 1800, 6200, 800],
        [11200, 7800, 2400, 800, 600, 1200, 4200, 600],
        [9400, 4200, 800, 10800, 1200, 800, 3600, 2400],
        [8800, 6400, 1200, 1800, 600, 800, 2800, 800],
        [6200, 5400, 600, 400, 200, 200, 1200, 200],
        [4400, 6800, 800, 200, 200, 600, 1600, 200],
      ],
      legend: '颜色越深表示对接强度越高(调用量越大);空白格(0)表示未对接。',
    },
    comments: [],
  },
  {
    id: 'n11-3-p',
    type: 'p',
    text:
      '颜色越深表示对接强度越高(调用量越大)。空白格表示未对接。此图可快速识别对接密度和空白区域。',
    comments: [],
  },
  {
    id: 'n11-3-p2',
    type: 'p',
    text:
      '从对接矩阵看,HIS 为全部智能体的基础依赖系统,EMR 次之(7 个智能体对接);手麻、病案等专科系统对接集中于少数智能体。',
    comments: [],
  },
  // ===== §3 准入评测情况 =====
  {
    id: 'n14',
    type: 'h2',
    text: '三、准入评测情况',
    comments: [],
  },
  // (一)评测进度
  {
    id: 'n14-1',
    type: 'h3',
    text: '(一)评测进度',
    comments: [],
  },
  {
    id: 'n15',
    type: 'chart',
    chart: {
      title: '图 3-1 准入评测进度分布(项)',
      chartType: 'bar',
      data: [
        { name: '待评测', value: 5 },
        { name: '评测中', value: 7 },
        { name: '已完成', value: 30 },
      ],
    },
    comments: [],
  },
  {
    id: 'n15-p',
    type: 'p',
    text:
      '累计发起准入评测 42 项,其中已完成 30 项、评测中 7 项、待评测 5 项,完成率 71.4%;平均评测周期 2 天,较上期缩短 0.5 天。',
    comments: [],
  },
  // (二)评测结果
  {
    id: 'n14-2',
    type: 'h3',
    text: '(二)评测结果',
    comments: [],
  },
  {
    id: 'n16',
    type: 'chart',
    chart: {
      title: '图 3-2 评测结果占比(项)',
      chartType: 'pie',
      data: [
        { name: '准入通过', value: 24 },
        { name: '退回修改', value: 6 },
      ],
    },
    comments: [],
  },
  {
    id: 'n16-p',
    type: 'p',
    text:
      '已完成评测 30 项中,准入通过 24 项(80%)、退回修改 6 项(20%),通过率环比提升 5 个百分点。',
    comments: [],
  },
  // (三)退回原因分析
  {
    id: 'n14-3',
    type: 'h3',
    text: '(三)退回原因分析',
    comments: [],
  },
  {
    id: 'n17',
    type: 'chart',
    chart: {
      title: '图 3-3 退回原因五维安全分布(项)',
      chartType: 'bar',
      data: [
        { name: '输入安全', value: 1 },
        { name: '输出安全', value: 3 },
        { name: '行为安全', value: 1 },
        { name: '数据安全', value: 1 },
        { name: '工具安全', value: 0 },
      ],
    },
    comments: [],
  },
  {
    id: 'n17-p',
    type: 'p',
    text:
      '对 6 项退回修改按输入安全、输出安全、行为安全、数据安全、工具安全五个维度归类:输出安全问题最多(3 项),主要表现为医学内容准确率不达标与不当表述;输入安全、行为安全、数据安全各 1 项;工具安全维度表现最好,未发现问题。建议针对输出安全维度,在供应商接入前增加预评测环节,并强化医学知识库对齐要求。',
    comments: [],
  },
  // ===== §4 运行监测情况 =====
  {
    id: 'n18',
    type: 'h2',
    text: '四、运行监测情况',
    comments: [],
  },
  // (一)告警情况
  {
    id: 'n18-1',
    type: 'h3',
    text: '(一)告警情况',
    comments: [],
  },
  {
    id: 'n19',
    type: 'kpi',
    kpis: [
      { label: '告警次数(次)', value: '68', color: '#FA8C16' },
      { label: '故障次数(次)', value: '3', color: '#FF4D4F' },
      { label: '故障平均恢复时间', value: '42', unit: '分钟', color: '#1677FF' },
    ],
    comments: [],
  },
  {
    id: 'n19-note',
    type: 'quote',
    text:
      '口径:告警为智能体接入运行后产生的告警次数(较轻);故障平均恢复时间为运行状态异常的智能体恢复正常的平均耗时。',
    comments: [],
  },
  {
    id: 'n20',
    type: 'chart',
    chart: {
      title: '图 4-1 告警次数周度趋势(近 12 个周期,次)',
      chartType: 'line',
      data: [
        { name: 'W1', value: 8 },
        { name: 'W2', value: 7 },
        { name: 'W3', value: 6 },
        { name: 'W4', value: 7 },
        { name: 'W5', value: 5 },
        { name: 'W6', value: 6 },
        { name: 'W7', value: 5 },
        { name: 'W8', value: 6 },
        { name: 'W9', value: 4 },
        { name: 'W10', value: 5 },
        { name: 'W11', value: 4 },
        { name: 'W12', value: 5 },
      ],
    },
    comments: [],
  },
  {
    id: 'n20-p',
    type: 'p',
    text:
      '近 12 周累计产生告警 68 次,周均 5.7 次,整体呈波动下降趋势;峰值出现在第 1 周(8 次),与月初调用高峰重合。统计周期内发生故障 3 次,故障平均恢复时间 42 分钟,均在应急预案时限内完成处置。',
    comments: [],
  },
  // (二)异常智能体情况说明
  {
    id: 'n18-2',
    type: 'h3',
    text: '(二)异常智能体情况说明',
    comments: [],
  },
  {
    id: 'n20b-p',
    type: 'p',
    text:
      '截至报告导出时,全院有 2 个智能体运行状态为异常:一是 ×× 检验结果解读助手,因 LIS 接口网关超时导致响应失败,正在实施接口扩容,预计 ×× 日恢复;二是 ×× 随访管理助手,因供应商模型服务升级临时停用,已按变更流程报备,预计 ×× 日恢复。异常期间相关业务均已切换至人工流程,未对临床工作造成影响。',
    comments: [],
  },
  // (三)故障原因统计
  {
    id: 'n18-3',
    type: 'h3',
    text: '(三)故障原因统计',
    comments: [],
  },
  {
    id: 'n20c',
    type: 'table',
    table: {
      title: '表 4 · 故障原因统计(按监控维度归类)',
      headers: ['监控维度', '故障/告警次数', '占比', '主要成因分析'],
      rows: [
        { key: 'm1', cells: ['业务监控', '31', '43.7%', '高峰时段接口调用超时、返回结果超出预期格式'] },
        { key: 'm2', cells: ['状态监控', '22', '31.0%', '模型服务响应缓慢、服务短时不可用'] },
        { key: 'm3', cells: ['成本监控', '10', '14.1%', '个别智能体调用量突增导致算力成本超出预算阈值'] },
        { key: 'm4', cells: ['安全监控', '8', '11.2%', '输出内容触发敏感词拦截、异常频次访问'] },
      ],
    },
    comments: [],
  },
  // PRD §3.3.2 (对齐模板 §4.4) 典型问题及处理方案 - 扩展至 5 列(序号/典型问题/影响范围/处理方案/处理进展/责任方)
  {
    id: 'n18-4',
    type: 'h3',
    text: '(四)典型问题及处理方案',
    comments: [],
  },
  {
    id: 'n21',
    type: 'table',
    table: {
      title: '表 5 · 典型问题及处理方案',
      headers: ['序号', '典型问题', '影响范围', '处理方案', '处理进展', '责任方'],
      rows: [
        { key: 'p1', cells: ['1', '影像报告解读助手高峰期响应超时', '放射科', '接口网关扩容,错峰调度', '已完成', '信息中心'] },
        { key: 'p2', cells: ['2', '用药审核助手对罕见病用药提示不准确', '药剂科', '补充语料复测,上线前人工复核', '进行中', '供应商'] },
        { key: 'p3', cells: ['3', '随访管理助手消息推送重复', '护理部', '修复推送去重逻辑并回归测试', '已完成', '供应商'] },
      ],
    },
    comments: [],
  },
  // ===== §5 报告总结 =====
  {
    id: 'n22',
    type: 'h2',
    text: '五、报告总结',
    comments: [],
  },
  // (一)存在的问题
  {
    id: 'n22-1',
    type: 'h3',
    text: '(一)存在的问题',
    comments: [],
  },
  {
    id: 'n23-p1',
    type: 'p',
    text:
      '一是科室覆盖不均衡。智能体集中于医技科室,临床科室与护理单元覆盖率偏低,全院仍有 25 个科室未接入。',
    comments: [],
  },
  {
    id: 'n23-p2',
    type: 'p',
    text:
      '二是评测退回率仍处较高水平。准入评测退回率达 20%,问题集中于输出安全维度,供应商交付质量参差不齐。',
    comments: [],
  },
  {
    id: 'n23-p3',
    type: 'p',
    text:
      '三是高峰期资源保障不足。业务与状态监控告警合计占 74.7%,均与高峰时段算力、接口资源紧张相关,LIS 接口异常尚未完全闭环。',
    comments: [],
  },
  {
    id: 'n23-p4',
    type: 'p',
    text:
      '四是成本增长需要关注。部分高频智能体调用量增长快于预算安排,成本监控告警 10 次,配额与预算机制有待完善。',
    comments: [],
  },
  // (二)下一步工作建议
  {
    id: 'n22-2',
    type: 'h3',
    text: '(二)下一步工作建议',
    comments: [],
  },
  {
    id: 'n24-p1',
    type: 'p',
    text:
      '一是制定临床科室智能体接入推广计划,结合科室需求优先推进未覆盖科室的场景落地,力争年底科室覆盖率达到 80%。',
    comments: [],
  },
  {
    id: 'n24-p2',
    type: 'p',
    text:
      '二是建立供应商预评测机制,将输出安全指标纳入合同验收条款与供应商考核,从源头降低评测退回率。',
    comments: [],
  },
  {
    id: 'n24-p3',
    type: 'p',
    text:
      '三是实施算力与接口资源扩容,完成接口网关扩容与 LIS 接口专项治理,对 TOP10 高频智能体实行资源优先保障。',
    comments: [],
  },
  {
    id: 'n24-p4',
    type: 'p',
    text:
      '四是完善成本配额管理,按智能体设定调用与成本预算阈值,超限自动预警并纳入月度运营分析。',
    comments: [],
  },
  // PRD §3.3.2 (对齐模板「附:编制说明」)
  {
    id: 'n25',
    type: 'h2',
    text: '附:编制说明',
    comments: [],
  },
  {
    id: 'n26',
    type: 'p',
    text:
      '本报告由智能体管理平台基于台账聚合数据一键生成,统计口径统一,统计周期与筛选范围(科室 / 时间)见封面。',
    comments: [],
  },
  {
    id: 'n27',
    type: 'p',
    text:
      '各模块图表由系统按实时数据自动生成,本模板内全部数据与图表均为示例;比率类指标在图表处注明分子分母口径。',
    comments: [],
  },
  {
    id: 'n28',
    type: 'p',
    text:
      '各模块文字综述由智能助手自动生成初稿,信息科管理员可在平台编辑页在线调整后发布。',
    comments: [],
  },
];

// ============ §4.3.2 科室用户应用成效小结草稿(对齐 docx 模板·放射科示例) ============
//   完全对齐《科室智能体运行情况报告模板-以放射科为例》:
//     - 封面 + 目录 + 5 大模块(建设/对接/评测/运行/总结) + 编制说明
//     - 示例数据:放射科,8 个智能体,5 个业务系统,6 项评测完成,14 次告警
//   报告节点类型扩展:cover / toc / matrix / colophon(原 4 模块→对齐 5 模块 + 4 辅助节点)
const buildDeptDraft = (deptLabel: string = '放射科'): ReportNode[] => [
  // ===== 封面 =====
  {
    id: 'r_cover',
    type: 'cover',
    cover: {
      hospital: '××××医院',
      reportTitle: '科室智能体运行情况报告',
      deptName: `科室名称:${deptLabel}`,
      period: '统计周期:2026 年 1 月 1 日 — 2026 年 6 月 30 日',
      generatedBy: '生成方式:智能体管理平台基于台账数据按科室自动生成',
      reportDate: '编制日期:2026 年 7 月',
      templateNote:
        '模板说明:本报告按科室逐一生成,文中科室、数据、图表与综述均为示例,供模板设计参考。',
    },
    comments: [],
  },
  // ===== 目录 =====
  {
    id: 'r_toc',
    type: 'toc',
    toc: {
      items: [
        { anchor: 'r_h2_1', label: '一、本科室智能体建设情况' },
        { anchor: 'r_h2_2', label: '二、对接系统情况' },
        { anchor: 'r_h2_3', label: '三、准入评测情况' },
        { anchor: 'r_h2_4', label: '四、运行监测情况' },
        { anchor: 'r_h2_5', label: '五、报告总结' },
      ],
    },
    comments: [],
  },
  // ===== 一、本科室智能体建设情况 =====
  {
    id: 'r_h2_1',
    type: 'h2',
    text: '一、本科室智能体建设情况',
    comments: [],
  },
  {
    id: 'r_h3_1_1',
    type: 'h3',
    text: '(一)总体规模与关键指标',
    comments: [],
  },
  {
    id: 'r_kpi_1',
    type: 'kpi',
    kpis: [
      { label: '纳管智能体数量', value: '8', unit: '个', color: '#1677FF' },
      { label: '总调用量', value: '18.6', unit: '万次 · 全院占比 14.7%', color: '#13C2C2' },
      { label: '正常运行率', value: '87.5', unit: '% · 全院平均 95.2%', color: '#FA8C16' },
      { label: '使用成本', value: '6.8', unit: '万元', color: '#722ED1' },
    ],
    comments: [],
  },
  {
    id: 'r_p_1',
    type: 'p',
    text:
      '截至 2026 年 6 月 30 日,本科室共纳管智能体 8 个,统计周期内总调用量 18.6 万次,占全院总调用量的 14.7%,居全院各科室首位;正常运行率 87.5%(7/8),低于全院平均水平 95.2%,主要因 1 个智能体接口异常待恢复;使用成本合计 6.8 万元。',
    comments: [],
  },
  {
    id: 'r_h3_1_2',
    type: 'h3',
    text: '(二)本科室智能体清单',
    comments: [],
  },
  {
    id: 'r_t_1',
    type: 'table',
    table: {
      title: '表 1-1 · 本科室智能体清单',
      headers: ['编号', '名称', '诊疗环节', '来源', '风险等级', '运行状态'],
      rows: [
        { key: 'a1', cells: ['①', '影像报告解读助手', '辅助检查', '第三方厂商', '中度关注', '在线'] },
        { key: 'a2', cells: ['②', 'CT 辅助诊断助手', '辅助诊断', '第三方厂商', '高度关注', '在线'] },
        { key: 'a3', cells: ['③', 'DR 胸片筛查助手', '辅助诊断', '第三方厂商', '中度关注', '在线'] },
        { key: 'a4', cells: ['④', '影像质控助手', '辅助检查', '自研', '中度关注', '在线'] },
        { key: 'a5', cells: ['⑤', '造影剂用量审核助手', '辅助检查', '第三方厂商', '一般关注', '在线'] },
        { key: 'a6', cells: ['⑥', '检查报告规范助手', '辅助检查', '合作研发', '一般关注', '在线'] },
        { key: 'a7', cells: ['⑦', 'MRI 预约排程助手', '其他', '第三方厂商', '一般关注', '离线'] },
        { key: 'a8', cells: ['⑧', '影像随访提醒助手', '辅助诊断', '第三方厂商', '一般关注', '异常'] },
      ],
    },
    comments: [],
  },
  {
    id: 'r_h3_1_3',
    type: 'h3',
    text: '(三)调用量趋势',
    comments: [],
  },
  {
    id: 'r_c_1_1',
    type: 'chart',
    chart: {
      title: '图 1-1 · 本科室智能体月度调用量趋势(万次)',
      chartType: 'bar',
      data: [
        { name: '1月', value: 2.1 },
        { name: '2月', value: 2.5 },
        { name: '3月', value: 3.0 },
        { name: '4月', value: 3.3 },
        { name: '5月', value: 3.3 },
        { name: '6月', value: 4.4 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_2',
    type: 'p',
    text:
      '本科室月度调用量由 1 月的 2.1 万次增长至 6 月的 4.4 万次,累计增长 109.5%,增速高于全院平均,智能体已深度融入影像检查与报告流程。',
    comments: [],
  },
  {
    id: 'r_h3_1_4',
    type: 'h3',
    text: '(四)新增纳管智能体趋势',
    comments: [],
  },
  {
    id: 'r_c_1_2',
    type: 'chart',
    chart: {
      title: '图 1-2 · 本科室每月新增纳管智能体数量(个)',
      chartType: 'bar',
      data: [
        { name: '1月', value: 0 },
        { name: '2月', value: 1 },
        { name: '3月', value: 1 },
        { name: '4月', value: 2 },
        { name: '5月', value: 1 },
        { name: '6月', value: 3 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_3',
    type: 'p',
    text:
      '上半年本科室新增纳管智能体 8 个,其中 6 月新增 3 个,为造影剂用量审核、检查报告规范、影像随访提醒等辅助场景,科室智能体应用广度持续拓展。',
    comments: [],
  },
  {
    id: 'r_h3_1_5',
    type: 'h3',
    text: '(五)诊疗环节分布情况',
    comments: [],
  },
  {
    id: 'r_c_1_3',
    type: 'chart',
    chart: {
      title: '图 1-3 · 本科室智能体诊疗环节分布(占比)',
      chartType: 'pie',
      data: [
        { name: '辅助检查', value: 4 },
        { name: '辅助诊断', value: 3 },
        { name: '其他', value: 1 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_4',
    type: 'p',
    text:
      '本科室智能体集中于辅助检查(4 个,占 50%)与辅助诊断(3 个,占 38%)环节,与科室业务特点相符;预约排程等运营辅助类 1 个。可结合患者服务需求,评估检查前须知推送等诊前场景的补充空间。',
    comments: [],
  },
  {
    id: 'r_h3_1_6',
    type: 'h3',
    text: '(六)来源分布情况',
    comments: [],
  },
  {
    id: 'r_c_1_4',
    type: 'chart',
    chart: {
      title: '图 1-4 · 本科室智能体来源分布(左:数量;右:占比)',
      chartType: 'pie',
      data: [
        { name: '第三方厂商 · 6个 / 75%', value: 6 },
        { name: '自研 · 1个 / 12.5%', value: 1 },
        { name: '合作研发 · 1个 / 12.5%', value: 1 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_5',
    type: 'p',
    text:
      '第三方厂商产品 6 个(占 75%)、自研 1 个、合作研发 1 个。第三方产品占比较高,科室在使用中发现的问题请及时通过平台上报,作为供应商考核与续约评估依据。',
    comments: [],
  },
  {
    id: 'r_h3_1_7',
    type: 'h3',
    text: '(七)风险分级情况',
    comments: [],
  },
  {
    id: 'r_c_1_5',
    type: 'chart',
    chart: {
      title: '图 1-5 · 本科室智能体风险分级分布(左:数量;右:占比)',
      chartType: 'pie',
      data: [
        { name: '高度关注 · 1个 / 12.5%', value: 1 },
        { name: '中度关注 · 3个 / 37.5%', value: 3 },
        { name: '一般关注 · 4个 / 50%', value: 4 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_6',
    type: 'p',
    text:
      '本科室高度关注类智能体 1 个,为 CT 辅助诊断助手,其输出结论直接辅助临床诊断,须严格执行医生逐例复核签发制度;中度关注类 3 个、一般关注类 4 个。请科室按分级要求落实相应的使用管理措施。',
    comments: [],
  },
  {
    id: 'r_h3_1_8',
    type: 'h3',
    text: '(八)本科室智能体调用排行',
    comments: [],
  },
  {
    id: 'r_c_1_6',
    type: 'chart',
    chart: {
      title: '图 1-6 · 本科室智能体调用排行(日均调用次数,标注全院排名)',
      chartType: 'bar',
      data: [
        { name: '影像报告解读', value: 4200 },
        { name: 'CT 辅助诊断', value: 1850 },
        { name: 'DR 胸片筛查', value: 1620 },
        { name: '影像质控', value: 1180 },
        { name: '造影剂审核', value: 850 },
        { name: '检查报告规范', value: 620 },
        { name: '影像随访提醒', value: 280 },
        { name: 'MRI 预约排程', value: 230 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_7',
    type: 'p',
    text:
      '影像报告解读助手日均调用 4200 次,居全院首位,为科室核心应用;MRI 预约排程助手、影像随访提醒助手日均调用不足 300 次,使用率偏低,建议科室排查原因(如入口不便、功能不符、人员不熟悉),必要时组织针对性培训或向平台反馈优化需求。',
    comments: [],
  },
  // ===== 二、对接系统情况 =====
  {
    id: 'r_h2_2',
    type: 'h2',
    text: '二、对接系统情况',
    comments: [],
  },
  {
    id: 'r_h3_2_1',
    type: 'h3',
    text: '(一)对接业务系统数量',
    comments: [],
  },
  {
    id: 'r_kpi_2',
    type: 'kpi',
    kpis: [
      { label: '本科室智能体对接的业务系统数量', value: '5', unit: '个', color: '#1677FF' },
    ],
    comments: [],
  },
  {
    id: 'r_p_8',
    type: 'p',
    text:
      '本科室智能体共对接 HIS、EMR、PACS、RIS、病案系统 5 个业务系统,其中 HIS、RIS 为全部智能体的基础依赖系统。',
    comments: [],
  },
  {
    id: 'r_h3_2_2',
    type: 'h3',
    text: '(二)各智能体对接系统数量排行',
    comments: [],
  },
  {
    id: 'r_c_2_1',
    type: 'chart',
    chart: {
      title: '图 2-1 · 本科室各智能体对接业务系统数量排行(个)',
      chartType: 'bar',
      data: [
        { name: '影像报告解读', value: 5 },
        { name: 'CT 辅助诊断', value: 4 },
        { name: 'DR 胸片筛查', value: 3 },
        { name: '影像质控', value: 3 },
        { name: '造影剂审核', value: 2 },
        { name: '检查报告规范', value: 2 },
        { name: '影像随访提醒', value: 2 },
        { name: 'MRI 预约排程', value: 1 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_9',
    type: 'p',
    text:
      '影像报告解读助手对接 5 个系统,为本科室对接复杂度最高的智能体;相关系统升级或接口变更时,请科室提前关注平台变更通知,做好业务衔接安排。',
    comments: [],
  },
  {
    id: 'r_h3_2_3',
    type: 'h3',
    text: '(三)各智能体对接系统具体情况',
    comments: [],
  },
  {
    id: 'r_m_1',
    type: 'matrix',
    matrix: {
      title: '图 2-2 · 本科室智能体 × 业务系统对接矩阵(调用量,单位:万次)',
      rows: [
        '影像报告解读',
        'CT 辅助诊断',
        'DR 胸片筛查',
        '影像质控',
        '造影剂审核',
        '检查报告规范',
        '影像随访提醒',
        'MRI 预约排程',
      ],
      cols: ['HIS', 'EMR', 'PACS', 'RIS', '病案系统'],
      data: [
        [3.2, 2.8, 4.5, 4.1, 1.6],
        [2.1, 1.8, 3.6, 2.4, 0],
        [1.4, 1.2, 2.8, 2.1, 0],
        [1.6, 1.5, 1.8, 1.7, 0.8],
        [1.2, 1.0, 0, 1.3, 0],
        [0.9, 1.1, 0, 0.8, 0],
        [0.6, 0.4, 0, 0, 0],
        [0.8, 0, 0, 0.9, 0],
      ],
      legend: '颜色越深表示对接强度越高(调用量越大);空白格表示未对接',
    },
    comments: [],
  },
  {
    id: 'r_p_10',
    type: 'p',
    text:
      '颜色越深表示对接强度越高(调用量越大)。空白格表示未对接。此图可快速识别对接密度和空白区域。从对接矩阵看,本科室智能体高度依赖 HIS、RIS 与 PACS。PACS 对接的 3 个智能体均涉及影像调阅,其接口稳定性直接影响阅片效率,已纳入平台重点保障范围。',
    comments: [],
  },
  // ===== 三、准入评测情况 =====
  {
    id: 'r_h2_3',
    type: 'h2',
    text: '三、准入评测情况',
    comments: [],
  },
  {
    id: 'r_h3_3_1',
    type: 'h3',
    text: '(一)评测进度',
    comments: [],
  },
  {
    id: 'r_c_3_1',
    type: 'chart',
    chart: {
      title: '图 3-1 · 本科室智能体评测进度(项)',
      chartType: 'bar',
      data: [
        { name: '已完成', value: 6 },
        { name: '评测中', value: 2 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_11',
    type: 'p',
    text:
      '本科室 8 个智能体中,已完成评测 6 项、评测中 2 项。评测中的 2 项为 6 月新接入的检查报告规范助手与影像随访提醒助手,预计 7 月完成,评测结果将由平台自动同步至科室。',
    comments: [],
  },
  {
    id: 'r_h3_3_2',
    type: 'h3',
    text: '(二)评测结果',
    comments: [],
  },
  {
    id: 'r_c_3_2',
    type: 'chart',
    chart: {
      title: '图 3-2 · 本科室评测结果占比',
      chartType: 'pie',
      data: [
        { name: '准入通过', value: 5 },
        { name: '退回修改', value: 1 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_12',
    type: 'p',
    text:
      '已完成评测 6 项中,准入通过 5 项(83%)、退回修改 1 项(17%)。',
    comments: [],
  },
  {
    id: 'r_h3_3_3',
    type: 'h3',
    text: '(三)退回原因分析',
    comments: [],
  },
  {
    id: 'r_p_13',
    type: 'p',
    text:
      '自智能体接入以来,本科室累计发生评测退回记录 5 项(含历次评测与复评中已完成整改项),按输入安全、输出安全、行为安全、数据安全、工具安全五个维度归类统计如下:',
    comments: [],
  },
  {
    id: 'r_c_3_3',
    type: 'chart',
    chart: {
      title: '图 3-3 · 本科室退回原因五维安全分布(项)',
      chartType: 'bar',
      data: [
        { name: '输入安全', value: 1 },
        { name: '输出安全', value: 2 },
        { name: '行为安全', value: 1 },
        { name: '数据安全', value: 1 },
        { name: '工具安全', value: 0 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_14',
    type: 'p',
    text:
      '从五维分布看,输出安全维度问题最多(2 项),主要表现为医学内容准确性与表述规范问题;输入安全、行为安全、数据安全各 1 项;工具安全维度表现最好,未发生退回。逐项情况如下:',
    comments: [],
  },
  {
    id: 'r_t_2',
    type: 'table',
    table: {
      title: '表 3-1 · 本科室智能体评测退回明细',
      headers: ['退回智能体', '安全维度', '退回原因', '整改要求', '整改状态'],
      rows: [
        { key: 'b1', cells: ['影像质控助手', '输出安全', '质控规则误判率偏高,正常报告误标记率 8.2%,超出 3% 准入线', '优化质控规则库并补充本院报告语料复测', '整改中,2026-08 复测'] },
        { key: 'b2', cells: ['CT 辅助诊断助手', '输出安全', '对罕见征象的风险提示表述过度,易引发不必要临床干预', '调整输出模板与风险提示分级规则', '已整改通过(2026-03)'] },
        { key: 'b3', cells: ['DR 胸片筛查助手', '输入安全', '对非标准体位、曝光不足影像未做输入校验,导致误判', '增加影像质量校验拦截,不合格影像提示重拍', '已整改通过(2026-02)'] },
        { key: 'b4', cells: ['影像随访提醒助手', '数据安全', '随访推送内容包含未脱敏的患者身份信息', '增加推送内容脱敏处理与模板审核', '已整改通过(2026-05)'] },
        { key: 'b5', cells: ['MRI 预约排程助手', '行为安全', '越权调用检查资源锁定接口,超出准入授权范围', '收敛接口权限至查询类,锁定操作转人工确认', '已整改通过(2026-04)'] },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_15',
    type: 'p',
    text:
      '目前仅影像质控助手 1 项整改复测中,其余 4 项均已整改闭环。请科室配合复测工作,按平台要求提供典型报告样本,并安排质控医师参与复测结果确认。',
    comments: [],
  },
  // ===== 四、运行监测情况 =====
  {
    id: 'r_h2_4',
    type: 'h2',
    text: '四、运行监测情况',
    comments: [],
  },
  {
    id: 'r_h3_4_1',
    type: 'h3',
    text: '(一)告警情况',
    comments: [],
  },
  {
    id: 'r_kpi_3',
    type: 'kpi',
    kpis: [
      { label: '告警次数', value: '14', unit: '次', color: '#FA8C16' },
      { label: '故障次数', value: '1', unit: '次', color: '#FF4D4F' },
      { label: '故障平均恢复时间', value: '35', unit: '分钟', color: '#1677FF' },
    ],
    comments: [],
  },
  {
    id: 'r_p_16',
    type: 'p',
    text:
      '口径:告警为本科室智能体接入运行后产生的告警次数(较轻);故障平均恢复时间为运行状态异常的智能体恢复正常的平均耗时。',
    comments: [],
  },
  {
    id: 'r_c_4_1',
    type: 'chart',
    chart: {
      title: '图 4-1 · 本科室告警次数周度趋势(近 12 个周期,次)',
      chartType: 'line',
      data: [
        { name: 'W1', value: 2 },
        { name: 'W2', value: 1 },
        { name: 'W3', value: 1 },
        { name: 'W4', value: 2 },
        { name: 'W5', value: 1 },
        { name: 'W6', value: 0 },
        { name: 'W7', value: 2 },
        { name: 'W8', value: 1 },
        { name: 'W9', value: 1 },
        { name: 'W10', value: 0 },
        { name: 'W11', value: 2 },
        { name: 'W12', value: 1 },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_17',
    type: 'p',
    text:
      '近 12 周本科室智能体累计告警 14 次,周均 1.2 次,整体平稳;发生故障 1 次,平均恢复时间 35 分钟,优于全院平均水平(42 分钟)。',
    comments: [],
  },
  {
    id: 'r_h3_4_2',
    type: 'h3',
    text: '(二)异常智能体情况说明',
    comments: [],
  },
  {
    id: 'r_p_18',
    type: 'p',
    text:
      '截至报告导出时,本科室有 1 个智能体运行状态为异常:影像随访提醒助手,因供应商消息推送服务升级临时停用,异常期间请科室按原人工电话随访流程执行,预计 ×× 日恢复;恢复后平台将通知科室并自动补推异常期间的随访任务。',
    comments: [],
  },
  {
    id: 'r_h3_4_3',
    type: 'h3',
    text: '(三)故障原因统计',
    comments: [],
  },
  {
    id: 'r_t_3',
    type: 'table',
    table: {
      title: '表 4-1 · 本科室告警/故障维度统计',
      headers: ['监控维度', '告警/故障次数', '占比', '主要成因分析'],
      rows: [
        { key: 'm1', cells: ['业务监控', '6', '42.9%', '高峰时段影像调阅接口响应超时'] },
        { key: 'm2', cells: ['状态监控', '5', '35.7%', '模型服务响应缓慢,多发生于上午检查高峰'] },
        { key: 'm3', cells: ['成本监控', '2', '14.3%', '影像报告解读助手调用量增长触发预算阈值提醒'] },
        { key: 'm4', cells: ['安全监控', '1', '7.1%', '单终端异常高频调用,经核实为科研批量使用,已规范'] },
      ],
    },
    comments: [],
  },
  {
    id: 'r_p_19',
    type: 'p',
    text:
      '本科室告警集中于业务监控与状态监控维度(合计 78.6%),与检查高峰时段资源紧张相关;平台已列入接口扩容计划。科研等批量调用需求请提前向平台申请专用通道,避免触发安全告警。',
    comments: [],
  },
  {
    id: 'r_h3_4_4',
    type: 'h3',
    text: '(四)典型问题及处理方案',
    comments: [],
  },
  {
    id: 'r_t_4',
    type: 'table',
    table: {
      title: '表 4-2 · 典型问题及处理方案',
      headers: ['序号', '典型问题', '处理方案', '处理进展', '需科室配合事项'],
      rows: [
        { key: 'p1', cells: ['1', '影像报告解读助手高峰期响应超时', '接口网关扩容,错峰调度', '已完成', '无'] },
        { key: 'p2', cells: ['2', '影像质控助手正常报告误标记率偏高', '优化规则库,补充语料复测', '进行中', '提供典型报告样本,质控医师参与复测确认'] },
        { key: 'p3', cells: ['3', '影像随访提醒助手推送服务停用', '供应商升级后恢复并补推任务', '进行中', '异常期间执行人工电话随访流程'] },
      ],
    },
    comments: [],
  },
  // ===== 五、报告总结 =====
  {
    id: 'r_h2_5',
    type: 'h2',
    text: '五、报告总结',
    comments: [],
  },
  {
    id: 'r_h3_5_1',
    type: 'h3',
    text: '(一)存在的问题',
    comments: [],
  },
  {
    id: 'r_p_20',
    type: 'p',
    text:
      '一是正常运行率低于全院平均。本科室正常运行率 87.5%,低于全院平均 95.2%,影像随访提醒助手异常尚未恢复,随访业务暂靠人工兜底。',
    comments: [],
  },
  {
    id: 'r_p_21',
    type: 'p',
    text:
      '二是部分智能体使用率偏低。MRI 预约排程助手、影像随访提醒助手日均调用不足 300 次,与科室业务量不匹配,存在建而少用的情况。',
    comments: [],
  },
  {
    id: 'r_p_22',
    type: 'p',
    text:
      '三是自研智能体质量待提升。影像质控助手评测退回整改中,正常报告误标记问题影响使用体验,复测工作需要科室配合推进。',
    comments: [],
  },
  {
    id: 'r_p_23',
    type: 'p',
    text:
      '四是高峰时段告警集中。检查高峰时段接口超时与响应缓慢告警占比近八成,影响阅片与报告效率。',
    comments: [],
  },
  {
    id: 'r_h3_5_2',
    type: 'h3',
    text: '(二)下一步工作建议',
    comments: [],
  },
  {
    id: 'r_p_24',
    type: 'p',
    text:
      '一是跟进异常恢复。督促供应商完成影像随访提醒助手升级恢复,恢复后核对异常期间随访任务补推情况,确保随访不遗漏。',
    comments: [],
  },
  {
    id: 'r_p_25',
    type: 'p',
    text:
      '二是提升低频智能体使用率。针对 MRI 预约排程、影像随访提醒等低频智能体,组织科内使用培训,排查功能与流程适配问题,确无使用价值的可向平台申请调整或退出。',
    comments: [],
  },
  {
    id: 'r_p_26',
    type: 'p',
    text:
      '三是配合完成整改复测。按计划于 8 月前完成影像质控助手复测,科室提供典型报告样本并安排质控医师参与结果确认。',
    comments: [],
  },
  {
    id: 'r_p_27',
    type: 'p',
    text:
      '四是规范使用与反馈。落实高度关注类智能体逐例复核制度,科研批量调用提前申请专用通道;持续通过平台反馈问题,推动供应商迭代优化。',
    comments: [],
  },
  // ===== 尾部编制说明 =====
  {
    id: 'r_colophon',
    type: 'colophon',
    colophon: {
      generator: '智能体管理平台自动生成',
      reportDate: '2026 年 7 月 × 日',
      note:
        '本报告由智能体管理平台基于台账聚合数据按科室自动生成,统计范围为归属或使用科室为本科室的智能体,统计周期见封面。各模块图表由系统按实时数据自动生成,本模板内全部科室、数据与图表均为示例;涉及全院对比的指标,基准值为同期全院平均水平。各模块文字综述由智能助手自动生成初稿,科室管理员可在平台编辑页在线调整。',
    },
    comments: [],
  },
];
// ============ 简易图表渲染 ============
// 对接矩阵热力图(本科室智能体 × 业务系统)
//   - 颜色按 value/maxV 映射到 #1677FF 透明度
//   - 0 值显示「—」浅灰边框(未对接)
//   - 列标签顶部旋转 -45°
const MatrixHeatmap: React.FC<{
  rows: string[];
  cols: string[];
  data: number[][];
  legend?: string;
}> = ({ rows, cols, data, legend }) => {
  const flat = data.flat();
  const maxV = Math.max(...flat, 1);
  const labelW = 120;
  const cellW = 88;
  const cellH = 36;
  const headerH = 80;
  const W = labelW + cols.length * cellW + 16;
  const H = headerH + rows.length * cellH + (legend ? 36 : 12);
  const colorOf = (v: number) => {
    if (v === 0) return '#FAFAFA';
    const a = Math.max(0.15, Math.min(1, v / maxV));
    // #1677FF 的 RGB=22,119,255;按 alpha a 混合到白底
    const r = Math.round(255 - (255 - 22) * a);
    const g = Math.round(255 - (255 - 119) * a);
    const b = Math.round(255 - (255 - 255) * a);
    return `rgb(${r},${g},${b})`;
  };
  const textColorOf = (v: number) => {
    if (v === 0) return '#BFBFBF';
    const a = v / maxV;
    return a > 0.55 ? '#fff' : '#262626';
  };
  return (
    <div style={{ overflowX: 'auto', padding: '4px 0' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {cols.map((c, j) => {
          const x = labelW + j * cellW + cellW / 2;
          const y = headerH - 8;
          return (
            <g key={`col-${j}`} transform={`translate(${x},${y}) rotate(-45)`}>
              <text x={0} y={0} fontSize={11} fill="#262626" textAnchor="start">
                {c}
              </text>
            </g>
          );
        })}
        {rows.map((rname, i) => (
          <g key={`row-${i}`}>
            <text
              x={labelW - 8}
              y={headerH + i * cellH + cellH / 2 + 4}
              fontSize={11}
              fill="#262626"
              textAnchor="end"
            >
              {rname}
            </text>
            {cols.map((_c, j) => {
              const v = data[i]?.[j] ?? 0;
              const x = labelW + j * cellW;
              const y = headerH + i * cellH;
              return (
                <g key={`cell-${i}-${j}`}>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={cellW - 4}
                    height={cellH - 4}
                    fill={colorOf(v)}
                    stroke={v === 0 ? '#D9D9D9' : '#fff'}
                    strokeWidth={1}
                    strokeDasharray={v === 0 ? '3,2' : ''}
                    rx={3}
                  />
                  <text
                    x={x + cellW / 2}
                    y={y + cellH / 2 + 4}
                    fontSize={11}
                    fill={textColorOf(v)}
                    textAnchor="middle"
                    fontWeight={v > 0 ? 500 : 400}
                  >
                    {v === 0 ? '—' : v.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
        {legend && (
          <g transform={`translate(${labelW}, ${H - 28})`}>
            <text x={0} y={12} fontSize={10} fill="#8C8C8C">
              {legend}
            </text>
            <g transform={`translate(${W - labelW - 220}, 4)`}>
              {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                <rect
                  key={i}
                  x={i * 40}
                  y={0}
                  width={36}
                  height={10}
                  fill={colorOf(p * maxV)}
                  stroke="#fff"
                />
              ))}
              <text x={0} y={22} fontSize={9} fill="#8C8C8C">
                低
              </text>
              <text x={W - labelW - 40} y={22} fontSize={9} fill="#8C8C8C" textAnchor="end">
                高
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

const MiniChart: React.FC<{
  type: 'bar' | 'pie' | 'line' | 'matrix';
  data: Array<{ name: string; value: number }>;
  // matrix 专用 props
  matrixRows?: string[];
  matrixCols?: string[];
  matrixData?: number[][];
  matrixLegend?: string;
}> = ({ type, data, matrixRows, matrixCols, matrixData, matrixLegend }) => {
  if (type === 'matrix') {
    return <MatrixHeatmap rows={matrixRows || []} cols={matrixCols || []} data={matrixData || []} legend={matrixLegend} />;
  }
  if (type === 'pie') {
    const total = data.reduce((s, d) => s + d.value, 0);
    const palette = ['#1677FF', '#13C2C2', '#52C41A', '#FA8C16', '#722ED1', '#EB2F96', '#FAAD14', '#A0D911'];
    let cursor = -Math.PI / 2;
    const cx = 80;
    const cy = 80;
    const R = 64;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
        <svg width={160} height={160} viewBox="0 0 160 160">
          {data.map((d, i) => {
            const angle = (d.value / total) * Math.PI * 2;
            const start = cursor;
            const end = cursor + angle;
            const x1 = cx + R * Math.cos(start);
            const y1 = cy + R * Math.sin(start);
            const x2 = cx + R * Math.cos(end);
            const y2 = cy + R * Math.sin(end);
            const large = angle > Math.PI ? 1 : 0;
            cursor = end;
            return (
              <path
                key={d.name}
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`}
                fill={palette[i % palette.length]}
                stroke="#fff"
                strokeWidth={1}
              />
            );
          })}
          <circle cx={cx} cy={cy} r={28} fill="#fff" />
          <text x={cx} y={cy - 2} fontSize={11} fill="#8C8C8C" textAnchor="middle">合计</text>
          <text x={cx} y={cy + 14} fontSize={14} fill="#262626" textAnchor="middle" fontWeight={600}>
            {total}
          </text>
        </svg>
        <div style={{ flex: 1 }}>
          {data.map((d, i) => (
            <div
              key={d.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '3px 0',
                fontSize: 12,
              }}
            >
              <Space size={6}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: palette[i % palette.length],
                    display: 'inline-block',
                  }}
                />
                <span>{d.name}</span>
              </Space>
              <span>
                {d.value} <Text type="secondary" style={{ fontSize: 11 }}>
                  ({((d.value / total) * 100).toFixed(1)}%)
                </Text>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'line') {
    const W = 600;
    const H = 180;
    const pad = { top: 20, right: 20, bottom: 30, left: 36 };
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;
    const maxV = Math.max(...data.map((d) => d.value), 1);
    const stepX = innerW / Math.max(data.length - 1, 1);
    const points = data.map((d, i) => ({
      x: pad.left + i * stepX,
      y: pad.top + innerH - (d.value / maxV) * innerH,
      ...d,
    }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = `${pathD} L ${pad.left + (data.length - 1) * stepX} ${pad.top + innerH} L ${pad.left} ${pad.top + innerH} Z`;
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1677FF" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#1677FF" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = pad.top + innerH * (1 - p);
          return (
            <g key={p}>
              <line x1={pad.left} y1={y} x2={pad.left + innerW} y2={y} stroke="#F0F0F0" />
              <text x={pad.left - 4} y={y + 3} fontSize={10} fill="#8C8C8C" textAnchor="end">
                {Math.round(maxV * p)}
              </text>
            </g>
          );
        })}
        <path d={areaD} fill="url(#line-grad)" />
        <path d={pathD} fill="none" stroke="#1677FF" strokeWidth={2} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#1677FF" strokeWidth={2} />
            <text x={p.x} y={p.y - 8} fontSize={10} fill="#262626" textAnchor="middle">
              {p.value}
            </text>
            <text x={p.x} y={H - pad.bottom + 16} fontSize={10} fill="#8C8C8C" textAnchor="middle">
              {p.name}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  // bar
  const W = 600;
  const H = 200;
  const pad = { top: 20, right: 20, bottom: 36, left: 36 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxV = Math.max(...data.map((d) => d.value), 1);
  const barW = innerW / data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const y = pad.top + innerH * (1 - p);
        return (
          <g key={p}>
            <line x1={pad.left} y1={y} x2={pad.left + innerW} y2={y} stroke="#F0F0F0" />
            <text x={pad.left - 4} y={y + 3} fontSize={10} fill="#8C8C8C" textAnchor="end">
              {Math.round(maxV * p)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / maxV) * innerH;
        const x = pad.left + i * barW + barW * 0.15;
        const w = barW * 0.7;
        const y = pad.top + innerH - h;
        const label = d.name.length > 6 ? d.name.slice(0, 6) + '…' : d.name;
        return (
          <g key={d.name}>
            <rect x={x} y={y} width={w} height={h} fill="#1677FF" rx={2} />
            <text x={x + w / 2} y={y - 4} fontSize={10} fill="#262626" textAnchor="middle">
              {d.value}
            </text>
            <text x={x + w / 2} y={H - pad.bottom + 16} fontSize={10} fill="#8C8C8C" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ============ 渲染节点 ============
const NodeRenderer: React.FC<{
  node: ReportNode;
  editable: boolean;
  onTextChange: (id: string, text: string) => void;
}> = ({ node, editable, onTextChange }) => {
  if (node.type === 'title') {
    return (
      <div style={{ position: 'relative' }}>
        {editable ? (
          <Input
            value={node.text}
            onChange={(e) => onTextChange(node.id, e.target.value)}
            bordered={false}
            style={{
              fontSize: 28,
              fontWeight: 700,
              textAlign: 'center',
              padding: '16px 0',
              background: 'transparent',
            }}
          />
        ) : (
          <Title level={2} style={{ textAlign: 'center', margin: '16px 0' }}>
            {node.text}
          </Title>
        )}
        <CommentStrip comments={node.comments} />
      </div>
    );
  }
  if (node.type === 'h2') {
    return (
      <div id={`sec-${node.id}`} style={{ position: 'relative', scrollMarginTop: 16 }}>
        {editable ? (
          <Input
            value={node.text}
            onChange={(e) => onTextChange(node.id, e.target.value)}
            bordered={false}
            style={{
              fontSize: 20,
              fontWeight: 600,
              padding: '12px 0 6px',
              borderBottom: '2px solid #1677FF',
              background: 'transparent',
            }}
          />
        ) : (
          <Title level={3} style={{ marginTop: 24, marginBottom: 8, borderBottom: '2px solid #1677FF', paddingBottom: 4 }}>
            {node.text}
          </Title>
        )}
        <CommentStrip comments={node.comments} />
      </div>
    );
  }
  if (node.type === 'p') {
    return (
      <div style={{ position: 'relative' }}>
        {editable ? (
          <TextArea
            value={node.text}
            onChange={(e) => onTextChange(node.id, e.target.value)}
            autoSize={{ minRows: 2 }}
            style={{ marginBottom: 8 }}
          />
        ) : (
          <Paragraph style={{ fontSize: 14, lineHeight: 1.85, marginBottom: 12 }}>
            {node.text}
          </Paragraph>
        )}
        <CommentStrip comments={node.comments} />
      </div>
    );
  }
  if (node.type === 'h3') {
    return (
      <div id={`sec-${node.id}`} style={{ position: 'relative', scrollMarginTop: 16 }}>
        {editable ? (
          <Input
            value={node.text}
            onChange={(e) => onTextChange(node.id, e.target.value)}
            bordered={false}
            style={{
              fontSize: 16,
              fontWeight: 600,
              padding: '8px 0 4px',
              background: 'transparent',
              color: '#1677FF',
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1677FF',
              padding: '8px 0 4px',
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            {node.text}
          </div>
        )}
        <CommentStrip comments={node.comments} />
      </div>
    );
  }
  if (node.type === 'quote') {
    return (
      <div style={{ position: 'relative', marginBottom: 12 }}>
        {editable ? (
          <TextArea
            value={node.text}
            onChange={(e) => onTextChange(node.id, e.target.value)}
            autoSize={{ minRows: 2 }}
            style={{
              margin: '8px 0',
              background: '#F5F5F5',
              borderLeft: '3px solid #8C8C8C',
            }}
          />
        ) : (
          <blockquote
            style={{
              margin: '8px 0',
              padding: '8px 12px',
              background: '#F5F5F5',
              borderLeft: '3px solid #8C8C8C',
              color: '#595959',
              fontSize: 12,
              borderRadius: 4,
            }}
          >
            {node.text}
          </blockquote>
        )}
        <CommentStrip comments={node.comments} />
      </div>
    );
  }
  if (node.type === 'kpi') {
    return (
      <div style={{ position: 'relative' }}>
        <Row gutter={12} style={{ marginBottom: 12 }}>
          {node.kpis!.map((k) => (
            <Col key={k.label} span={Math.floor(24 / node.kpis!.length)}>
              <Card size="small" style={{ background: '#FAFAFA', textAlign: 'center' }} bodyStyle={{ padding: 12 }}>
                <div style={{ fontSize: 11, color: '#8C8C8C' }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: k.color || '#1677FF', marginTop: 4 }}>
                  {k.value}
                  {k.unit && <span style={{ fontSize: 12, marginLeft: 4, color: '#8C8C8C' }}>{k.unit}</span>}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
        <CommentStrip comments={node.comments} />
      </div>
    );
  }
  if (node.type === 'chart') {
    return (
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Card size="small" bodyStyle={{ padding: 12 }}>
          {editable ? (
            <Input
              value={node.chart!.title}
              onChange={(e) => onTextChange(node.id, e.target.value)}
              bordered={false}
              style={{ padding: 0, fontSize: 13, fontWeight: 600 }}
            />
          ) : (
            <Text strong style={{ fontSize: 13 }}>{node.chart!.title}</Text>
          )}
          <Divider style={{ margin: '8px 0' }} />
          <MiniChart type={node.chart!.chartType} data={node.chart!.data} />
        </Card>
        <CommentStrip comments={node.comments} />
      </div>
    );
  }
  if (node.type === 'table') {
    return (
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Card size="small" bodyStyle={{ padding: 12 }}>
          {editable ? (
            <Input
              value={node.table!.title}
              onChange={(e) => onTextChange(node.id, e.target.value)}
              bordered={false}
              style={{ padding: 0, fontSize: 13, fontWeight: 600 }}
            />
          ) : (
            <Text strong style={{ fontSize: 13 }}>{node.table!.title}</Text>
          )}
          <table
            style={{
              width: '100%',
              marginTop: 8,
              borderCollapse: 'collapse',
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: '#F0F5FF' }}>
                {node.table!.headers.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 10px',
                      border: '1px solid #D6E4FF',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#1677FF',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.table!.rows.map((r) => (
                <tr key={r.key} style={{ background: r.key.endsWith('1') ? '#fff' : '#FAFAFA' }}>
                  {r.cells.map((c, i) => (
                    <td
                      key={i}
                      style={{
                        padding: '8px 10px',
                        border: '1px solid #F0F0F0',
                      }}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <CommentStrip comments={node.comments} />
      </div>
    );
  }
  if (node.type === 'cover') {
    // 封面:深蓝渐变 + 医院名 + 报告标题 + 字段列表(对齐 docx 模板)
    const c = node.cover!;
    return (
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #1677FF 0%, #0958D9 100%)',
          color: '#fff',
          padding: '48px 40px',
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
            {c.hospital}
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, opacity: 0.95 }}>
            {c.reportTitle}
          </div>
        </div>
        <div
          style={{
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 6,
            padding: '20px 28px',
            fontSize: 14,
            lineHeight: 2,
          }}
        >
          {editable ? (
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Input value={c.hospital} bordered={false} readOnly style={{ color: '#fff', fontSize: 30, fontWeight: 700, textAlign: 'center', background: 'transparent' }} />
              <Input value={c.reportTitle} bordered={false} readOnly style={{ color: '#fff', fontSize: 22, textAlign: 'center', background: 'transparent' }} />
            </Space>
          ) : (
            <>
              <div>{c.deptName}</div>
              <div>{c.period}</div>
              <div>{c.generatedBy}</div>
              <div>{c.reportDate}</div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
                {c.templateNote}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  if (node.type === 'toc') {
    // 目录:可点击锚点导航
    const items = node.toc?.items || [];
    const jump = (anchor: string) => {
      const el = document.getElementById(`sec-${anchor}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return (
      <Card
        size="small"
        bordered
        style={{
          marginBottom: 24,
          background: '#F0F5FF',
          border: '1px solid #ADC8FF',
        }}
        bodyStyle={{ padding: '16px 24px' }}
      >
        <Title level={4} style={{ marginTop: 0, marginBottom: 12, color: '#1677FF' }}>
          📑 目  录
        </Title>
        <div style={{ fontSize: 13, lineHeight: 2 }}>
          {items.map((it, i) => (
            <div
              key={it.anchor}
              onClick={() => jump(it.anchor)}
              style={{
                cursor: 'pointer',
                color: '#262626',
                padding: '4px 0',
                borderBottom: i < items.length - 1 ? '1px dashed #D6E4FF' : 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#1677FF';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#262626';
              }}
            >
              <span style={{ marginRight: 8 }}>{String(i + 1).padStart(2, '0')}.</span>
              {it.label}
            </div>
          ))}
        </div>
      </Card>
    );
  }
  if (node.type === 'matrix') {
    // 对接矩阵(热力图)
    const m = node.matrix!;
    return (
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Card size="small" bodyStyle={{ padding: 12 }}>
          {editable ? (
            <Input
              value={m.title}
              onChange={(e) => onTextChange(node.id, e.target.value)}
              bordered={false}
              style={{ padding: 0, fontSize: 13, fontWeight: 600 }}
            />
          ) : (
            <Text strong style={{ fontSize: 13 }}>{m.title}</Text>
          )}
          <Divider style={{ margin: '8px 0' }} />
          <MiniChart
            type="matrix"
            data={[]}
            matrixRows={m.rows}
            matrixCols={m.cols}
            matrixData={m.data}
            matrixLegend={m.legend}
          />
        </Card>
        <CommentStrip comments={node.comments} />
      </div>
    );
  }
  if (node.type === 'colophon') {
    // 尾部编制说明
    const cl = node.colophon!;
    return (
      <div style={{ marginTop: 32 }}>
        <Divider style={{ margin: '24px 0 16px', borderTop: '2px solid #1677FF' }} />
        <div
          style={{
            textAlign: 'right',
            color: '#595959',
            fontSize: 13,
            lineHeight: 1.8,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: '#262626' }}>
            {cl.generator}
          </div>
          <div>{cl.reportDate}</div>
        </div>
        <Card
          size="small"
          style={{ background: '#FAFAFA', border: '1px solid #F0F0F0' }}
          bodyStyle={{ padding: 12 }}
        >
          <Text strong style={{ fontSize: 13, color: '#1677FF' }}>
            附:编制说明
          </Text>
          <Paragraph style={{ fontSize: 12, color: '#595959', lineHeight: 1.85, marginTop: 6, marginBottom: 0 }}>
            {cl.note}
          </Paragraph>
        </Card>
        <CommentStrip comments={node.comments} />
      </div>
    );
  }
  return null;
};

const CommentStrip: React.FC<{ comments: { id: string; author: string; text: string }[] }> = ({
  comments,
}) => {
  if (!comments || comments.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 2,
        marginBottom: 8,
        padding: '4px 8px',
        background: '#FFFBE6',
        borderLeft: '3px solid #FAAD14',
        borderRadius: 4,
      }}
    >
      {comments.map((c) => (
        <div key={c.id} style={{ fontSize: 12, color: '#874D00' }}>
          💬 <b>{c.author}</b> 批注:{c.text}
        </div>
      ))}
    </div>
  );
};

// ============ 主体 ============
type EditorMode = 'view' | 'edit';
type ReportScope = 'platform_admin' | 'dept_admin';

// V1.1：localStorage 草稿持久化（per-scope 隔离）
const DRAFT_STORAGE_KEY = 'ledger_report_draft_v1';
const loadDraft = (scope: ReportScope): ReportNode[] | null => {
  try {
    const raw = localStorage.getItem(`${DRAFT_STORAGE_KEY}::${scope}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    /* ignore */
  }
  return null;
};
const saveDraft = (scope: ReportScope, nodes: ReportNode[]) => {
  try {
    localStorage.setItem(`${DRAFT_STORAGE_KEY}::${scope}`, JSON.stringify(nodes));
  } catch {
    /* ignore */
  }
};

const scopeFromRoles = (roles?: string[]): ReportScope =>
  roles?.includes('科室管理员') && !roles.includes('信息科管理员') ? 'dept_admin' : 'platform_admin';

const ReportV33: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const roleScope = scopeFromRoles(currentUser?.roles);
  const [mode, setMode] = useState<EditorMode>('view');
  // PRD §3.3:报告详情页按当前登录角色展示对应口径,不提供跨角色视角切换。
  const [scope, setScope] = useState<ReportScope>(roleScope);
  const [nodes, setNodes] = useState<ReportNode[]>(() =>
    roleScope === 'platform_admin' ? buildPlatformDraft() : buildDeptDraft('放射科'),
  );
  const [savedAt, setSavedAt] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef<number | null>(null);
  // 用一个稳定的 data-attr 选取正文容器（antd Card 不支持 ref 透传）
  const reportContainerSelector = 'data-report-container';

  useEffect(() => {
    if (roleScope === scope) return;
    setScope(roleScope);
    const cached = loadDraft(roleScope);
    setNodes(cached || (roleScope === 'platform_admin' ? buildPlatformDraft() : buildDeptDraft('放射科')));
    setSavedAt(cached ? new Date().toLocaleString('zh-CN', { hour12: false }) : '');
    setMode('view');
  }, [roleScope, scope]);

  // V1.1：自动保存(编辑态 1.8s 节流 → localStorage)
  useEffect(() => {
    if (mode !== 'edit') return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const ts = new Date().toLocaleString('zh-CN', { hour12: false });
      saveDraft(scope, nodes);
      setSavedAt(ts);
      message.success({ content: `草稿已自动保存 @ ${ts}`, duration: 1.2 });
    }, 1800);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [nodes, mode, scope]);

  // V1.1：导出 — 真实生成 PDF / Word
  //   - PDF:用 jspdf + html2canvas 把 reportRef DOM 切片成多页 A4
  //   - Word:写入结构化 HTML(MS Word 可直接打开)
  const exportToPdf = async () => {
    setExporting(true);
    const hide = message.loading({ content: '正在生成 PDF…', duration: 0 });
    try {
      // 临时切到 view 模式 + 隐藏操作按钮,保证截图干净
      const wasMode = mode;
      setMode('view');
      // 等下一帧让 view 模式渲染
      await new Promise((r) => setTimeout(r, 200));
      const node = document.querySelector<HTMLElement>(`[${reportContainerSelector}]`);
      if (!node) {
        message.error('未找到报告正文容器');
        return;
      }
      const canvas = await html2canvas(node, {
        scale: 1.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgW = pdfW - 20; // 左右各 10mm 边距
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 10;
      pdf.addImage(imgData, 'JPEG', 10, position, imgW, imgH);
      heightLeft -= pdfH - 20;
      while (heightLeft > 0) {
        pdf.addPage();
        position = 10 - (imgH - heightLeft);
        pdf.addImage(imgData, 'JPEG', 10, position, imgW, imgH);
        heightLeft -= pdfH - 20;
      }
      const fname = `${scope === 'platform_admin' ? '全院智能体运行管理情况报告' : '本科室智能体运行情况报告'}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      pdf.save(fname);
      if (wasMode !== 'view') setMode(wasMode);
      message.success({ content: `PDF 已导出:${fname}`, duration: 2 });
    } catch (e) {
      message.error('PDF 导出失败,请重试');
      // eslint-disable-next-line no-console
      console.error('[ReportV33.exportToPdf]', e);
    } finally {
      hide();
      setExporting(false);
    }
  };

  const exportToWord = () => {
    // 把 nodes 转成结构化 HTML,MS Word 可直接打开
    const title =
      scope === 'platform_admin' ? '全院智能体运行管理情况报告' : '本科室智能体运行情况报告';
    const esc = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const body = nodes
      .map((n) => {
        if (n.type === 'title') return `<h1 style="text-align:center">${esc(n.text || '')}</h1>`;
        if (n.type === 'h2') return `<h2>${esc(n.text || '')}</h2>`;
        if (n.type === 'h3') return `<h3>${esc(n.text || '')}</h3>`;
        if (n.type === 'p') return `<p>${esc(n.text || '')}</p>`;
        if (n.type === 'kpi') {
          const cells = (n.kpis || [])
            .map(
              (k) =>
                `<td style="border:1px solid #ccc;padding:8px;text-align:center"><div>${esc(
                  k.label,
                )}</div><div style="font-size:18px;color:${k.color || '#1677FF'};font-weight:600">${esc(
                  String(k.value),
                )}${k.unit ? ' ' + esc(k.unit) : ''}</div></td>`,
            )
            .join('');
          return `<table style="width:100%;border-collapse:collapse;margin:8px 0"><tr>${cells}</tr></table>`;
        }
        if (n.type === 'chart') {
          const rows = (n.chart?.data || [])
            .map((d) => `<tr><td>${esc(d.name)}</td><td>${d.value}</td></tr>`)
            .join('');
          return `<h4>${esc(n.chart?.title || '')}</h4><table style="width:60%;border-collapse:collapse"><tr><th style="border:1px solid #ccc;padding:4px">类别</th><th style="border:1px solid #ccc;padding:4px">数值</th></tr>${rows}</table>`;
        }
        if (n.type === 'table') {
          const ths = (n.table?.headers || [])
            .map((h) => `<th style="border:1px solid #ccc;padding:4px;background:#E6F4FF">${esc(h)}</th>`)
            .join('');
          const trs = (n.table?.rows || [])
            .map(
              (r) =>
                `<tr>${r.cells.map((c) => `<td style="border:1px solid #ccc;padding:4px">${esc(c)}</td>`).join('')}</tr>`,
            )
            .join('');
          return `<h4>${esc(n.table?.title || '')}</h4><table style="width:100%;border-collapse:collapse"><tr>${ths}</tr>${trs}</table>`;
        }
        if (n.type === 'quote') return `<blockquote>${esc(n.text || '')}</blockquote>`;
        if (n.type === 'cover' && n.cover) {
          const c = n.cover;
          return `<div style="background:#1677FF;color:#fff;padding:48px 40px;border-radius:8px;text-align:center">
            <h1 style="color:#fff;font-size:30px;margin:0">${esc(c.hospital)}</h1>
            <h2 style="color:#fff;font-size:22px;margin:8px 0 24px">${esc(c.reportTitle)}</h2>
            <table style="margin:0 auto;color:#fff;font-size:14px;line-height:2;text-align:left;background:rgba(255,255,255,0.12);padding:16px 24px;border-radius:6px">
              <tr><td>${esc(c.deptName)}</td></tr>
              <tr><td>${esc(c.period)}</td></tr>
              <tr><td>${esc(c.generatedBy)}</td></tr>
              <tr><td>${esc(c.reportDate)}</td></tr>
              <tr><td style="font-size:12px;opacity:0.75">${esc(c.templateNote)}</td></tr>
            </table>
          </div>`;
        }
        if (n.type === 'toc' && n.toc) {
          const items = n.toc.items
            .map((it, i) => `<li>${String(i + 1).padStart(2, '0')}. ${esc(it.label)}</li>`)
            .join('');
          return `<div style="background:#F0F5FF;border:1px solid #ADC8FF;padding:16px 24px;border-radius:4px">
            <h3 style="color:#1677FF;margin-top:0">📑 目  录</h3>
            <ol style="font-size:13px;line-height:2">${items}</ol>
          </div>`;
        }
        if (n.type === 'matrix' && n.matrix) {
          const m = n.matrix;
          // 取最大值做颜色参考(Word 不支持 rgba,用十六进制近似)
          const max = Math.max(...m.data.flat(), 1);
          const headerRow = `<tr><th style="border:1px solid #ccc;padding:6px;background:#E6F4FF">智能体 / 系统</th>${m.cols
            .map((c) => `<th style="border:1px solid #ccc;padding:6px;background:#E6F4FF">${esc(c)}</th>`)
            .join('')}</tr>`;
          const bodyRows = m.rows
            .map(
              (rname, i) =>
                `<tr><td style="border:1px solid #ccc;padding:6px;font-weight:600">${esc(
                  rname,
                )}</td>${m.cols
                  .map((_c, j) => {
                    const v = m.data[i]?.[j] ?? 0;
                    const a = Math.max(0.15, Math.min(1, v / max));
                    const r = Math.round(255 - (255 - 22) * a);
                    const g = Math.round(255 - (255 - 119) * a);
                    const b = Math.round(255 - (255 - 255) * a);
                    const color = `rgb(${r},${g},${b})`;
                    const txt = v === 0 ? '—' : v.toFixed(1);
                    return `<td style="border:1px solid #ccc;padding:6px;background:${color};color:${
                      a > 0.55 ? '#fff' : '#262626'
                    };text-align:center">${txt}</td>`;
                  })
                  .join('')}</tr>`,
            )
            .join('');
          return `<h4>${esc(m.title)}</h4><table style="width:100%;border-collapse:collapse;font-size:11px"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table><p style="font-size:11px;color:#8C8C8C">${esc(
            m.legend || '',
          )}</p>`;
        }
        if (n.type === 'colophon' && n.colophon) {
          const cl = n.colophon;
          return `<hr/><div style="text-align:right;font-size:13px;color:#595959;line-height:1.8;margin:16px 0">
            <div style="font-size:15px;font-weight:600;color:#262626">${esc(cl.generator)}</div>
            <div>${esc(cl.reportDate)}</div>
          </div>
          <div style="background:#FAFAFA;border:1px solid #F0F0F0;padding:12px">
            <strong style="color:#1677FF;font-size:13px">附:编制说明</strong>
            <p style="font-size:12px;color:#595959;line-height:1.85;margin:6px 0 0">${esc(
              cl.note,
            )}</p>
          </div>`;
        }
        return '';
      })
      .join('\n');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1 style="text-align:center">${title}</h1>${body}<hr/><p style="text-align:right;color:#888">导出时间:${new Date().toLocaleString('zh-CN')}</p></body></html>`;
    const blob = new Blob(['﻿' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}_${new Date().toISOString().slice(0, 10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`Word 已导出:${a.download}`);
  };

  // 确认 + 触发对应导出
  const handleExport = async (fmt: 'word' | 'pdf') => {
    Modal.confirm({
      title: `导出为 ${fmt.toUpperCase()} 格式?`,
      content: '导出即视为报告完成,草稿状态将转为"已完成"。',
      okText: '确认导出',
      cancelText: '取消',
      onOk: async () => {
        if (fmt === 'pdf') await exportToPdf();
        else if (fmt === 'word') exportToWord();
      },
    });
  };

  const handleTextChange = (id: string, text: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? n.type === 'chart' && n.chart
            ? { ...n, chart: { ...n.chart, title: text } }
            : n.type === 'table' && n.table
              ? { ...n, table: { ...n.table, title: text } }
              : n.type === 'matrix' && n.matrix
                ? { ...n, matrix: { ...n.matrix, title: text } }
                : { ...n, text }
          : n
      ),
    );
  };

  // 导出菜单
  const exportMenu = {
    items: [
      {
        key: 'word',
        label: exporting ? '导出中…' : '导出 Word (.doc)',
        icon: <FileWordOutlined style={{ color: '#2A5599' }} />,
        disabled: exporting,
      },
      {
        key: 'pdf',
        label: exporting ? '导出中…' : '导出 PDF (.pdf)',
        icon: <FilePdfOutlined style={{ color: '#FF4D4F' }} />,
        disabled: exporting,
      },
    ],
    onClick: ({ key }: { key: string }) => handleExport(key as 'word' | 'pdf'),
  };

  // 统计
  const stats = useMemo(() => {
    return {
      modules: nodes.filter((n) => n.type === 'h2').length,
      charts: nodes.filter((n) => n.type === 'chart').length,
      tables: nodes.filter((n) => n.type === 'table').length,
      matrices: nodes.filter((n) => n.type === 'matrix').length,
      kpis: nodes.filter((n) => n.type === 'kpi').length,
      comments: nodes.reduce((s, n) => s + n.comments.length, 0),
    };
  }, [nodes]);

  return (
    <div style={{ padding: 16, background: '#F5F5F5', minHeight: 'calc(100vh - 64px)' }}>
      <PageHeader
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              size="small"
              onClick={() => navigate('/app/ledger-demo')}
            />
            <span>
              {scope === 'platform_admin'
                ? '全院智能体运行管理情况报告'
                : '本科室智能体运行情况报告'}
            </span>
            <Tag color="processing">
              {scope === 'platform_admin' ? '信息科管理员 · 全院口径' : '科室管理员 · 本科室口径'}
            </Tag>
            <Tag color="blue">草稿</Tag>
            {savedAt && (
              <Tag color="success" icon={<CloudSyncOutlined />}>
                已自动保存 @ {savedAt}
              </Tag>
            )}
          </Space>
        }
        subTitle={`统计周期:2026-01-01 至 2026-06-30 · 统计范围:${
          scope === 'platform_admin' ? '全院全部智能体' : '本科室智能体'
        } · 共 ${stats.modules} 个模块`}
        extra={
          <Space>
            <Tooltip title={mode === 'view' ? '切换为编辑模式' : '切换为只读预览'}>
              <Button
                type={mode === 'edit' ? 'primary' : 'default'}
                icon={mode === 'edit' ? <CheckOutlined /> : <EditOutlined />}
                onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}
              >
                {mode === 'view' ? '编辑' : '编辑中'}
              </Button>
            </Tooltip>
            <Dropdown menu={exportMenu} trigger={['click']}>
              <Button type="primary" icon={<DownloadOutlined />}>
                导出
              </Button>
            </Dropdown>
          </Space>
        }
      />

      {/* 报告状态栏(按 PRD §3.3.2 内容规则:章节 / 图表 / 数据表 / KPI 四类报告指标 + 草稿状态) */}
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={5}>
          <Card size="small" bodyStyle={{ padding: 8 }}>
            <Statistic title="章节模块" value={stats.modules} suffix="个" valueStyle={{ fontSize: 18, color: '#1677FF' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" bodyStyle={{ padding: 8 }}>
            <Statistic title="图表" value={stats.charts} suffix="张" valueStyle={{ fontSize: 18, color: '#13C2C2' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" bodyStyle={{ padding: 8 }}>
            <Statistic title="数据表" value={stats.tables} suffix="张" valueStyle={{ fontSize: 18, color: '#722ED1' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" bodyStyle={{ padding: 8 }}>
            <Statistic title="KPI 指标" value={stats.kpis} suffix="组" valueStyle={{ fontSize: 18, color: '#FA8C16' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: 8 }} style={{ background: '#F0F5FF' }}>
            <div style={{ fontSize: 12, color: '#8C8C8C' }}>导出即完成</div>
            <div style={{ fontSize: 14, color: '#1677FF', fontWeight: 600, marginTop: 4 }}>
              <CheckOutlined /> 草稿状态
            </div>
          </Card>
        </Col>
      </Row>

      {/* 报告正文 */}
      <Card
        bordered={false}
        style={{
          marginTop: 12,
          border: '1px solid #F0F0F0',
          background: '#fff',
        }}
        bodyStyle={{ padding: '32px 48px', minHeight: 600 }}
      >
        <div {...{ [reportContainerSelector]: '' } as any}>
        {nodes.length === 0 ? (
          <Empty description="报告内容为空,请在编辑模式新增章节" />
        ) : (
          nodes.map((n) => (
            <NodeRenderer
              key={n.id}
              node={n}
              editable={mode === 'edit'}
              onTextChange={handleTextChange}
            />
          ))
        )}
        {/* 报告尾部 */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: '2px solid #1677FF',
            textAlign: 'right',
            color: '#8C8C8C',
            fontSize: 12,
          }}
        >
          — 报告结束 —
          <br />
          {scope === 'platform_admin' ? '信息科管理员' : '科室管理员'} ·
          {' '}
          {new Date().toISOString().slice(0, 10)} · 统一台账中心
        </div>
        </div>
      </Card>
    </div>
  );
};

export default ReportV33;
