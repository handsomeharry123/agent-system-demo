/**
 * Agent 机器人形象 — SVG 实现 (V6 医小管品牌版)
 *
 * 3.1.1 入口形象规范:
 *   - 萌系主导:白色圆角大头 + 深蓝面罩 + 蓝色胶囊眼 + 小圆身体
 *   - 科技点睛:蓝色耳机传感器 + 顶部卷曲天线 + 腹部状态灯
 *   - 通过 CSS keyframes 实现「呼吸 / 招手 / 天线扫描 / 能量脉冲」微动画
 *   - prefers-reduced-motion 降级为静态
 *
 * 不依赖第三方 Lottie 库 —— 用纯 SVG + CSS 即可。
 */
import { useEffect, useState } from 'react';
import type { AgentMood } from './types';

interface Props {
  mood?: AgentMood;
  size?: number;
  /** 浮动红点是否可见 (右上角未读提示) */
  badge?: number | boolean;
  /**
   * §3.1.1 新消息吸引: 红点是否播放「放大闪烁」动画
   * - 默认 false, AgentAssistant 在 unread 计数累加时设 true + 600ms 后回落
   * - 仅在 reduced 关闭时生效
   */
  badgePulse?: boolean;
  /**
   * §3.1.1 新消息: 双臂挫手 (与 bounce 同步, 0.6s × 2 次)
   * - 默认 false, 由 AgentAssistant 在新消息来时与 bounce 同步触发
   */
  handWave?: boolean;
}

const RobotIcon = ({ mood = 'idle', size = 64, badge, badgePulse = false, handWave = false }: Props) => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const eyeVariant = mood === 'thinking' ? 'loading' : mood === 'happy' ? 'smile' : mood === 'sad' ? 'sad' : 'normal';

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 96 96"
        width={size}
        height={size}
        style={{
          display: 'block',
          filter: 'drop-shadow(0 3px 8px rgba(124, 181, 255, 0.5))',
        }}
        // §3.1.1: mood=sad 走 .agent-robot-sad (低头+缩放呼吸), 与 .agent-robot-breathe 互斥
        // 其他 mood 走 breathe 待机; hover/thinking/bounce 在其他兄弟元素上叠加
        className={
          reduced
            ? ''
            : mood === 'sad'
              ? 'agent-robot-sad'
              : 'agent-robot-breathe'
        }
        aria-hidden
      >
        <defs>
          <linearGradient id="agent-shell-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="58%" stopColor="#F8FCFF" />
            <stop offset="100%" stopColor="#DCEBFF" />
          </linearGradient>
          <linearGradient id="agent-blue-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5AA4FF" />
            <stop offset="100%" stopColor="#1C63E8" />
          </linearGradient>
          <radialGradient id="agent-face-grad" cx="42%" cy="28%" r="85%">
            <stop offset="0%" stopColor="#263E78" />
            <stop offset="64%" stopColor="#172B5A" />
            <stop offset="100%" stopColor="#101D43" />
          </radialGradient>
          <linearGradient id="agent-eye-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9DF5FF" />
            <stop offset="100%" stopColor="#31C7F2" />
          </linearGradient>
          <radialGradient id="agent-soft-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7FE8FF" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#1677FF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 接触阴影 */}
        <ellipse cx="48" cy="90" rx="21" ry="3.2" fill="#0B3D9A" opacity="0.22" />

        {/* 顶部卷曲天线，参考图的品牌识别点 */}
        <g
          className={
            reduced
              ? ''
              : mood === 'thinking'
                ? 'agent-robot-antenna-spin'
                : 'agent-robot-antenna'
          }
          style={{ transformOrigin: '48px 18px' }}
        >
          <circle cx="48" cy="19" r="10" fill="url(#agent-soft-glow)" />
          <path
            d="M 42 18
               C 42 9 53 6 59 12
               C 62 15 62 19 59 20
               C 56 21 54 18 55 16
               C 56 14 53 12 50 13
               C 46 14 45 17 45 20"
            fill="none"
            stroke="#2A7CFF"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <circle cx="40" cy="22" r="5.5" fill="url(#agent-blue-grad)" />
        </g>

        {/* 蓝色耳机传感器，放在头部后方 */}
        <g>
          <rect x="10" y="35" width="13" height="21" rx="7" fill="url(#agent-blue-grad)" />
          <rect x="73" y="35" width="13" height="21" rx="7" fill="url(#agent-blue-grad)" />
          <rect x="14" y="38" width="6" height="15" rx="3" fill="#66B4FF" opacity="0.35" />
          <rect x="76" y="38" width="6" height="15" rx="3" fill="#66B4FF" opacity="0.35" />
        </g>

        {/* 简洁小圆身体 */}
        <g>
          <path
            d="M 31 59
               Q 34 56 39 56
               L 57 56
               Q 63 56 66 60
               L 62 82
               Q 61 87 56 88
               L 40 88
               Q 35 87 34 82
               Z"
            fill="url(#agent-shell-grad)"
            stroke="#9EB8D9"
            strokeWidth="1.1"
          />
          <path
            d="M 32 59 Q 48 69 64 59 L 62 68 Q 48 74 34 68 Z"
            fill="url(#agent-blue-grad)"
          />
          <path d="M 35 70 Q 48 76 61 70" fill="none" stroke="#FFFFFF" strokeWidth="2.2" opacity="0.85" />
          <circle cx="48" cy="77" r="3.1" fill="#48C8F1" />
          <circle cx="47" cy="75.8" r="1.1" fill="#FFFFFF" opacity="0.7" />
        </g>

        {/* 侧边小手，保留原来的招手 / 新消息挫手动画 */}
        <g
          className={
            reduced
              ? ''
              : handWave
                ? 'agent-robot-hand-wave'
                : mood === 'hover'
                  ? 'agent-robot-wave'
                  : ''
          }
          style={{ transformOrigin: '28px 62px' }}
        >
          <ellipse cx="28" cy="66" rx="5.3" ry="8.4" fill="url(#agent-shell-grad)" stroke="#9EB8D9" strokeWidth="1" transform="rotate(8 28 66)" />
          <ellipse cx="26" cy="62" rx="1.6" ry="3" fill="#FFFFFF" opacity="0.78" />
        </g>

        <g
          className={
            reduced
              ? ''
              : handWave
                ? 'agent-robot-hand-wave'
                : mood === 'hover'
                  ? 'agent-robot-wave'
                  : ''
          }
          style={{ transformOrigin: '68px 62px' }}
        >
          <ellipse cx="68" cy="66" rx="5.3" ry="8.4" fill="url(#agent-shell-grad)" stroke="#9EB8D9" strokeWidth="1" transform="rotate(-8 68 66)" />
          <ellipse cx="66" cy="62" rx="1.6" ry="3" fill="#FFFFFF" opacity="0.78" />
        </g>

        {/* 圆角白壳大头 + 深蓝面罩 */}
        <g>
          <rect
            x="18"
            y="20"
            width="60"
            height="44"
            rx="18"
            fill="url(#agent-shell-grad)"
            stroke="#9EB8D9"
            strokeWidth="1.6"
          />
          <path
            d="M 23 31
               Q 27 25 36 25
               L 60 25
               Q 70 25 73 32
               Q 70 29 62 29
               L 35 29
               Q 27 29 23 31 Z"
            fill="#FFFFFF"
            opacity="0.86"
          />

          <g className={reduced || mood !== 'thinking' ? '' : 'agent-robot-visor'}>
            <rect x="27" y="31" width="42" height="24" rx="10" fill="url(#agent-face-grad)" />
            <path d="M 31 34 Q 39 31 50 31 L 61 31 Q 66 31 68 35 Q 58 33 46 33 Q 36 33 31 34 Z" fill="#3F5D9D" opacity="0.36" />
          </g>

          {/* 眼睛与表情 */}
          {eyeVariant === 'loading' ? (
            <g>
              <rect x="36" y="37" width="6" height="10" rx="3" fill="url(#agent-eye-grad)" className={reduced ? '' : 'agent-robot-eye'} />
              <circle cx="37.5" cy="39" r="1.2" fill="#FFFFFF" opacity="0.9" />
              <rect x="53" y="40" width="9" height="4" rx="2" fill="url(#agent-eye-grad)" />
            </g>
          ) : eyeVariant === 'smile' ? (
            <g stroke="#5EE7FF" strokeWidth="3" fill="none" strokeLinecap="round">
              <path d="M 34 42 Q 39 36 44 42" />
              <path d="M 52 42 Q 57 36 62 42" />
            </g>
          ) : eyeVariant === 'sad' ? (
            <g stroke="#5EE7FF" strokeWidth="3" fill="none" strokeLinecap="round">
              <path d="M 34 40 Q 39 45 44 40" />
              <path d="M 52 40 Q 57 45 62 40" />
            </g>
          ) : (
            <g>
              <rect x="36" y="36" width="6.5" height="12" rx="3.2" fill="url(#agent-eye-grad)" />
              <rect x="54" y="36" width="6.5" height="12" rx="3.2" fill="url(#agent-eye-grad)" />
              <circle cx="38" cy="38.5" r="1.2" fill="#FFFFFF" opacity="0.88" />
              <circle cx="56" cy="38.5" r="1.2" fill="#FFFFFF" opacity="0.88" />
            </g>
          )}

          <circle cx="31" cy="44" r="1.8" fill="#4EB5E8" opacity="0.82" />
          <circle cx="65" cy="44" r="1.8" fill="#4EB5E8" opacity="0.82" />
        </g>
      </svg>

      {badge ? (
        <span
          className={reduced || !badgePulse ? '' : 'agent-robot-badge-pulse'}
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 8,
            background: '#FF4D4F',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 2px #fff',
            pointerEvents: 'none',
            transformOrigin: 'center',
          }}
        >
          {typeof badge === 'number' ? (badge > 99 ? '99+' : badge) : ''}
        </span>
      ) : null}
    </div>
  );
};

export default RobotIcon;
