import {
  BookOutlined,
  CalendarOutlined,
  FileTextOutlined,
  HeartOutlined,
  MessageOutlined,
  MoonOutlined,
  ReadOutlined,
  SoundOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import HomeSidebarV2 from './HomeSidebarV2';
import { autoTaskTemplates } from './autoTaskTemplates';

const { Text } = Typography;

const templateIcons = [
  FileTextOutlined,
  ReadOutlined,
  MoonOutlined,
  BookOutlined,
  VideoCameraOutlined,
  CalendarOutlined,
  SoundOutlined,
  TeamOutlined,
  HeartOutlined,
  MessageOutlined,
  CalendarOutlined,
  HeartOutlined,
];

const AutoTaskTemplateList = () => {
  const navigate = useNavigate();

  return (
    <div
      data-testid="home-auto-task-template-list"
      style={{
        padding: 16,
        background: '#F0F2F5',
        height: 'calc(100dvh - 64px)',
        minHeight: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <Row gutter={16} style={{ height: '100%' }}>
        <Col xs={0} sm={0} md={6} lg={6} xl={6} xxl={6} style={{ height: '100%' }}>
          <HomeSidebarV2
            initialActiveKey="auto-task"
            onNewTask={() => navigate('/app/home/overview')}
            onRestoreSession={(id) => navigate('/app/home/overview', { state: { restoreSessionId: id } })}
            onRestoreRun={(id) => navigate('/app/home/overview', { state: { restoreRunId: id } })}
            onOpenConnector={() => navigate('/app/home/connector')}
            onOpenAutoTasks={() => navigate('/app/home/auto-tasks')}
          />
        </Col>

        <Col span={18} style={{ height: '100%', minWidth: 0 }}>
          <Card
            bordered={false}
            styles={{ body: { padding: 0, height: '100%', overflow: 'auto', background: '#FFFFFF' } }}
            style={{ height: '100%', borderRadius: 8 }}
          >
            <div style={{ padding: '14px 22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 24 }}>
                <CalendarOutlined style={{ fontSize: 18, color: '#262626' }} />
                <button
                  type="button"
                  onClick={() => navigate('/app/home/auto-tasks')}
                  data-testid="auto-task-template-breadcrumb-back"
                  style={{
                    border: 0,
                    padding: 0,
                    background: 'transparent',
                    color: '#262626',
                    fontSize: 17,
                    lineHeight: '24px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  自动化
                </button>
                <span style={{ color: '#8C8C8C', fontSize: 17, fontWeight: 600 }}>/</span>
                <span style={{ fontSize: 17, lineHeight: '24px', fontWeight: 600 }}>从模板添加</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 14,
                  maxWidth: 1040,
                }}
              >
                {autoTaskTemplates.map((template, index) => {
                  const Icon = templateIcons[index % templateIcons.length];
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() =>
                        navigate(`/app/home/auto-tasks/new?template=${template.id}`, {
                          state: { autoTaskTemplateId: template.id },
                        })
                      }
                      data-testid={`auto-task-template-${template.id}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '34px minmax(0, 1fr)',
                        alignItems: 'center',
                        gap: 13,
                        border: '1px solid #F0F0F0',
                        background: '#FFFFFF',
                        borderRadius: 8,
                        padding: '17px 18px',
                        minHeight: 86,
                        textAlign: 'left',
                        cursor: 'pointer',
                        boxShadow: '0 6px 18px rgba(15, 23, 42, 0.045)',
                      }}
                    >
                      <Icon style={{ fontSize: 23, color: '#262626' }} />
                      <span style={{ minWidth: 0 }}>
                        <span
                          title={template.name}
                          style={{
                            display: 'block',
                            fontSize: 15,
                            lineHeight: '21px',
                            fontWeight: 600,
                            color: '#262626',
                            marginBottom: 4,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                          }}
                        >
                          {template.name}
                        </span>
                        <Text
                          title={template.description}
                          type="secondary"
                          style={{
                            display: 'block',
                            fontSize: 13,
                            lineHeight: '18px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {template.description}
                        </Text>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AutoTaskTemplateList;
