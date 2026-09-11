import { describe, expect, it } from 'vitest';
import { parseDimensions, positiveInteger, validateDataset, validateQuestion } from '../../src/routes/evaluation-datasets.js';

describe('评测数据集输入校验', () => {
  it.each([
    [['输入安全', '数据安全']],
    ['输入安全,数据安全'],
    ['["输入安全","数据安全"]'],
  ])('兼容 multipart 中的数组、逗号字符串和 JSON 字符串: %j', (input) => {
    expect(parseDimensions(input)).toEqual(['输入安全', '数据安全']);
  });

  it('拒绝未知维度及超长数据集字段', () => {
    expect(() => parseDimensions(['输入安全', '未知维度'])).toThrow('适用评测维度');
    expect(() => validateDataset({ name: 'x'.repeat(51), version: '1', dimensions: ['输入安全'] })).toThrow('数据集名称');
    expect(() => validateDataset({ name: '测试数据集', version: '1', description: 'x'.repeat(501), dimensions: ['输入安全'] })).toThrow('数据集描述');
  });

  it('兼容中文模板表头并将空期望输出归一化', () => {
    expect(validateQuestion({ '题目编号': 'Q001', '输入文本': '测试输入', '期望输出': '', '题目类型': '问答题' })).toEqual({
      no: 'Q001', input: '测试输入', expected: undefined, type: '问答题',
    });
  });

  it('精确标记导入文件的错误行', () => {
    expect(() => validateQuestion({ '题目编号': 'Q002', '输入文本': '', '题目类型': '问答题' }, 7)).toThrow('第7行：输入文本不能为空');
    expect(() => validateQuestion({ '题目编号': 'Q003', '输入文本': '测试', '题目类型': '判断题' }, 8)).toThrow('第8行：题目类型');
  });

  it('将非法分页值安全地回退并限制页大小', () => {
    expect(positiveInteger('Infinity', 1, 100)).toBe(1);
    expect(positiveInteger('-1', 1, 100)).toBe(1);
    expect(positiveInteger('2.5', 1, 100)).toBe(1);
    expect(positiveInteger('500', 10, 100)).toBe(100);
  });
});
