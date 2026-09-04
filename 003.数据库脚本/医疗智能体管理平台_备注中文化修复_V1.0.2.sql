-- ============================================================================
-- 医疗智能体管理平台：备注中文化修复脚本
-- 版本：V1.0.2
-- 前置版本：V1.0.1
-- 目标数据库：MySQL 9.7.0
-- 说明：为英文枚举代码和技术缩写补充中文业务释义，不修改业务数据。
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+08:00';
USE `med_agent_platform`;

-- 1. 将含英文代码的字段备注统一改为“代码=中文含义”格式
ALTER TABLE `agt_access_config`
  MODIFY COLUMN `access_mode` VARCHAR(20) NOT NULL COMMENT '接入方式：API=应用程序接口接入，SDK=软件开发工具包接入，OTEL=开放遥测接入',
  MODIFY COLUMN `endpoint_url` VARCHAR(1000) NOT NULL COMMENT '接入端点地址：应用程序接口地址或软件开发工具包、开放遥测平台地址',
  MODIFY COLUMN `credential_ciphertext` VARBINARY(2048) NULL COMMENT '由密钥管理服务加密的凭据密文，禁止保存明文',
  MODIFY COLUMN `credential_key_id` VARCHAR(200) NULL COMMENT '密钥管理服务中的密钥标识及版本',
  MODIFY COLUMN `instrumentation_code` MEDIUMTEXT NULL COMMENT '软件开发工具包或开放遥测接入的埋点代码';

ALTER TABLE `agt_agent`
  MODIFY COLUMN `agent_uuid` CHAR(36) NOT NULL COMMENT '对外使用的智能体全局唯一标识',
  MODIFY COLUMN `source_type` VARCHAR(20) NULL COMMENT '来源类型：SELF=自研，THIRD_PARTY=第三方，CO_DEVELOPED=合作研发',
  MODIFY COLUMN `current_access_mode` VARCHAR(20) NULL COMMENT '当前接入方式：API=应用程序接口，SDK=软件开发工具包，OTEL=开放遥测',
  MODIFY COLUMN `master_status` VARCHAR(20) NOT NULL DEFAULT 'REGISTERING' COMMENT '主数据状态：REGISTERING=注册中，MANAGED=已纳管，ARCHIVED=已归档',
  MODIFY COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '逻辑删除标记：0=未删除，1=已删除';

ALTER TABLE `agt_agent_clinical_stage`
  MODIFY COLUMN `stage_code` VARCHAR(30) NOT NULL COMMENT '诊疗环节：TRIAGE=导诊分诊，PRE_CONSULT=预问诊，REGISTRATION=预约挂号，EXAM=辅助检查，DIAGNOSIS=辅助诊断，TREATMENT=辅助治疗，INPATIENT=住院，SURGERY=手术，OTHER=其他',
  MODIFY COLUMN `custom_stage_name` VARCHAR(50) NULL COMMENT '诊疗环节选择“其他”时填写的自定义名称';

ALTER TABLE `agt_agent_document`
  MODIFY COLUMN `document_type` VARCHAR(30) NOT NULL COMMENT '材料类型：PRODUCT_MANUAL=产品说明书，TECH_SPEC=技术规格书，OTHER=其他材料';

ALTER TABLE `agt_connection_test`
  MODIFY COLUMN `test_scene` VARCHAR(20) NOT NULL COMMENT '测试场景：APPLICANT=申请人自测，REVIEWER=审核人复核',
  MODIFY COLUMN `test_result` VARCHAR(20) NOT NULL COMMENT '测试结果：RUNNING=测试中，PASSED=通过，FAILED=失败',
  MODIFY COLUMN `http_status` SMALLINT UNSIGNED NULL COMMENT '连通测试返回的超文本传输协议状态码';

ALTER TABLE `agt_registration_application`
  MODIFY COLUMN `application_type` VARCHAR(20) NOT NULL DEFAULT 'INITIAL' COMMENT '申请类型：INITIAL=首次接入，CHANGE=接入信息变更',
  MODIFY COLUMN `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT' COMMENT '申请状态：DRAFT=草稿，PENDING_REVIEW=待审核，REVIEWING=审核中，WITHDRAWN=撤销修改，RETURNED=退回修改，APPROVED=审核通过';

ALTER TABLE `agt_registration_file`
  MODIFY COLUMN `material_type` VARCHAR(30) NOT NULL COMMENT '材料类型：PRODUCT_MANUAL=产品说明书，TECH_SPEC=技术规格书，OTHER=其他材料',
  MODIFY COLUMN `ocr_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '光学字符识别状态：PENDING=待识别，PROCESSING=识别中，SUCCEEDED=识别成功，FAILED=识别失败，SKIPPED=已跳过',
  MODIFY COLUMN `ocr_text_object_key` VARCHAR(500) NULL COMMENT '光学字符识别全文在对象存储中的文件键',
  MODIFY COLUMN `ocr_structured_data` JSON NULL COMMENT '光学字符识别后的结构化数据，采用JSON格式';

ALTER TABLE `agt_registration_model`
  MODIFY COLUMN `deployment_mode` VARCHAR(30) NOT NULL COMMENT '部署方式：LOCAL=本地化部署，CLOUD=云端部署，HYBRID=混合部署',
  MODIFY COLUMN `top_p` DECIMAL(6,4) NULL COMMENT '模型核采样概率阈值（Top-P）';

ALTER TABLE `agt_registration_review`
  MODIFY COLUMN `review_result` VARCHAR(20) NOT NULL COMMENT '审核结果：APPROVED=审核通过，RETURNED=退回修改';

ALTER TABLE `agt_registration_revision`
  MODIFY COLUMN `access_mode` VARCHAR(20) NOT NULL COMMENT '接入方式：API=应用程序接口接入，SDK=软件开发工具包接入，OTEL=开放遥测接入',
  MODIFY COLUMN `connection_status` VARCHAR(20) NOT NULL DEFAULT 'NOT_TESTED' COMMENT '连通状态：NOT_TESTED=未测试，PASSED=已通过，FAILED=未通过',
  MODIFY COLUMN `ocr_status` VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED' COMMENT '光学字符识别状态：NOT_STARTED=未开始，PROCESSING=识别中，SUCCEEDED=识别成功，FAILED=识别失败',
  MODIFY COLUMN `ocr_extracted_data` JSON NULL COMMENT '光学字符识别抽取的原始结构化结果';

ALTER TABLE `agt_registration_status_history`
  MODIFY COLUMN `action_type` VARCHAR(30) NOT NULL COMMENT '流转动作：CREATE=创建，SAVE_DRAFT=保存草稿，SUBMIT=提交，START_REVIEW=开始审核，WITHDRAW=撤销，RETURN=退回，RESUBMIT=重新提交，APPROVE=审核通过，SYNC_LEDGER=同步台账';

ALTER TABLE `iam_data_policy`
  MODIFY COLUMN `department_scope` VARCHAR(20) NOT NULL DEFAULT 'SELF' COMMENT '科室范围：ALL=全部科室，SELF=用户本科室，CUSTOM=指定科室',
  MODIFY COLUMN `agent_scope` VARCHAR(30) NOT NULL DEFAULT 'SELF_DEPARTMENT' COMMENT '智能体范围：ALL=全部智能体，SELF_DEPARTMENT=本科室智能体，CUSTOM=指定智能体',
  MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'ENABLED' COMMENT '数据权限策略状态：ENABLED=启用，DISABLED=停用',
  MODIFY COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '逻辑删除标记：0=未删除，1=已删除';

ALTER TABLE `iam_data_policy_classification`
  MODIFY COLUMN `classification_code` VARCHAR(20) NOT NULL COMMENT '数据分级：GENERAL=一般，IMPORTANT=重要，CORE=核心，SENSITIVE=敏感';

ALTER TABLE `iam_department_data_policy`
  MODIFY COLUMN `configured` BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否已单独配置：0=沿用全院默认规则，1=使用本科室规则';

ALTER TABLE `iam_hr_sync_batch`
  MODIFY COLUMN `sync_type` VARCHAR(20) NOT NULL COMMENT '同步类型：SCHEDULED=定时同步，MANUAL=手动同步',
  MODIFY COLUMN `result` VARCHAR(20) NOT NULL COMMENT '同步结果：RUNNING=同步中，SUCCESS=成功，PARTIAL=部分失败，FAILED=失败';

ALTER TABLE `iam_hr_sync_item`
  MODIFY COLUMN `action_type` VARCHAR(20) NOT NULL COMMENT '同步动作：ADD=新增，UPDATE=更新，DISABLE=停用，SKIP=跳过',
  MODIFY COLUMN `result` VARCHAR(20) NOT NULL COMMENT '明细处理结果：SUCCESS=成功，FAILED=失败',
  MODIFY COLUMN `before_data` JSON NULL COMMENT '同步前的用户数据快照，采用JSON格式',
  MODIFY COLUMN `after_data` JSON NULL COMMENT '同步后的用户数据快照，采用JSON格式';

ALTER TABLE `iam_login_log`
  MODIFY COLUMN `auth_type` VARCHAR(20) NOT NULL COMMENT '认证方式：PASSWORD=密码认证，SMS=短信验证码认证，SSO=统一身份认证',
  MODIFY COLUMN `result` VARCHAR(20) NOT NULL COMMENT '登录结果：SUCCESS=成功，FAILED=失败，LOCKED=账号锁定，DISABLED=账号停用',
  MODIFY COLUMN `ip_address` VARCHAR(45) NULL COMMENT '客户端网络地址，兼容第四版和第六版互联网协议',
  MODIFY COLUMN `user_agent` VARCHAR(500) NULL COMMENT '客户端浏览器及设备标识信息';

ALTER TABLE `iam_login_session`
  MODIFY COLUMN `client_type` VARCHAR(20) NOT NULL DEFAULT 'WEB' COMMENT '客户端类型：WEB=网页端，MOBILE=移动端，API=接口调用端',
  MODIFY COLUMN `ip_address` VARCHAR(45) NULL COMMENT '客户端网络地址，兼容第四版和第六版互联网协议',
  MODIFY COLUMN `user_agent` VARCHAR(500) NULL COMMENT '客户端浏览器及设备标识信息';

ALTER TABLE `iam_permission`
  MODIFY COLUMN `permission_type` VARCHAR(20) NOT NULL COMMENT '权限层级：MODULE=功能模块，PAGE=页面，ACTION=操作按钮',
  MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'ENABLED' COMMENT '功能权限状态：ENABLED=启用，DISABLED=停用';

ALTER TABLE `iam_role`
  MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'ENABLED' COMMENT '角色状态：ENABLED=启用，DISABLED=停用',
  MODIFY COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '角色逻辑删除标记：0=未删除，1=已删除';

ALTER TABLE `iam_sms_verification_code`
  MODIFY COLUMN `purpose` VARCHAR(20) NOT NULL COMMENT '验证码用途：REGISTER=注册，LOGIN=登录，RESET_PASSWORD=重置密码，BIND_PHONE=绑定手机号',
  MODIFY COLUMN `expires_at` DATETIME(3) NOT NULL COMMENT '短信验证码过期时间，发送后60秒失效',
  MODIFY COLUMN `request_ip` VARCHAR(45) NULL COMMENT '验证码请求来源网络地址';

ALTER TABLE `iam_user`
  MODIFY COLUMN `user_uuid` CHAR(36) NOT NULL COMMENT '对外使用的用户全局唯一标识',
  MODIFY COLUMN `auth_mode` VARCHAR(20) NOT NULL DEFAULT 'BOTH' COMMENT '允许的认证方式：PASSWORD=密码，SMS=短信验证码，BOTH=两者均可，SSO=统一身份认证',
  MODIFY COLUMN `account_status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '账号状态：ACTIVE=正常，DISABLED=停用，LOCKED=锁定，PENDING=待激活',
  MODIFY COLUMN `user_source` VARCHAR(30) NOT NULL DEFAULT 'ADMIN_CREATE' COMMENT '用户来源：SELF_REGISTER=自主注册，ADMIN_CREATE=管理员创建，HOSPITAL_SYNC=医院员工系统同步',
  MODIFY COLUMN `data_permission_source` VARCHAR(20) NOT NULL DEFAULT 'INHERIT' COMMENT '数据权限来源：INHERIT=继承组织规则，OVERRIDE=用户级覆盖',
  MODIFY COLUMN `last_login_ip` VARCHAR(45) NULL COMMENT '用户最后登录的网络地址',
  MODIFY COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '逻辑删除标记：0=未删除，1=已删除';

ALTER TABLE `iam_user_data_policy`
  MODIFY COLUMN `expiry_strategy` VARCHAR(30) NOT NULL DEFAULT 'ON_ORG_CHANGE' COMMENT '失效策略：ON_ORG_CHANGE=组织变动时失效，BY_DATE=指定日期到期，PERMANENT=长期有效';

ALTER TABLE `iam_user_password`
  MODIFY COLUMN `password_hash` VARCHAR(255) NOT NULL COMMENT '采用Argon2id、bcrypt或PBKDF2算法生成的密码哈希值，禁止保存明文',
  MODIFY COLUMN `captcha_required` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否要求图形验证码：连续失败3次后设置为1';

ALTER TABLE `integration_outbox_event`
  MODIFY COLUMN `aggregate_type` VARCHAR(50) NOT NULL COMMENT '聚合类型：USER=用户，REGISTRATION=接入申请，AGENT=智能体，LEDGER=台账，RISK_ASSESSMENT=风险评定',
  MODIFY COLUMN `event_type` VARCHAR(100) NOT NULL COMMENT '业务事件类型，例如REGISTRATION_APPROVED=接入审核通过，AGENT_DISABLED=智能体禁用',
  MODIFY COLUMN `payload` JSON NOT NULL COMMENT '待发布事件的结构化载荷，采用JSON格式',
  MODIFY COLUMN `event_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '发布状态：PENDING=待发布，PUBLISHING=发布中，PUBLISHED=已发布，FAILED=发布失败，DEAD=停止重试';

ALTER TABLE `led_agent_ledger`
  MODIFY COLUMN `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键，基础信息统一读取智能体主数据表',
  MODIFY COLUMN `lifecycle_status` VARCHAR(20) NOT NULL DEFAULT 'TRIAL' COMMENT '生命周期状态：TRIAL=试运行中，ONLINE=已上线，DISABLED=已禁用',
  MODIFY COLUMN `runtime_status` VARCHAR(20) NULL COMMENT '运行状态：ONLINE=在线，OFFLINE=离线，UPDATING=更新中，DISABLED=禁用，ABNORMAL=异常',
  MODIFY COLUMN `risk_level` VARCHAR(20) NOT NULL DEFAULT 'UNASSESSED' COMMENT '风险等级：HIGH=高度关注，MEDIUM=中度关注，GENERAL=一般关注，UNASSESSED=待分级';

ALTER TABLE `led_evaluation_ref`
  MODIFY COLUMN `evaluation_type` VARCHAR(20) NOT NULL DEFAULT 'ADMISSION' COMMENT '评测类型：ADMISSION=准入评测，RUNTIME=运行期评测';

ALTER TABLE `led_lifecycle_event`
  MODIFY COLUMN `event_type` VARCHAR(30) NOT NULL COMMENT '生命周期事件：ENTER_TRIAL=进入试运行，GO_ONLINE=正式上线，DISABLE=禁用，ENABLE=启用，RUNTIME_STATUS_CHANGE=运行状态变更，INFO_CHANGE=基础信息变更',
  MODIFY COLUMN `event_source` VARCHAR(50) NOT NULL COMMENT '事件来源：ACCESS=接入中心，EVALUATION=评测中心，LEDGER=台账中心，MONITORING=运行监控中心，SYSTEM=系统任务';

ALTER TABLE `led_metric_snapshot`
  MODIFY COLUMN `period_type` VARCHAR(20) NOT NULL COMMENT '统计周期：DAY=日，WEEK=周，MONTH=月，TOTAL=累计';

ALTER TABLE `led_resource_link`
  MODIFY COLUMN `external_resource_id` VARCHAR(100) NOT NULL COMMENT '医院资源管理中心的资源业务标识',
  MODIFY COLUMN `link_type` VARCHAR(30) NOT NULL COMMENT '对接方式：API=应用程序接口，SDK=软件开发工具包，DB_DIRECT=数据库直连，FILE_EXCHANGE=文件交换，OTHER=其他',
  MODIFY COLUMN `link_status` VARCHAR(20) NOT NULL DEFAULT 'NORMAL' COMMENT '对接状态：NORMAL=正常，ABNORMAL=异常，DISCONNECTED=已断开';

ALTER TABLE `led_risk_assessment`
  MODIFY COLUMN `risk_level` VARCHAR(20) NOT NULL COMMENT '风险等级：HIGH=高度关注，MEDIUM=中度关注，GENERAL=一般关注';

ALTER TABLE `led_risk_option`
  MODIFY COLUMN `option_code` CHAR(1) NOT NULL COMMENT '选项编码：A=一般风险倾向，B=中度风险倾向，C=高度风险倾向',
  MODIFY COLUMN `risk_weight` TINYINT UNSIGNED NOT NULL COMMENT '风险权重：A选项=1，B选项=2，C选项=3';

ALTER TABLE `led_risk_question`
  MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'ENABLED' COMMENT '题目状态：ENABLED=启用，DISABLED=停用';

ALTER TABLE `sys_department`
  MODIFY COLUMN `department_type` VARCHAR(20) NOT NULL DEFAULT 'DEPARTMENT' COMMENT '组织类型：HOSPITAL=医院，DEPARTMENT=科室，OTHER=其他',
  MODIFY COLUMN `external_org_id` VARCHAR(100) NULL COMMENT '医院组织系统中的外部组织标识',
  MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'ENABLED' COMMENT '组织状态：ENABLED=启用，DISABLED=停用',
  MODIFY COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '科室逻辑删除标记：0=未删除，1=已删除';

ALTER TABLE `sys_file_object`
  MODIFY COLUMN `file_uuid` CHAR(36) NOT NULL COMMENT '对外使用的文件全局唯一标识',
  MODIFY COLUMN `storage_provider` VARCHAR(30) NOT NULL DEFAULT 'LOCAL' COMMENT '存储类型：LOCAL=本地存储，MINIO=院内部署对象存储，OSS=对象存储服务，S3=兼容对象存储',
  MODIFY COLUMN `object_key` VARCHAR(500) NOT NULL COMMENT '文件在对象存储中的唯一键，禁止保存临时访问地址',
  MODIFY COLUMN `mime_type` VARCHAR(100) NOT NULL COMMENT '文件媒体类型',
  MODIFY COLUMN `sha256` CHAR(64) NOT NULL COMMENT '文件内容的SHA-256摘要值，用于完整性校验和去重',
  MODIFY COLUMN `virus_scan_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '病毒扫描状态：PENDING=待扫描，CLEAN=安全，INFECTED=发现病毒，FAILED=扫描失败';

-- 2. 记录修复版本
INSERT INTO `sys_schema_version` (`version_no`, `script_name`, `description`)
VALUES ('1.0.2', '医疗智能体管理平台_备注中文化修复_V1.0.2.sql', '为英文枚举代码和技术缩写补充中文业务释义') AS `new`
ON DUPLICATE KEY UPDATE
  `script_name` = `new`.`script_name`,
  `description` = `new`.`description`;

-- 3. 执行后核验：仅允许必要技术缩写，禁止纯英文或仅由英文代码组成的备注
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND COLUMN_COMMENT REGEXP '^[A-Za-z0-9_ /=-]+$'
ORDER BY TABLE_NAME, ORDINAL_POSITION;

