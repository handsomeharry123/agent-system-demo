import { Steps } from 'antd';
import type { StepsProps } from 'antd';

export interface Step {
  title: string;
  description?: string;
  subSteps?: string[];
}

interface StatusStepsProps {
  steps: Step[];
  currentStep: number;
  size?: 'small' | 'default';
  direction?: 'horizontal' | 'vertical';
  style?: React.CSSProperties;
}

const StatusSteps = ({
  steps,
  currentStep,
  size = 'default',
  direction = 'horizontal',
  style,
}: StatusStepsProps) => {
  const items: StepsProps['items'] = steps.map((step, index) => ({
    title: step.title,
    description: step.description || (step.subSteps && step.subSteps.length > 0 ? (
      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
        {step.subSteps.map((sub, i) => (
          <div key={i}>{sub}</div>
        ))}
      </div>
    ) : undefined),
    status: index < currentStep ? 'finish' : index === currentStep ? 'process' : 'wait',
  }));

  return (
    <Steps
      current={currentStep}
      size={size}
      direction={direction}
      items={items}
      style={style}
    />
  );
};

/**
 * 使用示例：
 * const steps = [
 *   { title: '提交申请', description: '2024-01-15 10:30' },
 *   { title: '资料审核', description: '预计 1-3 工作日' },
 *   { title: '技术评测', subSteps: ['功能测试', '性能测试', '安全测试'] },
 *   { title: '上线审批' },
 *   { title: '正式接入' },
 * ];
 * <StatusSteps steps={steps} currentStep={2} />
 *
 * 垂直步骤条：
 * <StatusSteps steps={steps} currentStep={1} direction="vertical" />
 */

export default StatusSteps;
