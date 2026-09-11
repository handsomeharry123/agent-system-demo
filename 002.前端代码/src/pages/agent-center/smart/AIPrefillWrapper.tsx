/**
 * §3.1.2 AI 预填包裹组件
 *
 * 包裹 antd Form.Item：自动给字段加高亮 class + 在 label 旁加 <AIPrefillBadge>
 *
 * 用法：
 *   <AIPrefillWrapper fieldKey="name">
 *     <Form.Item name="name" label="智能体名称" rules={...}>
 *       <Input />
 *     </Form.Item>
 *   </AIPrefillWrapper>
 */
import { useEffect, useMemo, useState } from 'react';
import { Form } from 'antd';
import type { FormItemProps } from 'antd';
import AIPrefillBadge from './AIPrefillBadge';
import { useSmartDraft } from './store.tsx';
import { confidenceLevel } from './types';
import { cloneElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

interface Props {
  fieldKey: string;
  children: ReactElement<FormItemProps & { children?: ReactNode }>;
  /** 当字段值发生变化时 (用户手动改) 通知 store 清除预填标识 */
  onUserChange?: () => void;
}

const ACK_FLASH_MS = 1200; // 采纳后整个 Form.Item 闪烁高亮时长
const ACK_BADGE_MS = 5000; // Badge 绿色对勾持续时长 (与 AIPrefillBadge.ACK_VISIBLE_MS 保持一致)

const AIPrefillWrapper = ({ fieldKey, children, onUserChange }: Props) => {
  const { prefillMeta, acknowledgePrefill, pendingPrefills, clearPrefill } = useSmartDraft();
  const meta = prefillMeta[fieldKey];

  // 1s tick:用于驱动 5s「✓ 已采纳」绿色对勾的自动消失 + 1.2s 闪烁高亮的结束
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 是否有待写入值 (有=高亮, 无=空白)
  const highlight = useMemo(() => {
    if (!meta) return null;
    if (meta.acknowledged) {
      // 5s 显示窗内仍返回置信度层级,让 Badge 走"已采纳"分支
      if (meta.acknowledgedAt && Date.now() - meta.acknowledgedAt < ACK_BADGE_MS) {
        return confidenceLevel(meta.confidence);
      }
      return null;
    }
    return confidenceLevel(meta.confidence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, tick]);

  // 是否处于采纳瞬间闪烁高亮窗口
  const flashing = useMemo(() => {
    if (!meta?.acknowledged || !meta.acknowledgedAt) return false;
    return Date.now() - meta.acknowledgedAt < ACK_FLASH_MS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, tick]);

  // clone children, 在 label 旁注入 Badge + 给最外层 input 加高亮 class + 闪烁 class
  const wrapped = useMemo(() => {
    if (!children) return children;
    const labelAddon = meta ? <AIPrefillBadge meta={meta} onAcknowledge={() => acknowledgePrefill(fieldKey)} /> : null;

    // 注入 label 旁的 Badge
    const childWithBadge = cloneElement(children, {
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span>{children.props.label}</span>
          {labelAddon}
        </span>
      ),
    });

    // 注入 input 高亮 class — 通过 wrap 一个 div + 给 form-item-control-first 加 class
    const innerInput = childWithBadge.props.children as
      | ReactElement<{ className?: string; onChange?: (e: any) => void }>
      | undefined;
    let inner = innerInput;
    if (innerInput && highlight) {
      const existedClass = innerInput.props.className || '';
      const flashClass = flashing ? ' ai-prefill-ack-flash' : '';
      inner = cloneElement(innerInput as any, {
        className: `${existedClass} ai-prefill-highlight ai-prefill-${highlight}${flashClass}`.trim(),
        onChange: (e: any) => {
          // 用户手动改 → 清除 AI 预填状态 (key 不再高亮)
          innerInput.props.onChange?.(e);
          clearPrefill(fieldKey);
          onUserChange?.();
        },
      });
    }
    return cloneElement(childWithBadge, { children: inner });
  }, [children, meta, fieldKey, highlight, flashing, acknowledgePrefill, clearPrefill, onUserChange]);

  return <>{wrapped}</>;
};

export default AIPrefillWrapper;