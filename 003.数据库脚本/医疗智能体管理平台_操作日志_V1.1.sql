-- 医疗智能体管理平台：审计中心操作日志增量脚本
-- 版本：V1.1
-- 适用数据库：MySQL 9.7.0
-- 说明：操作日志采用业务快照保存，用户、角色、组织后续变更不会影响历史审计记录。

USE `med_agent_platform`;

CREATE TABLE IF NOT EXISTS `aud_operation_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '操作日志主键',
  `log_uuid` CHAR(36) NOT NULL COMMENT '对外使用的操作日志全局唯一标识',
  `user_id` BIGINT UNSIGNED NULL COMMENT '关联操作用户主键，用户删除后允许置空',
  `user_name_snapshot` VARCHAR(100) NOT NULL COMMENT '操作发生时的用户姓名快照',
  `role_name_snapshot` VARCHAR(100) NOT NULL COMMENT '操作发生时的主要用户角色快照',
  `department_name_snapshot` VARCHAR(100) NOT NULL COMMENT '操作发生时的所属组织名称快照',
  `module_code` VARCHAR(64) NOT NULL COMMENT '操作所属功能模块编码',
  `module_name` VARCHAR(100) NOT NULL COMMENT '操作所属功能模块中文名称',
  `operation_type` VARCHAR(30) NOT NULL COMMENT '操作类型，如新建、编辑、删除、查看、上传、导出、审核、撤销、刷新',
  `operation_description` VARCHAR(1000) NOT NULL COMMENT '完整操作描述',
  `operation_result` VARCHAR(20) NOT NULL COMMENT '操作结果：SUCCESS=成功，FAILED=失败',
  `failure_reason` VARCHAR(500) NULL COMMENT '操作失败原因',
  `ip_address` VARCHAR(45) NULL COMMENT '客户端网络地址，兼容IPv4和IPv6',
  `request_method` VARCHAR(10) NULL COMMENT '触发操作的HTTP请求方法',
  `request_path` VARCHAR(500) NULL COMMENT '触发操作的HTTP请求路径',
  `target_type` VARCHAR(64) NULL COMMENT '被操作业务对象类型',
  `target_id` VARCHAR(100) NULL COMMENT '被操作业务对象标识',
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '操作发生时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_operation_log_uuid` (`log_uuid`),
  KEY `idx_operation_log_time` (`occurred_at`, `id`),
  KEY `idx_operation_log_user_time` (`user_id`, `occurred_at`),
  KEY `idx_operation_log_module_type` (`module_code`, `operation_type`, `occurred_at`),
  KEY `idx_operation_log_result_time` (`operation_result`, `occurred_at`),
  KEY `idx_operation_log_department_time` (`department_name_snapshot`, `occurred_at`),
  CONSTRAINT `fk_operation_log_user` FOREIGN KEY (`user_id`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_operation_log_result` CHECK (`operation_result` IN ('SUCCESS', 'FAILED'))
) ENGINE=InnoDB COMMENT='平台关键业务操作审计日志';
