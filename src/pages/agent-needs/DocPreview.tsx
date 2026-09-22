/**
 * 智能体建设需求管理 - 需求文档在线预览页
 *
 * 在线预览系统基于该条需求渲染的标准化需求文档，支持下载 Word / PDF。
 * 文档 HTML 由 docExport.buildNeedDocHtml 生成（预览与导出共用同一模板）。
 */
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Empty, Space, message } from 'antd';
import { FilePdfOutlined, FileWordOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { useNeeds } from './store';
import { buildNeedDocHtml, exportNeedPdf, exportNeedWord } from './docExport';

const NeedDocPreview = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const needs = useNeeds();
  const need = useMemo(() => needs.find((n) => n.id === id), [needs, id]);
  const docRef = useRef<HTMLDivElement>(null);
  const downloadParam = new URLSearchParams(window.location.search).get('download');
  const downloadPdfRequested = downloadParam === '1' || downloadParam === 'pdf';

  useEffect(() => {
    if (!need || !downloadPdfRequested) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const el = docRef.current?.querySelector<HTMLElement>('.need-doc');
      if (!el || cancelled) return;
      await exportNeedPdf(el, `需求文档-${need.title}`);
      if (!cancelled) {
        message.success('已开始下载 PDF 文档');
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [downloadPdfRequested, need]);

  if (!need) {
    return (
      <div style={{ padding: 0 }}>
        <PageHeader title="需求文档预览" showBack onBack={() => navigate('/app/agent-needs')} />
        <Card style={{ marginTop: 12 }}>
          <Empty description="未找到该需求记录" />
        </Card>
      </div>
    );
  }

  const handlePdf = async () => {
    const el = docRef.current?.querySelector<HTMLElement>('.need-doc');
    if (!el) return;
    await exportNeedPdf(el, `需求文档-${need.title}`);
    message.success('已导出 PDF 文档');
  };
  const handleWord = () => {
    exportNeedWord(need, `需求文档-${need.title}`);
    message.success('已导出 Word 文档');
  };

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        title="需求文档预览"
        subTitle={need.title}
        showBack
        onBack={() => navigate(-1)}
        extra={
          <Space>
            <Button icon={<FileWordOutlined />} onClick={handleWord}>
              下载 Word
            </Button>
            <Button type="primary" icon={<FilePdfOutlined />} onClick={handlePdf}>
              下载 PDF
            </Button>
          </Space>
        }
      />

      <Card style={{ marginTop: 12, background: '#F5F5F5' }} styles={{ body: { display: 'flex', justifyContent: 'center', padding: 24 } }}>
        <div
          ref={docRef}
          style={{ background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
          dangerouslySetInnerHTML={{ __html: buildNeedDocHtml(need) }}
        />
      </Card>
    </div>
  );
};

export default NeedDocPreview;
