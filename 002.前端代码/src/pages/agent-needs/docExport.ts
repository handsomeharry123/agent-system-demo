/**
 * 智能体建设需求管理 - 需求文档导出工具
 *
 *   - buildNeedDocHtml(need): 生成标准化需求文档的 HTML 片段（预览页与 Word 导出共用）
 *   - exportNeedPdf(el, filename): html2canvas → jsPDF 多页切分（参照 evaluation/ReportPdf.tsx）
 *   - exportNeedWord(need, filename): 拼 HTML → Blob(application/msword) → 触发 .doc 下载
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { BuildNeed } from './types';

const esc = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

const stageText = (n: BuildNeed) =>
  n.clinicalStage === '其他' && n.clinicalStageOther ? `其他（${n.clinicalStageOther}）` : n.clinicalStage;

/** 生成标准化需求文档 HTML（body 内片段） */
export const buildNeedDocHtml = (need: BuildNeed): string => {
  const matchRows =
    need.matchResult && need.matchResult.top.length > 0
      ? need.matchResult.top
          .map(
            (m, i) =>
              `<tr><td>${i + 1}</td><td>${esc(m.agentCode)}</td><td>${esc(m.agentName)}</td><td>${m.score}%</td></tr>`,
          )
          .join('')
      : `<tr><td colspan="4" style="text-align:center;color:#999;">暂无匹配智能体</td></tr>`;

  return `
  <div class="need-doc" style="font-family:'Microsoft YaHei','PingFang SC',sans-serif;color:#1F1F1F;width:720px;margin:0 auto;padding:32px 40px;background:#fff;box-sizing:border-box;">
    <h1 style="text-align:center;font-size:24px;margin:0 0 4px;">智能体建设需求文档</h1>
    <p style="text-align:center;color:#888;margin:0 0 24px;font-size:13px;">${esc(need.title)}</p>

    <h2 style="font-size:16px;border-left:4px solid #1677FF;padding-left:8px;margin:24px 0 12px;">一、基本信息</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;" border="1" cellpadding="8" cellspacing="0" bordercolor="#E5E5E5">
      <tr><td style="width:120px;background:#FAFAFA;">需求标题</td><td>${esc(need.title)}</td></tr>
      <tr><td style="background:#FAFAFA;">提出科室</td><td>${esc(need.department)}</td></tr>
      <tr><td style="background:#FAFAFA;">提出人</td><td>${esc(need.proposer)}</td></tr>
      <tr><td style="background:#FAFAFA;">联系方式</td><td>${esc(need.contactPhone)}</td></tr>
      <tr><td style="background:#FAFAFA;">诊疗环节</td><td>${esc(stageText(need))}</td></tr>
      <tr><td style="background:#FAFAFA;">所需资源</td><td>${esc((need.resources || []).join('、') || '—')}</td></tr>
      <tr><td style="background:#FAFAFA;">需求紧急程度</td><td>${esc(need.urgency)}</td></tr>
      <tr><td style="background:#FAFAFA;">提出时间</td><td>${esc(need.submitTime || need.lastUpdateTime)}</td></tr>
    </table>

    <h2 style="font-size:16px;border-left:4px solid #1677FF;padding-left:8px;margin:24px 0 12px;">二、提出原因</h2>
    <p style="font-size:14px;line-height:1.9;margin:0;white-space:pre-wrap;">${esc(need.reason || '—')}</p>

    <h2 style="font-size:16px;border-left:4px solid #1677FF;padding-left:8px;margin:24px 0 12px;">三、功能描述</h2>
    <p style="font-size:14px;line-height:1.9;margin:0;white-space:pre-wrap;">${esc(need.functionDesc || '—')}</p>

    <h2 style="font-size:16px;border-left:4px solid #1677FF;padding-left:8px;margin:24px 0 12px;">四、智能化匹配结果（TOP3）</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;" border="1" cellpadding="8" cellspacing="0" bordercolor="#E5E5E5">
      <thead><tr style="background:#FAFAFA;"><th style="width:48px;">排名</th><th>智能体编号</th><th>智能体名称</th><th style="width:90px;">匹配度</th></tr></thead>
      <tbody>${matchRows}</tbody>
    </table>

    <p style="margin-top:40px;color:#999;font-size:12px;text-align:right;">本文档由「智能体建设需求管理」模块自动生成</p>
  </div>`;
};

/** 从已渲染的 DOM 节点导出为 PDF（多页切分） */
export const exportNeedPdf = async (el: HTMLElement, filename: string): Promise<void> => {
  const canvas = await html2canvas(el, {
    scale: 1.5,
    backgroundColor: '#FFFFFF',
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const imgW = pdfW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.9);

  if (imgH <= pdfH) {
    pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH, undefined, 'FAST');
  } else {
    let yOffset = 0;
    let pageIdx = 0;
    while (yOffset < imgH) {
      if (pageIdx > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -yOffset, imgW, imgH, undefined, 'FAST');
      yOffset += pdfH;
      pageIdx += 1;
    }
  }
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
};

/** 导出为 Word（.doc，HTML Blob 方案，Word 可正常打开） */
export const exportNeedWord = (need: BuildNeed, filename: string): void => {
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(
    need.title,
  )}</title></head><body>${buildNeedDocHtml(need)}</body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
