import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Typography, Tag, message, Form, Input,
  Select, Switch, Divider, Modal, Tooltip, Dropdown, Popconfirm,
  Alert, theme, Drawer, InputNumber, Table, Collapse, Timeline,
  Descriptions, Badge, Empty, Tabs, List
} from 'antd';
import type { MenuProps } from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, UndoOutlined, RedoOutlined,
  ZoomInOutlined, ZoomOutOutlined, PlayCircleOutlined, SettingOutlined,
  DeleteOutlined, MoreOutlined, EyeOutlined, NodeIndexOutlined,
  FileImageOutlined, SaveFilled, HistoryOutlined, AlignLeftOutlined,
  StopOutlined, RobotOutlined, CheckCircleOutlined, PlusOutlined,
  HolderOutlined, DownOutlined, UpOutlined, InfoCircleOutlined, WarningOutlined,
  BugOutlined, StepForwardOutlined, PauseCircleOutlined, ReloadOutlined, SendOutlined,
  FileTextOutlined, UploadOutlined
} from '@ant-design/icons';
import type { NodeType, FlowNode, Connection } from '../../mock/orchestration';
import { mockFlows, flowStatusColors, nodeTypeLabels, nodeStatusColors } from '../../mock/orchestration';
import { mockAgents } from '../../mock';
import { getAgentSchema } from '../../services/orchestrationApi';

const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;
const { TextArea } = Input;

// ============ Node Type Config ============
const nodeTypeConfig: Record<NodeType, { label: string; icon: React.ReactNode; color: string; bgColor: string; description: string }> = {
  start: { label: '开始节点', icon: <PlayCircleOutlined />, color: '#1890FF', bgColor: '#E6F7FF', description: '流程入口，定义开场白和全局变量' },
  input: { label: '输入节点', icon: <InfoCircleOutlined />, color: '#1677FF', bgColor: '#E6F4FF', description: '等待用户输入（对话框/表单）' },
  output: { label: '输出节点', icon: <CheckCircleOutlined />, color: '#52C41A', bgColor: '#F6FFED', description: '向用户展示处理结果' },
  agent: { label: 'Agent节点', icon: <RobotOutlined />, color: '#722ED1', bgColor: '#F9F0FF', description: '调用已注册智能体' },
  condition: { label: '条件分支', icon: <NodeIndexOutlined />, color: '#FA8C16', bgColor: '#FFF7E6', description: '根据条件分流' },
  end: { label: '结束节点', icon: <StopOutlined />, color: '#8C8C8C', bgColor: '#F5F5F5', description: '流程出口' },
};

// Node categories for left panel
const nodeCategories = [
  { label: '流程控制', types: ['start', 'end', 'condition'] as NodeType[] },
  { label: '智能体调度', types: ['agent'] as NodeType[] },
  { label: '人机交互', types: ['input', 'output'] as NodeType[] },
];

// ============ Variable Selector Component ============
interface VariableSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  variables?: { name: string; type: string; source: string }[];
  placeholder?: string;
}

const VariableSelector: React.FC<VariableSelectorProps> = ({ value, onChange, variables = [], placeholder = '选择变量或输入 {变量名}' }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredVars = variables.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.source.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (varName: string) => {
    onChange?.(`{${varName}}`);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        suffix={
          <Button type="text" size="small" onClick={() => setOpen(!open)} style={{ padding: 0, height: 'auto' }}>
            <Text style={{ color: '#1890FF', fontSize: 12 }}>{ }</Text>
          </Button>
        }
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: 'white', border: '1px solid #d9d9d9', borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)', maxHeight: 200, overflow: 'auto'
        }}>
          <Input placeholder="搜索变量..." size="small" value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #f0f0f0' }} />
          {filteredVars.length === 0 ? (
            <div style={{ padding: 8, color: '#999' }}>无匹配变量</div>
          ) : (
            filteredVars.map((v) => (
              <div key={v.name} onClick={() => handleSelect(v.name)} style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                <Text code>{v.name}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{v.source}</Text>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ============ Main FlowEditor Component ============
const FlowEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const canvasRef = useRef<HTMLDivElement>(null);

  // State
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [scale, setScale] = useState(100);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved'>('saved');
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [publishForm] = Form.useForm();
  const [debugPanelVisible, setDebugPanelVisible] = useState(false);
  const [debugging, setDebugging] = useState(false);
  const [currentDebugNode, setCurrentDebugNode] = useState<string | null>(null);
  const [debugVariables, setDebugVariables] = useState<Record<string, any>>({});
  const [expandedVarKeys, setExpandedVarKeys] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; timestamp: Date }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationErrorNodes, setValidationErrorNodes] = useState<string[]>([]);
  const [history, setHistory] = useState<{ nodes: FlowNode[]; connections: Connection[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [workflowPreviewVisible, setWorkflowPreviewVisible] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [workflowLogs, setWorkflowLogs] = useState<{ nodeName: string; nodeType: string; status: string; duration: number; input?: any; output?: any; error?: string }[]>([]);
  const [currentPreviewNode, setCurrentPreviewNode] = useState<string | null>(null);

  // Mouse-based dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Node expanded/collapsed state - all nodes expanded by default
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Connection drawing state
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; port: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const isNewFlow = id === 'new';
  const flow = isNewFlow ? null : mockFlows.find((f) => f.id === id);

  // Get available variables from upstream nodes
  const getAvailableVariables = useCallback(() => {
    const vars: { name: string; type: string; source: string }[] = [
      { name: 'current_time', type: 'string', source: '系统变量' },
      { name: 'chat_history', type: 'array', source: '系统变量' },
      { name: 'user_input', type: 'string', source: '系统变量' },
      { name: 'session_id', type: 'string', source: '系统变量' },
      { name: 'flow_id', type: 'string', source: '系统变量' },
    ];
    nodes.forEach((node) => {
      if (node.type === 'input' && node.config.input?.formFields) {
        node.config.input.formFields.forEach((field) => {
          vars.push({ name: field.variableName, type: field.type, source: `输入节点: ${node.name}` });
        });
      }
      if (node.type === 'agent' && node.config.agent?.outputMappings) {
        node.config.agent.outputMappings.forEach((mapping) => {
          vars.push({ name: mapping.outputVariableName, type: mapping.dataType, source: `Agent节点: ${node.name}` });
        });
      }
      if (node.type === 'output' && node.config.output?.displayVariables) {
        node.config.output.displayVariables.forEach((v) => {
          vars.push({ name: v, type: 'any', source: `输出节点: ${node.name}` });
        });
      }
    });
    return vars;
  }, [nodes]);

  // Initialize
  useEffect(() => {
    if (isNewFlow) {
      setFlowName('新建流程');
      setFlowDescription('');
      const initialNodes: FlowNode[] = [
        { id: 'start-1', name: '开始', type: 'start', x: 300, y: 50, config: { start: { welcomeMessage: '', guideQuestions: [] } } },
        { id: 'end-1', name: '结束', type: 'end', x: 300, y: 450, config: {} },
      ];
      setNodes(initialNodes);
      setConnections([]);
      saveToHistory(initialNodes, []);
    } else if (flow) {
      setFlowName(flow.name);
      setFlowDescription(flow.description);
      if (flow.nodes.length > 0) {
        setNodes(flow.nodes);
        setConnections(flow.connections);
        saveToHistory(flow.nodes, flow.connections);
      } else {
        // Default template for empty flow
        const initialNodes: FlowNode[] = [
          { id: 'start-1', name: '开始', type: 'start', x: 300, y: 50, config: { start: { welcomeMessage: '', guideQuestions: [] } } },
          { id: 'end-1', name: '结束', type: 'end', x: 300, y: 450, config: {} },
        ];
        setNodes(initialNodes);
        setConnections([]);
        saveToHistory(initialNodes, []);
      }
    }
  }, [id, isNewFlow, flow]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (isCtrl && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (isCtrl && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (isCtrl && e.key === 'd') {
        e.preventDefault();
        // Duplicate selected node
        const nodeToDuplicate = nodes.find(n => n.id === selectedNodeId);
        if (selectedNodeId && nodeToDuplicate) {
          const newNode = {
            ...nodeToDuplicate,
            id: `${nodeToDuplicate.type}-${Date.now()}`,
            name: `${nodeToDuplicate.name}-副本`,
            x: nodeToDuplicate.x + 20,
            y: nodeToDuplicate.y + 20,
          };
          const newNodes = [...nodes, newNode];
          setNodes(newNodes);
          saveToHistory(newNodes, connections);
          setSelectedNodeId(newNode.id);
          setSaveStatus('unsaved');
          message.success('节点已复制');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedNodeId) {
          handleDeleteNode();
        } else if (selectedConnectionId) {
          handleDeleteConnection();
        }
      } else if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setSelectedConnectionId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedConnectionId, nodes, connections, historyIndex, saveStatus]);

  // Global mouse event handlers for dragging nodes and drawing connections
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingNodeId) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left - dragOffset.x) / (scale / 100);
          const y = (e.clientY - rect.top - dragOffset.y) / (scale / 100);
          setNodes(prev => prev.map(n =>
            n.id === draggingNodeId ? { ...n, x, y } : n
          ));
          setSaveStatus('unsaved');
        }
      }
      if (connectingFrom) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          setMousePos({
            x: (e.clientX - rect.left) / (scale / 100),
            y: (e.clientY - rect.top) / (scale / 100),
          });
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (draggingNodeId) {
        setDraggingNodeId(null);
        saveToHistory(nodes, connections);
      }
      if (connectingFrom) {
        setConnectingFrom(null);
        // Remove temp connection if exists
        setConnections(prev => prev.filter(c => c.id !== 'temp'));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingNodeId, dragOffset, connectingFrom, scale, nodes, connections, saveStatus]);

  const saveToHistory = useCallback((newNodes: FlowNode[], newConnections: Connection[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...newNodes], connections: [...newConnections] });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setNodes(prev.nodes);
      setConnections(prev.connections);
      setHistoryIndex(historyIndex - 1);
      setSaveStatus('unsaved');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setNodes(next.nodes);
      setConnections(next.connections);
      setHistoryIndex(historyIndex + 1);
      setSaveStatus('unsaved');
    }
  };

  // Node operations
  const handleAddNode = (type: NodeType, x: number, y: number) => {
    const config = nodeTypeConfig[type];
    let newNode: FlowNode = {
      id: `${type}-${Date.now()}`,
      name: config.label.replace('节点', ''),
      type,
      x,
      y,
      config: {},
    };

    // Set default config based on type
    switch (type) {
      case 'start':
        newNode.config.start = { welcomeMessage: '', guideQuestions: [] };
        break;
      case 'input':
        newNode.config.input = { inputMode: 'dialog', formFields: [] };
        break;
      case 'output':
        newNode.config.output = { contentTemplate: '', displayVariables: [], displayMode: 'bubble', interactionMode: 'none' };
        break;
      case 'agent':
        newNode.config.agent = {
          agentId: '', agentName: '', agentVersion: 'latest', versionType: 'latest',
          callMode: 'sync', showResultRealTime: true, inputMappings: [], outputMappings: [],
          timeout: 30, retryCount: 2, retryInterval: 5, failStrategy: 'terminate',
        };
        break;
      case 'condition':
        newNode.config.condition = {
          branches: [
            { id: 'b-1', name: '分支1', rules: [], logic: 'and' },
            { id: 'b-2', name: '分支2', rules: [], logic: 'and' },
          ],
        };
        break;
    }

    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    saveToHistory(newNodes, connections);
    setSelectedNodeId(newNode.id);
    setSaveStatus('unsaved');
  };

  const handleDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('nodeType', type);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType') as NodeType;
    if (type && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - 60) / (scale / 100);
      const y = (e.clientY - rect.top - 30) / (scale / 100);
      handleAddNode(type, x, y);
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleNodeMove = (nodeId: string, dx: number, dy: number) => {
    setNodes(nodes.map(n =>
      n.id === nodeId ? { ...n, x: n.x + dx, y: n.y + dy } : n
    ));
    setSaveStatus('unsaved');
  };

  const handleNodeMouseUp = () => {
    saveToHistory(nodes, connections);
  };

  const handleDeleteNode = () => {
    if (selectedNodeId) {
      // Don't allow deleting start and end nodes
      const nodeToDelete = nodes.find(n => n.id === selectedNodeId);
      if (nodeToDelete?.type === 'start' || nodeToDelete?.type === 'end') {
        message.warning('开始节点和结束节点不能删除');
        return;
      }
      const newNodes = nodes.filter(n => n.id !== selectedNodeId);
      const newConnections = connections.filter(c => c.sourceId !== selectedNodeId && c.targetId !== selectedNodeId);
      setNodes(newNodes);
      setConnections(newConnections);
      setSelectedNodeId(null);
      saveToHistory(newNodes, newConnections);
      setSaveStatus('unsaved');
      message.success('节点已删除');
    }
  };

  const handleDeleteConnection = () => {
    if (selectedConnectionId) {
      const newConnections = connections.filter(c => c.id !== selectedConnectionId);
      setConnections(newConnections);
      setSelectedConnectionId(null);
      saveToHistory(nodes, newConnections);
      setSaveStatus('unsaved');
      message.success('连线已删除');
    }
  };

  // Connection operations
  const handleStartConnection = (nodeId: string, port: string) => {
    setConnectingFrom({ nodeId, port });
  };

  const handleEndConnection = (nodeId: string, port: string) => {
    if (!connectingFrom || connectingFrom.nodeId === nodeId) {
      setConnectingFrom(null);
      return;
    }
    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      sourceId: connectingFrom.nodeId,
      targetId: nodeId,
      sourcePort: connectingFrom.port,
      targetPort: port,
    };
    const newConnections = [...connections, newConnection];
    setConnections(newConnections);
    setConnectingFrom(null);
    saveToHistory(nodes, newConnections);
    setSaveStatus('unsaved');
  };

  // Validation
  const validateFlow = (): { errors: string[]; errorNodeIds: string[] } => {
    const errors: string[] = [];
    const errorNodeIds: string[] = [];
    const startNodes = nodes.filter(n => n.type === 'start');
    const endNodes = nodes.filter(n => n.type === 'end');

    if (startNodes.length === 0) {
      errors.push('流程必须包含一个开始节点');
    }
    if (startNodes.length > 1) {
      errors.push('流程只能有一个开始节点');
      startNodes.forEach(n => errorNodeIds.push(n.id));
    }
    if (endNodes.length === 0) {
      errors.push('流程必须包含至少一个结束节点');
    }

    // Check for orphan nodes (no incoming or outgoing connections, except end nodes)
    nodes.forEach(node => {
      if (node.type === 'start' || node.type === 'end') return;
      const hasIncoming = connections.some(c => c.targetId === node.id);
      const hasOutgoing = connections.some(c => c.sourceId === node.id);
      if (!hasIncoming || !hasOutgoing) {
        errors.push(`节点「${node.name}」未连线`);
        errorNodeIds.push(node.id);
      }
    });

    // Check all non-end nodes have their output ports connected
    nodes.forEach(node => {
      if (node.type === 'end') return;
      const hasOutgoing = connections.some(c => c.sourceId === node.id);
      if (!hasOutgoing) {
        errors.push(`节点「${node.name}」的输出端口未连接`);
        errorNodeIds.push(node.id);
      }
    });

    // Check agent nodes have agent selected
    nodes.filter(n => n.type === 'agent').forEach(agent => {
      if (!agent.config.agent?.agentId) {
        errors.push(`Agent节点「${agent.name}」未选择智能体`);
        errorNodeIds.push(agent.id);
      }
    });

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const findCycle = (nodeId: string, path: string[]): string[] | null => {
      if (recursionStack.has(nodeId)) {
        return [...path, nodeId];
      }
      if (visited.has(nodeId)) {
        return null;
      }
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingConnections = connections.filter(c => c.sourceId === nodeId);
      for (const conn of outgoingConnections) {
        const cycle = findCycle(conn.targetId, [...path, nodeId]);
        if (cycle) {
          return cycle;
        }
      }

      recursionStack.delete(nodeId);
      return null;
    };

    // Start cycle detection from start nodes
    for (const startNode of startNodes) {
      visited.clear();
      recursionStack.clear();
      const cycle = findCycle(startNode.id, []);
      if (cycle) {
        const cycleNodeNames = cycle.map(id => nodes.find(n => n.id === id)?.name || id).join(' → ');
        errors.push(`检测到循环连线：${cycleNodeNames}`);
        cycle.forEach(id => errorNodeIds.push(id));
        break;
      }
    }

    return { errors, errorNodeIds: [...new Set(errorNodeIds)] };
  };

  const handleSave = () => {
    const { errors, errorNodeIds } = validateFlow();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setValidationErrorNodes(errorNodeIds);
      message.error('存在配置问题，请修复后保存');
      return;
    }
    setValidationErrors([]);
    setValidationErrorNodes([]);
    setSaveStatus('saved');
    message.success('流程保存成功');
  };

  const handlePublish = () => {
    const { errors, errorNodeIds } = validateFlow();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setValidationErrorNodes(errorNodeIds);
      message.error('存在配置问题，请修复后发布');
      return;
    }
    setValidationErrors([]);
    setValidationErrorNodes([]);
    publishForm.validateFields().then(() => {
      message.success('流程发布成功');
      setPublishModalVisible(false);
      navigate('/app/orchestration/flows');
    }).catch(() => {});
  };

  // Debug - Run workflow preview
  const handleDebug = () => {
    const { errors, errorNodeIds } = validateFlow();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setValidationErrorNodes(errorNodeIds);
      message.error('请先修复流程配置问题');
      return;
    }
    setValidationErrors([]);
    setValidationErrorNodes([]);
    setWorkflowPreviewVisible(true);
    setWorkflowStatus('running');
    setDebugging(true);
    setWorkflowLogs([]);
    // Simulate starting debug
    const startNode = nodes.find(n => n.type === 'start');
    if (startNode) {
      setCurrentPreviewNode(startNode.id);
      setCurrentDebugNode(startNode.id);
      // Initialize with start node log
      setWorkflowLogs([{
        nodeName: startNode.name,
        nodeType: startNode.type,
        status: 'success',
        duration: 0,
        output: startNode.config.start?.welcomeMessage || '流程已开始'
      }]);
      // Add initial chat message
      setChatMessages([{
        role: 'assistant',
        content: startNode.config.start?.welcomeMessage || '您好，流程已开始执行',
        timestamp: new Date()
      }]);
    }
  };

  const handleDebugStep = () => {
    if (!currentDebugNode && !currentPreviewNode) return;
    const activeNodeId = currentDebugNode || currentPreviewNode;
    if (!activeNodeId) return;

    // Simulate variable updates based on current node
    const currentNode = nodes.find(n => n.id === activeNodeId);
    if (currentNode) {
      // Generate mock variables based on node type
      const newVars = { ...debugVariables };
      let nodeOutput = '';
      if (currentNode.type === 'start') {
        newVars.welcome_message = currentNode.config.start?.welcomeMessage || '您好';
        newVars.session_id = `sess_${Date.now()}`;
        nodeOutput = currentNode.config.start?.welcomeMessage || '流程已开始';
      } else if (currentNode.type === 'input') {
        const inputFields = currentNode.config.input?.formFields || [];
        if (inputFields.length > 0) {
          inputFields.forEach((field) => {
            newVars[field.variableName] = field.type === 'select'
              ? (field.multiple ? ['option1', 'option2'] : 'option1')
              : field.type === 'file'
                ? ['file1.pdf']
                : '用户输入内容';
          });
          nodeOutput = `已收集${inputFields.length}个输入字段`;
        } else {
          nodeOutput = '等待用户输入';
        }
      } else if (currentNode.type === 'agent') {
        const agentName = currentNode.config.agent?.agentName || '智能体';
        newVars[`${agentName}_result`] = {
          status: 'success',
          output: '智能体返回的处理结果',
          confidence: 0.95,
        };
        nodeOutput = `${agentName}处理完成`;
        // Add chat message for agent
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `正在调用${agentName}...`,
          timestamp: new Date()
        }]);
        setTimeout(() => {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `${agentName}处理完成，结果已生成`,
            timestamp: new Date()
          }]);
        }, 1000);
      } else if (currentNode.type === 'output') {
        newVars.output_result = '最终输出结果';
        nodeOutput = currentNode.config.output?.contentTemplate || '输出结果';
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: nodeOutput,
          timestamp: new Date()
        }]);
      } else if (currentNode.type === 'condition') {
        nodeOutput = '条件判断完成';
      } else if (currentNode.type === 'end') {
        nodeOutput = '流程结束';
        setWorkflowStatus('success');
      }
      setDebugVariables(newVars);

      // Update workflow logs
      setWorkflowLogs(prev => [...prev, {
        nodeName: currentNode.name,
        nodeType: currentNode.type,
        status: 'success',
        duration: Math.floor(Math.random() * 500) + 100,
        output: nodeOutput
      }]);
    }
    // Find next node
    const currentConn = connections.find(c => c.sourceId === activeNodeId);
    if (currentConn) {
      const nextNodeId = currentConn.targetId;
      const nextNode = nodes.find(n => n.id === nextNodeId);
      setCurrentDebugNode(nextNodeId);
      setCurrentPreviewNode(nextNodeId);

      // If next node is input, add chat prompt
      if (nextNode?.type === 'input') {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: '请输入信息：',
          timestamp: new Date()
        }]);
      } else if (nextNode?.type === 'agent') {
        // Agent nodes will auto-simulate
      } else if (nextNode?.type === 'output') {
        // Output nodes will auto-simulate
      } else if (nextNode?.type === 'end') {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: '流程已结束，感谢使用',
          timestamp: new Date()
        }]);
      }
    } else {
      // No more connections - end of flow
      if (currentNode?.type !== 'end') {
        setWorkflowStatus('success');
      }
      setDebugging(false);
      setCurrentDebugNode(null);
      setCurrentPreviewNode(null);
    }
  };

  const moreMenuItems: MenuProps['items'] = [
    { key: 'version', icon: <HistoryOutlined />, label: '版本历史', onClick: () => message.info('版本历史功能开发中') },
    { key: 'export', icon: <FileImageOutlined />, label: '导出流程图 (PNG)' },
    { key: 'template', icon: <SaveFilled />, label: '另存为模板' },
    { key: 'autoLayout', icon: <AlignLeftOutlined />, label: '自动布局', onClick: () => message.info('自动布局功能开发中') },
  ];

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedConnection = connections.find(c => c.id === selectedConnectionId);

  // Get port position for connection lines
  const getPortPosition = (nodeId: string, port: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const nodeWidth = node.type === 'start' || node.type === 'end' ? 100 : 180;
    const nodeHeight = 60;
    switch (port) {
      case 'top': return { x: node.x + nodeWidth / 2, y: node.y };
      case 'bottom': return { x: node.x + nodeWidth / 2, y: node.y + nodeHeight };
      case 'left': return { x: node.x, y: node.y + nodeHeight / 2 };
      case 'right': return { x: node.x + nodeWidth, y: node.y + nodeHeight / 2 };
      default: return { x: node.x + nodeWidth / 2, y: node.y + nodeHeight / 2 };
    }
  };

  // Generate bezier path for connection
  const getConnectionPath = (conn: Connection) => {
    const sourcePos = getPortPosition(conn.sourceId, conn.sourcePort);
    const targetPos = getPortPosition(conn.targetId, conn.targetPort);
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;

    // Determine connection direction based on ports
    const isSourceTop = conn.sourcePort === 'top';
    const isSourceBottom = conn.sourcePort === 'bottom';
    const isSourceLeft = conn.sourcePort === 'left';
    const isSourceRight = conn.sourcePort === 'right';
    const isTargetTop = conn.targetPort === 'top';
    const isTargetBottom = conn.targetPort === 'bottom';
    const isTargetLeft = conn.targetPort === 'left';
    const isTargetRight = conn.targetPort === 'right';

    // Control point offset - how far out the bezier control points go
    const cpOffset = Math.min(Math.abs(dy), Math.abs(dx), 50);

    // For top-to-top or bottom-to-bottom (reversing direction)
    if ((isSourceTop && isTargetTop) || (isSourceBottom && isTargetBottom)) {
      const midX = (sourcePos.x + targetPos.x) / 2;
      return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x} ${sourcePos.y + (isSourceTop ? -cpOffset : cpOffset)}, ${targetPos.x} ${targetPos.y + (isTargetTop ? -cpOffset : cpOffset)}, ${targetPos.x} ${targetPos.y}`;
    }

    // For top-to-bottom or bottom-to-top (same x, different y)
    if ((isSourceTop && isTargetBottom) || (isSourceBottom && isTargetTop)) {
      const midY = (sourcePos.y + targetPos.y) / 2;
      return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x} ${midY}, ${targetPos.x} ${midY}, ${targetPos.x} ${targetPos.y}`;
    }

    // For left-to-left or right-to-left (reversing)
    if ((isSourceLeft && isTargetLeft) || (isSourceRight && isTargetRight)) {
      const midY = (sourcePos.y + targetPos.y) / 2;
      return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + (isSourceLeft ? -cpOffset : cpOffset)} ${sourcePos.y}, ${targetPos.x + (isTargetLeft ? -cpOffset : cpOffset)} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
    }

    // For left-to-right or right-to-left (horizontal)
    if ((isSourceLeft && isTargetRight) || (isSourceRight && isTargetLeft)) {
      const midX = (sourcePos.x + targetPos.x) / 2;
      return `M ${sourcePos.x} ${sourcePos.y} C ${midX} ${sourcePos.y}, ${midX} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
    }

    // For top/bottom to left/right connections (diagonal)
    // Use approach that maintains perpendicular entry to target
    if (isTargetTop || isTargetBottom) {
      // Entry is vertical, so end path vertically
      const midY = (sourcePos.y + targetPos.y) / 2;
      return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x} ${midY}, ${targetPos.x} ${midY}, ${targetPos.x} ${targetPos.y}`;
    }
    if (isTargetLeft || isTargetRight) {
      // Entry is horizontal, so end path horizontally
      const midX = (sourcePos.x + targetPos.x) / 2;
      return `M ${sourcePos.x} ${sourcePos.y} C ${midX} ${sourcePos.y}, ${midX} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
    }

    // Default: simple bezier
    const cp = Math.min(Math.abs(dx), 50);
    return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + cp} ${sourcePos.y}, ${targetPos.x - cp} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
  };

  const onlineAgents = mockAgents.filter((a) => a.lifecycleStatus === '已上线');

  // ============ Node Config Panel ============
  const renderNodeConfigPanel = () => {
    if (!selectedNode) return null;

    const config = nodeTypeConfig[selectedNode.type];
    const availableVars = getAvailableVariables();

    return (
      <div style={{ padding: 16 }}>
        <Title level={5} style={{ marginBottom: 16 }}>
          <Space>
            <Text style={{ color: config.color }}>{config.icon}</Text>
            节点配置
          </Space>
        </Title>

        <Form layout="vertical" size="small">
          <Form.Item label="节点名称">
            <Input
              value={selectedNode.name}
              onChange={(e) => {
                setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, name: e.target.value } : n));
                setSaveStatus('unsaved');
              }}
            />
          </Form.Item>

          <Form.Item label="节点类型">
            <Tag color={config.color}>{config.label}</Tag>
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />

          {/* Start Node Config */}
          {selectedNode.type === 'start' && (
            <>
              <Title level={5} style={{ marginBottom: 12 }}>开场配置</Title>
              <Form.Item label="开场白">
                <TextArea
                  rows={3}
                  placeholder="流程启动时发送给用户的消息，支持 Markdown"
                  value={selectedNode.config.start?.welcomeMessage || ''}
                  onChange={(e) => {
                    setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, start: { ...n.config.start, welcomeMessage: e.target.value } } } : n));
                    setSaveStatus('unsaved');
                  }}
                />
              </Form.Item>
              <Form.Item label="引导问题">
                <div style={{ border: '1px dashed #d9d9d9', padding: 8, borderRadius: 4 }}>
                  {(selectedNode.config.start?.guideQuestions || []).map((q, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <Input
                        value={q.label}
                        placeholder="问题文本"
                        style={{ flex: 1 }}
                        onChange={(e) => {
                          const newQuestions = [...(selectedNode.config.start?.guideQuestions || [])];
                          newQuestions[i] = { label: e.target.value };
                          setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, start: { ...n.config.start, guideQuestions: newQuestions } } } : n));
                          setSaveStatus('unsaved');
                        }}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          const newQuestions = (selectedNode.config.start?.guideQuestions || []).filter((_, idx) => idx !== i);
                          setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, start: { ...n.config.start, guideQuestions: newQuestions } } } : n));
                          setSaveStatus('unsaved');
                        }}
                      />
                    </div>
                  ))}
                  {(selectedNode.config.start?.guideQuestions || []).length < 6 && (
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const newQuestions = [...(selectedNode.config.start?.guideQuestions || []), { label: '' }];
                        setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, start: { ...n.config.start, guideQuestions: newQuestions } } } : n));
                        setSaveStatus('unsaved');
                      }}
                      block
                    >
                      添加引导问题
                    </Button>
                  )}
                </div>
              </Form.Item>
            </>
          )}

          {/* Input Node Config */}
          {selectedNode.type === 'input' && (
            <>
              <Title level={5} style={{ marginBottom: 12 }}>输入配置</Title>
              <Form.Item label="输入方式">
                <Select
                  value={selectedNode.config.input?.inputMode || 'dialog'}
                  onChange={(value) => {
                    setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, inputMode: value } } } : n));
                    setSaveStatus('unsaved');
                  }}
                  options={[
                    { label: '对话框输入', value: 'dialog' },
                    { label: '表单输入', value: 'form' },
                  ]}
                />
              </Form.Item>
              {selectedNode.config.input?.inputMode === 'form' && (
                <Form.Item label="表单项">
                  <div style={{ border: '1px dashed #d9d9d9', padding: 8, borderRadius: 4 }}>
                    {(selectedNode.config.input?.formFields || []).map((field, i) => (
                      <Card key={field.id} size="small" style={{ marginBottom: 8 }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Space>
                            <Select
                              value={field.type}
                              style={{ width: 100 }}
                              size="small"
                              onChange={(type) => {
                                const newFields = [...(selectedNode.config.input?.formFields || [])];
                                newFields[i] = { ...newFields[i], type };
                                setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                setSaveStatus('unsaved');
                              }}
                              options={[
                                { label: '文本', value: 'text' },
                                { label: '下拉', value: 'select' },
                                { label: '文件', value: 'file' },
                              ]}
                            />
                            <Input
                              placeholder="显示名称"
                              value={field.label}
                              size="small"
                              style={{ width: 100 }}
                              onChange={(e) => {
                                const newFields = [...(selectedNode.config.input?.formFields || [])];
                                newFields[i] = { ...newFields[i], label: e.target.value };
                                setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                setSaveStatus('unsaved');
                              }}
                            />
                            <Input
                              placeholder="变量名"
                              value={field.variableName}
                              size="small"
                              style={{ width: 100 }}
                              onChange={(e) => {
                                const newFields = [...(selectedNode.config.input?.formFields || [])];
                                newFields[i] = { ...newFields[i], variableName: e.target.value };
                                setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                setSaveStatus('unsaved');
                              }}
                            />
                          </Space>

                          {/* Select type options */}
                          {field.type === 'select' && (
                            <>
                              <Space>
                                <Switch checkedChildren="多选" unCheckedChildren="单选" checked={field.multiple || false} size="small" onChange={(checked) => {
                                  const newFields = [...(selectedNode.config.input?.formFields || [])];
                                  newFields[i] = { ...newFields[i], multiple: checked };
                                  setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                  setSaveStatus('unsaved');
                                }} />
                                <Text type="secondary" style={{ fontSize: 12 }}>下拉选项：</Text>
                              </Space>
                              <div style={{ marginLeft: 24 }}>
                                {(field.options || []).map((opt, optIdx) => (
                                  <Space key={optIdx} style={{ marginBottom: 4 }}>
                                    <Input
                                      placeholder="选项标签"
                                      value={opt.label}
                                      size="small"
                                      style={{ width: 100 }}
                                      onChange={(e) => {
                                        const newFields = [...(selectedNode.config.input?.formFields || [])];
                                        const newOptions = [...(newFields[i].options || [])];
                                        newOptions[optIdx] = { ...newOptions[optIdx], label: e.target.value };
                                        newFields[i] = { ...newFields[i], options: newOptions };
                                        setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                        setSaveStatus('unsaved');
                                      }}
                                    />
                                    <Input
                                      placeholder="选项值"
                                      value={opt.value}
                                      size="small"
                                      style={{ width: 80 }}
                                      onChange={(e) => {
                                        const newFields = [...(selectedNode.config.input?.formFields || [])];
                                        const newOptions = [...(newFields[i].options || [])];
                                        newOptions[optIdx] = { ...newOptions[optIdx], value: e.target.value };
                                        newFields[i] = { ...newFields[i], options: newOptions };
                                        setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                        setSaveStatus('unsaved');
                                      }}
                                    />
                                    <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => {
                                      const newFields = [...(selectedNode.config.input?.formFields || [])];
                                      const newOptions = (newFields[i].options || []).filter((_, idx) => idx !== optIdx);
                                      newFields[i] = { ...newFields[i], options: newOptions };
                                      setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                      setSaveStatus('unsaved');
                                    }} />
                                  </Space>
                                ))}
                                <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => {
                                  const newFields = [...(selectedNode.config.input?.formFields || [])];
                                  const newOptions = [...(newFields[i].options || []), { label: '', value: '' }];
                                  newFields[i] = { ...newFields[i], options: newOptions };
                                  setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                  setSaveStatus('unsaved');
                                }}>
                                  添加选项
                                </Button>
                              </div>
                            </>
                          )}

                          {/* File type options */}
                          {field.type === 'file' && (
                            <>
                              <Space>
                                <Text type="secondary" style={{ fontSize: 12 }}>支持文件类型：</Text>
                              </Space>
                              <div style={{ marginLeft: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {['图片', 'PDF', 'Word', 'Excel', 'CSV', 'DICOM'].map((ft) => (
                                  <Tag
                                    key={ft}
                                    style={{
                                      cursor: 'pointer',
                                      border: (field.fileTypes || []).includes(ft) ? '1px solid #1890FF' : '1px dashed #d9d9d9',
                                      color: (field.fileTypes || []).includes(ft) ? '#1890FF' : '#999',
                                      background: (field.fileTypes || []).includes(ft) ? '#E6F7FF' : 'transparent',
                                    }}
                                    onClick={() => {
                                      const newFields = [...(selectedNode.config.input?.formFields || [])];
                                      const currentTypes = newFields[i].fileTypes || [];
                                      const newFileTypes = currentTypes.includes(ft)
                                        ? currentTypes.filter(t => t !== ft)
                                        : [...currentTypes, ft];
                                      newFields[i] = { ...newFields[i], fileTypes: newFileTypes };
                                      setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                      setSaveStatus('unsaved');
                                    }}
                                  >
                                    {ft}
                                  </Tag>
                                ))}
                              </div>
                            </>
                          )}

                          <Space>
                            <Switch checkedChildren="必填" unCheckedChildren="选填" checked={field.required} size="small" onChange={(checked) => {
                              const newFields = [...(selectedNode.config.input?.formFields || [])];
                              newFields[i] = { ...newFields[i], required: checked };
                              setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                              setSaveStatus('unsaved');
                            }} />
                            <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => {
                              const newFields = (selectedNode.config.input?.formFields || []).filter((_, idx) => idx !== i);
                              setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                              setSaveStatus('unsaved');
                            }}>删除</Button>
                          </Space>
                        </Space>
                      </Card>
                    ))}
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => {
                      const newField = { id: `ff-${Date.now()}`, type: 'text' as const, label: '', variableName: '', required: false };
                      const newFields = [...(selectedNode.config.input?.formFields || []), newField];
                      setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                      setSaveStatus('unsaved');
                    }} block>
                      添加表单项
                    </Button>
                  </div>
                </Form.Item>
              )}
              {selectedNode.config.input?.inputMode === 'dialog' && (
                <Alert
                  message="对话框输入模式"
                  description="流程执行到此节点时，对话窗口将自动激活输入框，用户输入或上传文件后自动写入对应系统变量。"
                  type="info"
                  showIcon
                />
              )}
            </>
          )}

          {/* Output Node Config */}
          {selectedNode.type === 'output' && (
            <>
              <Title level={5} style={{ marginBottom: 12 }}>输出配置</Title>
              <Form.Item label="输出内容模板">
                <TextArea
                  rows={4}
                  placeholder="支持 Markdown 和变量插值，如：## 诊断结果&#10;患者：{patient_name}&#10;诊断：{diagnosis}"
                  value={selectedNode.config.output?.contentTemplate || ''}
                  onChange={(e) => {
                    setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, output: { ...n.config.output, contentTemplate: e.target.value } } } : n));
                    setSaveStatus('unsaved');
                  }}
                />
              </Form.Item>
              <Form.Item label="变量选择">
                <Select
                  mode="multiple"
                  placeholder="选择要展示的上游变量"
                  value={selectedNode.config.output?.displayVariables || []}
                  onChange={(value) => {
                    setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, output: { ...n.config.output, displayVariables: value } } } : n));
                    setSaveStatus('unsaved');
                  }}
                  options={availableVars.map(v => ({ label: `${v.name} (${v.source})`, value: v.name }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item label="展示方式">
                <Select
                  value={selectedNode.config.output?.displayMode || 'bubble'}
                  onChange={(value) => {
                    setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, output: { ...n.config.output, displayMode: value } } } : n));
                    setSaveStatus('unsaved');
                  }}
                  options={[
                    { label: '消息气泡', value: 'bubble' },
                    { label: '卡片面板', value: 'card' },
                    { label: '流式输出', value: 'stream' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="交互模式">
                <Select
                  value={selectedNode.config.output?.interactionMode || 'none'}
                  onChange={(value) => {
                    setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, output: { ...n.config.output, interactionMode: value } } } : n));
                    setSaveStatus('unsaved');
                  }}
                  options={[
                    { label: '无交互', value: 'none' },
                    { label: '确认继续', value: 'confirm' },
                    { label: '选择型交互', value: 'select' },
                    { label: '输入型交互', value: 'input' },
                  ]}
                />
              </Form.Item>
            </>
          )}

          {/* Agent Node Config */}
          {selectedNode.type === 'agent' && (
            <>
              <Title level={5} style={{ marginBottom: 12 }}>智能体配置</Title>
              <Form.Item label="绑定智能体">
                <Select
                  value={selectedNode.config.agent?.agentId}
                  onChange={(value) => {
                    const agent = onlineAgents.find(a => a.id === value);
                    setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, agent: { ...n.config.agent, agentId: value, agentName: agent?.name } } } : n));
                    setSaveStatus('unsaved');
                  }}
                  placeholder="请选择智能体"
                  showSearch
                  options={onlineAgents.map(a => ({ label: a.name, value: a.id }))}
                />
              </Form.Item>
              {selectedNode.config.agent?.agentId && (
                <>
                  <Form.Item label="调用方式">
                    <Select
                      value={selectedNode.config.agent?.callMode || 'sync'}
                      onChange={(value) => {
                        setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, agent: { ...n.config.agent, callMode: value } } } : n));
                        setSaveStatus('unsaved');
                      }}
                      options={[
                        { label: '同步调用', value: 'sync' },
                        { label: '异步调用', value: 'async' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label="结果实时展示">
                    <Switch
                      checked={selectedNode.config.agent?.showResultRealTime ?? true}
                      onChange={(checked) => {
                        setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, agent: { ...n.config.agent, showResultRealTime: checked } } } : n));
                        setSaveStatus('unsaved');
                      }}
                    />
                  </Form.Item>
                  <Divider style={{ margin: '12px 0' }} />
                  <Title level={5} style={{ marginBottom: 12 }}>超时与重试</Title>
                  <Form.Item label="超时时间（秒）">
                    <InputNumber
                      value={selectedNode.config.agent?.timeout || 30}
                      min={1}
                      max={600}
                      style={{ width: '100%' }}
                      onChange={(value) => {
                        setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, agent: { ...n.config.agent, timeout: value || 30 } } } : n));
                        setSaveStatus('unsaved');
                      }}
                    />
                  </Form.Item>
                  <Form.Item label="重试次数">
                    <InputNumber
                      value={selectedNode.config.agent?.retryCount || 2}
                      min={0}
                      max={5}
                      style={{ width: '100%' }}
                      onChange={(value) => {
                        setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, agent: { ...n.config.agent, retryCount: value || 0 } } } : n));
                        setSaveStatus('unsaved');
                      }}
                    />
                  </Form.Item>
                  <Form.Item label="失败处理策略">
                    <Select
                      value={selectedNode.config.agent?.failStrategy || 'terminate'}
                      onChange={(value) => {
                        setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, agent: { ...n.config.agent, failStrategy: value } } } : n));
                        setSaveStatus('unsaved');
                      }}
                      options={[
                        { label: '跳过继续', value: 'skip_continue' },
                        { label: '走降级分支', value: 'fallback' },
                        { label: '终止流程', value: 'terminate' },
                      ]}
                    />
                  </Form.Item>
                  {selectedNode.config.agent?.failStrategy === 'fallback' && (
                    <Form.Item label="降级出口">
                      <Select
                        value={selectedNode.config.agent?.fallbackBranch || 'right'}
                        onChange={(value) => {
                          setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, agent: { ...n.config.agent, fallbackBranch: value } } } : n));
                          setSaveStatus('unsaved');
                        }}
                        options={[
                          { label: '右侧端口（降级出口）', value: 'right' },
                        ]}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>请连接右侧红色端口作为降级分支</Text>
                    </Form.Item>
                  )}
                  <Divider style={{ margin: '12px 0' }} />
                  <Title level={5} style={{ marginBottom: 12 }}>参数映射</Title>
                  <Button
                    type="dashed"
                    icon={<ReloadOutlined />}
                    onClick={async () => {
                      const agentId = selectedNode.config.agent?.agentId;
                      if (!agentId) return;
                      try {
                        const schema = await getAgentSchema(agentId);
                        const schemaData = (schema as any).data || schema;
                        const inputMappings = Object.keys(schemaData.input_schema?.properties || {}).map(key => ({
                          agentParamName: key,
                          sourceType: 'upstream' as const,
                          sourceValue: '',
                        }));
                        const outputMappings = Object.keys(schemaData.output_schema?.properties || {}).map(key => ({
                          agentFieldName: key,
                          outputVariableName: key,
                          dataType: schemaData.output_schema?.properties[key]?.type || 'string',
                        }));
                        setNodes(nodes.map(n => n.id === selectedNodeId ? {
                          ...n,
                          config: {
                            ...n.config,
                            agent: {
                              ...n.config.agent,
                              inputMappings,
                              outputMappings,
                            }
                          }
                        } : n));
                        setSaveStatus('unsaved');
                        message.success('已从Schema加载参数映射');
                      } catch (e) {
                        message.error('加载Schema失败');
                      }
                    }}
                    block
                    style={{ marginBottom: 8 }}
                  >
                    从Agent Schema加载映射
                  </Button>
                  <Collapse size="small" items={[
                    {
                      key: 'input',
                      label: `输入映射 (${selectedNode.config.agent?.inputMappings?.length || 0})`,
                      children: (
                        <div>
                          {(selectedNode.config.agent?.inputMappings || []).map((mapping, i) => (
                            <div key={i} style={{ marginBottom: 8, padding: 8, background: token.colorBgContainerDisabled, borderRadius: 4 }}>
                              <Space direction="vertical" style={{ width: '100%' }} size="small">
                                <Text type="secondary" style={{ fontSize: 12 }}>Agent参数: {mapping.agentParamName}</Text>
                                <Select
                                  size="small"
                                  value={mapping.sourceType}
                                  style={{ width: '100%' }}
                                  onChange={(val) => {
                                    const newMappings = [...(selectedNode.config.agent?.inputMappings || [])];
                                    newMappings[i] = { ...newMappings[i], sourceType: val };
                                    setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, agent: { ...n.config.agent, inputMappings: newMappings } } } : n));
                                    setSaveStatus('unsaved');
                                  }}
                                  options={[
                                    { label: '上游变量', value: 'upstream' },
                                    { label: '常量值', value: 'constant' },
                                    { label: '表达式', value: 'expression' },
                                  ]}
                                />
                                <Input
                                  size="small"
                                  placeholder="请输入值"
                                  value={mapping.sourceValue}
                                  onChange={(e) => {
                                    const newMappings = [...(selectedNode.config.agent?.inputMappings || [])];
                                    newMappings[i] = { ...newMappings[i], sourceValue: e.target.value };
                                    setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, agent: { ...n.config.agent, inputMappings: newMappings } } } : n));
                                    setSaveStatus('unsaved');
                                  }}
                                />
                              </Space>
                            </div>
                          ))}
                        </div>
                      ),
                    },
                    {
                      key: 'output',
                      label: `输出映射 (${selectedNode.config.agent?.outputMappings?.length || 0})`,
                      children: (
                        <div>
                          {(selectedNode.config.agent?.outputMappings || []).map((mapping, i) => (
                            <div key={i} style={{ marginBottom: 8, padding: 8, background: token.colorBgContainerDisabled, borderRadius: 4 }}>
                              <Space direction="vertical" style={{ width: '100%' }} size="small">
                                <Text type="secondary" style={{ fontSize: 12 }}>Agent字段: {mapping.agentFieldName}</Text>
                                <Space>
                                  <Input
                                    size="small"
                                    placeholder="输出变量名"
                                    value={mapping.outputVariableName}
                                    style={{ width: 120 }}
                                    onChange={(e) => {
                                      const newMappings = [...(selectedNode.config.agent?.outputMappings || [])];
                                      newMappings[i] = { ...newMappings[i], outputVariableName: e.target.value };
                                      setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, agent: { ...n.config.agent, outputMappings: newMappings } } } : n));
                                      setSaveStatus('unsaved');
                                    }}
                                  />
                                  <Tag>{mapping.dataType}</Tag>
                                </Space>
                              </Space>
                            </div>
                          ))}
                        </div>
                      ),
                    },
                  ]} />
                </>
              )}
            </>
          )}

          {/* Condition Node Config */}
          {selectedNode.type === 'condition' && (
            <>
              <Title level={5} style={{ marginBottom: 12 }}>条件分支配置</Title>
              <Alert
                message="条件判断逻辑"
                description="依次判断每个分支的条件是否满足，如果满足则会执行该分支的后续逻辑。每个分支支持添加多个条件，多条件时只能同时 AND 或同时 OR。"
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
              />
              {selectedNode.config.condition?.branches.map((branch, i) => (
                <Card key={branch.id} size="small" style={{ marginBottom: 8 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Input
                        placeholder="分支名称"
                        value={branch.name}
                        style={{ width: 120 }}
                        onChange={(e) => {
                          const newBranches = [...(selectedNode.config.condition?.branches || [])];
                          newBranches[i] = { ...newBranches[i], name: e.target.value };
                          setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                          setSaveStatus('unsaved');
                        }}
                      />
                      <Select
                        value={branch.logic}
                        style={{ width: 80 }}
                        size="small"
                        onChange={(value) => {
                          const newBranches = [...(selectedNode.config.condition?.branches || [])];
                          newBranches[i] = { ...newBranches[i], logic: value };
                          setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                          setSaveStatus('unsaved');
                        }}
                        options={[
                          { label: 'AND', value: 'and' },
                          { label: 'OR', value: 'or' },
                        ]}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={selectedNode.config.condition?.branches.length <= 2}
                        onClick={() => {
                          const newBranches = (selectedNode.config.condition?.branches || []).filter((_, idx) => idx !== i);
                          setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                          setSaveStatus('unsaved');
                        }}
                      />
                    </Space>
                    {branch.rules.map((rule, j) => (
                      <Space key={rule.id} wrap>
                        <Select
                          value={rule.variable}
                          placeholder="选择变量"
                          style={{ width: 120 }}
                          size="small"
                          showSearch
                          options={availableVars.map(v => ({ label: v.name, value: v.name }))}
                          onChange={(value) => {
                            const newBranches = [...(selectedNode.config.condition?.branches || [])];
                            newBranches[i].rules[j] = { ...newBranches[i].rules[j], variable: value };
                            setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                            setSaveStatus('unsaved');
                          }}
                        />
                        <Select
                          value={rule.operator}
                          style={{ width: 100 }}
                          size="small"
                          options={[
                            { label: '等于', value: '等于' },
                            { label: '不等于', value: '不等于' },
                            { label: '包含', value: '包含' },
                            { label: '为空', value: '为空' },
                            { label: '>', value: '>' },
                            { label: '<', value: '<' },
                          ]}
                          onChange={(value) => {
                            const newBranches = [...(selectedNode.config.condition?.branches || [])];
                            newBranches[i].rules[j] = { ...newBranches[i].rules[j], operator: value };
                            setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                            setSaveStatus('unsaved');
                          }}
                        />
                        {rule.operator !== '为空' && (
                          <Input
                            placeholder="比较值"
                            value={rule.value}
                            style={{ width: 100 }}
                            size="small"
                            onChange={(e) => {
                              const newBranches = [...(selectedNode.config.condition?.branches || [])];
                              newBranches[i].rules[j] = { ...newBranches[i].rules[j], value: e.target.value };
                              setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                              setSaveStatus('unsaved');
                            }}
                          />
                        )}
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const newBranches = [...(selectedNode.config.condition?.branches || [])];
                            newBranches[i].rules = newBranches[i].rules.filter((_, idx) => idx !== j);
                            setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                            setSaveStatus('unsaved');
                          }}
                        />
                      </Space>
                    ))}
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const newBranches = [...(selectedNode.config.condition?.branches || [])];
                        newBranches[i].rules.push({ id: `r-${Date.now()}`, variable: '', operator: '等于', value: '', valueType: 'input' });
                        setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                        setSaveStatus('unsaved');
                      }}
                    >
                      添加条件
                    </Button>
                  </Space>
                </Card>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  const newBranches = [...(selectedNode.config.condition?.branches || []), { id: `b-${Date.now()}`, name: `分支${selectedNode.config.condition?.branches.length + 1}`, rules: [], logic: 'and' as const }];
                  setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                  setSaveStatus('unsaved');
                }}
                block
              >
                添加分支
              </Button>
            </>
          )}

          <Divider style={{ margin: '16px 0' }} />

          <Popconfirm title="确认删除" description="确定要删除该节点吗？" onConfirm={handleDeleteNode} okText="确认" cancelText="取消">
            <Button danger type="text" icon={<DeleteOutlined />} block>删除节点</Button>
          </Popconfirm>
        </Form>
      </div>
    );
  };

  // ============ Connection Config Panel ============
  const renderConnectionConfigPanel = () => {
    if (!selectedConnection || selectedConnection.id === 'temp') return null;

    return (
      <div style={{ padding: 16 }}>
        <Title level={5} style={{ marginBottom: 16 }}>连线配置</Title>
        <Form layout="vertical" size="small">
          <Form.Item label="分支名称">
            <Input
              value={selectedConnection.branchName}
              onChange={(e) => {
                setConnections(connections.map(c => c.id === selectedConnectionId ? { ...c, branchName: e.target.value } : c));
                setSaveStatus('unsaved');
              }}
              placeholder="如：影像检查、实验室检查"
            />
          </Form.Item>
          <Divider style={{ margin: '16px 0' }} />
          <Button danger type="text" icon={<DeleteOutlined />} block onClick={handleDeleteConnection}>删除连线</Button>
        </Form>
      </div>
    );
  };

  // ============ Render ============
  if (!flow && !isNewFlow) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/orchestration/flows')}>返回流程列表</Button>
        <Empty description="未找到该流程" style={{ marginTop: 48 }} />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: token.colorBgLayout }}>
      {/* Top Toolbar */}
      <div style={{
        height: 56, background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
      }}>
        <Space size="middle">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/orchestration/flows')}>返回</Button>
          <Input value={flowName} onChange={(e) => { setFlowName(e.target.value); setSaveStatus('unsaved'); }} style={{ width: 200, fontWeight: 500 }} />
          <Tag color={flow?.status ? flowStatusColors[flow.status] : 'default'}>
            {flow?.version || 'v1.0'}-{flow?.status || '草稿'}
          </Tag>
        </Space>
        <Space size="small">
          <Tooltip title="撤销"><Button icon={<UndoOutlined />} onClick={handleUndo} disabled={historyIndex <= 0} /></Tooltip>
          <Tooltip title="重做"><Button icon={<RedoOutlined />} onClick={handleRedo} disabled={historyIndex >= history.length - 1} /></Tooltip>
          <Divider type="vertical" style={{ margin: '0 8px' }} />
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleDebug}>运行</Button>
          <Button icon={<BugOutlined />} onClick={() => setDebugPanelVisible(true)}>调试</Button>
          <Button icon={<SaveOutlined />} onClick={handleSave}>保存草稿</Button>
          <Button icon={<UploadOutlined />} onClick={() => setPublishModalVisible(true)}>发布</Button>
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert type="error" message="存在以下配置问题：" description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {validationErrors.map((err, i) => (
              <li key={i}>
                {err}
                {validationErrorNodes[i] && (
                  <Button type="link" size="small" onClick={() => {
                    setSelectedNodeId(validationErrorNodes[i]);
                    // Scroll to node
                    const node = nodes.find(n => n.id === validationErrorNodes[i]);
                    if (node && canvasRef.current) {
                      canvasRef.current.scrollTo({ left: node.x - 200, top: node.y - 200, behavior: 'smooth' });
                    }
                  }} style={{ marginLeft: 8, padding: '0 4px' }}>
                    定位节点
                  </Button>
                )}
              </li>
            ))}
          </ul>
        } closable onClose={() => { setValidationErrors([]); setValidationErrorNodes([]); }} style={{ margin: 8 }} />
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Node Library */}
        <div style={{
          width: 140, background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorder}`,
          overflow: 'auto', padding: 12,
        }}>
          <Title level={5} style={{ marginBottom: 12 }}>节点库</Title>
          {nodeCategories.map((category) => (
            <div key={category.label} style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{category.label}</Text>
              <div style={{ marginTop: 8 }}>
                {category.types.map((type) => {
                  const config = nodeTypeConfig[type];
                  return (
                    <Tooltip key={type} title={config.description} placement="right">
                      <div
                        draggable={type !== 'start'}
                        onDragStart={(e) => handleDragStart(e, type)}
                        style={{
                          padding: '8px 10px',
                          background: config.bgColor,
                          border: `1px dashed ${config.color}`,
                          borderRadius: 6, cursor: type === 'start' ? 'not-allowed' : 'grab',
                          marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, opacity: type === 'start' ? 0.5 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 16, color: config.color }}>{config.icon}</Text>
                        <Text style={{ color: config.color, fontSize: 12 }}>{config.label.replace('节点', '')}</Text>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>快捷操作</Text>
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button size="small" icon={<PlusOutlined />} onClick={() => handleAddNode('input', 300, 200)} block>添加输入</Button>
            <Button size="small" icon={<PlusOutlined />} onClick={() => handleAddNode('output', 300, 200)} block>添加输出</Button>
            <Button size="small" icon={<PlusOutlined />} onClick={() => handleAddNode('agent', 300, 200)} block>添加Agent</Button>
            <Button size="small" icon={<PlusOutlined />} onClick={() => handleAddNode('condition', 300, 200)} block>添加条件</Button>
            <Button size="small" icon={<PlusOutlined />} onClick={() => handleAddNode('end', 300, 400)} block>添加结束</Button>
          </Space>
        </div>

        {/* Center Panel - Canvas */}
        <div
          ref={canvasRef}
          style={{
            flex: 1, overflow: 'auto',
            background: token.colorBgContainerDisabled,
            backgroundImage: `radial-gradient(circle, ${token.colorBorder} 1px, transparent 1px)`,
            backgroundSize: `${20 * scale / 100}px ${20 * scale / 100}px`,
            position: 'relative', cursor: 'default',
          }}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
          onClick={(e) => {
            if (e.target === canvasRef.current) {
              setSelectedNodeId(null);
              setSelectedConnectionId(null);
            }
          }}
        >
          {/* Connection Lines SVG */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="0" refY="5" orient="auto">
                <path d="M0,5 L10,0 L10,10 Z" fill="#1890FF" />
              </marker>
            </defs>
            <style>
              {`
                @keyframes flowAnimation {
                  0% { stroke-dashoffset: 20; }
                  100% { stroke-dashoffset: 0; }
                }
                .connection-animated {
                  animation: flowAnimation 0.5s linear infinite;
                }
              `}
            </style>
            {connections.filter(c => c.sourceId && c.targetId).map((conn) => {
              const isSelected = selectedConnectionId === conn.id;
              return (
                <g key={conn.id} onClick={() => { setSelectedConnectionId(conn.id); setSelectedNodeId(null); }}>
                  {/* Invisible wider hit area for easier selection */}
                  <path
                    d={getConnectionPath(conn)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                  />
                  {/* Visible line */}
                  <path
                    d={getConnectionPath(conn)}
                    fill="none"
                    stroke={isSelected ? '#1677FF' : '#1890FF'}
                    strokeWidth={isSelected ? 3 : 2}
                    strokeDasharray="8,4"
                    marker-end="url(#arrowhead)"
                    className="connection-animated"
                    style={{ pointerEvents: 'none' }}
                  />
                  {conn.branchName && (
                    <text
                      x={(getPortPosition(conn.sourceId, conn.sourcePort).x + getPortPosition(conn.targetId, conn.targetPort).x) / 2}
                      y={(getPortPosition(conn.sourceId, conn.sourcePort).y + getPortPosition(conn.targetId, conn.targetPort).y) / 2 - 8}
                      textAnchor="middle" fill={token.colorTextSecondary} fontSize={12}
                      style={{ pointerEvents: 'none' }}
                    >
                      {conn.branchName}
                    </text>
                  )}
                </g>
              );
            })}
            {/* Temp connection line while drawing */}
            {connectingFrom && (
              <path
                d={`M ${getPortPosition(connectingFrom.nodeId, connectingFrom.port).x} ${getPortPosition(connectingFrom.nodeId, connectingFrom.port).y} L ${mousePos.x} ${mousePos.y}`}
                fill="none"
                stroke="#1890FF"
                strokeWidth={2}
                strokeDasharray="8,4"
                marker-end="url(#arrowhead)"
                className="connection-animated"
              />
            )}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const config = nodeTypeConfig[node.type];
            const isSelected = selectedNodeId === node.id;
            const isDebugging = debugging && currentDebugNode === node.id;
            const isError = validationErrorNodes.includes(node.id);
            const isExpanded = expandedNodes[node.id] !== false; // default to expanded
            const isStartNode = node.type === 'start';
            const isEndNode = node.type === 'end';
            const nodeWidth = isExpanded ? 320 : (isStartNode || isEndNode ? 100 : 180);

            const handleDuplicateNode = () => {
              const newNode = {
                ...node,
                id: `${node.type}-${Date.now()}`,
                name: `${node.name}-副本`,
                x: node.x + 20,
                y: node.y + 20,
              };
              const newNodes = [...nodes, newNode];
              setNodes(newNodes);
              saveToHistory(newNodes, connections);
              setExpandedNodes(prev => ({ ...prev, [newNode.id]: true }));
              setSelectedNodeId(newNode.id);
              setSaveStatus('unsaved');
              message.success('节点已复制');
            };

            const handleDeleteNode = () => {
              if (isStartNode || isEndNode) {
                message.warning('开始节点和结束节点不能删除');
                return;
              }
              const newNodes = nodes.filter(n => n.id !== node.id);
              const newConnections = connections.filter(c => c.sourceId !== node.id && c.targetId !== node.id);
              setNodes(newNodes);
              setConnections(newConnections);
              setSelectedNodeId(null);
              saveToHistory(newNodes, newConnections);
              setSaveStatus('unsaved');
              message.success('节点已删除');
            };

            return (
              <>
              <div
                key={node.id}
                onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                onMouseDown={(e) => {
                  if (e.button === 0) {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) {
                      setDraggingNodeId(node.id);
                      setDragOffset({
                        x: e.clientX - (node.x * scale / 100) - rect.left,
                        y: e.clientY - (node.y * scale / 100) - rect.top,
                      });
                    }
                  }
                }}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: nodeWidth,
                  background: config.bgColor,
                  border: `2px solid ${isError ? '#FF4D4F' : isSelected ? '#1677FF' : isDebugging ? '#52c41a' : config.color}`,
                  borderRadius: 8,
                  cursor: draggingNodeId === node.id ? 'grabbing' : 'grab',
                  boxShadow: isSelected ? '0 4px 12px rgba(24,144,255,0.3)' : (draggingNodeId === node.id ? '0 8px 16px rgba(0,0,0,0.2)' : 'none'),
                  transition: 'box-shadow 0.2s, border-color 0.2s, width 0.2s',
                  zIndex: isSelected ? 100 : (draggingNodeId === node.id ? 1000 : 10),
                  overflow: 'visible',
                }}
              >
                {/* Connection Ports - Top */}
                <div style={{
                  position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
                  width: 12, height: 12, background: connectingFrom?.nodeId === node.id && connectingFrom?.port === 'top' ? '#1890FF' : token.colorBgContainer,
                  border: `2px solid ${token.colorBorder}`, borderRadius: '50%',
                  cursor: 'crosshair', zIndex: 10,
                }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setConnectingFrom({ nodeId: node.id, port: 'top' });
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) {
                      setMousePos({ x: (e.clientX - rect.left) / (scale / 100), y: (e.clientY - rect.top) / (scale / 100) });
                    }
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    if (connectingFrom && (connectingFrom.nodeId !== node.id || connectingFrom.port !== 'top')) {
                      handleEndConnection(node.id, 'top');
                    }
                  }}
                />
                {/* Connection Ports - Bottom */}
                <div style={{
                  position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                  width: 12, height: 12, background: connectingFrom?.nodeId === node.id && connectingFrom?.port === 'bottom' ? '#1890FF' : token.colorBgContainer,
                  border: `2px solid ${token.colorBorder}`, borderRadius: '50%',
                  cursor: 'crosshair', zIndex: 10,
                }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setConnectingFrom({ nodeId: node.id, port: 'bottom' });
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) {
                      setMousePos({ x: (e.clientX - rect.left) / (scale / 100), y: (e.clientY - rect.top) / (scale / 100) });
                    }
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    if (connectingFrom && (connectingFrom.nodeId !== node.id || connectingFrom.port !== 'bottom')) {
                      handleEndConnection(node.id, 'bottom');
                    }
                  }}
                />
                {(node.type === 'condition') && (
                  <>
                    <div style={{
                      position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
                      width: 12, height: 12, background: connectingFrom?.nodeId === node.id && connectingFrom?.port === 'left' ? '#1890FF' : token.colorBgContainer,
                      border: `2px solid ${token.colorBorder}`, borderRadius: '50%',
                      cursor: 'crosshair', zIndex: 10,
                    }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setConnectingFrom({ nodeId: node.id, port: 'left' });
                        const rect = canvasRef.current?.getBoundingClientRect();
                        if (rect) {
                          setMousePos({ x: (e.clientX - rect.left) / (scale / 100), y: (e.clientY - rect.top) / (scale / 100) });
                        }
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        if (connectingFrom && (connectingFrom.nodeId !== node.id || connectingFrom.port !== 'left')) {
                          handleEndConnection(node.id, 'left');
                        }
                      }}
                    />
                    <div style={{
                      position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
                      width: 12, height: 12, background: connectingFrom?.nodeId === node.id && connectingFrom?.port === 'right' ? '#1890FF' : token.colorBgContainer,
                      border: `2px solid ${token.colorBorder}`, borderRadius: '50%',
                      cursor: 'crosshair', zIndex: 10,
                    }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setConnectingFrom({ nodeId: node.id, port: 'right' });
                        const rect = canvasRef.current?.getBoundingClientRect();
                        if (rect) {
                          setMousePos({ x: (e.clientX - rect.left) / (scale / 100), y: (e.clientY - rect.top) / (scale / 100) });
                        }
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        if (connectingFrom && (connectingFrom.nodeId !== node.id || connectingFrom.port !== 'right')) {
                          handleEndConnection(node.id, 'right');
                        }
                      }}
                    />
                  </>
                )}
                {(node.type === 'agent' && node.config.agent?.failStrategy === 'fallback') && (
                  <Tooltip title="降级出口">
                    <div style={{
                      position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
                      width: 12, height: 12, background: '#FF4D4F', border: '2px solid #FF4D4F', borderRadius: '50%',
                      cursor: 'crosshair', zIndex: 10,
                    }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setConnectingFrom({ nodeId: node.id, port: 'right' });
                        const rect = canvasRef.current?.getBoundingClientRect();
                        if (rect) {
                          setMousePos({ x: (e.clientX - rect.left) / (scale / 100), y: (e.clientY - rect.top) / (scale / 100) });
                        }
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        if (connectingFrom && (connectingFrom.nodeId !== node.id || connectingFrom.port !== 'right')) {
                          handleEndConnection(node.id, 'right');
                        }
                      }}
                    />
                  </Tooltip>
                )}

                {/* Node Header - Always Visible */}
                <div style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: isExpanded ? `1px solid ${token.colorBorder}` : 'none',
                }}>
                  <Text style={{ fontSize: 18 }}>{config.icon}</Text>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13, fontWeight: 500, color: config.color }} ellipsis>{node.name}</Text>
                    {!isExpanded && (
                      <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                        {node.type === 'agent' && node.config.agent?.agentName}
                        {node.type === 'input' && (node.config.input?.inputMode === 'dialog' ? '对话框输入' : '表单输入')}
                        {node.type === 'output' && '输出节点'}
                        {node.type === 'condition' && `${(node.config.condition?.branches || []).length} 个分支`}
                        {isStartNode && '开始节点'}
                        {isEndNode && '结束节点'}
                      </Text>
                    )}
                    {isDebugging && <Tag color="green" style={{ fontSize: 10, marginTop: 2 }}>执行中</Tag>}
                  </div>
                  {/* Expand/Collapse button - same line as name */}
                  <Tooltip title={isExpanded ? '收起配置' : '展开配置'}>
                    <Button
                      type="text"
                      size="small"
                      icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedNodes(prev => ({ ...prev, [node.id]: !prev[node.id] }));
                      }}
                    />
                  </Tooltip>
                </div>

                {/* Expanded Config Content */}
                {isExpanded && (
                  <div style={{ padding: 12, maxHeight: 400, overflow: 'auto' }}>
                    {/* Start Node Config */}
                    {node.type === 'start' && (
                      <div>
                        <Form layout="vertical" size="small">
                          <Form.Item label="开场白" style={{ marginBottom: 8 }}>
                            <TextArea
                              rows={2}
                              placeholder="流程启动时发送给用户的消息"
                              value={node.config.start?.welcomeMessage || ''}
                              onChange={(e) => {
                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, start: { ...n.config.start, welcomeMessage: e.target.value } } } : n));
                                setSaveStatus('unsaved');
                              }}
                            />
                          </Form.Item>
                          <Form.Item label="引导问题" style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {(node.config.start?.guideQuestions || []).map((q, i) => (
                                <Input
                                  key={i}
                                  size="small"
                                  placeholder="问题文本"
                                  value={q.label}
                                  onChange={(e) => {
                                    const newQuestions = [...(node.config.start?.guideQuestions || [])];
                                    newQuestions[i] = { ...newQuestions[i], label: e.target.value };
                                    setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, start: { ...n.config.start, guideQuestions: newQuestions } } } : n));
                                    setSaveStatus('unsaved');
                                  }}
                                  addonAfter={
                                    <DeleteOutlined onClick={() => {
                                      const newQuestions = (node.config.start?.guideQuestions || []).filter((_, idx) => idx !== i);
                                      setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, start: { ...n.config.start, guideQuestions: newQuestions } } } : n));
                                      setSaveStatus('unsaved');
                                    }} />
                                  }
                                />
                              ))}
                              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => {
                                const newQuestions = [...(node.config.start?.guideQuestions || []), { label: '' }];
                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, start: { ...n.config.start, guideQuestions: newQuestions } } } : n));
                                setSaveStatus('unsaved');
                              }}>添加问题</Button>
                            </div>
                          </Form.Item>
                        </Form>
                      </div>
                    )}

                    {/* Input Node Config */}
                    {node.type === 'input' && (
                      <div>
                        <Form layout="vertical" size="small">
                          <Form.Item label="输入方式" style={{ marginBottom: 8 }}>
                            <Select
                              value={node.config.input?.inputMode || 'dialog'}
                              onChange={(value) => {
                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, inputMode: value } } } : n));
                                setSaveStatus('unsaved');
                              }}
                              options={[
                                { label: '对话框输入', value: 'dialog' },
                                { label: '表单输入', value: 'form' },
                              ]}
                            />
                          </Form.Item>
                          {node.config.input?.inputMode === 'form' && (
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>表单项：</Text>
                              {(node.config.input?.formFields || []).map((field, i) => (
                                <Card key={field.id} size="small" style={{ marginTop: 8 }}>
                                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                    <Space>
                                      <Select
                                        value={field.type}
                                        size="small"
                                        style={{ width: 80 }}
                                        onChange={(type) => {
                                          const newFields = [...(node.config.input?.formFields || [])];
                                          newFields[i] = { ...newFields[i], type };
                                          setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                          setSaveStatus('unsaved');
                                        }}
                                        options={[
                                          { label: '文本', value: 'text' },
                                          { label: '下拉', value: 'select' },
                                          { label: '文件', value: 'file' },
                                        ]}
                                      />
                                      <Input
                                        placeholder="显示名称"
                                        size="small"
                                        value={field.label}
                                        style={{ width: 80 }}
                                        onChange={(e) => {
                                          const newFields = [...(node.config.input?.formFields || [])];
                                          newFields[i] = { ...newFields[i], label: e.target.value };
                                          setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                          setSaveStatus('unsaved');
                                        }}
                                      />
                                      <Input
                                        placeholder="变量名"
                                        size="small"
                                        value={field.variableName}
                                        style={{ width: 80 }}
                                        onChange={(e) => {
                                          const newFields = [...(node.config.input?.formFields || [])];
                                          newFields[i] = { ...newFields[i], variableName: e.target.value };
                                          setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                          setSaveStatus('unsaved');
                                        }}
                                      />
                                    </Space>
                                    {field.type === 'select' && (
                                      <div>
                                        <Switch checkedChildren="多选" unCheckedChildren="单选" checked={field.multiple} size="small" onChange={(checked) => {
                                          const newFields = [...(node.config.input?.formFields || [])];
                                          newFields[i] = { ...newFields[i], multiple: checked };
                                          setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                          setSaveStatus('unsaved');
                                        }} />
                                        <div style={{ marginTop: 4 }}>
                                          {(field.options || []).map((opt, optIdx) => (
                                            <Space key={optIdx} style={{ marginTop: 4 }}>
                                              <Input placeholder="标签" size="small" value={opt.label} style={{ width: 70 }} onChange={(e) => {
                                                const newFields = [...(node.config.input?.formFields || [])];
                                                const newOptions = [...(newFields[i].options || [])];
                                                newOptions[optIdx] = { ...newOptions[optIdx], label: e.target.value };
                                                newFields[i] = { ...newFields[i], options: newOptions };
                                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                                setSaveStatus('unsaved');
                                              }} />
                                              <Input placeholder="值" size="small" value={opt.value} style={{ width: 60 }} onChange={(e) => {
                                                const newFields = [...(node.config.input?.formFields || [])];
                                                const newOptions = [...(newFields[i].options || [])];
                                                newOptions[optIdx] = { ...newOptions[optIdx], value: e.target.value };
                                                newFields[i] = { ...newFields[i], options: newOptions };
                                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                                setSaveStatus('unsaved');
                                              }} />
                                              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => {
                                                const newFields = [...(node.config.input?.formFields || [])];
                                                const newOptions = (newFields[i].options || []).filter((_, idx) => idx !== optIdx);
                                                newFields[i] = { ...newFields[i], options: newOptions };
                                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                                setSaveStatus('unsaved');
                                              }} />
                                            </Space>
                                          ))}
                                          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => {
                                            const newFields = [...(node.config.input?.formFields || [])];
                                            const newOptions = [...(newFields[i].options || []), { label: '', value: '' }];
                                            newFields[i] = { ...newFields[i], options: newOptions };
                                            setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                            setSaveStatus('unsaved');
                                          }}>添加选项</Button>
                                        </div>
                                      </div>
                                    )}
                                    {field.type === 'file' && (
                                      <div>
                                        <Text type="secondary" style={{ fontSize: 11 }}>支持文件类型：</Text>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                          {['图片', 'PDF', 'Word', 'Excel', 'CSV', 'DICOM'].map(ft => (
                                            <Tag
                                              key={ft}
                                              style={{ cursor: 'pointer', border: (field.fileTypes || []).includes(ft) ? '1px solid #1890FF' : '1px dashed #d9d9d9', color: (field.fileTypes || []).includes(ft) ? '#1890FF' : '#999', background: (field.fileTypes || []).includes(ft) ? '#E6F7FF' : 'transparent' }}
                                              onClick={() => {
                                                const newFields = [...(node.config.input?.formFields || [])];
                                                const currentTypes = newFields[i].fileTypes || [];
                                                const newFileTypes = currentTypes.includes(ft) ? currentTypes.filter(t => t !== ft) : [...currentTypes, ft];
                                                newFields[i] = { ...newFields[i], fileTypes: newFileTypes };
                                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                                setSaveStatus('unsaved');
                                              }}
                                            >{ft}</Tag>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <Switch checkedChildren="必填" unCheckedChildren="选填" checked={field.required} size="small" onChange={(checked) => {
                                      const newFields = [...(node.config.input?.formFields || [])];
                                      newFields[i] = { ...newFields[i], required: checked };
                                      setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                      setSaveStatus('unsaved');
                                    }} />
                                  </Space>
                                </Card>
                              ))}
                              <Button type="dashed" size="small" icon={<PlusOutlined />} block onClick={() => {
                                const newField = { id: `ff-${Date.now()}`, type: 'text' as const, label: '', variableName: '', required: false };
                                const newFields = [...(node.config.input?.formFields || []), newField];
                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, input: { ...n.config.input, formFields: newFields } } } : n));
                                setSaveStatus('unsaved');
                              }} style={{ marginTop: 8 }}>添加表单项</Button>
                            </div>
                          )}
                        </Form>
                      </div>
                    )}

                    {/* Output Node Config */}
                    {node.type === 'output' && (
                      <div>
                        <Form layout="vertical" size="small">
                          <Form.Item label="输出内容模板" style={{ marginBottom: 8 }}>
                            <TextArea
                              rows={3}
                              placeholder="支持 Markdown 和变量插值"
                              value={node.config.output?.contentTemplate || ''}
                              onChange={(e) => {
                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, output: { ...n.config.output, contentTemplate: e.target.value } } } : n));
                                setSaveStatus('unsaved');
                              }}
                            />
                          </Form.Item>
                          <Form.Item label="展示方式" style={{ marginBottom: 8 }}>
                            <Select
                              value={node.config.output?.displayMode || 'bubble'}
                              onChange={(value) => {
                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, output: { ...n.config.output, displayMode: value } } } : n));
                                setSaveStatus('unsaved');
                              }}
                              options={[
                                { label: '消息气泡', value: 'bubble' },
                                { label: '卡片面板', value: 'card' },
                                { label: '流式输出', value: 'stream' },
                              ]}
                            />
                          </Form.Item>
                        </Form>
                      </div>
                    )}

                    {/* Agent Node Config */}
                    {node.type === 'agent' && (
                      <div>
                        <Form layout="vertical" size="small">
                          <Form.Item label="绑定智能体" style={{ marginBottom: 8 }}>
                            <Select
                              value={node.config.agent?.agentId}
                              placeholder="请选择智能体"
                              showSearch
                              onChange={(value) => {
                                const agent = onlineAgents.find(a => a.id === value);
                                setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, agent: { ...n.config.agent, agentId: value, agentName: agent?.name } } } : n));
                                setSaveStatus('unsaved');
                              }}
                              options={onlineAgents.map(a => ({ label: a.name, value: a.id }))}
                            />
                          </Form.Item>
                          {node.config.agent?.agentId && (
                            <>
                              <Form.Item label="调用方式" style={{ marginBottom: 8 }}>
                                <Select
                                  value={node.config.agent?.callMode || 'sync'}
                                  onChange={(value) => {
                                    setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, agent: { ...n.config.agent, callMode: value } } } : n));
                                    setSaveStatus('unsaved');
                                  }}
                                  options={[
                                    { label: '同步调用', value: 'sync' },
                                    { label: '异步调用', value: 'async' },
                                  ]}
                                />
                              </Form.Item>
                              <Form.Item label="超时时间（秒）" style={{ marginBottom: 8 }}>
                                <InputNumber
                                  value={node.config.agent?.timeout || 30}
                                  min={1}
                                  max={600}
                                  style={{ width: '100%' }}
                                  onChange={(value) => {
                                    setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, agent: { ...n.config.agent, timeout: value || 30 } } } : n));
                                    setSaveStatus('unsaved');
                                  }}
                                />
                              </Form.Item>
                              <Form.Item label="失败处理策略" style={{ marginBottom: 8 }}>
                                <Select
                                  value={node.config.agent?.failStrategy || 'terminate'}
                                  onChange={(value) => {
                                    setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, agent: { ...n.config.agent, failStrategy: value } } } : n));
                                    setSaveStatus('unsaved');
                                  }}
                                  options={[
                                    { label: '跳过继续', value: 'skip_continue' },
                                    { label: '走降级分支', value: 'fallback' },
                                    { label: '终止流程', value: 'terminate' },
                                  ]}
                                />
                              </Form.Item>
                            </>
                          )}
                        </Form>
                      </div>
                    )}

                    {/* Condition Node Config */}
                    {node.type === 'condition' && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>分支条件：</Text>
                        {(node.config.condition?.branches || []).map((branch, i) => (
                          <Card key={branch.id} size="small" style={{ marginTop: 8 }}>
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                              <Input
                                placeholder="分支名称"
                                value={branch.name}
                                size="small"
                                onChange={(e) => {
                                  const newBranches = [...(node.config.condition?.branches || [])];
                                  newBranches[i] = { ...newBranches[i], name: e.target.value };
                                  setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                                  setSaveStatus('unsaved');
                                }}
                              />
                              <Text type="secondary" style={{ fontSize: 11 }}>条件表达式 (待实现)</Text>
                            </Space>
                          </Card>
                        ))}
                        <Button type="dashed" size="small" icon={<PlusOutlined />} block onClick={() => {
                          const newBranches = [...(node.config.condition?.branches || []), { id: `b-${Date.now()}`, name: `分支${(node.config.condition?.branches?.length || 0) + 1}`, rules: [], logic: 'and' as const }];
                          setNodes(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, condition: { branches: newBranches } } } : n));
                          setSaveStatus('unsaved');
                        }} style={{ marginTop: 8 }}>添加分支</Button>
                      </div>
                    )}

                    {/* End Node Config */}
                    {node.type === 'end' && (
                      <Text type="secondary" style={{ fontSize: 12 }}>结束节点，无需配置</Text>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons - Outside Node, Top-Right Corner, Only When Selected */}
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  left: node.x + nodeWidth + 4,
                  top: node.y - 8,
                  display: 'flex',
                  gap: 4,
                  zIndex: 1000,
                  background: 'white',
                  borderRadius: 6,
                  padding: '4px 8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  border: '1px solid #e8e8e8',
                }}>
                  <Tooltip title="运行此节点">
                    <Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={() => message.info(`运行节点: ${node.name}`)} style={{ color: '#1890FF', padding: 4 }} />
                  </Tooltip>
                  {!isStartNode && (
                    <Tooltip title="复制节点">
                      <Button type="text" size="small" icon={<FileTextOutlined />} onClick={() => handleDuplicateNode()} style={{ padding: 4 }} />
                    </Tooltip>
                  )}
                  {!isStartNode && !isEndNode && (
                    <Tooltip title="删除节点">
                      <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteNode()} danger style={{ padding: 4 }} />
                    </Tooltip>
                  )}
                </div>
              )}
              </>
            );
          })}
        </div>

        {/* Right Panel - Only for connection config when node is selected */}
        <div style={{
          width: selectedNode && !expandedNodes[selectedNode.id] ? 320 : 0,
          background: token.colorBgContainer, borderLeft: `1px solid ${token.colorBorder}`, overflow: 'auto', transition: 'width 0.2s',
        }}>
          {selectedNode && !expandedNodes[selectedNode.id] && (
            <div style={{ padding: 16 }}>
              <Title level={5} style={{ marginBottom: 12 }}>节点摘要</Title>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="节点名称">{selectedNode.name}</Descriptions.Item>
                <Descriptions.Item label="节点类型">{nodeTypeLabels[selectedNode.type]}</Descriptions.Item>
                {selectedNode.type === 'agent' && selectedNode.config.agent?.agentName && (
                  <Descriptions.Item label="绑定智能体">{selectedNode.config.agent.agentName}</Descriptions.Item>
                )}
              </Descriptions>
              <Button
                type="primary"
                block
                icon={<EyeOutlined />}
                onClick={() => setExpandedNodes(prev => ({ ...prev, [selectedNode.id]: true }))}
                style={{ marginTop: 16 }}
              >
                展开配置
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div style={{
        height: 36, background: token.colorBgContainer, borderTop: `1px solid ${token.colorBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
      }}>
        <Space size="large">
          <Space size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>缩放：</Text>
            <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setScale(Math.max(25, scale - 25))} />
            <Text style={{ fontSize: 12, minWidth: 40, textAlign: 'center' }}>{scale}%</Text>
            <Button size="small" icon={<ZoomInOutlined />} onClick={() => setScale(Math.min(200, scale + 25))} />
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{nodes.length} 个节点 / {connections.filter(c => c.sourceId && c.targetId).length} 条连线</Text>
        </Space>
        <Space size="small">
          <Text type={saveStatus === 'saved' ? 'secondary' : 'warning'} style={{ fontSize: 12 }}>
            {saveStatus === 'saved' ? '已保存' : '未保存变更'}
          </Text>
        </Space>
      </div>

      {/* Workflow Preview Drawer */}
      <Drawer
        title={
          <Space>
            <Text strong>工作流预览</Text>
            <Tag color={workflowStatus === 'running' ? 'processing' : workflowStatus === 'success' ? 'success' : workflowStatus === 'failed' ? 'error' : 'default'}>
              {workflowStatus === 'idle' ? '空闲' : workflowStatus === 'running' ? '运行中' : workflowStatus === 'success' ? '运行成功' : '运行失败'}
            </Tag>
          </Space>
        }
        placement="right"
        width={520}
        open={workflowPreviewVisible}
        onClose={() => {
          setWorkflowPreviewVisible(false);
          setDebugging(false);
          setCurrentPreviewNode(null);
          setCurrentDebugNode(null);
          setWorkflowStatus('idle');
        }}
        extra={
          <Space>
            {workflowStatus === 'running' && (
              <>
                <Button icon={<StepForwardOutlined />} onClick={handleDebugStep}>下一步</Button>
                <Button icon={<StopOutlined />} danger onClick={() => {
                  setDebugging(false);
                  setCurrentPreviewNode(null);
                  setCurrentDebugNode(null);
                  setWorkflowStatus('failed');
                  setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '流程已终止',
                    timestamp: new Date()
                  }]);
                }}>停止</Button>
              </>
            )}
            <Button type="link" size="small" onClick={() => message.info('查看完整日志')}>查看日志</Button>
          </Space>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Chat Messages Area */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: 16,
            background: '#F5F5F5',
            borderRadius: 8,
            marginBottom: 16,
            minHeight: 300,
          }}>
            {chatMessages.length === 0 ? (
              <Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: '40px 0' }}>
                流程开始执行后，对话消息将在这里显示
              </Text>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  marginBottom: 12,
                }}>
                  <div style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    background: msg.role === 'user' ? '#1890FF' : 'white',
                    color: msg.role === 'user' ? 'white' : 'inherit',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    border: msg.role === 'user' ? 'none' : '1px solid #f0f0f0',
                  }}>
                    <Text style={{ color: msg.role === 'user' ? 'white' : 'inherit', whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
                    <Text style={{
                      fontSize: 10, display: 'block', marginTop: 4,
                      color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#999',
                    }}>
                      {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Execution Summary */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Text strong>执行摘要</Text>
              <Space size="large">
                <Text type="secondary">总节点数：<Text strong>{nodes.length}</Text></Text>
                <Text type="secondary">当前节点：<Text strong>{currentPreviewNode ? nodes.find(n => n.id === currentPreviewNode)?.name : '-'}</Text></Text>
              </Space>
              {workflowLogs.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>执行路径：</Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {workflowLogs.map((log, idx) => (
                      <Tag key={idx} color={log.status === 'success' ? 'success' : log.status === 'failed' ? 'error' : 'processing'}>
                        {log.nodeName}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
            </Space>
          </Card>

          {/* Bottom Input Area */}
          <div style={{
            padding: 12,
            background: 'white',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
          }}>
            {currentPreviewNode && nodes.find(n => n.id === currentPreviewNode)?.type === 'input' ? (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Text type="secondary" style={{ fontSize: 12 }}>等待输入节点激活...</Text>
                <Input.TextArea
                  placeholder="输入内容..."
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <Button type="primary" icon={<SendOutlined />} block onClick={() => {
                  if (chatInput.trim()) {
                    setChatMessages(prev => [...prev, { role: 'user', content: chatInput, timestamp: new Date() }]);
                    setChatInput('');
                    // Simulate response
                    setTimeout(() => {
                      setChatMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `已收到输入，正在处理...`,
                        timestamp: new Date()
                      }]);
                    }, 500);
                  }
                }}>
                  提交
                </Button>
              </Space>
            ) : workflowStatus === 'running' ? (
              <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>流程执行中...</Text>
            ) : workflowStatus === 'success' ? (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Alert type="success" message="运行成功" description="流程已成功执行完成" showIcon />
                <Button icon={<ReloadOutlined />} block onClick={() => {
                  setWorkflowStatus('running');
                  setWorkflowLogs([]);
                  setChatMessages([]);
                  const startNode = nodes.find(n => n.type === 'start');
                  if (startNode) {
                    setCurrentPreviewNode(startNode.id);
                    setChatMessages([{
                      role: 'assistant',
                      content: startNode.config.start?.welcomeMessage || '您好，流程已重新开始',
                      timestamp: new Date()
                    }]);
                    setWorkflowLogs([{
                      nodeName: startNode.name,
                      nodeType: startNode.type,
                      status: 'success',
                      duration: 0,
                      output: startNode.config.start?.welcomeMessage || '流程已开始'
                    }]);
                  }
                }}>
                  开启新会话
                </Button>
              </Space>
            ) : workflowStatus === 'failed' ? (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Alert type="error" message="运行失败" description="流程执行过程中发生错误" showIcon />
                <Button icon={<ReloadOutlined />} block onClick={() => {
                  setWorkflowStatus('running');
                  setWorkflowLogs([]);
                  setChatMessages([]);
                }}>
                  重新测试
                </Button>
              </Space>
            ) : (
              <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>点击「运行」开始调试</Text>
            )}
          </div>
        </div>
      </Drawer>

      {/* Debug Panel - kept for step-by-step debugging */}
      <Drawer title="流程调试" placement="right" width={600} open={debugPanelVisible && !workflowPreviewVisible} onClose={() => { setDebugPanelVisible(false); setDebugging(false); setCurrentDebugNode(null); }}
        extra={
          <Space>
            {debugging && <Button icon={<StepForwardOutlined />} onClick={handleDebugStep}>下一步</Button>}
            {debugging && <Button icon={<StopOutlined />} danger onClick={() => { setDebugging(false); setCurrentDebugNode(null); }}>停止</Button>}
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Alert type="info" message="调试模式说明" description="在调试模式下，您可以逐步执行流程，查看每个节点的输入输出和执行状态。" showIcon />
          <Card title="执行概览" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="流程">{flowName}</Descriptions.Item>
              <Descriptions.Item label="状态">{debugging ? <Badge status="processing" text="执行中" /> : <Badge status="default" text="已停止" />}</Descriptions.Item>
              <Descriptions.Item label="当前节点">{currentDebugNode ? nodes.find(n => n.id === currentDebugNode)?.name : '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title="节点执行状态" size="small">
            <Timeline items={nodes.map(node => ({
              color: currentDebugNode === node.id ? 'blue' : 'gray',
              children: (
                <Space>
                  <Text strong={currentDebugNode === node.id}>{node.name}</Text>
                  <Tag>{nodeTypeLabels[node.type]}</Tag>
                  {currentDebugNode === node.id && <Badge status="processing" text="执行中" />}
                </Space>
              ),
            }))} />
          </Card>
          <Card title="实时变量" size="small"
            extra={
              <Space>
                <Button size="small" onClick={() => setExpandedVarKeys([])}>收起全部</Button>
                <Button size="small" onClick={() => setExpandedVarKeys(Object.keys(debugVariables).flatMap(k => [k, ...(typeof debugVariables[k] === 'object' && debugVariables[k] !== null ? Object.keys(debugVariables[k]).map(ck => `${k}.${ck}`) : [])]))}>展开全部</Button>
              </Space>
            }
          >
            {Object.keys(debugVariables).length === 0 ? (
              <Empty description="暂无变量数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {Object.entries(debugVariables).map(([key, value]) => {
                  const isObject = typeof value === 'object' && value !== null;
                  return (
                    <div key={key} style={{ marginBottom: 8, border: '1px solid #f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          padding: '6px 12px',
                          background: isObject ? '#fafafa' : 'transparent',
                          cursor: isObject ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                        onClick={() => {
                          if (isObject) {
                            const childKeys = Object.keys(value).map(ck => `${key}.${ck}`);
                            setExpandedVarKeys(prev =>
                              prev.includes(key)
                                ? prev.filter(k => !childKeys.includes(k))
                                : [...prev, key, ...childKeys]
                            );
                          }
                        }}
                      >
                        {isObject && (
                          <Text style={{ fontSize: 10, color: '#999' }}>
                            {expandedVarKeys.includes(key) ? '▼' : '▶'}
                          </Text>
                        )}
                        <Text strong style={{ color: '#1890FF', fontSize: 13 }}>{key}</Text>
                        <Tag style={{ marginLeft: 'auto' }}>{typeof value === 'object' ? (Array.isArray(value) ? 'array' : 'object') : typeof value}</Tag>
                      </div>
                      {isObject && expandedVarKeys.includes(key) && (
                        <div style={{ padding: '8px 12px 8px 32px', background: '#fff' }}>
                          {Object.entries(value).map(([subKey, subValue]) => (
                            <div key={subKey} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Text style={{ color: '#666', fontSize: 12, minWidth: 100 }}>{subKey}:</Text>
                              <Text code style={{ fontSize: 12 }}>{JSON.stringify(subValue)}</Text>
                            </div>
                          ))}
                        </div>
                      )}
                      {!isObject && (
                        <div style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text style={{ color: '#666' }}>值:</Text>
                          <Text code>{String(value)}</Text>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card title="测试聊天" size="small"
            extra={
              <Button size="small" danger onClick={() => setChatMessages([])}>清空</Button>
            }
          >
            <div style={{ height: 300, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflow: 'auto', marginBottom: 12, padding: '8px 0' }}>
                {chatMessages.length === 0 ? (
                  <Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: '20px 0' }}>
                    开始对话测试，输入消息后按发送按钮
                  </Text>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                      marginBottom: 12,
                    }}>
                      <div style={{
                        maxWidth: '75%',
                        padding: '10px 14px',
                        borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        background: msg.role === 'user' ? '#1890FF' : 'white',
                        color: msg.role === 'user' ? 'white' : 'inherit',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        border: msg.role === 'user' ? 'none' : '1px solid #f0f0f0',
                      }}>
                        <Text style={{ color: msg.role === 'user' ? 'white' : 'inherit' }}>{msg.content}</Text>
                        <Text style={{
                          fontSize: 10, display: 'block', marginTop: 4,
                          color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#999',
                        }}>
                          {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Input
                  placeholder="输入测试消息..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onPressEnter={() => {
                    if (chatInput.trim()) {
                      setChatMessages(prev => [...prev, { role: 'user', content: chatInput, timestamp: new Date() }]);
                      // Simulate assistant response
                      setTimeout(() => {
                        setChatMessages(prev => [...prev, {
                          role: 'assistant',
                          content: `已收到: "${chatInput}" - 这是模拟回复，实际会调用流程处理`,
                          timestamp: new Date()
                        }]);
                      }, 500);
                      setChatInput('');
                    }
                  }}
                  size="small"
                />
                <Button
                  type="primary"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={() => {
                    if (chatInput.trim()) {
                      setChatMessages(prev => [...prev, { role: 'user', content: chatInput, timestamp: new Date() }]);
                      setTimeout(() => {
                        setChatMessages(prev => [...prev, {
                          role: 'assistant',
                          content: `已收到: "${chatInput}" - 这是模拟回复，实际会调用流程处理`,
                          timestamp: new Date()
                        }]);
                      }, 500);
                      setChatInput('');
                    }
                  }}
                />
              </div>
            </div>
          </Card>
        </Space>
      </Drawer>

      {/* Publish Modal */}
      <Modal title="发布流程" open={publishModalVisible} onCancel={() => setPublishModalVisible(false)} onOk={handlePublish} okText="确认发布" cancelText="取消">
        <Form form={publishForm} layout="vertical">
          <Form.Item label="版本号"><Text>{flow?.version || 'v1.0'}</Text></Form.Item>
          <Form.Item name="changeNote" label="变更说明" rules={[{ required: true, message: '请填写变更说明' }]}>
            <TextArea rows={4} placeholder="描述本次发布的变更内容" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FlowEditor;