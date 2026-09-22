from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT = "output/pdf/立项申报演示导入文件-全字段自动填充.pdf"
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT = "CN"
pdfmetrics.registerFont(TTFont(FONT, FONT_PATH))

PAGE_W, PAGE_H = A4
LEFT = 18 * mm
RIGHT = PAGE_W - 18 * mm
TOP = PAGE_H - 22 * mm
BOTTOM = 18 * mm
BLUE = colors.HexColor("#1677FF")
NAVY = colors.HexColor("#183B63")
GREEN = colors.HexColor("#389E0D")
LIGHT = colors.HexColor("#F4F8FC")
LINE = colors.HexColor("#DCE6F0")
TEXT = colors.HexColor("#24364B")
MUTED = colors.HexColor("#6B7C8F")

fields = [
    ("项目名称", "慢病健康教育数字人示范项目"),
    ("申报科室", "内分泌科"),
    ("上级部门", "科研处"),
    ("申报赛道", "便民赛道"),
    ("项目负责人", "孙悦"),
    ("项目联系人", "赵敏"),
    ("联系方式", "13800138000"),
    ("希望获得的支持", "资金支持；算力支持；数据要素支持；项目推广；技术指导支持"),
    ("项目概述", "面向糖尿病、肥胖及代谢综合征等慢病患者，建设可在互联网医院、院内服务号和病区终端使用的健康教育数字人。项目基于专科指南、院内宣教规范和患者画像，通过自然语言交互、语音合成、知识检索与分层推荐，为患者提供连续、个性化、可追踪的饮食、运动、用药和复诊教育，减轻医护重复宣教负担，提高患者健康知识掌握度与自我管理依从性。"),
    ("项目解决的痛点", "当前慢病宣教依赖医护人员口头讲解和纸质材料，存在内容同质化、触达时间短、患者理解程度难评估、出院后教育连续性不足等问题；重复咨询占用大量门诊与护理时间。项目通过个性化问答、重点内容复述、风险提示和学习效果反馈，解决宣教效率低、内容不精准、院内外衔接弱及效果不可量化的问题。"),
    ("项目运用的核心技术", "智能语音；多模态；自然语言处理；知识图谱；机器学习；隐私计算"),
    ("项目运用的大模型", "Qwen模型；Deepseek模型"),
    ("项目完成形式", "建成1个慢病健康教育数字人，支持文字、语音和图文卡片交互；建成1套覆盖糖尿病、肥胖和代谢综合征的专科知识库，首期不少于1200条标准知识单元；建成患者分层与内容推荐模块1套；完成与互联网医院、患者主索引和随访系统的接口联调；形成数据治理规范、隐私保护方案、模型评测报告和用户操作手册各1份。"),
    ("考核指标", "技术性能指标：常见慢病问题回答准确率不低于90%，知识来源可追溯率100%，平均响应时间不超过3秒，敏感问题安全拦截率不低于98%。知识产权指标：申请软件著作权1项，形成院内技术规范1份。经济指标：医护重复宣教工时降低30%，单次标准宣教平均时长降低40%。社会效益指标：患者健康知识知晓率提升25%，重点患者教育触达率达到90%，患者满意度不低于90%。其他指标：项目验收通过率100%。"),
    ("已有经费来源合计", "48.00万元"),
    ("具体来源明细", "上海市卫生健康委员会资助20.00万元；医院资助18.00万元；其它渠道资助10.00万元；来源合计48.00万元。"),
    ("具体使用明细", "硬件设备购置6.00万元；硬件资源与服务租赁8.00万元；软件及专利技术购置费5.00万元；系统集成费3.00万元；研发设计费12.00万元；合作研发费6.00万元；试制用材料费2.00万元；测试及加工费3.00万元；审计费1.00万元；其他费用2.00万元；使用合计48.00万元。"),
]


def char_width(ch, size):
    return pdfmetrics.stringWidth(ch, FONT, size)


def wrap(text, size, max_width):
    lines, current, width = [], "", 0
    for ch in text:
        w = char_width(ch, size)
        if current and width + w > max_width:
            lines.append(current)
            current, width = ch, w
        else:
            current += ch
            width += w
    if current:
        lines.append(current)
    return lines


c = canvas.Canvas(OUT, pagesize=A4, pageCompression=0)
c.setTitle("立项申报演示导入文件-全字段自动填充")
c.setAuthor("医疗智能体管理平台")
c.setSubject("立项申报页面全字段自动识别演示")
page_no = 0
y = TOP


def page_header(first=False):
    global page_no, y
    page_no += 1
    c.setFillColor(NAVY)
    c.setFont(FONT, 18 if first else 13)
    c.drawString(LEFT, PAGE_H - 14 * mm, "立项申报演示导入文件" if first else "立项申报演示导入文件（续）")
    c.setFillColor(MUTED)
    c.setFont(FONT, 8.5)
    c.drawRightString(RIGHT, PAGE_H - 13.5 * mm, "医疗智能体管理平台")
    c.setStrokeColor(LINE)
    c.line(LEFT, PAGE_H - 17 * mm, RIGHT, PAGE_H - 17 * mm)
    y = TOP
    if first:
        c.setFillColor(GREEN)
        c.roundRect(LEFT, y - 13 * mm, RIGHT - LEFT, 11 * mm, 3 * mm, fill=0, stroke=1)
        c.setFont(FONT, 9)
        c.drawString(LEFT + 5 * mm, y - 7 * mm, "演示说明：本文件采用固定字段名与逐行结构，用于医小管识别并预填立项申报页面全部字段。")
        y -= 19 * mm


def footer():
    c.setStrokeColor(LINE)
    c.line(LEFT, 14 * mm, RIGHT, 14 * mm)
    c.setFillColor(MUTED)
    c.setFont(FONT, 8)
    c.drawString(LEFT, 9.5 * mm, "机器可读演示文件 · 金额单位：万元")
    c.drawRightString(RIGHT, 9.5 * mm, f"第 {page_no} 页")


def new_page():
    footer()
    c.showPage()
    page_header(False)


page_header(True)
for label, value in fields:
    value_size = 9.3
    value_lines = wrap(value, value_size, RIGHT - LEFT - 10 * mm)
    block_h = 10 * mm + max(1, len(value_lines)) * 5.2 * mm
    if y - block_h < BOTTOM:
        new_page()
    c.setFillColor(LIGHT)
    c.roundRect(LEFT, y - block_h + 2 * mm, RIGHT - LEFT, block_h - 2 * mm, 2 * mm, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.rect(LEFT, y - block_h + 2 * mm, 1.2 * mm, block_h - 2 * mm, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont(FONT, 10)
    # 标签与冒号是单独的文本对象，确保 PDF.js 原样提取字段名。
    c.drawString(LEFT + 5 * mm, y - 6 * mm, f"{label}：")
    c.setFillColor(TEXT)
    c.setFont(FONT, value_size)
    line_y = y - 12 * mm
    for line in value_lines:
        c.drawString(LEFT + 5 * mm, line_y, line)
        line_y -= 5.2 * mm
    y -= block_h + 3 * mm

footer()
c.save()
print(OUT)
