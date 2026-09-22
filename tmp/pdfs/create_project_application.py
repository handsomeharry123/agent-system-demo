from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)

OUT = "output/pdf/慢病健康教育数字人项目-立项申报书.pdf"
FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
pdfmetrics.registerFont(TTFont("CN", FONT))

BLUE = colors.HexColor("#1677FF")
NAVY = colors.HexColor("#163A63")
LIGHT = colors.HexColor("#F3F7FC")
LINE = colors.HexColor("#D8E2EF")
TEXT = colors.HexColor("#23354D")
MUTED = colors.HexColor("#66788A")

styles = getSampleStyleSheet()
title = ParagraphStyle("title", fontName="CN", fontSize=22, leading=30, textColor=NAVY,
                       alignment=TA_CENTER, spaceAfter=8)
subtitle = ParagraphStyle("subtitle", fontName="CN", fontSize=10.5, leading=16,
                          textColor=MUTED, alignment=TA_CENTER)
section = ParagraphStyle("section", fontName="CN", fontSize=14, leading=20,
                         textColor=NAVY, spaceBefore=4, spaceAfter=8)
body = ParagraphStyle("body", fontName="CN", fontSize=9.5, leading=15, textColor=TEXT)
small = ParagraphStyle("small", fontName="CN", fontSize=8.5, leading=13, textColor=MUTED)
label_style = ParagraphStyle("label", fontName="CN", fontSize=9, leading=14,
                             textColor=NAVY)
value_style = ParagraphStyle("value", fontName="CN", fontSize=9.2, leading=14,
                             textColor=TEXT)

def P(text, style=body):
    return Paragraph(str(text).replace("\n", "<br/>"), style)

def field_table(rows, widths=(42*mm, 138*mm)):
    data = [[P(k, label_style), P(v, value_style)] for k, v in rows]
    t = Table(data, colWidths=list(widths), repeatRows=0, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t

def section_header(number, text):
    return KeepTogether([
        Table([[P(number, ParagraphStyle("num", parent=body, textColor=colors.white,
                                         fontSize=9, alignment=TA_CENTER)),
                P(text, section)]],
              colWidths=[9*mm, 171*mm],
              style=TableStyle([
                  ("BACKGROUND", (0, 0), (0, 0), BLUE),
                  ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                  ("LEFTPADDING", (0, 0), (0, 0), 0),
                  ("RIGHTPADDING", (0, 0), (0, 0), 0),
                  ("LEFTPADDING", (1, 0), (1, 0), 7),
                  ("TOPPADDING", (0, 0), (-1, -1), 4),
                  ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
              ])),
        Spacer(1, 3*mm),
    ])

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(15*mm, h-16*mm, w-15*mm, h-16*mm)
    canvas.setFont("CN", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(15*mm, h-12*mm, "医疗智能体管理平台 · 立项申报管理中心")
    canvas.drawRightString(w-15*mm, 10*mm, f"第 {doc.page} 页")
    canvas.setFillColor(BLUE)
    canvas.rect(15*mm, 9.4*mm, 20*mm, 0.8*mm, fill=1, stroke=0)
    canvas.restoreState()

doc = BaseDocTemplate(
    OUT, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm,
    topMargin=21*mm, bottomMargin=16*mm,
    title="慢病健康教育数字人项目立项申报书",
    author="医疗智能体管理平台",
    subject="立项申报全字段结构化文件",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="normal", frames=[frame], onPage=header_footer)])

story = [
    Spacer(1, 8*mm),
    P("项目立项申报书", title),
    P("慢病健康教育数字人项目", subtitle),
    Spacer(1, 7*mm),
    Table([[P("申报版本", label_style), P("V1.0（正式申报）", value_style),
            P("申报日期", label_style), P("2026年7月30日", value_style)]],
          colWidths=[28*mm, 62*mm, 28*mm, 62*mm],
          style=TableStyle([
              ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
              ("BOX", (0, 0), (-1, -1), 0.7, LINE),
              ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
              ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
              ("LEFTPADDING", (0, 0), (-1, -1), 7),
              ("TOPPADDING", (0, 0), (-1, -1), 8),
              ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
          ])),
    Spacer(1, 8*mm),
    P("识别说明", section),
    P("本文件按立项申报页字段顺序编制。每个字段均使用页面原始字段名，枚举项采用系统标准值，金额统一以“万元”为单位。上传后可由医小管识别并完成全部字段填充。"),
    Spacer(1, 8*mm),
    section_header("01", "项目基本信息"),
    field_table([
        ("项目名称", "慢病健康教育数字人项目"),
        ("申报科室", "内分泌科"),
        ("上级部门", "科研处"),
        ("申报赛道", "便民赛道"),
        ("项目负责人", "孙悦"),
        ("项目联系人", "赵敏"),
        ("联系方式", "13800138000"),
        ("希望获取的支持", "资金支持；算力支持；数据要素支持；项目推广；技术指导支持"),
    ]),
    PageBreak(),
    section_header("02", "项目内容信息"),
    field_table([
        ("项目概述",
         "面向糖尿病、肥胖及代谢综合征等慢病患者，建设可在院内服务号、互联网医院和病区终端使用的健康教育数字人。项目以专科指南、院内宣教规范和患者画像为基础，通过自然语言交互、语音合成与知识检索，为患者提供分层、连续、可追踪的饮食、运动、用药和复诊教育。目标是减轻医护重复宣教负担，提高患者健康知识掌握度与长期自我管理依从性。"),
        ("项目解决的痛点问题",
         "当前慢病宣教依赖医护人员口头讲解和纸质材料，内容同质化、触达时间短、患者理解程度难评估；出院后教育连续性不足，重复咨询占用大量门诊与护理时间。项目通过个性化问答、重点内容复述、风险提示和学习效果反馈，解决宣教效率低、内容不精准、院内外衔接弱及效果不可量化等问题。"),
        ("项目运用的核心技术",
         "智能语音；多模态；自然语言处理；知识图谱；机器学习；隐私计算"),
        ("项目运用的大模型",
         "Qwen模型；Deepseek模型"),
        ("项目完成形式",
         "1. 建成1个慢病健康教育数字人，支持文字、语音和图文卡片交互；2. 建成1套覆盖糖尿病、肥胖和代谢综合征的专科知识库，首期不少于1,200条标准知识单元；3. 建成患者分层与内容推荐模块1套；4. 完成与互联网医院、患者主索引和随访系统的接口联调；5. 形成数据治理规范、隐私保护方案、模型评测报告和用户操作手册各1份；6. 不开展患者原始数据对基础大模型的直接训练，仅使用脱敏样本开展指令优化和效果评测。"),
        ("考核指标",
         "技术性能指标：常见慢病问题回答准确率不低于90%，知识来源可追溯率100%，平均响应时间不超过3秒，敏感问题安全拦截率不低于98%。知识产权指标：申请软件著作权1项，形成院内技术规范1份。经济指标：上线后医护重复宣教工时降低30%，单次标准宣教平均时长降低40%。社会效益指标：患者健康知识知晓率提升25%，重点患者教育触达率达到90%，患者满意度不低于90%。"),
    ]),
    PageBreak(),
    section_header("03", "项目经费预算"),
    field_table([
        ("已有经费来源合计", "48.00 万元"),
        ("具体来源明细",
         "上海市卫生健康委员会资助：20.00万元；医院资助：18.00万元；其它渠道资助：10.00万元。来源合计：48.00万元。"),
        ("具体使用明细",
         "硬件设备购置：6.00万元；硬件资源与服务租赁：8.00万元；软件及专利技术购置费：5.00万元；系统集成费：3.00万元；研发设计费：12.00万元；合作研发费：6.00万元；试制用材料费：2.00万元；测试及加工费：3.00万元；审计费：1.00万元；其他费用：2.00万元。使用合计：48.00万元。"),
    ]),
    Spacer(1, 7*mm),
    P("预算一致性校验", section),
    Table([
        [P("经费来源合计", label_style), P("48.00万元", value_style),
         P("经费使用合计", label_style), P("48.00万元", value_style)],
        [P("差额", label_style), P("0.00万元", value_style),
         P("校验结果", label_style), P("通过", value_style)],
    ], colWidths=[36*mm, 54*mm, 36*mm, 54*mm],
       style=TableStyle([
           ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
           ("BOX", (0, 0), (-1, -1), 0.7, LINE),
           ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
           ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
           ("LEFTPADDING", (0, 0), (-1, -1), 7),
           ("TOPPADDING", (0, 0), (-1, -1), 7),
           ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
       ])),
    Spacer(1, 9*mm),
    P("申报确认", section),
    P("本申报书所列信息真实、完整，项目建设内容、考核指标及经费预算已完成内部核对。"),
    Spacer(1, 14*mm),
    Table([[P("项目负责人签字：________________", body),
            P("申报科室盖章：________________", body)]],
          colWidths=[90*mm, 90*mm]),
]

doc.build(story)
print(OUT)
