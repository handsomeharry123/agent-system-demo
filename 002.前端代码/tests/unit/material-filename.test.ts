import { describe, expect, it } from 'vitest';
import {
  buildRegistrationMaterialFilename,
  renamePdfFile,
} from '../../src/pages/agent-center/smart/materialFilename';

describe('智能体备案材料文件名', () => {
  it('为产品说明书和技术规格书生成不同的标准名称', () => {
    expect(buildRegistrationMaterialFilename('product', 'RAD-001', '影像智能体', '原文件.pdf'))
      .toBe('RAD-001-影像智能体-产品说明书.pdf');
    expect(buildRegistrationMaterialFilename('tech', 'RAD-001', '影像智能体', '原文件.pdf'))
      .toBe('RAD-001-影像智能体-技术规格书.pdf');
  });

  it('其他材料保留原始文件名', () => {
    expect(buildRegistrationMaterialFilename('other', 'RAD-001', '影像智能体', '安全测试报告.pdf'))
      .toBe('安全测试报告.pdf');
  });

  it('上传前同步修改 File.name，且不改变文件大小', () => {
    const source = new File(['%PDF-demo'], '同名文件.pdf', { type: 'application/pdf' });
    const renamed = renamePdfFile(source, 'RAD-001-影像智能体-技术规格书.pdf');

    expect(renamed.name).toBe('RAD-001-影像智能体-技术规格书.pdf');
    expect(renamed.type).toBe('application/pdf');
    expect(renamed.size).toBe(source.size);
  });
});
