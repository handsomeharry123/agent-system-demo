import { useState, type CSSProperties, type ReactNode } from 'react';
import { ApiOutlined } from '@ant-design/icons';
import { Select } from 'antd';

type ModelOption = {
  value: string;
  name: string;
  version?: string;
  vendor?: string;
  iconUrl?: string;
  color?: string;
  fallback?: string;
  customIcon?: ReactNode;
};

/** 图3同款语义：A 表示自动，双环表示系统会在多个模型间智能路由。 */
export const AutoModelIcon = ({ size = 22 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ flex: '0 0 auto' }}
  >
    <circle cx="12" cy="12" r="8.25" stroke="#30343B" strokeWidth="1.7" />
    <path d="M3.2 13.6c1.7 1.2 4.8 1.8 8.2 1.3 4.6-.6 8.2-2.8 8-4.9" stroke="#30343B" strokeWidth="1.45" strokeLinecap="round" />
    <path d="m9.1 15.2 2.85-7.05 2.95 7.05M10.2 12.55h3.58" stroke="#30343B" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m19.05 5.15.45 1.05 1.05.45-1.05.45-.45 1.05-.45-1.05-1.05-.45 1.05-.45.45-1.05Z" fill="#30343B" />
  </svg>
);

const MODELS: ModelOption[] = [
  { value: 'MiniMax-M3', name: 'MiniMax', version: 'M3', vendor: 'MiniMax', iconUrl: 'minimax-color.svg', color: 'F03573', fallback: 'M' },
];

const BrandIcon = ({ model, compact = false }: { model: ModelOption; compact?: boolean }) => {
  const [failed, setFailed] = useState(false);
  if (model.value === 'auto') return <AutoModelIcon size={compact ? 18 : 22} />;
  if (model.value === 'custom') {
    return <ApiOutlined style={{ color: '#722ed1', fontSize: compact ? 17 : 21 }} />;
  }
  if (model.customIcon) return model.customIcon;
  const iconUrl = `https://registry.npmmirror.com/@lobehub/icons-static-svg/1.91.0/files/icons/${model.iconUrl}`;
  return (
    <span
      style={{
        width: compact ? 20 : 24,
        height: compact ? 20 : 24,
        borderRadius: compact ? 5 : 6,
        background: `#${model.color}12`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
      }}
    >
      {failed ? (
        <span style={{ color: `#${model.color}`, fontSize: 12, fontWeight: 500, lineHeight: 1 }}>
          {model.fallback}
        </span>
      ) : (
        <img
          src={iconUrl}
          alt=""
          width={compact ? 15 : 18}
          height={compact ? 15 : 18}
          style={{ display: 'block', objectFit: 'contain' }}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
};

const ModelLabel = ({ model, compact = false }: { model: ModelOption; compact?: boolean }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 10, minWidth: 0 }}>
    <BrandIcon model={model} compact={compact} />
    <span
      style={{
        minWidth: 0,
        color: '#1f2329',
        fontWeight: 400,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontSize: compact ? 12 : undefined,
      }}
    >
      {model.name}{model.version ? ` · ${model.version}` : ''}
    </span>
  </span>
);

export const modelSelectOptions = MODELS.map((model) => ({
  value: model.value,
  label: <ModelLabel model={model} />,
  title: `${model.name}${model.version ? ` ${model.version}` : ''}`,
}));

const compactModelSelectOptions = MODELS.map((model) => ({
  value: model.value,
  label: <ModelLabel model={model} compact />,
  title: `${model.name}${model.version ? ` ${model.version}` : ''}`,
}));

type ModelSelectorProps = {
  value?: string;
  onChange?: (value: string) => void;
  style?: CSSProperties;
  size?: 'small' | 'middle' | 'large';
  variant?: 'outlined' | 'borderless' | 'filled';
  testId?: string;
  compact?: boolean;
};

const ModelSelector = ({ value, onChange, style, size, variant, testId, compact = false }: ModelSelectorProps) => (
  <Select
    value={value}
    onChange={onChange}
    size={size}
    variant={variant}
    style={style}
    options={compact ? compactModelSelectOptions : modelSelectOptions}
    popupMatchSelectWidth={compact ? 260 : 300}
    listHeight={390}
    optionRender={(option) => option.data.label}
    data-testid={testId}
  />
);

export default ModelSelector;
