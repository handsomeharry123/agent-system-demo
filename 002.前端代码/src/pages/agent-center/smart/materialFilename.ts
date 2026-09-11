export type RegistrationMaterialCategory = 'product' | 'tech' | 'other';

const MATERIAL_SUFFIX: Partial<Record<RegistrationMaterialCategory, string>> = {
  product: '产品说明书',
  tech: '技术规格书',
};

const cleanFilenamePart = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ');

/**
 * 产品说明书和技术规格书使用统一、可区分的归档文件名。
 * 其他材料保留用户原始文件名。
 */
export const buildRegistrationMaterialFilename = (
  category: RegistrationMaterialCategory,
  agentCode: unknown,
  agentName: unknown,
  originalName: string,
) => {
  const suffix = MATERIAL_SUFFIX[category];
  if (!suffix) return originalName;

  const code = cleanFilenamePart(agentCode);
  const name = cleanFilenamePart(agentName);
  // 表单信息未补齐时先保留原名，保存/提交时会再次生成最终名称。
  if (!code || !name) return originalName;
  return `${code}-${name}-${suffix}.pdf`;
};

export const renamePdfFile = (file: File, filename: string) =>
  file.name === filename
    ? file
    : new File([file], filename, {
        type: file.type || 'application/pdf',
        lastModified: file.lastModified,
      });
