import { useState } from 'react';
import { Input, Card, Typography, Tree, Collapse, Space, Breadcrumb } from 'antd';
import { SearchOutlined, FileTextOutlined, FolderOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';

const { Title, Text, Paragraph } = Typography;

const { Search } = Input;

interface HelpDoc {
  id: string;
  title: string;
  category: string;
  content: string;
}

const helpDocs: HelpDoc[] = [
  {
    id: 'doc-001',
    title: '平台快速入门',
    category: '快速入门',
    content: `
# 平台快速入门

欢迎使用医疗智能体管理平台！本指南将帮助您快速了解平台功能并开始使用。

## 第一步：注册账号

访问平台首页，点击"立即注册"按钮，填写个人信息完成注册。注册成功后即可登录平台。

## 第二步：浏览智能体

登录后，您可以在"智能体展示"页面浏览所有已上线的智能体，了解各智能体的功能、适用场景和接入要求。

## 第三步：申请接入

找到您需要的智能体后，点击"申请接入"按钮，填写接入申请表。提交后，平台管理员将对您的申请进行审核。

## 第四步：获取 API 密钥

申请通过后，您可以在"API 管理"页面获取 API 密钥，用于调用智能体接口。

## 第五步：开始使用

使用获取的 API 密钥，按照智能体提供的 API 文档进行开发集成，即可开始使用智能体服务。
    `.trim(),
  },
  {
    id: 'doc-002',
    title: '智能体接入指南',
    category: '接入指南',
    content: `
# 智能体接入指南

本指南详细说明如何将智能体接入平台。

## 接入前准备

在开始接入前，请确保您具备以下条件：
- 已完成平台账号注册
- 拥有智能体的技术文档
- 具备 API 对接开发能力

## 接入流程

1. **注册智能体信息**：填写智能体的基本信息、技术架构、接口规范等
2. **提交审核材料**：上传医疗器械注册证、技术架构说明书等备案材料
3. **完成技术评测**：平台将对智能体进行功能、性能、安全等方面的评测
4. **签署接入协议**：评测通过后，与平台签署接入协议
5. **正式上线运营**：完成上述步骤后，智能体即可正式上线运营

## 技术要求

- 接口协议：支持 REST 或 gRPC
- 认证方式：支持 API Key、OAuth2、JWT 等
- 服务可用性：需提供健康检查接口，SLA 不低于 99.9%
    `.trim(),
  },
  {
    id: 'doc-003',
    title: 'API 调用教程',
    category: '使用教程',
    content: `
# API 调用教程

本教程说明如何使用平台提供的 API 调用智能体服务。

## 获取 Access Token

在使用 API 之前，您需要先获取 Access Token：

\`\`\`
POST /api/v1/auth/token
Content-Type: application/json

{
  "api_key": "your_api_key",
  "api_secret": "your_api_secret"
}
\`\`\`

## 调用智能体接口

获取 Token 后，您可以通过以下方式调用智能体接口：

\`\`\`
POST /api/v1/agent/{agent_id}/invoke
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "task": "智能诊断任务",
  "parameters": {
    "patient_id": "P12345",
    "symptoms": ["发热", "咳嗽"]
  }
}
\`\`\`

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权或 Token 过期 |
| 403 | 无权访问该智能体 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |
    `.trim(),
  },
  {
    id: 'doc-004',
    title: '常见问题 FAQ',
    category: '常见问题',
    content: `
# 常见问题 FAQ

## Q: 如何申请接入新的智能体？

A: 您可以在"智能体接入中心"页面提交接入申请，填写智能体信息和上传备案材料。平台管理员将在 3 个工作日内完成审核。

## Q: API 调用频率有限制吗？

A: 不同类型的智能体有不同的调用频率限制。基础套餐为每分钟 100 次调用，如需更高频率，请联系平台管理员。

## Q: 智能体调用失败怎么办？

A: 首先检查请求参数是否正确，然后查看错误码说明。如果问题持续存在，请提交工单或联系技术支持。

## Q: 如何查看我的 API 使用情况？

A: 您可以在"监控中心"页面查看 API 调用统计，包括调用量、响应时间、错误率等指标。

## Q: 智能体响应时间过长怎么处理？

A: 您可以在"监控中心"的性能监控页面查看各智能体的响应时间分布。如果响应时间持续过长，请检查网络环境或联系智能体供应商。
    `.trim(),
  },
  {
    id: 'doc-005',
    title: '账户与权限管理',
    category: '使用教程',
    content: `
# 账户与权限管理

本指南说明如何管理平台账户和权限。

## 角色说明

平台支持三种用户角色：

- **平台管理员**：拥有全部权限，可管理所有模块
- **科室管理员**：管理本科室的智能体接入和用户
- **普通用户**：查看和使用已上线的智能体

## 修改个人信息

在"用户中心"页面，您可以修改个人信息，包括姓名、手机号、邮箱等。

## 修改密码

为了账户安全，建议您定期修改密码。点击"修改密码"后，输入当前密码和新密码即可完成修改。
    `.trim(),
  },
  {
    id: 'doc-006',
    title: '数据安全指南',
    category: '接入指南',
    content: `
# 数据安全指南

本指南说明平台的数据安全措施和使用规范。

## 数据加密

平台对所有传输数据进行 TLS 1.3 加密存储，确保数据在传输过程中的安全性。

## 敏感信息保护

- 用户密码采用 bcrypt 加盐哈希存储
- API 密钥仅在创建时显示一次，后续不再明文展示
- 敏感操作需二次验证

## 合规说明

平台已通过等保三级认证，符合医疗行业数据安全要求。所有智能体接入前需完成安全评测。
    `.trim(),
  },
];

const categories = [
  {
    title: '快速入门',
    key: '快速入门',
    icon: <FolderOutlined />,
    children: helpDocs.filter((d) => d.category === '快速入门').map((d) => ({
      key: d.id,
      title: d.title,
      icon: <FileTextOutlined />,
    })),
  },
  {
    title: '接入指南',
    key: '接入指南',
    icon: <FolderOutlined />,
    children: helpDocs.filter((d) => d.category === '接入指南').map((d) => ({
      key: d.id,
      title: d.title,
      icon: <FileTextOutlined />,
    })),
  },
  {
    title: '使用教程',
    key: '使用教程',
    icon: <FolderOutlined />,
    children: helpDocs.filter((d) => d.category === '使用教程').map((d) => ({
      key: d.id,
      title: d.title,
      icon: <FileTextOutlined />,
    })),
  },
  {
    title: '常见问题',
    key: '常见问题',
    icon: <FolderOutlined />,
    children: helpDocs.filter((d) => d.category === '常见问题').map((d) => ({
      key: d.id,
      title: d.title,
      icon: <FileTextOutlined />,
    })),
  },
];

const faqItems = [
  {
    key: 'faq-1',
    label: '如何申请接入新的智能体？',
    children: (
      <Paragraph style={{ margin: 0 }}>
        您可以在"智能体接入中心"页面提交接入申请，填写智能体信息和上传备案材料。
        平台管理员将在 3 个工作日内完成审核。
      </Paragraph>
    ),
  },
  {
    key: 'faq-2',
    label: 'API 调用频率有限制吗？',
    children: (
      <Paragraph style={{ margin: 0 }}>
        不同类型的智能体有不同的调用频率限制。基础套餐为每分钟 100 次调用，
        如需更高频率，请联系平台管理员。
      </Paragraph>
    ),
  },
  {
    key: 'faq-3',
    label: '智能体调用失败怎么办？',
    children: (
      <Paragraph style={{ margin: 0 }}>
        首先检查请求参数是否正确，然后查看错误码说明。
        如果问题持续存在，请提交工单或联系技术支持。
      </Paragraph>
    ),
  },
  {
    key: 'faq-4',
    label: '如何查看 API 使用情况？',
    children: (
      <Paragraph style={{ margin: 0 }}>
        您可以在"监控中心"页面查看 API 调用统计，包括调用量、响应时间、错误率等指标。
      </Paragraph>
    ),
  },
  {
    key: 'faq-5',
    label: '智能体响应时间过长怎么处理？',
    children: (
      <Paragraph style={{ margin: 0 }}>
        您可以在"监控中心"的性能监控页面查看各智能体的响应时间分布。
        如果响应时间持续过长，请检查网络环境或联系智能体供应商。
      </Paragraph>
    ),
  },
];

const Help = () => {
  const [selectedDoc, setSelectedDoc] = useState<HelpDoc>(helpDocs[0]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['快速入门', '接入指南', '使用教程', '常见问题']);
  const [searchText, setSearchText] = useState('');

  const onSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const doc = helpDocs.find((d) => d.id === selectedKeys[0]);
      if (doc) {
        setSelectedDoc(doc);
      }
    }
  };

  const filteredDocs = searchText
    ? helpDocs.filter(
        (d) =>
          d.title.includes(searchText) || d.content.includes(searchText)
      )
    : helpDocs;

  return (
    <div style={{ padding: '24px 48px', background: '#F5F5F5', minHeight: '100vh' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: '首页' },
          { title: '帮助中心' },
          { title: selectedDoc?.category },
          { title: selectedDoc?.title },
        ]}
      />

      <div style={{ marginBottom: 24 }}>
        <Search
          placeholder="搜索文档..."
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          onSearch={setSearchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Left Sidebar - Document Tree */}
        <Card style={{ width: 280, flexShrink: 0 }} styles={{ body: { padding: 12 } }}>
          <Title level={5} style={{ marginBottom: 16 }}>文档分类</Title>
          <Tree
            showIcon
            blockNode
            expandedKeys={expandedKeys}
            onExpand={setExpandedKeys}
            onSelect={onSelect}
            treeData={categories}
            selectedKeys={[selectedDoc?.id || '']}
          />
        </Card>

        {/* Main Content - Document View */}
        <Card style={{ flex: 1 }} styles={{ body: { padding: 32, minHeight: 600 } }}>
          {selectedDoc ? (
            <>
              <Title level={3} style={{ marginBottom: 8 }}>{selectedDoc.title}</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                分类：{selectedDoc.category}
              </Text>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedDoc.content.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return <Title key={idx} level={2} style={{ marginTop: 24 }}>{line.slice(2)}</Title>;
                  }
                  if (line.startsWith('## ')) {
                    return <Title key={idx} level={3} style={{ marginTop: 20 }}>{line.slice(3)}</Title>;
                  }
                  if (line.startsWith('### ')) {
                    return <Title key={idx} level={4} style={{ marginTop: 16 }}>{line.slice(4)}</Title>;
                  }
                  if (line.startsWith('- ')) {
                    return <li key={idx} style={{ marginLeft: 16 }}>{line.slice(2)}</li>;
                  }
                  if (line.startsWith('| ')) {
                    return <div key={idx} style={{ fontFamily: 'monospace', margin: '4px 0' }}>{line}</div>;
                  }
                  if (line.startsWith('```')) {
                    return null;
                  }
                  if (line.trim()) {
                    return <Paragraph key={idx}>{line}</Paragraph>;
                  }
                  return <br key={idx} />;
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 100 }}>
              <Text type="secondary">请选择要查看的文档</Text>
            </div>
          )}
        </Card>
      </div>

      {/* FAQ Section */}
      <Card title="常见问题" style={{ marginTop: 24 }} styles={{ body: { padding: '0 24px 24px' } }}>
        <Collapse items={faqItems} defaultActiveKey={['faq-1']} />
      </Card>
    </div>
  );
};

export default Help;
