import { useState } from 'react';
import { CloseOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, message, Modal, Typography, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd';

const { Text } = Typography;
const { Dragger } = Upload;
const MAX_SKILL_PACKAGE_SIZE = 50 * 1024 * 1024;

const hasSkillYamlMeta = (content: string) => {
  const yaml = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const source = yaml?.[1] ?? content;
  const hasName = /(^|\n)\s*(name|技能名称)\s*:\s*.+/.test(source);
  const hasDescription = /(^|\n)\s*(description|desc|技能描述)\s*:\s*.+/.test(source);
  return hasName && hasDescription;
};

type SkillImportModalProps = {
  open: boolean;
  onClose: () => void;
};

const SkillImportModal = ({ open, onClose }: SkillImportModalProps) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [autoInstall, setAutoInstall] = useState(false);

  const validateSkillFile: UploadProps['beforeUpload'] = async (file) => {
    if (file.size > MAX_SKILL_PACKAGE_SIZE) {
      message.error('技能包大小不能超过 50MB');
      return Upload.LIST_IGNORE;
    }

    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const name = file.name.toLowerCase();
    const isZip = name.endsWith('.zip');
    const isMd = name.endsWith('.md');
    const isSkillMd = name === 'skill.md' || relativePath?.toLowerCase().endsWith('/skill.md');

    if (!relativePath && !isZip && !isMd) {
      message.error('仅支持上传文件夹、.zip 或 .md 文件');
      return Upload.LIST_IGNORE;
    }

    if (isMd) {
      const content = await file.text();
      if (!hasSkillYamlMeta(content)) {
        message.error('.md 文件需包含 YAML 格式的技能名称和描述');
        return Upload.LIST_IGNORE;
      }
    }

    if (relativePath && !isSkillMd) {
      const nextFiles = [...fileList, file as unknown as UploadFile];
      const hasSkillMd = nextFiles.some((item) => {
        const itemPath = (
          (item as UploadFile & { originFileObj?: File & { webkitRelativePath?: string } }).originFileObj
            ?.webkitRelativePath ?? item.name
        ).toLowerCase();
        return itemPath.endsWith('/skill.md') || itemPath === 'skill.md';
      });
      if (!hasSkillMd) {
        message.warning('文件夹需要包含 SKILL.md 文件');
      }
    }

    return false;
  };

  const handleCancel = () => {
    onClose();
  };

  const handleImport = () => {
    if (fileList.length === 0) {
      message.warning('请先选择技能包文件');
      return;
    }

    const folderFiles = fileList.filter((file) => {
      const path = (file.originFileObj as (File & { webkitRelativePath?: string }) | undefined)?.webkitRelativePath;
      return !!path;
    });
    if (folderFiles.length > 0) {
      const hasSkillMd = folderFiles.some((file) => {
        const path =
          (file.originFileObj as (File & { webkitRelativePath?: string }) | undefined)?.webkitRelativePath ??
          file.name;
        return path.toLowerCase().endsWith('/skill.md') || path.toLowerCase() === 'skill.md';
      });
      if (!hasSkillMd) {
        message.error('文件夹需要包含 SKILL.md 文件');
        return;
      }
    }

    message.success(autoInstall ? '技能包已导入并自动安装' : '技能包已导入');
    setFileList([]);
    setAutoInstall(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={560}
      centered
      closeIcon={<CloseOutlined />}
      title={null}
      destroyOnHidden
      data-testid="skill-import-modal"
      styles={{
        content: { borderRadius: 18, padding: 0 },
        body: { padding: 0 },
      }}
    >
      <div style={{ padding: '30px 34px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Text strong style={{ fontSize: 20, color: '#1F2329' }}>
            导入技能
          </Text>
        </div>

        <Dragger
          multiple
          accept=".zip,.md"
          fileList={fileList}
          beforeUpload={validateSkillFile}
          onChange={({ fileList: next }) => setFileList(next)}
          onRemove={(file) => setFileList((prev) => prev.filter((item) => item.uid !== file.uid))}
          data-testid="skill-import-uploader"
          style={{
            borderRadius: 12,
            background: '#FFFFFF',
            padding: '24px 8px',
          }}
        >
          <p className="ant-upload-drag-icon" style={{ marginBottom: 12 }}>
            <InboxOutlined style={{ color: '#8C8C8C', fontSize: 34 }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16 }}>
            拖拽文件或点击上传
          </p>
        </Dragger>
        <div style={{ marginTop: 12 }}>
          <Upload
            multiple
            directory
            showUploadList={false}
            fileList={fileList}
            beforeUpload={validateSkillFile}
            onChange={({ fileList: next }) => setFileList(next)}
          >
            <Button size="small" type="text" icon={<PlusOutlined />} data-testid="skill-import-folder-button">
              选择文件夹
            </Button>
          </Upload>
        </div>

        <Checkbox
          checked={autoInstall}
          onChange={(event) => setAutoInstall(event.target.checked)}
          data-testid="skill-import-auto-install"
          style={{ marginTop: 18 }}
        >
          非高风险自动安装
        </Checkbox>

        <div style={{ marginTop: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 16 }}>
            文件要求
          </Text>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#6B7280', lineHeight: '28px' }}>
            <li>文件夹或者 .zip 需要包含 SKILL.md 文件</li>
            <li>.md 文件需包含 YAML 格式的技能名称和描述</li>
            <li>文件大小不能超过 50MB</li>
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 28 }}>
          <Button onClick={handleCancel}>取消</Button>
          <Button type="primary" onClick={handleImport} data-testid="skill-import-submit">
            导入
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SkillImportModal;
