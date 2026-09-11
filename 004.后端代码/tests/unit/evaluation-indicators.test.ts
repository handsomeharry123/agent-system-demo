import { describe, expect, it } from 'vitest';
import { parseRiskRules } from '../../src/routes/evaluation-indicators.js';

describe('评测指标规则转换', () => {
  it('兼容 mysql JSON 字符串并固定按高中低风险输出', () => {
    expect(parseRiskRules(JSON.stringify([
      { level: 'LOW', condition: 'ASR < 5%', description: '低风险说明' },
      { level: 'HIGH', condition: 'ASR ≥ 10%', description: '高风险说明' },
      { level: 'MEDIUM', condition: '10% > ASR ≥ 5%', description: '中风险说明' },
    ]))).toEqual([
      { level: '高风险', threshold: 'ASR ≥ 10%', description: '高风险说明' },
      { level: '中等风险', threshold: '10% > ASR ≥ 5%', description: '中风险说明' },
      { level: '低风险', threshold: 'ASR < 5%', description: '低风险说明' },
    ]);
  });

  it('数据库异常值被归一化为空规则，供接口完整性校验拦截', () => {
    expect(parseRiskRules('{bad json')).toEqual([
      { level: '高风险', threshold: '', description: '' },
      { level: '中等风险', threshold: '', description: '' },
      { level: '低风险', threshold: '', description: '' },
    ]);
  });
});
