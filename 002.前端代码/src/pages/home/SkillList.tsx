import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquareOutlined,
  CloseOutlined,
  DeleteOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Input,
  MenuProps,
  message,
  Row,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import PageHeader from '../../components/PageHeader';
import type { SkillItem } from '../../mock/skills';
import SkillImportModal from './SkillImportModal';
import { useSkillState } from './useSkillState';

const { Text } = Typography;

type SkillListProps = {
  embedded?: boolean;
  onTrySkill?: (skill: SkillItem) => void;
};

const SkillList = ({ embedded = false, onTrySkill }: SkillListProps = {}) => {
  const navigate = useNavigate();
  const { skills, installedSkills, installSkill, closeSkill, uninstallSkill } = useSkillState();
  const [keyword, setKeyword] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return skills;
    return skills.filter((skill) => {
      return (
        skill.name.toLowerCase().includes(value) ||
        skill.description.toLowerCase().includes(value)
      );
    });
  }, [keyword, skills]);

  const installedCount = installedSkills.length;

  const buildInstalledMenu = (skill: SkillItem): MenuProps['items'] => [
    {
      key: 'close',
      icon: <CloseOutlined />,
      label: '关闭',
      onClick: () => {
        closeSkill(skill.key);
        message.success(`${skill.name}技能已关闭`);
      },
    },
    {
      key: 'uninstall',
      icon: <DeleteOutlined />,
      label: '卸载',
      danger: true,
      onClick: () => {
        uninstallSkill(skill.key);
        message.success(`${skill.name}技能已卸载`);
      },
    },
  ];

  return (
    <div
      data-testid="home-v1-middle-skill-list"
      style={{
        minHeight: '100%',
        padding: embedded ? '0 12px 16px' : '0 4px',
        background: '#FFFFFF',
      }}
    >
      <PageHeader
        style={embedded ? { padding: '14px 18px' } : undefined}
        title={
          <Space size={embedded ? 8 : 10}>
            <ToolOutlined style={{ color: '#1677FF' }} />
            <span>技能</span>
          </Space>
        }
        extra={
          <Space size={10} wrap>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
            placeholder="搜索技能"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            data-testid="skill-search-input"
            style={{ width: 260, borderRadius: 8 }}
          />
          <Button
            icon={<CheckSquareOutlined />}
            onClick={() => navigate('/app/home/skill/manage')}
            data-testid="skill-installed-button"
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            <span>我安装的</span>
            {installedCount > 0 && (
              <span
                data-testid="skill-installed-count"
                style={{
                  minWidth: 24,
                  height: 22,
                  padding: '0 7px',
                  borderRadius: 11,
                  background: '#EEF0F3',
                  color: '#8A8F98',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: '22px',
                  marginLeft: 2,
                }}
              >
                {installedCount}
              </span>
            )}
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setImportOpen(true)}
            data-testid="skill-add-button"
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            添加技能
          </Button>
        </Space>
        }
      />

      {filtered.length === 0 ? (
        <Empty description="未找到匹配的技能" />
      ) : (
        <Row gutter={[16, 16]} style={{ marginTop: embedded ? 8 : 12 }}>
          {filtered.map((skill) => (
            <Col key={skill.key} xs={24} md={12} xl={8}>
              <Card
                data-testid={`skill-card-${skill.key}`}
                styles={{
                  body: {
                    minHeight: 118,
                    padding: '22px 22px 18px',
                    display: 'grid',
                    gridTemplateColumns: '42px minmax(0, 1fr) auto',
                    gridTemplateRows: '42px 44px',
                    columnGap: 16,
                    rowGap: 12,
                    alignItems: 'center',
                  },
                }}
                style={{
                  borderRadius: 8,
                  borderColor: '#ECEDEF',
                  boxShadow: 'none',
                  height: '100%',
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: `${skill.iconColor}22`,
                    color: skill.iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  {skill.iconText}
                </div>
                <Text
                  strong
                  ellipsis={{ tooltip: skill.name }}
                  style={{
                    display: 'block',
                    minWidth: 0,
                    fontSize: 16,
                    lineHeight: '24px',
                    color: '#1F2329',
                  }}
                >
                  {skill.name}
                </Text>
                <Space size={8} style={{ justifySelf: 'end' }}>
                  {skill.installed ? (
                    <>
                      <Dropdown
                        trigger={['click']}
                        menu={{ items: buildInstalledMenu(skill) }}
                        placement="bottomRight"
                      >
                        <Tooltip title="更多操作">
                          <Button
                            icon={<MoreOutlined />}
                            data-testid={`skill-card-more-${skill.key}`}
                            onClick={(event) => event.stopPropagation()}
                            style={{ width: 36, height: 36, borderRadius: 8 }}
                          />
                        </Tooltip>
                      </Dropdown>
                      <Tooltip title="试一试">
                        <Button
                          icon={<PlayCircleOutlined />}
                          data-testid={`skill-card-try-${skill.key}`}
                          onClick={() => {
                            if (onTrySkill) {
                              onTrySkill(skill);
                            } else {
                              navigate('/app/home/overview', { state: { trySkillKey: skill.key } });
                            }
                          }}
                          style={{ width: 36, height: 36, borderRadius: 8, color: '#16A085' }}
                        />
                      </Tooltip>
                    </>
                  ) : (
                    <Tooltip title="安装技能">
                      <Button
                        icon={<PlusOutlined />}
                        data-testid={`skill-card-install-${skill.key}`}
                        onClick={() => {
                          installSkill(skill.key);
                          message.success(`已安装 ${skill.name}`);
                        }}
                        style={{ width: 36, height: 36, borderRadius: 8 }}
                      />
                    </Tooltip>
                  )}
                </Space>
                <Tooltip title={skill.description} placement="topLeft">
                  <span
                    style={{
                      gridColumn: '1 / 4',
                      display: '-webkit-box',
                      color: '#6B7280',
                      fontSize: 14,
                      lineHeight: '22px',
                      maxHeight: 44,
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      wordBreak: 'break-all',
                    }}
                  >
                    {skill.description}
                  </span>
                </Tooltip>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <SkillImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
};

export default SkillList;
