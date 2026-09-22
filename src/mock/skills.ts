export type SkillKey =
  | 'word-doc'
  | 'pdf-doc'
  | 'ppt-maker'
  | 'word-to-pdf'
  | 'pdf-to-word'
  | 'word-to-ppt'
  | 'pdf-to-ppt'
  | 'report-writing'
  | 'data-analysis'
  | 'humanize-text';

export interface SkillItem {
  key: SkillKey;
  name: string;
  description: string;
  iconText: string;
  iconColor: string;
  installed?: boolean;
  enabled?: boolean;
  tag?: string;
}

export const skillPromptExamples: Record<SkillKey, string> = {
  'word-doc': '帮我根据【......】生成一份word文档',
  'pdf-doc': '帮我根据【......】生成一份pdf文档',
  'ppt-maker': '帮我根据【......】制作一份ppt',
  'word-to-pdf': '帮我将上传的 Word 文档转换为 PDF 格式',
  'pdf-to-word': '帮我将上传的 PDF 文档转换为 Word 格式',
  'word-to-ppt': '帮我将上传的 Word 文档转换为PPT格式',
  'pdf-to-ppt': '帮我将 PDF 文档转换为PPT格式',
  'report-writing': '帮我生成一份智能体管理情况报告或运行监控情况报告',
  'data-analysis': '帮我对【功能模块】的【指标数据】进行数据分析',
  'humanize-text': '帮我去除文本中的AI写作痕迹',
};

export const skills: SkillItem[] = [
  {
    key: 'word-doc',
    name: 'word 文档生成',
    description:
      '离线 Word 文档 (.docx) 生成技能。根据用户描述的内容自动构建 JSON 结构，调用 generate_docx.py 脚本生成格式化的 Word 文档。支持标题、正文、加粗/斜体、列表、表格、图片、分页、页眉页脚等元素。适用场景：生成需求文档 (PRD)、咨询方案/分析报告、会议纪要、通用文档等。当用户提出"生成 Word / docx / 需求文档 / PRD / 方案报告 / 导出为文档"等需求时触发。',
    iconText: 'W',
    iconColor: '#2F6BFF',
    installed: true,
    enabled: true,
  },
  {
    key: 'pdf-doc',
    name: 'pdf 文档生成',
    description:
      '离线 PDF 文档生成技能。根据用户描述的内容自动构建 JSON 结构，调用 generate_pdf.py 脚本生成格式化的 PDF 文档。支持中文、标题、正文、加粗/斜体、列表、表格、图片、分页、页眉页脚、目录等元素。适用场景：生成 PDF 需求文档 (PRD)、咨询方案/分析报告、会议纪要、通用文档、导出为 PDF 等。当用户提出"生成 PDF / 导出 PDF / 创建 PDF 文档"等需求时触发。',
    iconText: 'P',
    iconColor: '#F97316',
  },
  {
    key: 'ppt-maker',
    name: 'PPT 制作',
    description:
      '离线 PPT 演示文稿 (.pptx) 生成技能。根据用户描述的内容自动构建 JSON 结构，调用 generate_pptx.py 脚本生成专业的 PowerPoint 演示文稿。支持封面页、章节分隔页、内容页、结束页四种布局，内置蓝/绿/深/暖四种主题配色。适用于商业汇报、方案演示、项目路演、产品发布等场景。当用户提出"生成 PPT / 制作演示文稿 / 做一个幻灯片 / 创建 pptx"等需求时触发。',
    iconText: 'P',
    iconColor: '#D946EF',
  },
  {
    key: 'word-to-pdf',
    name: 'Word 转 pdf',
    description:
      'Word (.docx) -> PDF 文件转换技能。支持 Word COM（docx2pdf，保真度最高）和纯 Python（python-docx + reportlab，无 Word 环境降级方案）两种模式。支持单文件转换、批量转换、stdin 流水线模式。当用户提出"Word转PDF"、"docx转pdf"、"把word转成pdf"、"导出为pdf"、"转pdf"等需求时触发。',
    iconText: '转',
    iconColor: '#0EA5E9',
  },
  {
    key: 'pdf-to-word',
    name: 'Pdf 转 word',
    description:
      'PDF -> Word (.docx) 文件转换技能。支持 pdf2docx（保真度较高，提取文本/表格/图片）和 PyMuPDF（纯文本提取降级方案）两种模式。支持单文件转换、批量转换、stdin 流水线模式。当用户提出"PDF转Word"、"pdf转docx"、"把pdf转成word"、"pdf导出为docx"、"转word"等需求时触发。',
    iconText: '转',
    iconColor: '#14B8A6',
  },
  {
    key: 'word-to-ppt',
    name: 'word 转 ppt',
    description:
      'Word (.docx) -> 演示文稿 (.pptx) 转换技能。从 Word 文档中提取标题、段落、表格、图片，按标题层级自动分页生成 PPT 幻灯片。支持 blue/green/dark/warm 四种主题。当用户提出"Word转PPT"、"docx转pptx"、"把word做成ppt"、"根据文档生成演示文稿"、"导出为ppt"等需求时触发。',
    iconText: 'P',
    iconColor: '#8B5CF6',
  },
  {
    key: 'pdf-to-ppt',
    name: 'pdf 转 ppt',
    description:
      'PDF -> PPT 文件转换技能。支持 PyMuPDF 提取文本/表格/图片，智能分页重构为 PPT 演示文稿。支持单文件、批量转换、stdin 流水线模式。四套主题配色可选。当用户提出"PDF转PPT"、"pdf转pptx"、"把pdf转成幻灯片"、"pdf to ppt"等需求时触发。',
    iconText: 'P',
    iconColor: '#6366F1',
  },
  {
    key: 'report-writing',
    name: '报告撰写',
    description:
      '标准化管理报告撰写技能。参考"全院智能体运行管理情况报告"等模板，自动构建报告结构并生成格式化的 .docx 文件。支持封面、目录、KPI 指标卡、图表占位、数据表格、问题跟踪表、总结建议、编制说明等元素。适用场景：医院信息化管理报告、项目阶段汇报、运营分析报告、质量分析报告等结构化管理报告。当用户提出"生成报告 / 撰写报告 / 导出报告 / 写一份 XX 报告 / 管理报告"等需求时触发。',
    iconText: '报',
    iconColor: '#64748B',
  },
  {
    key: 'data-analysis',
    name: '数据分析',
    description:
      '智能体管理平台数据分析技能。支持台账数据和运行监控数据的统计分析，自动生成图表和 JSON 摘要，可直接对接 report-generator 生成报告。适用场景：智能体台账分析、运行监控分析、科室分布统计、调用量趋势、告警故障分析、KPI 汇总等。当用户提出"分析数据 / 数据分析 / 统计分析 / 台账分析 / 监控分析 / 帮我看看这数据 / 导出分析结果"等需求时触发。',
    iconText: '数',
    iconColor: '#22C55E',
  },
  {
    key: 'humanize-text',
    name: '去 AI 味工具',
    description:
      '去 AI 味文本处理技能。把 AI 生成的生硬文本改成自然的人话，干掉"值得注意的是""综上所述"等套话、打散过于工整的句式、去掉假谦虚和结尾升天。支持轻量/深度两种模式，可生成审计报告。适用于需要将 AI 生成内容改为自然文风的场景。当用户提出"去AI味""去掉AI感""AI味太重""改写得更像人写的"等需求时触发。',
    iconText: '人',
    iconColor: '#EF4444',
  },
];

export const installedSkills = skills.filter((skill) => skill.installed);
