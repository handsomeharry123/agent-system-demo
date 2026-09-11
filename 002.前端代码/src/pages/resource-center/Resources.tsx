/**
 * 医院资源管理中心 - 2.1 资源管理页（含草稿 Tab）
 * 规范:医院资源管理中心-需求说明文档V1.1 §2.1
 *   - 全部资源(§2.1.1):管理员之间数据不隔离;字段 资源列表 / 负责人 / 联系方式 / 对接方式 / 创建人
 *   - 注册资源草稿(§2.1.2):管理员之间数据隔离;字段口径与全部资源一致;操作 编辑 / 删除
 *   - 资源 ID / 更新时间 / 创建人 / 对接方式子字段统一收敛到「查看详情」Drawer
 *   - V1.1.1:「注册资源草稿」由独立子页面收敛为「资源管理」下的第二个 Tab
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Tooltip,
  Modal,
  message,
  Typography,
  Drawer,
  Descriptions,
  Empty,
  Flex,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  ApiOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import PageHeader from "../../components/PageHeader";
import {
  useResources,
  useDrafts,
  useDemoRole,
  useCurrentUser,
  ADMIN_ACCOUNTS,
  removeResource,
  removeDraft,
  RESOURCE_CATALOG,
  PROTOCOL_LABEL,
  PROTOCOL_COLOR,
  type ResourceItem,
  type ProtocolType,
} from "../../mock/resource-center";
import { useSmartDraft } from "../agent-center/smart/store";

const { Text } = Typography;

const resourceName = (code: string) =>
  RESOURCE_CATALOG.find((r) => r.code === code)?.name || code;

const creatorLabel = (creator?: string) => {
  if (!creator) return "-";
  return ADMIN_ACCOUNTS.find((a) => a.account === creator)?.name || creator;
};

/**
 * 资源管理 Tab 配置
 *   - all    : §2.1.1 全部资源(管理员之间不隔离)
 *   - draft  : §2.1.2 注册资源草稿(管理员之间隔离)
 */
type ResourceTabKey = "all" | "draft";
const TABS: { key: ResourceTabKey; label: string }[] = [
  { key: "all", label: "所有资源" },
  { key: "draft", label: "草稿" },
];

const TAB_STORAGE_KEY = "resource-center:resources:tab:v1";
const FILTER_STORAGE_KEY = "resource-center:resources:filters:v1";

const loadTab = (): ResourceTabKey => {
  try {
    const v = sessionStorage.getItem(TAB_STORAGE_KEY) as ResourceTabKey | null;
    if (v && TABS.some((t) => t.key === v)) return v;
  } catch {}
  return "all";
};

const loadFilters = (): { keyword: string; protocol: ProtocolType | "all" } => {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { keyword: "", protocol: "all" };
};

const ResourceList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useResources();
  const draftData = useDrafts();
  // V1.2:resource-center mock 内置 demoRole 为英文枚举 'admin' | 'user'(与 useDemoSettings 的中文枚举是两套独立 store)
  const isAdmin = useDemoRole() === "admin";
  const current = useCurrentUser();
  const [keyword, setKeyword] = useState<string>(
    () => searchParams.get("keyword") || loadFilters().keyword,
  );
  const [protocol, setProtocol] = useState<ProtocolType | "all">(
    () => loadFilters().protocol,
  );
  const [tab, setTab] = useState<ResourceTabKey>(
    () => (searchParams.get("tab") as ResourceTabKey) || loadTab(),
  );
  const [detail, setDetail] = useState<ResourceItem | null>(null);
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();

  useEffect(() => {
    const code = searchParams.get("resource");
    if (!code) return;
    const matched = data.find((item) => item.resources.includes(code));
    if (matched) setDetail(matched);
  }, [data, searchParams]);

  const visibleResources = useMemo(() => data, [data]);
  const visibleDrafts = useMemo(() => {
    if (!isAdmin) return [];
    return draftData.filter((draft) => draft.creator === current.account);
  }, [draftData, isAdmin, current.account]);

  useEffect(() => {
    if (tab === "all") {
      pushWelcomeGreeting(
        "resource-center-all",
        isAdmin ? "admin" : "dept",
        (_pageKey, _role, target) => (target === "bubble" ? [data.length] : []),
        {
          actions: [
            {
              key: "register-resource",
              label: "注册资源",
              path: "/app/resource-center/resources/new",
              enabled: true,
            },
          ],
        },
      );
    } else {
      const rows = visibleDrafts.map((draft) => ({
        recordId: draft.id,
        title: draft.resources.map(resourceName).join("、") || "未命名资源",
        subTitle: PROTOCOL_LABEL[draft.protocol],
        actions: [
          {
            key: `edit-${draft.id}`,
            label: "编辑",
            kind: "navigate-edit" as const,
            path: `/app/resource-center/resources/edit/${draft.id}`,
          },
        ],
      }));
      pushWelcomeGreeting(
        "resource-center-draft",
        isAdmin ? "admin" : "dept",
        () => [visibleDrafts.length],
        {
          miniList: {
            toggleLabel: "查看未完成的注册资源操作",
            targetTab: "draft",
            rows,
            totalCount: visibleDrafts.length,
          },
        },
      );
    }
    return () => consumeWelcome();
  }, [
    consumeWelcome,
    data.length,
    isAdmin,
    pushWelcomeGreeting,
    tab,
    visibleDrafts,
  ]);

  useEffect(() => {
    const onBubbleRowAction = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; path?: string }>)
        .detail;
      if (detail?.kind === "navigate-edit" && detail.path)
        navigate(detail.path);
    };
    window.addEventListener("agent-bubble-row-action", onBubbleRowAction);
    return () =>
      window.removeEventListener("agent-bubble-row-action", onBubbleRowAction);
  }, [navigate]);

  // 持久化 tab / 筛选
  useEffect(() => {
    sessionStorage.setItem(TAB_STORAGE_KEY, tab);
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", tab);
    setSearchParams(sp, { replace: true });
  }, [tab]);
  useEffect(() => {
    sessionStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({ keyword, protocol }),
    );
  }, [keyword, protocol]);

  // 按 Tab 取数 + 筛选
  const sourceData = tab === "all" ? visibleResources : visibleDrafts;

  const filtered = useMemo(() => {
    return sourceData.filter((d) => {
      if (tab === "all" && protocol !== "all" && d.protocol !== protocol)
        return false;
      if (!keyword) return true;
      const k = keyword.toLowerCase();
      return (
        d.resources.join(" ").toLowerCase().includes(k) ||
        d.owner.toLowerCase().includes(k) ||
        d.id.toLowerCase().includes(k)
      );
    });
  }, [sourceData, keyword, protocol, tab]);

  const handleDelete = (it: ResourceItem) => {
    Modal.confirm({
      title: tab === "draft" ? "确认删除该草稿?" : "确认删除该资源?",
      content: `${tab === "draft" ? "草稿" : "资源"} ${it.id} 引用资源: ${it.resources.join("、")};删除后无法恢复。`,
      okText: "确认删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        if (tab === "draft") {
          removeDraft(it.id);
          message.success(`已删除草稿 ${it.id}`);
        } else {
          removeResource(it.id);
          message.success(`已删除资源 ${it.id}`);
        }
      },
    });
  };

  /** 草稿 Tab 列(口径与全部资源一致,不含「创建人」列;末列改为「最后编辑时间」) */
  const draftColumns: ColumnsType<ResourceItem> = [
    { title: "草稿 ID", dataIndex: "id", width: 100 },
    {
      title: "资源列表",
      dataIndex: "resources",
      width: 220,
      render: (rs: string[]) => (
        <Tooltip
          title={
            <Space size={4} wrap>
              {rs.map((c) => (
                <Tag key={c} color="default">
                  {c} - {resourceName(c)}
                </Tag>
              ))}
            </Space>
          }
        >
          <Space size={4} wrap>
            {rs.slice(0, 3).map((r) => (
              <Tag key={r} color="default">
                {r}
              </Tag>
            ))}
            {rs.length > 3 && <Tag>+{rs.length - 3}</Tag>}
          </Space>
        </Tooltip>
      ),
    },
    { title: "资源负责人", dataIndex: "owner", width: 120 },
    { title: "联系方式", dataIndex: "contact", width: 140 },
    {
      title: "对接方式",
      dataIndex: "protocol",
      width: 140,
      render: (p: ProtocolType) => (
        <Tag color={PROTOCOL_COLOR[p]} icon={<ApiOutlined />}>
          {PROTOCOL_LABEL[p]}
        </Tag>
      ),
    },
    { title: "最后编辑时间", dataIndex: "updatedAt", width: 180 },
    {
      title: "操作",
      width: 200,
      fixed: "right",
      render: (_, it) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() =>
              navigate(`/app/resource-center/resources/edit/${it.id}`)
            }
          >
            编辑
          </Button>
          {isAdmin && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(it)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  /** 全部资源 Tab 列 */
  const resourceColumns: ColumnsType<ResourceItem> = [
    {
      title: "资源列表",
      dataIndex: "resources",
      width: 260,
      render: (rs: string[]) => (
        <Tooltip
          title={
            <Space size={4} wrap>
              {rs.map((c) => (
                <Tag key={c} color="blue">
                  {c} - {resourceName(c)}
                </Tag>
              ))}
            </Space>
          }
        >
          <Space size={4} wrap>
            {rs.slice(0, 3).map((r) => (
              <Tag key={r} color="blue">
                {r}
              </Tag>
            ))}
            {rs.length > 3 && <Tag>+{rs.length - 3}</Tag>}
          </Space>
        </Tooltip>
      ),
    },
    { title: "资源负责人", dataIndex: "owner", width: 120 },
    { title: "联系方式", dataIndex: "contact", width: 140 },
    {
      title: "对接方式",
      dataIndex: "protocol",
      width: 160,
      render: (p: ProtocolType, it) => (
        <Tooltip title="点击值标签在台账详情页就地查看对接方式子字段(此处仅展示枚举)">
          <Tag
            color={PROTOCOL_COLOR[p]}
            icon={<ApiOutlined />}
            onClick={() => setDetail(it)}
            style={{ cursor: "pointer" }}
          >
            {PROTOCOL_LABEL[p]}
          </Tag>
        </Tooltip>
      ),
    },
    // §2.1.1:管理员之间数据不隔离,新增「创建人」列方便审计追溯
    {
      title: "创建人",
      dataIndex: "creator",
      width: 130,
      render: (c?: string) => <Tag color="default">{creatorLabel(c)}</Tag>,
    },
    {
      title: "操作",
      width: 200,
      fixed: "right",
      render: (_, it) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() =>
              navigate(`/app/resource-center/resources/edit/${it.id}`)
            }
          >
            编辑
          </Button>
          {isAdmin && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(it)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const currentColumns = tab === "all" ? resourceColumns : draftColumns;
  const totalText =
    tab === "all"
      ? `共 ${filtered.length} 条`
      : isAdmin
        ? `当前管理员共 ${filtered.length} 条草稿`
        : "草稿 Tab 仅对信息科管理员开放";

  const emptyText =
    tab === "all" ? (
      <Empty description="暂无资源" />
    ) : isAdmin ? (
      <Empty description="当前管理员暂无草稿(可切换其他管理员查看)" />
    ) : (
      <Empty description="草稿 Tab 仅对信息科管理员开放" />
    );

  return (
    <>
      <PageHeader
        title="资源管理"
        subTitle="维护院内可被智能体调用的系统资源台账,登记对接方式与负责人"
        breadcrumb={[
          { path: "/app/resource-center", breadcrumbName: "医院资源管理中心" },
          {
            path: "/app/resource-center/resources",
            breadcrumbName: "资源管理",
          },
        ]}
        extra={
          isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/app/resource-center/resources/new")}
            >
              注册资源
            </Button>
          )
        }
      />

      <Card bordered={false}>
        <Flex gap={8} align="center" wrap style={{ marginBottom: 12 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={
              tab === "all"
                ? "资源 ID / 资源名称 / 负责人"
                : "资源 / 负责人 / 草稿 ID"
            }
            style={{ width: 240 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          {tab === "all" && (
            <Select
              value={protocol}
              style={{ width: 180 }}
              onChange={setProtocol}
              options={[
                { value: "all", label: "全部对接方式" },
                ...(["HL7", "FHIR", "DICOM", "DB", "MQ"] as ProtocolType[]).map(
                  (p) => ({
                    value: p,
                    label: PROTOCOL_LABEL[p],
                  }),
                ),
              ]}
            />
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setKeyword("");
              if (tab === "all") setProtocol("all");
            }}
          >
            重置
          </Button>
          <div style={{ flex: 1 }} />
          <Text type="secondary">{totalText}</Text>
        </Flex>

        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as ResourceTabKey)}
          items={TABS.map((t) => ({
            key: t.key,
            label: (
              <Space size={6}>
                <span>{t.label}</span>
                <Tag color={t.key === "draft" ? "default" : "blue"}>
                  {t.key === "all"
                    ? data.length
                    : isAdmin
                      ? visibleDrafts.length
                      : 0}
                </Tag>
              </Space>
            ),
            children: (
              <Table<ResourceItem>
                rowKey="id"
                columns={currentColumns}
                dataSource={filtered}
                scroll={{ x: t.key === "all" ? 1080 : 1080 }}
                pagination={{
                  pageSize: 10,
                  showTotal: (tot) => `共 ${tot} 条`,
                }}
                locale={{ emptyText }}
              />
            ),
          }))}
        />
      </Card>

      {/* 资源详情 Drawer - 集中展示 ID / 更新时间 / 创建人 / 对接方式子字段 */}
      <Drawer
        title={`资源详情 - ${detail?.id}`}
        width={560}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="资源 ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="资源列表">
                <Space size={4} wrap>
                  {detail.resources.map((r) => (
                    <Tooltip key={r} title={resourceName(r)}>
                      <Tag color="blue">{r}</Tag>
                    </Tooltip>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="资源负责人">
                {detail.owner}
              </Descriptions.Item>
              <Descriptions.Item label="联系方式">
                {detail.contact}
              </Descriptions.Item>
              <Descriptions.Item label="对接方式">
                <Tag
                  color={PROTOCOL_COLOR[detail.protocol]}
                  icon={<ApiOutlined />}
                >
                  {PROTOCOL_LABEL[detail.protocol]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {creatorLabel(detail.creator)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {detail.updatedAt}
              </Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 16 }}>
              对接方式子字段
            </Typography.Title>
            <Descriptions column={1} bordered size="small">
              {detail.protocolConfig.fields.map((f) => (
                <Descriptions.Item key={f.label} label={f.label}>
                  <Text code>{f.value}</Text>
                </Descriptions.Item>
              ))}
            </Descriptions>
          </>
        )}
      </Drawer>
    </>
  );
};

export default ResourceList;
