from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "项目审计填报材料-完成度100%-已使用金额136.8万元.pdf"
FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
HANDWRITING_FONT = "/System/Library/AssetsV2/PreinstalledAssetsV2/InstallWithOs/com_apple_MobileAsset_Font7/ef9c121249635b32dd48da4e2e7030efd3e48327.asset/AssetData/Xingkai.ttc"

pdfmetrics.registerFont(TTFont("STHeiti", FONT, subfontIndex=0))
pdfmetrics.registerFont(TTFont("Xingkai", HANDWRITING_FONT, subfontIndex=0))

styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "ChineseTitle",
    parent=styles["Title"],
    fontName="STHeiti",
    fontSize=20,
    leading=28,
    alignment=TA_CENTER,
    textColor=colors.HexColor("#153E75"),
    spaceAfter=5 * mm,
)
section_style = ParagraphStyle(
    "ChineseSection",
    parent=styles["Heading2"],
    fontName="STHeiti",
    fontSize=13,
    leading=20,
    textColor=colors.HexColor("#1559B7"),
    spaceBefore=2.5 * mm,
    spaceAfter=2 * mm,
)
body_style = ParagraphStyle(
    "ChineseBody",
    parent=styles["BodyText"],
    fontName="STHeiti",
    fontSize=10,
    leading=16,
    textColor=colors.HexColor("#263238"),
)
note_style = ParagraphStyle(
    "ChineseNote",
    parent=body_style,
    fontSize=9,
    leading=15,
    textColor=colors.HexColor("#64748B"),
)


def p(text: str, style=body_style):
    return Paragraph(text.replace("\n", "<br/>"), style)


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("STHeiti", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"第 {doc.page} 页")

    # 演示签署信息：姓名和日期值使用中文行楷模拟手写效果。
    signature_right = A4[0] - 18 * mm
    canvas.setFillColor(colors.HexColor("#334155"))
    canvas.setFont("STHeiti", 9)
    label_right = signature_right - 34 * mm
    canvas.drawRightString(label_right, 31 * mm, "签署人名称：")
    canvas.drawRightString(label_right, 24 * mm, "签署日期：")
    canvas.setFillColor(colors.HexColor("#1E4F91"))
    canvas.setFont("Xingkai", 14)
    canvas.drawString(label_right + 1 * mm, 30.3 * mm, "郑涛")
    canvas.setFont("Xingkai", 12)
    canvas.drawString(label_right + 1 * mm, 23.4 * mm, "2026 年 7 月 30 日")
    canvas.restoreState()


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=15 * mm,
    bottomMargin=16 * mm,
    title="项目审计信息填报材料",
    author="医疗智能体管理平台",
)

story = [
    p("项目审计信息填报材料", title_style),
    p("用于“项目审计信息填报”页面上传识别与字段自动填充", note_style),
    Spacer(1, 3 * mm),
    p("一、项目基本信息", section_style),
]

basic_data = [
    [p("<b>项目名称</b>"), p("急诊智能预检分诊系统"), p("<b>申报科室</b>"), p("急诊科")],
    [p("<b>申报赛道</b>"), p("临床诊疗"), p("<b>项目负责人</b>"), p("郑涛")],
    [p("<b>项目联系人</b>"), p("孙悦"), p("<b>联系方式</b>"), p("135****0432")],
]
basic_table = Table(basic_data, colWidths=[28 * mm, 53 * mm, 28 * mm, 53 * mm])
basic_table.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (-1, -1), "STHeiti"),
    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EFF6FF")),
    ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#EFF6FF")),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story.extend([
    basic_table,
    p("二、项目建设内容完成情况", section_style),
    p("<b>项目计划完成形式：</b>建设院内一体化管理平台并完成临床科室试运行"),
    p("<b>完成度：100%</b>"),
    p(
        "<b>建设完成情况说明：</b>项目核心功能已全部完成建设并通过内部验收，"
        "已完成急诊分诊知识库、患者信息采集、智能分级、风险预警、人工复核、"
        "统计分析及权限审计等模块建设。系统已在急诊科完成临床试运行，运行稳定，"
        "满足项目计划完成形式及上线要求。"
    ),
    p("三、考核指标达成情况", section_style),
])

indicator_data = [
    [p("<b>指标名称</b>"), p("<b>需达成目标值</b>"), p("<b>实际完成情况</b>"), p("<b>是否达成</b>")],
    [p("随访任务按时完成率"), p("≥ 90%"), p("96%"), p("是")],
    [p("临床使用满意度"), p("≥ 85 分"), p("91 分"), p("是")],
]
indicator_table = Table(indicator_data, colWidths=[54 * mm, 34 * mm, 44 * mm, 30 * mm])
indicator_table.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (-1, -1), "STHeiti"),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1559B7")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (1, 1), (-1, -1), "CENTER"),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.extend([
    indicator_table,
    p("四、资金使用情况", section_style),
    p("<b>投资总预算：</b>180 万元"),
    p("<b>已使用金额：136.8 万元</b>"),
    p("<b>资金使用率：</b>76%"),
    p(
        "<b>资金使用明细：</b>软硬件采购 62.5 万元；系统实施与接口服务 31.8 万元；"
        "模型训练及数据治理 24.6 万元；系统测试、安全测评与运维服务 17.9 万元。"
        "累计支出 136.8 万元，全部用于本项目建设，票据、合同及验收材料齐全。"
    ),
    p("五、材料真实性说明", section_style),
    p(
        "本材料所列项目建设、考核指标与资金使用信息真实、完整，相关证明材料可供审计复核。"
        "本文件用于演示环境的上传识别与表单预填。"
    ),
])

doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(OUTPUT)
