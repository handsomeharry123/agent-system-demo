import { CheckOutlined } from '@ant-design/icons';
import { Card, message, Typography } from 'antd';
import type { CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './index.css';

const { Text } = Typography;

export const AGENT_LIFECYCLE_STAGES = [
  '立项',
  '接入',
  '安全性评测',
  '浦江实验室评测',
  '上线',
] as const;

export type AgentLifecycleStage = (typeof AGENT_LIFECYCLE_STAGES)[number];

const AGENT_LIFECYCLE_STAGE_LABELS: Record<AgentLifecycleStage, string> = {
  '立项': '立项',
  '接入': '接入',
  '安全性评测': '安全性评测',
  '浦江实验室评测': '第三方评测',
  '上线': '上线',
};

interface AgentLifecycleProgressProps {
  currentStage?: AgentLifecycleStage;
  /** 当前节点是否已通过审核/完成；未完成时仍展示节点序号。 */
  currentStageCompleted?: boolean;
  /** 已知的业务详情页可覆盖默认入口，例如立项详情、注册详情或评测结果详情。 */
  stagePaths?: Partial<Record<AgentLifecycleStage, string>>;
}

const DEFAULT_STAGE_PATHS: Record<AgentLifecycleStage, string> = {
  '立项': '/app/project-application',
  '接入': '/app/agent-center',
  '安全性评测': '/app/evaluation/tasks?module=safety',
  '浦江实验室评测': '/app/evaluation/tasks?module=pujiang',
  '上线': '/app/ledger/list',
};

const normalizePath = (path: string) => path.replace(/\/$/, '') || '/';

/** 从立项到上线的统一流程进度，供各业务详情页复用。 */
const AgentLifecycleProgress = ({
  currentStage = '立项',
  currentStageCompleted = false,
  stagePaths,
}: AgentLifecycleProgressProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationProgress = (location.state as {
    agentLifecycleProgress?: {
      currentStage?: AgentLifecycleStage;
      currentStageCompleted?: boolean;
      stagePaths?: Partial<Record<AgentLifecycleStage, string>>;
    };
  } | null)?.agentLifecycleProgress;
  const inheritedStage = navigationProgress?.currentStage;
  const effectiveCurrentStage = inheritedStage && AGENT_LIFECYCLE_STAGES.includes(inheritedStage)
    ? inheritedStage
    : currentStage;
  const effectiveCurrentStageCompleted = navigationProgress?.currentStageCompleted ?? currentStageCompleted;
  const effectiveStagePaths = navigationProgress?.stagePaths ?? stagePaths;
  const current = Math.max(0, AGENT_LIFECYCLE_STAGES.indexOf(effectiveCurrentStage));
  const progress = current / (AGENT_LIFECYCLE_STAGES.length - 1) * 100;
  const currentStageLabel = AGENT_LIFECYCLE_STAGE_LABELS[effectiveCurrentStage];

  const handleStageClick = (stage: AgentLifecycleStage) => {
    const target = effectiveStagePaths?.[stage] ?? DEFAULT_STAGE_PATHS[stage];
    const [targetPathname, targetSearch = ''] = target.split('?');
    const currentSearch = location.search.replace(/^\?/, '');
    const searchMatches =
      currentSearch === targetSearch ||
      (stage === '安全性评测' && !currentSearch && targetSearch === 'module=safety');
    const targetIsDetailPage = /\/(?:detail|report)(?:\/|$)/.test(targetPathname);
    const isCurrentPage =
      normalizePath(location.pathname) === normalizePath(targetPathname) &&
      (targetIsDetailPage || searchMatches);

    if (isCurrentPage) {
      message.info('当前正处于应跳转页面');
      return;
    }

    navigate(target, {
      state: {
        agentLifecycleProgress: {
          currentStage: effectiveCurrentStage,
          currentStageCompleted: effectiveCurrentStageCompleted,
          stagePaths: effectiveStagePaths,
        },
      },
    });
    message.success('跳转成功');
  };

  return (
    <Card
      bordered={false}
      className="lifecycle-card"
      data-testid="agent-lifecycle-progress"
      aria-label={`项目流程进度，当前节点：${currentStageLabel}`}
    >
      <div className="lifecycle-heading">
        <Text strong className="lifecycle-title">项目进度</Text>
        <span className="lifecycle-status"><i />当前阶段：{currentStageLabel}</span>
      </div>

      <div className="lifecycle-progress-body" style={{ '--lifecycle-progress': `${progress}%` } as CSSProperties}>
        <div className="lifecycle-track" aria-hidden="true">
          <div className="lifecycle-track-fill"><span /></div>
        </div>
        <ol className="lifecycle-steps">
          {AGENT_LIFECYCLE_STAGES.map((title, index) => {
            const active = index === current;
            const completed = index < current;
            // 各节点只有通过审核/完成后才展示勾选；进行中始终展示序号。
            // 浦江评测完成后会直接进入上线，因此上线节点直接视为完成。
            const showCheck = completed || (active && (effectiveCurrentStageCompleted || title === '上线'));
            return (
              <li
                key={title}
                className={`lifecycle-step${completed ? ' is-completed' : ''}${active ? ' is-active' : ''}`}
                style={{ '--step-index': index } as CSSProperties}
                aria-current={active ? 'step' : undefined}
              >
                <button
                  type="button"
                  className="lifecycle-step-button"
                  onClick={() => handleStageClick(title)}
                  aria-label={`${AGENT_LIFECYCLE_STAGE_LABELS[title]}节点，点击跳转`}
                >
                  <span className="lifecycle-node" aria-hidden="true">
                    <span className="lifecycle-node-ring" />
                    <span className="lifecycle-node-core">
                      {showCheck ? <CheckOutlined /> : index + 1}
                    </span>
                  </span>
                  <span className="lifecycle-label">{AGENT_LIFECYCLE_STAGE_LABELS[title]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
};

export default AgentLifecycleProgress;
