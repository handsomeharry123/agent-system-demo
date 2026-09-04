import { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Input,
  Button,
  Space,
  Typography,
  Tag,
  Avatar,
  Tooltip,
  Divider,
  Upload,
  Progress,
  Card,
  Collapse,
  Spin,
  message,
} from 'antd';
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  CloseOutlined,
  SendOutlined,
  PaperClipOutlined,
  PlusOutlined,
  HistoryOutlined,
  LikeOutlined,
  DislikeOutlined,
  CopyOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  RobotOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import type { UploadFile } from 'antd';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  citations?: { title: string; source: string; snippet: string }[];
  context?: { label: string; value: string }[];
}

interface QuickCommand {
  label: string;
  command: string;
}

interface FlowNode {
  id: string;
  name: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'waiting_review';
  result?: string;
}

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
  sceneName: string;
  agentName?: string;
  isOrchestration?: boolean;
  flowNodes?: FlowNode[];
}

const quickCommands: QuickCommand[] = [
  { label: '整理主诉', command: '请帮我整理患者的主诉信息' },
  { label: '生成病历摘要', command: '请生成病历摘要' },
  { label: '用药建议', command: '请提供用药建议' },
  { label: '风险评估', command: '请进行风险评估' },
];

const mockResponses = [
  '根据您提供的信息，我已经完成了分析。\n\n**主要发现：**\n- 患者主诉：发热、咳嗽3天\n- 体温：38.5°C\n- 血常规：白细胞升高\n\n**建议：**\n1. 进一步完善胸部CT检查\n2. 经验性抗感染治疗\n3. 密切观察病情变化',
  '好的，我现在开始执行病历生成任务。\n\n**正在分析患者数据...**\n\n检测到以下关键信息：\n- 基本信息：姓名、年龄、性别\n- 主诉：发热、咳嗽\n- 现病史：3天前开始\n- 既往史：无特殊\n\n**病历摘要生成中...**',
  '已完成初步分析。\n\n```json\n{\n  "patient_id": "P20240520001",\n  "chief_complaint": "发热、咳嗽3天",\n  "preliminary_diagnosis": "上呼吸道感染",\n  "suggested_tests": ["血常规", "CRP", "胸部X光"],\n  "medication_suggestion": "对症处理，必要时加用抗生素"\n}\n```\n\n请问是否需要进一步分析？',
];

const ChatDrawer = ({
  open,
  onClose,
  sceneName,
  agentName = '智能助手',
  isOrchestration = false,
  flowNodes = [],
}: ChatDrawerProps) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  const currentNode = flowNodes[currentNodeIndex];
  const completedNodes = flowNodes.filter((n) => n.status === 'completed');
  const progressPercent = (completedNodes.length / flowNodes.length) * 100;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `欢迎使用 **${sceneName}**${isOrchestration ? '（多智能体编排场景）' : ''}！\n\n我可以帮您完成以下任务：\n- 智能问诊与分诊\n- 病历信息整理\n- 检查检验建议\n- 诊断推理辅助\n\n请描述您的问题或选择快捷指令开始。`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [open, sceneName, isOrchestration]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    // Simulate streaming response
    setTimeout(() => {
      const mockResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: mockResponse,
        timestamp: new Date().toISOString(),
        citations: [
          { title: '临床诊疗指南', source: '中华医学杂志', snippet: '...发热患者应首先考虑...' },
          { title: '药品说明书', source: '药典', snippet: '...用法用量详见...' },
        ],
        context: [
          { label: '患者ID', value: 'P20240520001' },
          { label: '科室', value: '心内科' },
          { label: '就诊类型', value: '门诊' },
        ],
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLoading(false);
    }, 1500);
  };

  const handleQuickCommand = (command: string) => {
    setInputValue(command);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    message.success('已复制到剪贴板');
  };

  const handleNewConversation = () => {
    setMessages([]);
    setCurrentNodeIndex(0);
  };

  const handleReviewConfirm = () => {
    if (currentNode) {
      const updatedNodes = [...flowNodes];
      updatedNodes[currentNodeIndex] = { ...currentNode, status: 'completed' };
      if (currentNodeIndex < flowNodes.length - 1) {
        updatedNodes[currentNodeIndex + 1] = { ...updatedNodes[currentNodeIndex + 1], status: 'running' };
        setCurrentNodeIndex(currentNodeIndex + 1);
      }
      message.success('已确认，进入下一节点');
    }
  };

  const drawerWidth = fullscreen ? '100%' : '40%';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={drawerWidth}
      closable={false}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column' },
        header: { display: 'none' },
      }}
      placement="right"
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
        }}
      >
        <div>
          <Space>
            <Title level={5} style={{ margin: 0 }}>{sceneName}</Title>
            {!isOrchestration && <Tag color="blue">{agentName}</Tag>}
          </Space>
          {isOrchestration && currentNode && (
            <div style={{ marginTop: 8 }}>
              <Space size={4}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  当前节点：
                </Text>
                <Tag color="processing">{currentNode.name}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ({currentNodeIndex + 1}/{flowNodes.length})
                </Text>
              </Space>
              <Progress
                percent={progressPercent}
                size="small"
                showInfo={false}
                style={{ width: 200, marginTop: 4 }}
              />
            </div>
          )}
        </div>
        <Space>
          <Tooltip title={fullscreen ? '退出全屏' : '全屏'}>
            <Button
              type="text"
              icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setFullscreen(!fullscreen)}
            />
          </Tooltip>
          <Tooltip title="关闭">
            <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
          </Tooltip>
        </Space>
      </div>

      {/* Orchestration: Node List */}
      {isOrchestration && flowNodes.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            background: '#fafafa',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {flowNodes.map((node, idx) => (
              <Tag
                key={node.id}
                color={
                  node.status === 'completed' ? 'success' :
                  node.status === 'running' ? 'processing' :
                  node.status === 'waiting_review' ? 'warning' : 'default'
                }
                icon={
                  node.status === 'completed' ? <CheckCircleOutlined /> :
                  node.status === 'running' ? <LoadingOutlined /> : undefined
                }
                style={{ whiteSpace: 'nowrap' }}
              >
                {node.status === 'pending' && idx + 1 + '. '}
                {node.name}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          background: '#F5F5F5',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 16,
            }}
          >
            {msg.role === 'assistant' && (
              <Avatar
                icon={<RobotOutlined />}
                style={{ marginRight: 8, background: '#1677FF' }}
              />
            )}
            <div
              style={{
                maxWidth: '70%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {/* Context Tags */}
              {msg.context && msg.context.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <Space size={4} wrap>
                    {msg.context.map((ctx, idx) => (
                      <Tag key={idx} style={{ fontSize: 11 }}>{ctx.label}: {ctx.value}</Tag>
                    ))}
                  </Space>
                </div>
              )}

              {/* Message Bubble */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: msg.role === 'user' ? '#1677FF' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <Collapse
                  ghost
                  size="small"
                  style={{ marginTop: 4, width: '100%' }}
                  items={[{
                    key: 'citations',
                    label: <Text type="secondary" style={{ fontSize: 12 }}>引用来源 ({msg.citations.length})</Text>,
                    children: msg.citations.map((cit, idx) => (
                      <Card key={idx} size="small" style={{ marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 12 }}>{cit.title}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>{cit.source}</Text>
                        <Divider style={{ margin: '4px 0' }} />
                        <Text style={{ fontSize: 12 }}>{cit.snippet}</Text>
                      </Card>
                    )),
                  }]}
                />
              )}

              {/* Timestamp */}
              <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </div>

            {msg.role === 'user' && (
              <Avatar
                icon={<UserOutlined />}
                style={{ marginLeft: 8, background: '#52C41A' }}
              />
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar icon={<RobotOutlined />} style={{ background: '#1677FF' }} />
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            >
              <Spin size="small" /> <Text type="secondary" style={{ marginLeft: 8 }}>正在思考...</Text>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Human Review Card */}
      {isOrchestration && currentNode?.status === 'waiting_review' && (
        <Card
          size="small"
          style={{ margin: '0 16px 8px', background: '#fffbe6', border: '1px solid #ffe58f' }}
        >
          <Space>
            <Text strong>人工审核节点</Text>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Text>{currentNode.name} 已完成初步分析，请确认结果是否正确。</Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Space>
              <Button type="primary" size="small" onClick={handleReviewConfirm}>确认并继续</Button>
              <Button size="small" onClick={() => message.info('请修改输入后重试')}>返回修改</Button>
            </Space>
          </div>
        </Card>
      )}

      {/* Input Area */}
      <div
        style={{
          padding: 12,
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
        }}
      >
        {/* Quick Commands */}
        <div style={{ marginBottom: 8 }}>
          <Space wrap size={4}>
            {quickCommands.map((cmd) => (
              <Tag
                key={cmd.command}
                style={{ cursor: 'pointer', border: '1px dashed #d9d9d9' }}
                onClick={() => handleQuickCommand(cmd.command)}
              >
                {cmd.label}
              </Tag>
            ))}
          </Space>
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Upload
            showUploadList={false}
            beforeUpload={() => {
              message.info('附件上传功能开发中');
              return false;
            }}
          >
            <Button icon={<PaperClipOutlined />} type="text" />
          </Upload>
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Shift+Enter 换行，Enter 发送..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!inputValue.trim() || loading}
          />
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          background: '#fafafa',
        }}
      >
        <Space>
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={handleNewConversation}
            size="small"
          >
            新建对话
          </Button>
          <Button
            type="text"
            icon={<HistoryOutlined />}
            onClick={() => setShowHistory(!showHistory)}
            size="small"
          >
            对话记录
          </Button>
        </Space>
        <Space>
          <Tooltip title="有帮助">
            <Button type="text" icon={<LikeOutlined />} size="small" />
          </Tooltip>
          <Tooltip title="没帮助">
            <Button type="text" icon={<DislikeOutlined />} size="small" />
          </Tooltip>
          <Tooltip title="复制结果">
            <Button
              type="text"
              icon={<CopyOutlined />}
              size="small"
              onClick={() => {
                const lastMsg = messages.filter((m) => m.role === 'assistant').pop();
                if (lastMsg) handleCopy(lastMsg.content);
              }}
            />
          </Tooltip>
        </Space>
      </div>
    </Drawer>
  );
};

export default ChatDrawer;
