import type { LedgerAgent } from '../mock/ledger';

const STORAGE_PREFIX = 'ledger-agent-avatar:';
const PALETTES = [
  ['#1677ff', '#36cfc9'],
  ['#722ed1', '#2f54eb'],
  ['#08979c', '#52c41a'],
  ['#d46b08', '#fa8c16'],
  ['#c41d7f', '#9254de'],
  ['#0958d9', '#13c2c2'],
];

const hashText = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
};

export const generateAgentAvatar = (agent: Pick<LedgerAgent, 'name' | 'description' | 'type'>, prompt = '') => {
  const seed = `${agent.description || agent.name}-${prompt || agent.type}`;
  const index = hashText(seed) % PALETTES.length;
  const [start, end] = PALETTES[index];
  const specialty = /影像|CT|MRI|超声/.test(seed)
    ? 'scan'
    : /药|治疗|审核/.test(seed)
      ? 'medical'
      : /问诊|导诊|分诊/.test(seed)
        ? 'chat'
        : /心理|健康|评估/.test(seed)
          ? 'heart'
          : 'ai';
  const specialtyMark: Record<string, string> = {
    scan: `
      <circle cx="160" cy="238" r="17" fill="none" stroke="#fff" stroke-width="5"/>
      <circle cx="160" cy="238" r="5" fill="#fff"/>
      <path d="M137 238h-9m55 0h9M160 215v-9m0 55v9" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
    medical: `
      <rect x="151" y="215" width="18" height="48" rx="7" fill="#fff"/>
      <rect x="136" y="230" width="48" height="18" rx="7" fill="#fff"/>`,
    chat: `
      <path d="M135 218h50a12 12 0 0 1 12 12v17a12 12 0 0 1-12 12h-24l-13 11 2-11h-15a12 12 0 0 1-12-12v-17a12 12 0 0 1 12-12z" fill="#fff"/>
      <circle cx="144" cy="239" r="4" fill="${end}"/><circle cx="160" cy="239" r="4" fill="${end}"/><circle cx="176" cy="239" r="4" fill="${end}"/>`,
    heart: `
      <path d="M160 263c-5-8-31-21-31-38 0-19 24-24 31-9 7-15 31-10 31 9 0 17-26 30-31 38z" fill="#fff"/>`,
    ai: `
      <text x="160" y="254" text-anchor="middle" fill="#fff" font-size="35" font-family="Arial,sans-serif" font-weight="800">AI</text>`,
  };
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#1683ff"/><stop offset="1" stop-color="#5ab8ff"/>
        </linearGradient>
        <linearGradient id="visor" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#113f72"/><stop offset="1" stop-color="#072846"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="shadow" x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#1677ff" flood-opacity=".2"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <!-- 蓝色小帽和短天线 -->
        <path d="M124 56c8-28 64-35 78 0z" fill="url(#g)"/>
        <path d="M160 43V28" stroke="#197fe8" stroke-width="8" stroke-linecap="round"/>
        <circle cx="160" cy="22" r="9" fill="#66e7ff" stroke="#fff" stroke-width="4" filter="url(#glow)"/>

        <!-- 软萌耳机 -->
        <rect x="35" y="88" width="43" height="76" rx="21" fill="url(#g)" stroke="#dff4ff" stroke-width="7"/>
        <rect x="242" y="88" width="43" height="76" rx="21" fill="url(#g)" stroke="#dff4ff" stroke-width="7"/>
        <circle cx="57" cy="126" r="8" fill="#8de9ff"/>
        <circle cx="263" cy="126" r="8" fill="#8de9ff"/>

        <!-- 大头白色外壳 -->
        <rect x="58" y="48" width="204" height="145" rx="66" fill="#f8fdff" stroke="#ccecff" stroke-width="8"/>
        <path d="M84 78c27-22 55-28 85-27" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"/>

        <!-- 大面罩和水汪汪的眼睛 -->
        <rect x="76" y="73" width="168" height="93" rx="42" fill="url(#visor)" stroke="#65cfff" stroke-width="5"/>
        <ellipse cx="121" cy="116" rx="14" ry="22" fill="#55e8ff" filter="url(#glow)"/>
        <ellipse cx="199" cy="116" rx="14" ry="22" fill="#55e8ff" filter="url(#glow)"/>
        <ellipse cx="116" cy="107" rx="5" ry="8" fill="#fff" opacity=".9"/>
        <ellipse cx="194" cy="107" rx="5" ry="8" fill="#fff" opacity=".9"/>
        <path d="M137 143q23 15 46 0" fill="none" stroke="#5eeaff" stroke-width="7" stroke-linecap="round"/>
        <circle cx="99" cy="143" r="7" fill="#ff91ad" opacity=".7"/>
        <circle cx="221" cy="143" r="7" fill="#ff91ad" opacity=".7"/>

        <!-- 胖乎乎的短身体 -->
        <path d="M111 177c13-9 85-9 98 0 10 8 13 29 13 54 0 41-21 62-62 62s-62-21-62-62c0-25 3-46 13-54z" fill="#f7fcff" stroke="#ccecff" stroke-width="8"/>
        <path d="M104 205l-29 24" stroke="#e8f8ff" stroke-width="21" stroke-linecap="round"/>
        <path d="M216 205l29 24" stroke="#e8f8ff" stroke-width="21" stroke-linecap="round"/>
        <circle cx="70" cy="234" r="14" fill="#fff" stroke="#ccecff" stroke-width="5"/>
        <circle cx="250" cy="234" r="14" fill="#fff" stroke="#ccecff" stroke-width="5"/>

        <!-- 描述驱动的彩色胸牌 -->
        <rect x="120" y="203" width="80" height="65" rx="25" fill="${start}" opacity=".92"/>
        ${specialtyMark[specialty]}
        <circle cx="160" cy="281" r="5" fill="${end}"/>
        <path d="M126 291v10m68-10v10" stroke="#dff4ff" stroke-width="16" stroke-linecap="round"/>
      </g>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const getAgentAvatar = (agent: Pick<LedgerAgent, 'id' | 'name' | 'description' | 'type'>) => {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${agent.id}`) || generateAgentAvatar(agent);
  } catch {
    return generateAgentAvatar(agent);
  }
};

export const saveAgentAvatar = (agentId: string, dataUrl: string) => {
  localStorage.setItem(`${STORAGE_PREFIX}${agentId}`, dataUrl);
};

export const resetAgentAvatar = (agentId: string) => {
  localStorage.removeItem(`${STORAGE_PREFIX}${agentId}`);
};
