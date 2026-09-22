import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Col, Empty, Row, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { useSkillState } from './useSkillState';

const { Text, Title } = Typography;

const SkillManage = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const navigate = useNavigate();
  const { installedSkills, setSkillEnabled } = useSkillState();

  return (
    <div
      data-testid="home-v1-middle-skill-manage"
      style={{
        minHeight: '100%',
        padding: embedded ? '28px 44px 40px' : '28px 40px',
        background: '#FFFFFF',
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/app/home/skill')}
          data-testid="skill-manage-back"
          style={{
            paddingInline: 0,
            height: 28,
            color: '#1F2329',
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          全部技能
        </Button>
      </div>

      <Space align="center" size={10} style={{ marginBottom: 22 }}>
        <Title level={2} style={{ margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 700 }}>
          我安装的
        </Title>
        <Tag
          bordered={false}
          style={{
            marginInlineEnd: 0,
            borderRadius: 10,
            color: '#8C8C8C',
            fontSize: 13,
            fontWeight: 700,
            lineHeight: '20px',
          }}
        >
          {installedSkills.length}
        </Tag>
      </Space>

      {installedSkills.length === 0 ? (
        <Empty description="暂无已安装技能" />
      ) : (
        <Row gutter={[16, 16]}>
          {installedSkills.map((skill) => (
            <Col key={skill.key} xs={24} md={12} xl={8}>
              <Card
                data-testid={`installed-skill-card-${skill.key}`}
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
                  height: '100%',
                  borderRadius: 8,
                  borderColor: '#ECEDEF',
                  boxShadow: '0 16px 42px rgba(31, 35, 41, 0.06)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
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
                  {skill.tag && (
                    <Tag color="purple" bordered={false} style={{ borderRadius: 6, marginInlineEnd: 0 }}>
                      {skill.tag}
                    </Tag>
                  )}
                </div>
                <Switch
                  checked={skill.enabled !== false}
                  onChange={(checked) => setSkillEnabled(skill.key, checked)}
                  data-testid={`installed-skill-switch-${skill.key}`}
                  style={{ justifySelf: 'end' }}
                />
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
    </div>
  );
};

export default SkillManage;
