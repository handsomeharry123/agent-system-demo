# 医疗智能体管理平台数据库设计说明 MVP V1.2

## 1. 版本与范围

- 目标数据库：MySQL Community Server 9.7.0
- 数据库：`med_agent_platform`
- 增量脚本：[医疗智能体管理平台_MVP表结构升级_V1.2.sql](./医疗智能体管理平台_MVP表结构升级_V1.2.sql)
- 前置结构：V1.0、V1.0.1、V1.0.2 和 V1.1 操作日志
- 本版新增 25 张表，升级后共 69 张表

MVP 包含用户登录、首页大屏、接入中心、统一台账、内置准入评测、监控总览与告警闭环、用户中心、操作日志、数据字典和模型配置。

MVP 不包含医小管、智能体建设需求管理、立项申报、医院资源管理、360 画像、风险分级、三方评测对接、具体维度指标仪表盘、项目审计、智能体行为审计和第三方评测平台配置。V1.0 已存在的台账360画像/风险表为避免破坏历史数据予以保留，MVP 不展示也不新增依赖。

## 2. 设计依据

- 《医疗智能体管理平台-需求说明书 V1.2.4》
- 《智能体管理平台首页-需求说明文档 V1.6》
- 《智能体接入中心-需求说明书 V2.1》
- 《统一台账中心-需求说明文档 V1.8》
- 《统一准入评测沙盒-需求说明文档 V1.9》
- 《统一运行监控中心-需求说明文档 V2.1》
- 《用户中心-需求说明 V1.4》
- 《审计中心-需求说明 V1.2》
- 《系统配置-需求说明 V1.0》和《数据字典-需求说明书 V1.0》
- 当前前端 `src/pages`、`src/types`、`src/mock` 及后端已有表访问代码

## 3. 新增表分组

| 分组 | 表 | 设计要点 |
| --- | --- | --- |
| 首页大屏 | `dsh_overview_snapshot` | 按日、全院/科室预聚合，不让大屏扫描时序明细 |
| 评测指标 | `evl_dimension`、`evl_indicator` | 五大安全维度与 ASR/GCR/RR/PLR 风险阈值 |
| 评测数据 | `evl_dataset`、`evl_dataset_dimension`、`evl_dataset_question` | 数据集多维度关联、题集和 50MB 文件限制 |
| 评测任务 | `evl_task`、`evl_task_dimension`、`evl_task_dataset`、`evl_task_status_history` | 内置评测九态流转、统一样本档位和乐观锁 |
| 评测结果 | `evl_report`、`evl_report_dimension_score`、`evl_task_review` | 总结论、分维度得分、红线和人工审核 |
| 精简监控 | `mon_metric_definition`、`mon_metric_hourly`、`mon_agent_status` | 只保留总览 8 项指标，采用小时聚合而非高频原始样本 |
| 告警闭环 | `mon_alert_rule`、`mon_alert_event`、`mon_alert_handle`、`mon_alert_review`、`mon_alert_status_history` | 覆盖规则、分派、处理、审核、关闭/忽略七态流程 |
| 数据字典 | `sys_dictionary`、`sys_dictionary_item` | 内置/自定义字典、值类型、排序和停启用 |
| 模型配置 | `sys_model_config`、`sys_model_connection_test` | API Key 仅保存 KMS 密文和末四位，联通测试独立留痕 |

## 4. MVP 精简监控指标

`mon_metric_definition` 只初始化以下 8 项：

1. 调用总量
2. 成功调用率
3. P95 响应时间
4. 运行状态
5. 告警次数
6. Token 使用量
7. Token 使用成本
8. 异常智能体数

这些指标仅服务监控总览和首页大屏。MVP 不创建业务、状态、成本、安全四类专项仪表盘的明细表。

## 5. 执行和回退

执行：

```bash
mysql --default-character-set=utf8mb4 -u <DBA用户> -p < 医疗智能体管理平台_MVP表结构升级_V1.2.sql
```

脚本可幂等重跑。由于正式执行后新表可能写入业务数据，不提供自动 `DROP` 回退脚本。如需回退，应先停止新版应用写入，导出新表数据，再由 DBA 按外键依赖逆序删除表并删除 `sys_schema_version` 中的 `1.2` 记录。

## 6. 2026-08-28 执行验证

- MySQL 版本：9.7.0
- 执行前：44 张表
- 执行后：69 张表
- V1.2 新增表：25/25
- 数据库外键：126
- `CHECK` 约束：111
- 基础数据：5 个评测维度、5 个评测指标、8 个精简监控指标、5 类字典和 22 个字典项
- 完整基线重放：通过
- V1.2 幂等二次执行：通过
- 无 `DROP`、无业务数据覆盖
