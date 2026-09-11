-- ============================================================================
-- 医疗智能体管理平台：数据库表结构脚本
-- 版本：V1.0
-- 目标数据库：MySQL 9.7.0（兼容 MySQL 8.0.19+ 基础语法）
-- 覆盖模块：用户登录、用户中心、智能体接入中心、智能体统一台账中心
-- 说明：只创建数据库对象及必要基础数据，不执行 DROP，不写入明文密码/密钥。
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+08:00';
SET FOREIGN_KEY_CHECKS = 1;

CREATE DATABASE IF NOT EXISTS `med_agent_platform`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `med_agent_platform`;

-- ==========================================================================
-- 0. 版本管理与基础主数据
-- ==========================================================================

CREATE TABLE IF NOT EXISTS `sys_schema_version` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `version_no` VARCHAR(20) NOT NULL COMMENT '数据库版本号',
  `script_name` VARCHAR(200) NOT NULL COMMENT '脚本文件名',
  `description` VARCHAR(500) NULL COMMENT '版本说明',
  `installed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '安装时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_schema_version_no` (`version_no`)
) ENGINE=InnoDB COMMENT='数据库版本记录';

CREATE TABLE IF NOT EXISTS `sys_department` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '科室/组织主键',
  `parent_id` BIGINT UNSIGNED NULL COMMENT '上级组织',
  `department_code` VARCHAR(32) NOT NULL COMMENT '科室代码，用于智能体编号前缀',
  `department_name` VARCHAR(100) NOT NULL COMMENT '科室名称',
  `department_type` VARCHAR(20) NOT NULL DEFAULT 'DEPARTMENT' COMMENT '组织类型：HOSPITAL=医院，DEPARTMENT=科室，OTHER=其他',
  `external_org_id` VARCHAR(100) NULL COMMENT '医院组织系统中的外部组织标识',
  `sort_no` INT NOT NULL DEFAULT 0 COMMENT '排序号',
  `status` VARCHAR(20) NOT NULL DEFAULT 'ENABLED' COMMENT '组织状态：ENABLED=启用，DISABLED=停用',
  `synced_at` DATETIME(3) NULL COMMENT '最近同步时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '记录最后更新时间',
  `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '科室逻辑删除标记：0=未删除，1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_department_code` (`department_code`),
  KEY `idx_department_parent_sort` (`parent_id`, `sort_no`),
  KEY `idx_department_status` (`status`, `is_deleted`),
  CONSTRAINT `fk_department_parent` FOREIGN KEY (`parent_id`) REFERENCES `sys_department` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_department_type` CHECK (`department_type` IN ('HOSPITAL', 'DEPARTMENT', 'OTHER')),
  CONSTRAINT `ck_department_status` CHECK (`status` IN ('ENABLED', 'DISABLED'))
) ENGINE=InnoDB COMMENT='医院组织/科室';

-- ==========================================================================
-- 1. 用户登录与用户中心
-- ==========================================================================

CREATE TABLE IF NOT EXISTS `iam_user` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户主键',
  `user_uuid` CHAR(36) NOT NULL COMMENT '对外使用的用户全局唯一标识',
  `employee_no` VARCHAR(50) NOT NULL COMMENT '医院工号',
  `login_name` VARCHAR(80) NOT NULL COMMENT '登录名；默认可取工号',
  `real_name` VARCHAR(50) NOT NULL COMMENT '真实姓名',
  `department_id` BIGINT UNSIGNED NOT NULL COMMENT '所属组织/科室',
  `job_title` VARCHAR(100) NULL COMMENT '职务/职称',
  `phone` VARCHAR(20) NOT NULL COMMENT '手机号，数据库保存完整值，展示时应用脱敏',
  `email` VARCHAR(254) NULL COMMENT '邮箱',
  `avatar_url` VARCHAR(500) NULL COMMENT '头像地址',
  `auth_mode` VARCHAR(20) NOT NULL DEFAULT 'BOTH' COMMENT '允许的认证方式：PASSWORD=密码，SMS=短信验证码，BOTH=两者均可，SSO=统一身份认证',
  `account_status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '账号状态：ACTIVE=正常，DISABLED=停用，LOCKED=锁定，PENDING=待激活',
  `user_source` VARCHAR(30) NOT NULL DEFAULT 'ADMIN_CREATE' COMMENT '用户来源：SELF_REGISTER=自主注册，ADMIN_CREATE=管理员创建，HOSPITAL_SYNC=医院员工系统同步',
  `data_permission_source` VARCHAR(20) NOT NULL DEFAULT 'INHERIT' COMMENT '数据权限来源：INHERIT=继承组织规则，OVERRIDE=用户级覆盖',
  `last_login_at` DATETIME(3) NULL COMMENT '用户最后登录时间',
  `last_login_ip` VARCHAR(45) NULL COMMENT '用户最后登录的网络地址',
  `synced_at` DATETIME(3) NULL COMMENT '医院员工系统最近同步时间',
  `created_by` BIGINT UNSIGNED NULL COMMENT '创建人用户主键',
  `updated_by` BIGINT UNSIGNED NULL COMMENT '最后更新人用户主键',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '记录最后更新时间',
  `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '逻辑删除标记：0=未删除，1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_uuid` (`user_uuid`),
  UNIQUE KEY `uk_user_employee_no` (`employee_no`),
  UNIQUE KEY `uk_user_login_name` (`login_name`),
  UNIQUE KEY `uk_user_phone` (`phone`),
  UNIQUE KEY `uk_user_email` (`email`),
  KEY `idx_user_department_status` (`department_id`, `account_status`, `is_deleted`),
  KEY `idx_user_name` (`real_name`),
  CONSTRAINT `fk_user_department` FOREIGN KEY (`department_id`) REFERENCES `sys_department` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_user_created_by` FOREIGN KEY (`created_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_user_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_user_auth_mode` CHECK (`auth_mode` IN ('PASSWORD', 'SMS', 'BOTH', 'SSO')),
  CONSTRAINT `ck_user_account_status` CHECK (`account_status` IN ('ACTIVE', 'DISABLED', 'LOCKED', 'PENDING')),
  CONSTRAINT `ck_user_source` CHECK (`user_source` IN ('SELF_REGISTER', 'ADMIN_CREATE', 'HOSPITAL_SYNC')),
  CONSTRAINT `ck_user_data_permission_source` CHECK (`data_permission_source` IN ('INHERIT', 'OVERRIDE'))
) ENGINE=InnoDB COMMENT='平台用户';

CREATE TABLE IF NOT EXISTS `sys_file_object` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '文件主键',
  `file_uuid` CHAR(36) NOT NULL COMMENT '对外使用的文件全局唯一标识',
  `original_name` VARCHAR(255) NOT NULL COMMENT '原始文件名',
  `storage_provider` VARCHAR(30) NOT NULL DEFAULT 'LOCAL' COMMENT '存储类型：LOCAL=本地存储，MINIO=院内部署对象存储，OSS=对象存储服务，S3=兼容对象存储',
  `bucket_name` VARCHAR(100) NULL COMMENT '存储桶',
  `object_key` VARCHAR(500) NOT NULL COMMENT '文件在对象存储中的唯一键，禁止保存临时访问地址',
  `mime_type` VARCHAR(100) NOT NULL COMMENT '文件媒体类型',
  `file_ext` VARCHAR(20) NULL COMMENT '扩展名',
  `size_bytes` BIGINT UNSIGNED NOT NULL COMMENT '文件大小（字节）',
  `sha256` CHAR(64) NOT NULL COMMENT '文件内容的SHA-256摘要值，用于完整性校验和去重',
  `virus_scan_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '病毒扫描状态：PENDING=待扫描，CLEAN=安全，INFECTED=发现病毒，FAILED=扫描失败',
  `uploaded_by` BIGINT UNSIGNED NULL COMMENT '上传用户',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '文件上传时间',
  `deleted_at` DATETIME(3) NULL COMMENT '文件逻辑删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_file_uuid` (`file_uuid`),
  KEY `idx_file_sha256` (`sha256`),
  KEY `idx_file_uploader_time` (`uploaded_by`, `created_at`),
  CONSTRAINT `fk_file_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_file_scan_status` CHECK (`virus_scan_status` IN ('PENDING', 'CLEAN', 'INFECTED', 'FAILED')),
  CONSTRAINT `ck_file_size_positive` CHECK (`size_bytes` > 0)
) ENGINE=InnoDB COMMENT='统一文件对象元数据';

CREATE TABLE IF NOT EXISTS `iam_user_password` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '关联用户主键',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '采用Argon2id、bcrypt或PBKDF2算法生成的密码哈希值，禁止保存明文',
  `password_algorithm` VARCHAR(30) NOT NULL DEFAULT 'ARGON2ID' COMMENT '密码哈希算法',
  `password_version` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '密码凭据版本号',
  `failed_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '连续密码失败次数',
  `captcha_required` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否要求图形验证码：连续失败3次后设置为1',
  `locked_until` DATETIME(3) NULL COMMENT '连续失败5次锁定30分钟',
  `must_change_password` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '管理员初始密码首次登录需修改',
  `password_changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '最近一次密码修改时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_password_user` (`user_id`),
  KEY `idx_user_password_lock` (`locked_until`),
  CONSTRAINT `fk_user_password_user` FOREIGN KEY (`user_id`) REFERENCES `iam_user` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_user_password_algorithm` CHECK (`password_algorithm` IN ('ARGON2ID', 'BCRYPT', 'PBKDF2')),
  CONSTRAINT `ck_user_password_failures` CHECK (`failed_attempts` <= 5)
) ENGINE=InnoDB COMMENT='用户密码凭据与锁定状态';

CREATE TABLE IF NOT EXISTS `iam_sms_verification_code` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `phone` VARCHAR(20) NOT NULL COMMENT '接收短信验证码的手机号',
  `purpose` VARCHAR(20) NOT NULL COMMENT '验证码用途：REGISTER=注册，LOGIN=登录，RESET_PASSWORD=重置密码，BIND_PHONE=绑定手机号',
  `code_digest` CHAR(64) NOT NULL COMMENT '验证码摘要，禁止明文',
  `expires_at` DATETIME(3) NOT NULL COMMENT '短信验证码过期时间，发送后60秒失效',
  `consumed_at` DATETIME(3) NULL COMMENT '验证码核销时间',
  `verify_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '验证码校验失败次数',
  `request_ip` VARCHAR(45) NULL COMMENT '验证码请求来源网络地址',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_sms_phone_purpose_time` (`phone`, `purpose`, `created_at`),
  KEY `idx_sms_expiry` (`expires_at`),
  CONSTRAINT `ck_sms_purpose` CHECK (`purpose` IN ('REGISTER', 'LOGIN', 'RESET_PASSWORD', 'BIND_PHONE'))
) ENGINE=InnoDB COMMENT='短信验证码';

CREATE TABLE IF NOT EXISTS `iam_login_session` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `session_uuid` CHAR(36) NOT NULL COMMENT '登录会话全局唯一标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '关联用户主键',
  `access_token_hash` CHAR(64) NOT NULL COMMENT '访问令牌摘要',
  `refresh_token_hash` CHAR(64) NULL COMMENT '刷新令牌摘要',
  `client_type` VARCHAR(20) NOT NULL DEFAULT 'WEB' COMMENT '客户端类型：WEB=网页端，MOBILE=移动端，API=接口调用端',
  `device_id` VARCHAR(128) NULL COMMENT '客户端设备标识',
  `ip_address` VARCHAR(45) NULL COMMENT '客户端网络地址，兼容第四版和第六版互联网协议',
  `user_agent` VARCHAR(500) NULL COMMENT '客户端浏览器及设备标识信息',
  `expires_at` DATETIME(3) NOT NULL COMMENT '登录会话过期时间',
  `last_active_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '会话最后活跃时间',
  `revoked_at` DATETIME(3) NULL COMMENT '会话撤销时间',
  `revoke_reason` VARCHAR(200) NULL COMMENT '会话撤销原因',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_login_session_uuid` (`session_uuid`),
  UNIQUE KEY `uk_login_access_token_hash` (`access_token_hash`),
  KEY `idx_login_session_user_expiry` (`user_id`, `expires_at`, `revoked_at`),
  CONSTRAINT `fk_login_session_user` FOREIGN KEY (`user_id`) REFERENCES `iam_user` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_login_session_client` CHECK (`client_type` IN ('WEB', 'MOBILE', 'API'))
) ENGINE=InnoDB COMMENT='用户登录会话';

CREATE TABLE IF NOT EXISTS `iam_login_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `user_id` BIGINT UNSIGNED NULL COMMENT '关联用户主键',
  `login_identifier` VARCHAR(100) NOT NULL COMMENT '登录标识，日志展示需脱敏',
  `auth_type` VARCHAR(20) NOT NULL COMMENT '认证方式：PASSWORD=密码认证，SMS=短信验证码认证，SSO=统一身份认证',
  `result` VARCHAR(20) NOT NULL COMMENT '登录结果：SUCCESS=成功，FAILED=失败，LOCKED=账号锁定，DISABLED=账号停用',
  `failure_reason` VARCHAR(200) NULL COMMENT '登录失败原因',
  `ip_address` VARCHAR(45) NULL COMMENT '客户端网络地址，兼容第四版和第六版互联网协议',
  `user_agent` VARCHAR(500) NULL COMMENT '客户端浏览器及设备标识信息',
  `device_id` VARCHAR(128) NULL COMMENT '客户端设备标识',
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '事件发生时间',
  PRIMARY KEY (`id`),
  KEY `idx_login_log_user_time` (`user_id`, `occurred_at`),
  KEY `idx_login_log_ip_time` (`ip_address`, `occurred_at`),
  KEY `idx_login_log_result_time` (`result`, `occurred_at`),
  CONSTRAINT `fk_login_log_user` FOREIGN KEY (`user_id`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_login_log_auth_type` CHECK (`auth_type` IN ('PASSWORD', 'SMS', 'SSO')),
  CONSTRAINT `ck_login_log_result` CHECK (`result` IN ('SUCCESS', 'FAILED', 'LOCKED', 'DISABLED'))
) ENGINE=InnoDB COMMENT='登录审计日志';

CREATE TABLE IF NOT EXISTS `iam_role` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `role_code` VARCHAR(64) NOT NULL COMMENT '角色唯一编码',
  `role_name` VARCHAR(100) NOT NULL COMMENT '角色名称',
  `description` VARCHAR(500) NULL COMMENT '角色职责说明',
  `is_system` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '系统角色不可删除',
  `status` VARCHAR(20) NOT NULL DEFAULT 'ENABLED' COMMENT '角色状态：ENABLED=启用，DISABLED=停用',
  `created_by` BIGINT UNSIGNED NULL COMMENT '创建人用户主键',
  `updated_by` BIGINT UNSIGNED NULL COMMENT '最后更新人用户主键',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '记录最后更新时间',
  `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '角色逻辑删除标记：0=未删除，1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_code` (`role_code`),
  UNIQUE KEY `uk_role_name` (`role_name`),
  KEY `idx_role_status` (`status`, `is_deleted`),
  CONSTRAINT `fk_role_created_by` FOREIGN KEY (`created_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_role_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_role_status` CHECK (`status` IN ('ENABLED', 'DISABLED'))
) ENGINE=InnoDB COMMENT='角色';

CREATE TABLE IF NOT EXISTS `iam_user_role` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '关联用户主键',
  `role_id` BIGINT UNSIGNED NOT NULL COMMENT '关联角色主键',
  `granted_by` BIGINT UNSIGNED NULL COMMENT '执行授权的用户主键',
  `granted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '授权时间',
  `expires_at` DATETIME(3) NULL COMMENT '用户角色授权到期时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`, `role_id`),
  KEY `idx_user_role_role` (`role_id`, `user_id`),
  CONSTRAINT `fk_user_role_user` FOREIGN KEY (`user_id`) REFERENCES `iam_user` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_user_role_role` FOREIGN KEY (`role_id`) REFERENCES `iam_role` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_user_role_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB COMMENT='用户角色关联（支持多角色）';

CREATE TABLE IF NOT EXISTS `iam_permission` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `parent_id` BIGINT UNSIGNED NULL COMMENT '父级权限主键',
  `permission_code` VARCHAR(150) NOT NULL COMMENT '模块:页面:操作编码',
  `permission_name` VARCHAR(150) NOT NULL COMMENT '功能权限名称',
  `permission_type` VARCHAR(20) NOT NULL COMMENT '权限层级：MODULE=功能模块，PAGE=页面，ACTION=操作按钮',
  `route_path` VARCHAR(255) NULL COMMENT '前端页面路由',
  `sort_no` INT NOT NULL DEFAULT 0 COMMENT '显示排序号',
  `status` VARCHAR(20) NOT NULL DEFAULT 'ENABLED' COMMENT '功能权限状态：ENABLED=启用，DISABLED=停用',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permission_code` (`permission_code`),
  KEY `idx_permission_parent_sort` (`parent_id`, `sort_no`),
  CONSTRAINT `fk_permission_parent` FOREIGN KEY (`parent_id`) REFERENCES `iam_permission` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_permission_type` CHECK (`permission_type` IN ('MODULE', 'PAGE', 'ACTION')),
  CONSTRAINT `ck_permission_status` CHECK (`status` IN ('ENABLED', 'DISABLED'))
) ENGINE=InnoDB COMMENT='功能权限树（模块-页面-操作）';

CREATE TABLE IF NOT EXISTS `iam_role_permission` (
  `role_id` BIGINT UNSIGNED NOT NULL COMMENT '关联角色主键',
  `permission_id` BIGINT UNSIGNED NOT NULL COMMENT '关联功能权限主键',
  `granted_by` BIGINT UNSIGNED NULL COMMENT '授予功能权限的用户主键',
  `granted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '授权时间',
  PRIMARY KEY (`role_id`, `permission_id`),
  KEY `idx_role_permission_permission` (`permission_id`, `role_id`),
  CONSTRAINT `fk_role_permission_role` FOREIGN KEY (`role_id`) REFERENCES `iam_role` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_role_permission_permission` FOREIGN KEY (`permission_id`) REFERENCES `iam_permission` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_role_permission_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB COMMENT='角色功能权限';

CREATE TABLE IF NOT EXISTS `iam_hr_sync_batch` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `batch_no` VARCHAR(64) NOT NULL COMMENT '同步批次编号',
  `sync_type` VARCHAR(20) NOT NULL COMMENT '同步类型：SCHEDULED=定时同步，MANUAL=手动同步',
  `result` VARCHAR(20) NOT NULL COMMENT '同步结果：RUNNING=同步中，SUCCESS=成功，PARTIAL=部分失败，FAILED=失败',
  `added_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '本批次新增用户数量',
  `updated_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '本批次更新用户数量',
  `disabled_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '本批次停用用户数量',
  `failed_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '本批次处理失败数量',
  `message` VARCHAR(1000) NULL COMMENT '本次员工同步结果摘要',
  `started_by` BIGINT UNSIGNED NULL COMMENT '发起同步的用户主键',
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '处理开始时间',
  `finished_at` DATETIME(3) NULL COMMENT '处理完成时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_sync_batch_no` (`batch_no`),
  KEY `idx_hr_sync_result_time` (`result`, `started_at`),
  CONSTRAINT `fk_hr_sync_started_by` FOREIGN KEY (`started_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_hr_sync_type` CHECK (`sync_type` IN ('SCHEDULED', 'MANUAL')),
  CONSTRAINT `ck_hr_sync_result` CHECK (`result` IN ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'))
) ENGINE=InnoDB COMMENT='医院员工/组织同步批次';

CREATE TABLE IF NOT EXISTS `iam_hr_sync_item` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `batch_id` BIGINT UNSIGNED NOT NULL COMMENT '关联同步批次主键',
  `external_employee_no` VARCHAR(50) NOT NULL COMMENT '医院员工系统工号',
  `action_type` VARCHAR(20) NOT NULL COMMENT '同步动作：ADD=新增，UPDATE=更新，DISABLE=停用，SKIP=跳过',
  `result` VARCHAR(20) NOT NULL COMMENT '明细处理结果：SUCCESS=成功，FAILED=失败',
  `user_id` BIGINT UNSIGNED NULL COMMENT '关联用户主键',
  `before_data` JSON NULL COMMENT '同步前的用户数据快照，采用JSON格式',
  `after_data` JSON NULL COMMENT '同步后的用户数据快照，采用JSON格式',
  `error_message` VARCHAR(1000) NULL COMMENT '单条员工数据同步失败原因',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_hr_sync_item_batch_result` (`batch_id`, `result`),
  KEY `idx_hr_sync_item_employee` (`external_employee_no`),
  CONSTRAINT `fk_hr_sync_item_batch` FOREIGN KEY (`batch_id`) REFERENCES `iam_hr_sync_batch` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_hr_sync_item_user` FOREIGN KEY (`user_id`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_hr_sync_item_action` CHECK (`action_type` IN ('ADD', 'UPDATE', 'DISABLE', 'SKIP')),
  CONSTRAINT `ck_hr_sync_item_result` CHECK (`result` IN ('SUCCESS', 'FAILED'))
) ENGINE=InnoDB COMMENT='医院员工同步明细';

-- ==========================================================================
-- 2. 智能体统一主数据与接入中心
-- ==========================================================================

CREATE TABLE IF NOT EXISTS `agt_agent` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `agent_uuid` CHAR(36) NOT NULL COMMENT '对外使用的智能体全局唯一标识',
  `agent_code` VARCHAR(50) NOT NULL COMMENT '科室编号-四位准入顺序号',
  `agent_name` VARCHAR(100) NOT NULL COMMENT '智能体名称，业务限制2-20字符',
  `agent_version` VARCHAR(30) NOT NULL COMMENT '智能体版本号',
  `department_id` BIGINT UNSIGNED NOT NULL COMMENT '关联科室主键',
  `agent_type` VARCHAR(50) NULL COMMENT '辅助诊断/影像分析等',
  `source_type` VARCHAR(20) NULL COMMENT '来源类型：SELF=自研，THIRD_PARTY=第三方，CO_DEVELOPED=合作研发',
  `supplier_name` VARCHAR(100) NULL COMMENT '供应商全称',
  `function_description` VARCHAR(500) NOT NULL COMMENT '智能体核心功能与应用场景说明',
  `tech_contact_name` VARCHAR(50) NOT NULL COMMENT '技术联系人姓名',
  `tech_contact_phone` VARCHAR(20) NOT NULL COMMENT '技术联系人手机号',
  `tech_contact_email` VARCHAR(254) NULL COMMENT '技术联系人邮箱',
  `current_access_mode` VARCHAR(20) NULL COMMENT '当前接入方式：API=应用程序接口，SDK=软件开发工具包，OTEL=开放遥测',
  `master_status` VARCHAR(20) NOT NULL DEFAULT 'REGISTERING' COMMENT '主数据状态：REGISTERING=注册中，MANAGED=已纳管，ARCHIVED=已归档',
  `created_by` BIGINT UNSIGNED NOT NULL COMMENT '创建人用户主键',
  `updated_by` BIGINT UNSIGNED NOT NULL COMMENT '最后更新人用户主键',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '记录最后更新时间',
  `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '逻辑删除标记：0=未删除，1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_uuid` (`agent_uuid`),
  UNIQUE KEY `uk_agent_code` (`agent_code`),
  UNIQUE KEY `uk_agent_name` (`agent_name`),
  KEY `idx_agent_department_status` (`department_id`, `master_status`, `is_deleted`),
  KEY `idx_agent_source_type` (`source_type`, `agent_type`),
  CONSTRAINT `fk_agent_department` FOREIGN KEY (`department_id`) REFERENCES `sys_department` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_agent_created_by` FOREIGN KEY (`created_by`) REFERENCES `iam_user` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_agent_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `iam_user` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_agent_source_type` CHECK (`source_type` IS NULL OR `source_type` IN ('SELF', 'THIRD_PARTY', 'CO_DEVELOPED')),
  CONSTRAINT `ck_agent_access_mode` CHECK (`current_access_mode` IS NULL OR `current_access_mode` IN ('API', 'SDK', 'OTEL')),
  CONSTRAINT `ck_agent_master_status` CHECK (`master_status` IN ('REGISTERING', 'MANAGED', 'ARCHIVED'))
) ENGINE=InnoDB COMMENT='智能体统一主数据（接入与台账共用）';

CREATE TABLE IF NOT EXISTS `agt_agent_clinical_stage` (
  `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键',
  `stage_code` VARCHAR(30) NOT NULL COMMENT '诊疗环节：TRIAGE=导诊分诊，PRE_CONSULT=预问诊，REGISTRATION=预约挂号，EXAM=辅助检查，DIAGNOSIS=辅助诊断，TREATMENT=辅助治疗，INPATIENT=住院，SURGERY=手术，OTHER=其他',
  `stage_name` VARCHAR(50) NOT NULL COMMENT '诊疗环节名称',
  `custom_stage_name` VARCHAR(50) NULL COMMENT '诊疗环节选择“其他”时填写的自定义名称',
  `sort_no` INT NOT NULL DEFAULT 0 COMMENT '显示排序号',
  PRIMARY KEY (`agent_id`, `stage_code`),
  KEY `idx_agent_stage_filter` (`stage_code`, `agent_id`),
  CONSTRAINT `fk_agent_stage_agent` FOREIGN KEY (`agent_id`) REFERENCES `agt_agent` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_agent_stage_code` CHECK (`stage_code` IN ('TRIAGE', 'PRE_CONSULT', 'REGISTRATION', 'EXAM', 'DIAGNOSIS', 'TREATMENT', 'INPATIENT', 'SURGERY', 'OTHER'))
) ENGINE=InnoDB COMMENT='智能体诊疗环节（支持多选）';

CREATE TABLE IF NOT EXISTS `agt_registration_application` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `application_no` VARCHAR(50) NOT NULL COMMENT '接入申请单号',
  `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键',
  `application_type` VARCHAR(20) NOT NULL DEFAULT 'INITIAL' COMMENT '申请类型：INITIAL=首次接入，CHANGE=接入信息变更',
  `applicant_id` BIGINT UNSIGNED NOT NULL COMMENT '申请人用户主键',
  `applicant_department_id` BIGINT UNSIGNED NOT NULL COMMENT '提交时申请人所属科室快照',
  `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT' COMMENT '申请状态：DRAFT=草稿，PENDING_REVIEW=待审核，REVIEWING=审核中，WITHDRAWN=撤销修改，RETURNED=退回修改，APPROVED=审核通过',
  `current_revision_no` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '当前生效的申请修订序号',
  `submitted_at` DATETIME(3) NULL COMMENT '提交时间',
  `review_started_at` DATETIME(3) NULL COMMENT '审核开始时间',
  `withdrawn_at` DATETIME(3) NULL COMMENT '申请撤销时间',
  `returned_at` DATETIME(3) NULL COMMENT '审核退回时间',
  `approved_at` DATETIME(3) NULL COMMENT '审核通过时间',
  `ledger_synced_at` DATETIME(3) NULL COMMENT '审核结果同步至台账的时间',
  `row_version` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '接入申请创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '接入申请最后更新时间',
  `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '仅草稿/撤销记录允许逻辑删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_registration_application_no` (`application_no`),
  KEY `idx_registration_status_time` (`status`, `submitted_at`),
  KEY `idx_registration_applicant_status` (`applicant_id`, `status`, `updated_at`),
  KEY `idx_registration_department_status` (`applicant_department_id`, `status`),
  KEY `idx_registration_agent` (`agent_id`, `application_type`, `created_at`),
  CONSTRAINT `fk_registration_agent` FOREIGN KEY (`agent_id`) REFERENCES `agt_agent` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_registration_applicant` FOREIGN KEY (`applicant_id`) REFERENCES `iam_user` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_registration_department` FOREIGN KEY (`applicant_department_id`) REFERENCES `sys_department` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_registration_type` CHECK (`application_type` IN ('INITIAL', 'CHANGE')),
  CONSTRAINT `ck_registration_status` CHECK (`status` IN ('DRAFT', 'PENDING_REVIEW', 'REVIEWING', 'WITHDRAWN', 'RETURNED', 'APPROVED'))
) ENGINE=InnoDB COMMENT='智能体接入申请';

CREATE TABLE IF NOT EXISTS `agt_registration_revision` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `application_id` BIGINT UNSIGNED NOT NULL COMMENT '关联接入申请主键',
  `revision_no` INT UNSIGNED NOT NULL COMMENT '申请修订序号',
  `agent_name` VARCHAR(100) NOT NULL COMMENT '智能体名称',
  `agent_code` VARCHAR(50) NOT NULL COMMENT '智能体业务编号',
  `agent_version` VARCHAR(30) NOT NULL COMMENT '智能体版本号',
  `department_id` BIGINT UNSIGNED NOT NULL COMMENT '关联科室主键',
  `clinical_stages` JSON NULL COMMENT '提交时诊疗环节快照数组',
  `agent_type` VARCHAR(50) NULL COMMENT '智能体类型',
  `source_type` VARCHAR(20) NULL COMMENT '智能体来源类型',
  `supplier_name` VARCHAR(100) NULL COMMENT '供应商全称',
  `function_description` VARCHAR(500) NOT NULL COMMENT '智能体核心功能与应用场景说明',
  `tech_contact_name` VARCHAR(50) NOT NULL COMMENT '技术联系人姓名',
  `tech_contact_phone` VARCHAR(20) NOT NULL COMMENT '技术联系人手机号',
  `tech_contact_email` VARCHAR(254) NULL COMMENT '技术联系人邮箱',
  `access_mode` VARCHAR(20) NOT NULL COMMENT '接入方式：API=应用程序接口接入，SDK=软件开发工具包接入，OTEL=开放遥测接入',
  `connection_status` VARCHAR(20) NOT NULL DEFAULT 'NOT_TESTED' COMMENT '连通状态：NOT_TESTED=未测试，PASSED=已通过，FAILED=未通过',
  `ocr_status` VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED' COMMENT '光学字符识别状态：NOT_STARTED=未开始，PROCESSING=识别中，SUCCEEDED=识别成功，FAILED=识别失败',
  `ocr_extracted_data` JSON NULL COMMENT '光学字符识别抽取的原始结构化结果',
  `change_summary` VARCHAR(500) NULL COMMENT '本次修订内容摘要',
  `created_by` BIGINT UNSIGNED NOT NULL COMMENT '创建该修订的用户主键',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '申请修订创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_registration_revision` (`application_id`, `revision_no`),
  KEY `idx_revision_department` (`department_id`),
  KEY `idx_revision_agent_name` (`agent_name`),
  CONSTRAINT `fk_revision_application` FOREIGN KEY (`application_id`) REFERENCES `agt_registration_application` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_revision_department` FOREIGN KEY (`department_id`) REFERENCES `sys_department` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_revision_created_by` FOREIGN KEY (`created_by`) REFERENCES `iam_user` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_revision_source_type` CHECK (`source_type` IS NULL OR `source_type` IN ('SELF', 'THIRD_PARTY', 'CO_DEVELOPED')),
  CONSTRAINT `ck_revision_access_mode` CHECK (`access_mode` IN ('API', 'SDK', 'OTEL')),
  CONSTRAINT `ck_revision_connection` CHECK (`connection_status` IN ('NOT_TESTED', 'PASSED', 'FAILED')),
  CONSTRAINT `ck_revision_ocr` CHECK (`ocr_status` IN ('NOT_STARTED', 'PROCESSING', 'SUCCEEDED', 'FAILED'))
) ENGINE=InnoDB COMMENT='接入申请修订快照';

CREATE TABLE IF NOT EXISTS `agt_registration_model` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `revision_id` BIGINT UNSIGNED NOT NULL COMMENT '关联接入申请修订主键',
  `sort_no` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '显示排序号',
  `model_name` VARCHAR(100) NOT NULL COMMENT '模型名称',
  `model_version` VARCHAR(50) NOT NULL COMMENT '模型版本号',
  `deployment_mode` VARCHAR(30) NOT NULL COMMENT '部署方式：LOCAL=本地化部署，CLOUD=云端部署，HYBRID=混合部署',
  `parameter_count` DECIMAL(12,1) UNSIGNED NULL COMMENT '模型参数量（单位：十亿/B）',
  `is_open_source` BOOLEAN NULL COMMENT '模型是否开源',
  `context_length` INT UNSIGNED NULL COMMENT '模型上下文窗口长度',
  `temperature` DECIMAL(6,4) NULL COMMENT '模型采样温度参数',
  `top_p` DECIMAL(6,4) NULL COMMENT '模型核采样概率阈值（Top-P）',
  `max_concurrency` INT UNSIGNED NULL COMMENT '模型最大并发数',
  `release_date` DATE NULL COMMENT '模型发布日期',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_registration_model_sort` (`revision_id`, `sort_no`),
  CONSTRAINT `fk_registration_model_revision` FOREIGN KEY (`revision_id`) REFERENCES `agt_registration_revision` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_model_deployment_mode` CHECK (`deployment_mode` IN ('LOCAL', 'CLOUD', 'HYBRID')),
  CONSTRAINT `ck_model_temperature` CHECK (`temperature` IS NULL OR (`temperature` >= 0 AND `temperature` <= 2)),
  CONSTRAINT `ck_model_top_p` CHECK (`top_p` IS NULL OR (`top_p` >= 0 AND `top_p` <= 1))
) ENGINE=InnoDB COMMENT='接入申请使用模型配置';

CREATE TABLE IF NOT EXISTS `agt_registration_file` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `revision_id` BIGINT UNSIGNED NOT NULL COMMENT '关联接入申请修订主键',
  `file_id` BIGINT UNSIGNED NOT NULL COMMENT '关联文件对象主键',
  `material_type` VARCHAR(30) NOT NULL COMMENT '材料类型：PRODUCT_MANUAL=产品说明书，TECH_SPEC=技术规格书，OTHER=其他材料',
  `sort_no` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '显示排序号',
  `ocr_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '光学字符识别状态：PENDING=待识别，PROCESSING=识别中，SUCCEEDED=识别成功，FAILED=识别失败，SKIPPED=已跳过',
  `ocr_text_object_key` VARCHAR(500) NULL COMMENT '光学字符识别全文在对象存储中的文件键',
  `ocr_structured_data` JSON NULL COMMENT '光学字符识别后的结构化数据，采用JSON格式',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_registration_file` (`revision_id`, `file_id`),
  KEY `idx_registration_file_type` (`revision_id`, `material_type`, `sort_no`),
  CONSTRAINT `fk_registration_file_revision` FOREIGN KEY (`revision_id`) REFERENCES `agt_registration_revision` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_registration_file_file` FOREIGN KEY (`file_id`) REFERENCES `sys_file_object` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_registration_material_type` CHECK (`material_type` IN ('PRODUCT_MANUAL', 'TECH_SPEC', 'OTHER')),
  CONSTRAINT `ck_registration_file_ocr` CHECK (`ocr_status` IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'SKIPPED'))
) ENGINE=InnoDB COMMENT='接入备案材料';

CREATE TABLE IF NOT EXISTS `agt_access_config` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `revision_id` BIGINT UNSIGNED NOT NULL COMMENT '关联接入申请修订主键',
  `access_mode` VARCHAR(20) NOT NULL COMMENT '接入方式：API=应用程序接口接入，SDK=软件开发工具包接入，OTEL=开放遥测接入',
  `endpoint_url` VARCHAR(1000) NOT NULL COMMENT '接入端点地址：应用程序接口地址或软件开发工具包、开放遥测平台地址',
  `credential_ciphertext` VARBINARY(2048) NULL COMMENT '由密钥管理服务加密的凭据密文，禁止保存明文',
  `credential_key_id` VARCHAR(200) NULL COMMENT '密钥管理服务中的密钥标识及版本',
  `credential_last4` CHAR(4) NULL COMMENT '掩码展示末四位',
  `instrumentation_code` MEDIUMTEXT NULL COMMENT '软件开发工具包或开放遥测接入的埋点代码',
  `issued_at` DATETIME(3) NULL COMMENT '平台密钥签发时间',
  `expires_at` DATETIME(3) NULL COMMENT '接入凭据过期时间',
  `rotated_at` DATETIME(3) NULL COMMENT '接入密钥最近轮换时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_access_config_revision` (`revision_id`),
  KEY `idx_access_config_expiry` (`expires_at`),
  CONSTRAINT `fk_access_config_revision` FOREIGN KEY (`revision_id`) REFERENCES `agt_registration_revision` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_access_config_mode` CHECK (`access_mode` IN ('API', 'SDK', 'OTEL'))
) ENGINE=InnoDB COMMENT='接入地址与加密凭据';

CREATE TABLE IF NOT EXISTS `agt_connection_test` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `revision_id` BIGINT UNSIGNED NOT NULL COMMENT '关联接入申请修订主键',
  `test_scene` VARCHAR(20) NOT NULL COMMENT '测试场景：APPLICANT=申请人自测，REVIEWER=审核人复核',
  `test_result` VARCHAR(20) NOT NULL COMMENT '测试结果：RUNNING=测试中，PASSED=通过，FAILED=失败',
  `http_status` SMALLINT UNSIGNED NULL COMMENT '连通测试返回的超文本传输协议状态码',
  `latency_ms` INT UNSIGNED NULL COMMENT '连通测试响应耗时（毫秒）',
  `error_code` VARCHAR(100) NULL COMMENT '连通测试错误代码',
  `error_message` VARCHAR(1000) NULL COMMENT '错误详细信息',
  `process_detail` JSON NULL COMMENT '中间连通过程',
  `tested_by` BIGINT UNSIGNED NOT NULL COMMENT '执行连通测试的用户主键',
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '处理开始时间',
  `finished_at` DATETIME(3) NULL COMMENT '处理完成时间',
  PRIMARY KEY (`id`),
  KEY `idx_connection_revision_time` (`revision_id`, `started_at`),
  KEY `idx_connection_result_time` (`test_result`, `started_at`),
  CONSTRAINT `fk_connection_revision` FOREIGN KEY (`revision_id`) REFERENCES `agt_registration_revision` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_connection_tested_by` FOREIGN KEY (`tested_by`) REFERENCES `iam_user` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_connection_scene` CHECK (`test_scene` IN ('APPLICANT', 'REVIEWER')),
  CONSTRAINT `ck_connection_result` CHECK (`test_result` IN ('RUNNING', 'PASSED', 'FAILED'))
) ENGINE=InnoDB COMMENT='接入连通测试记录';

CREATE TABLE IF NOT EXISTS `agt_registration_review` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `application_id` BIGINT UNSIGNED NOT NULL COMMENT '被审核的接入申请主键',
  `revision_id` BIGINT UNSIGNED NOT NULL COMMENT '审核所针对的不可变修订',
  `reviewer_id` BIGINT UNSIGNED NOT NULL COMMENT '审核人用户主键',
  `review_result` VARCHAR(20) NOT NULL COMMENT '审核结果：APPROVED=审核通过，RETURNED=退回修改',
  `review_comment` VARCHAR(500) NULL COMMENT '退回时必填，由应用层校验',
  `connection_test_id` BIGINT UNSIGNED NULL COMMENT '管理员复核连通记录',
  `reviewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '审核完成时间',
  PRIMARY KEY (`id`),
  KEY `idx_review_application_time` (`application_id`, `reviewed_at`),
  KEY `idx_review_reviewer_time` (`reviewer_id`, `reviewed_at`),
  CONSTRAINT `fk_review_application` FOREIGN KEY (`application_id`) REFERENCES `agt_registration_application` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_review_revision` FOREIGN KEY (`revision_id`) REFERENCES `agt_registration_revision` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_review_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `iam_user` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_review_connection_test` FOREIGN KEY (`connection_test_id`) REFERENCES `agt_connection_test` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_review_result` CHECK (`review_result` IN ('APPROVED', 'RETURNED')),
  CONSTRAINT `ck_review_return_comment` CHECK (`review_result` = 'APPROVED' OR CHAR_LENGTH(TRIM(COALESCE(`review_comment`, ''))) > 0)
) ENGINE=InnoDB COMMENT='接入审核结论';

CREATE TABLE IF NOT EXISTS `agt_registration_status_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `application_id` BIGINT UNSIGNED NOT NULL COMMENT '关联接入申请主键',
  `revision_id` BIGINT UNSIGNED NULL COMMENT '关联接入申请修订主键',
  `from_status` VARCHAR(30) NULL COMMENT '变更前状态',
  `to_status` VARCHAR(30) NOT NULL COMMENT '变更后状态',
  `action_type` VARCHAR(30) NOT NULL COMMENT '流转动作：CREATE=创建，SAVE_DRAFT=保存草稿，SUBMIT=提交，START_REVIEW=开始审核，WITHDRAW=撤销，RETURN=退回，RESUBMIT=重新提交，APPROVE=审核通过，SYNC_LEDGER=同步台账',
  `operator_id` BIGINT UNSIGNED NULL COMMENT '系统操作时可空',
  `operator_name_snapshot` VARCHAR(100) NULL COMMENT '状态变更操作人姓名快照',
  `remark` VARCHAR(500) NULL COMMENT '状态流转原因或补充说明',
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '事件发生时间',
  PRIMARY KEY (`id`),
  KEY `idx_registration_history_app_time` (`application_id`, `occurred_at`),
  CONSTRAINT `fk_registration_history_app` FOREIGN KEY (`application_id`) REFERENCES `agt_registration_application` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_registration_history_revision` FOREIGN KEY (`revision_id`) REFERENCES `agt_registration_revision` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_registration_history_operator` FOREIGN KEY (`operator_id`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_registration_history_to_status` CHECK (`to_status` IN ('DRAFT', 'PENDING_REVIEW', 'REVIEWING', 'WITHDRAWN', 'RETURNED', 'APPROVED')),
  CONSTRAINT `ck_registration_history_from_status` CHECK (`from_status` IS NULL OR `from_status` IN ('DRAFT', 'PENDING_REVIEW', 'REVIEWING', 'WITHDRAWN', 'RETURNED', 'APPROVED')),
  CONSTRAINT `ck_registration_history_action` CHECK (`action_type` IN ('CREATE', 'SAVE_DRAFT', 'SUBMIT', 'START_REVIEW', 'WITHDRAW', 'RETURN', 'RESUBMIT', 'APPROVE', 'SYNC_LEDGER'))
) ENGINE=InnoDB COMMENT='接入申请全流程状态轨迹';

CREATE TABLE IF NOT EXISTS `agt_agent_document` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键',
  `file_id` BIGINT UNSIGNED NOT NULL COMMENT '关联文件对象主键',
  `document_type` VARCHAR(30) NOT NULL COMMENT '材料类型：PRODUCT_MANUAL=产品说明书，TECH_SPEC=技术规格书，OTHER=其他材料',
  `source_revision_id` BIGINT UNSIGNED NULL COMMENT '来自哪次审核通过修订',
  `is_current` BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否为智能体当前有效材料',
  `sort_no` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '显示排序号',
  `created_by` BIGINT UNSIGNED NULL COMMENT '维护材料的用户主键',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_document` (`agent_id`, `file_id`),
  KEY `idx_agent_document_current` (`agent_id`, `is_current`, `document_type`, `sort_no`),
  CONSTRAINT `fk_agent_document_agent` FOREIGN KEY (`agent_id`) REFERENCES `agt_agent` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_agent_document_file` FOREIGN KEY (`file_id`) REFERENCES `sys_file_object` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_agent_document_revision` FOREIGN KEY (`source_revision_id`) REFERENCES `agt_registration_revision` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_agent_document_created_by` FOREIGN KEY (`created_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_agent_document_type` CHECK (`document_type` IN ('PRODUCT_MANUAL', 'TECH_SPEC', 'OTHER'))
) ENGINE=InnoDB COMMENT='智能体当前备案材料映射';

-- ==========================================================================
-- 3. 用户中心数据权限（依赖智能体主数据）
-- ==========================================================================

CREATE TABLE IF NOT EXISTS `iam_data_policy` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `policy_code` VARCHAR(64) NOT NULL COMMENT '数据权限策略编码',
  `policy_name` VARCHAR(150) NOT NULL COMMENT '数据权限策略名称',
  `description` VARCHAR(500) NULL COMMENT '数据权限策略说明',
  `department_scope` VARCHAR(20) NOT NULL DEFAULT 'SELF' COMMENT '科室范围：ALL=全部科室，SELF=用户本科室，CUSTOM=指定科室',
  `agent_scope` VARCHAR(30) NOT NULL DEFAULT 'SELF_DEPARTMENT' COMMENT '智能体范围：ALL=全部智能体，SELF_DEPARTMENT=本科室智能体，CUSTOM=指定智能体',
  `status` VARCHAR(20) NOT NULL DEFAULT 'ENABLED' COMMENT '数据权限策略状态：ENABLED=启用，DISABLED=停用',
  `priority_no` INT NOT NULL DEFAULT 100 COMMENT '数值越小优先级越高；用户覆盖高于组织/角色',
  `created_by` BIGINT UNSIGNED NULL COMMENT '创建人用户主键',
  `updated_by` BIGINT UNSIGNED NULL COMMENT '最后更新人用户主键',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '记录最后更新时间',
  `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '逻辑删除标记：0=未删除，1=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_data_policy_code` (`policy_code`),
  KEY `idx_data_policy_status_priority` (`status`, `priority_no`, `is_deleted`),
  CONSTRAINT `fk_data_policy_created_by` FOREIGN KEY (`created_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_data_policy_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_data_policy_department_scope` CHECK (`department_scope` IN ('ALL', 'SELF', 'CUSTOM')),
  CONSTRAINT `ck_data_policy_agent_scope` CHECK (`agent_scope` IN ('ALL', 'SELF_DEPARTMENT', 'CUSTOM')),
  CONSTRAINT `ck_data_policy_status` CHECK (`status` IN ('ENABLED', 'DISABLED'))
) ENGINE=InnoDB COMMENT='数据权限策略';

CREATE TABLE IF NOT EXISTS `iam_role_data_policy` (
  `role_id` BIGINT UNSIGNED NOT NULL COMMENT '关联角色主键',
  `policy_id` BIGINT UNSIGNED NOT NULL COMMENT '关联数据权限策略主键',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  PRIMARY KEY (`role_id`, `policy_id`),
  CONSTRAINT `fk_role_data_policy_role` FOREIGN KEY (`role_id`) REFERENCES `iam_role` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_role_data_policy_policy` FOREIGN KEY (`policy_id`) REFERENCES `iam_data_policy` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB COMMENT='角色数据策略绑定';

CREATE TABLE IF NOT EXISTS `iam_department_data_policy` (
  `department_id` BIGINT UNSIGNED NOT NULL COMMENT '关联科室主键',
  `policy_id` BIGINT UNSIGNED NOT NULL COMMENT '关联数据权限策略主键',
  `is_default_rule` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否全院/组织默认规则',
  `configured` BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否已单独配置：0=沿用全院默认规则，1=使用本科室规则',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  PRIMARY KEY (`department_id`, `policy_id`),
  KEY `idx_department_policy_default` (`is_default_rule`, `configured`),
  CONSTRAINT `fk_department_data_policy_department` FOREIGN KEY (`department_id`) REFERENCES `sys_department` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_department_data_policy_policy` FOREIGN KEY (`policy_id`) REFERENCES `iam_data_policy` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB COMMENT='组织数据策略绑定';

CREATE TABLE IF NOT EXISTS `iam_user_data_policy` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '关联用户主键',
  `policy_id` BIGINT UNSIGNED NOT NULL COMMENT '关联数据权限策略主键',
  `override_reason` VARCHAR(500) NOT NULL COMMENT '用户级权限覆盖原因',
  `expiry_strategy` VARCHAR(30) NOT NULL DEFAULT 'ON_ORG_CHANGE' COMMENT '失效策略：ON_ORG_CHANGE=组织变动时失效，BY_DATE=指定日期到期，PERMANENT=长期有效',
  `expires_at` DATETIME(3) NULL COMMENT '用户级权限覆盖到期时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '记录最后更新时间',
  PRIMARY KEY (`user_id`, `policy_id`),
  KEY `idx_user_data_policy_expiry` (`expiry_strategy`, `expires_at`),
  CONSTRAINT `fk_user_data_policy_user` FOREIGN KEY (`user_id`) REFERENCES `iam_user` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_user_data_policy_policy` FOREIGN KEY (`policy_id`) REFERENCES `iam_data_policy` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_user_data_policy_expiry` CHECK (`expiry_strategy` IN ('ON_ORG_CHANGE', 'BY_DATE', 'PERMANENT'))
) ENGINE=InnoDB COMMENT='用户级数据权限覆盖';

CREATE TABLE IF NOT EXISTS `iam_data_policy_department_scope` (
  `policy_id` BIGINT UNSIGNED NOT NULL COMMENT '关联数据权限策略主键',
  `department_id` BIGINT UNSIGNED NOT NULL COMMENT '关联科室主键',
  PRIMARY KEY (`policy_id`, `department_id`),
  KEY `idx_policy_department_scope_department` (`department_id`, `policy_id`),
  CONSTRAINT `fk_policy_department_scope_policy` FOREIGN KEY (`policy_id`) REFERENCES `iam_data_policy` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_policy_department_scope_department` FOREIGN KEY (`department_id`) REFERENCES `sys_department` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB COMMENT='数据策略指定科室范围';

CREATE TABLE IF NOT EXISTS `iam_data_policy_agent_scope` (
  `policy_id` BIGINT UNSIGNED NOT NULL COMMENT '关联数据权限策略主键',
  `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键',
  PRIMARY KEY (`policy_id`, `agent_id`),
  KEY `idx_policy_agent_scope_agent` (`agent_id`, `policy_id`),
  CONSTRAINT `fk_policy_agent_scope_policy` FOREIGN KEY (`policy_id`) REFERENCES `iam_data_policy` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_policy_agent_scope_agent` FOREIGN KEY (`agent_id`) REFERENCES `agt_agent` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB COMMENT='数据策略指定智能体范围';

CREATE TABLE IF NOT EXISTS `iam_data_policy_classification` (
  `policy_id` BIGINT UNSIGNED NOT NULL COMMENT '关联数据权限策略主键',
  `classification_code` VARCHAR(20) NOT NULL COMMENT '数据分级：GENERAL=一般，IMPORTANT=重要，CORE=核心，SENSITIVE=敏感',
  PRIMARY KEY (`policy_id`, `classification_code`),
  CONSTRAINT `fk_policy_classification_policy` FOREIGN KEY (`policy_id`) REFERENCES `iam_data_policy` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_policy_classification_code` CHECK (`classification_code` IN ('GENERAL', 'IMPORTANT', 'CORE', 'SENSITIVE'))
) ENGINE=InnoDB COMMENT='数据策略可见数据分级';

-- ==========================================================================
-- 4. 智能体统一台账中心
-- ==========================================================================

CREATE TABLE IF NOT EXISTS `led_agent_ledger` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `ledger_no` VARCHAR(50) NOT NULL COMMENT '台账编号',
  `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键，基础信息统一读取智能体主数据表',
  `source_application_id` BIGINT UNSIGNED NOT NULL COMMENT '首次审核通过的接入申请',
  `lifecycle_status` VARCHAR(20) NOT NULL DEFAULT 'TRIAL' COMMENT '生命周期状态：TRIAL=试运行中，ONLINE=已上线，DISABLED=已禁用',
  `runtime_status` VARCHAR(20) NULL COMMENT '运行状态：ONLINE=在线，OFFLINE=离线，UPDATING=更新中，DISABLED=禁用，ABNORMAL=异常',
  `runtime_exception_reason` VARCHAR(500) NULL COMMENT '运行异常原因',
  `risk_level` VARCHAR(20) NOT NULL DEFAULT 'UNASSESSED' COMMENT '风险等级：HIGH=高度关注，MEDIUM=中度关注，GENERAL=一般关注，UNASSESSED=待分级',
  `accessed_at` DATETIME(3) NOT NULL COMMENT '进入台账/开始试运行时间',
  `online_at` DATETIME(3) NULL COMMENT '智能体正式上线时间',
  `trial_expires_at` DATETIME(3) NULL COMMENT '试运行到期时间',
  `disabled_at` DATETIME(3) NULL COMMENT '智能体禁用时间',
  `disabled_by` BIGINT UNSIGNED NULL COMMENT '执行禁用的用户主键',
  `disabled_reason` VARCHAR(200) NULL COMMENT '智能体禁用原因',
  `last_heartbeat_at` DATETIME(3) NULL COMMENT '运行监控最近心跳时间',
  `public_display` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否在官网公开展示',
  `row_version` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '记录最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ledger_no` (`ledger_no`),
  UNIQUE KEY `uk_ledger_agent` (`agent_id`),
  UNIQUE KEY `uk_ledger_source_application` (`source_application_id`),
  KEY `idx_ledger_lifecycle_runtime` (`lifecycle_status`, `runtime_status`),
  KEY `idx_ledger_risk_status` (`risk_level`, `lifecycle_status`),
  KEY `idx_ledger_accessed_at` (`accessed_at`),
  CONSTRAINT `fk_ledger_agent` FOREIGN KEY (`agent_id`) REFERENCES `agt_agent` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_ledger_application` FOREIGN KEY (`source_application_id`) REFERENCES `agt_registration_application` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_ledger_disabled_by` FOREIGN KEY (`disabled_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_ledger_lifecycle` CHECK (`lifecycle_status` IN ('TRIAL', 'ONLINE', 'DISABLED')),
  CONSTRAINT `ck_ledger_runtime` CHECK (`runtime_status` IS NULL OR `runtime_status` IN ('ONLINE', 'OFFLINE', 'UPDATING', 'DISABLED', 'ABNORMAL')),
  CONSTRAINT `ck_ledger_risk` CHECK (`risk_level` IN ('HIGH', 'MEDIUM', 'GENERAL', 'UNASSESSED'))
) ENGINE=InnoDB COMMENT='智能体统一台账管理状态';

CREATE TABLE IF NOT EXISTS `led_agent_version` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键',
  `version_no` VARCHAR(30) NOT NULL COMMENT '版本号',
  `source_revision_id` BIGINT UNSIGNED NULL COMMENT '来源接入申请修订主键',
  `evaluation_report_ref` VARCHAR(100) NULL COMMENT '关联评测报告业务标识',
  `online_at` DATETIME(3) NOT NULL COMMENT '该版本上线时间',
  `offline_at` DATETIME(3) NULL COMMENT '版本下线时间',
  `version_description` VARCHAR(500) NULL COMMENT '版本变更说明',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_version` (`agent_id`, `version_no`),
  KEY `idx_agent_version_online` (`agent_id`, `online_at`),
  CONSTRAINT `fk_agent_version_agent` FOREIGN KEY (`agent_id`) REFERENCES `agt_agent` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_agent_version_revision` FOREIGN KEY (`source_revision_id`) REFERENCES `agt_registration_revision` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB COMMENT='智能体版本历史';

CREATE TABLE IF NOT EXISTS `led_lifecycle_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `ledger_id` BIGINT UNSIGNED NOT NULL COMMENT '关联台账记录主键',
  `event_type` VARCHAR(30) NOT NULL COMMENT '生命周期事件：ENTER_TRIAL=进入试运行，GO_ONLINE=正式上线，DISABLE=禁用，ENABLE=启用，RUNTIME_STATUS_CHANGE=运行状态变更，INFO_CHANGE=基础信息变更',
  `from_status` VARCHAR(30) NULL COMMENT '生命周期变更前状态',
  `to_status` VARCHAR(30) NULL COMMENT '生命周期变更后状态',
  `event_source` VARCHAR(50) NOT NULL COMMENT '事件来源：ACCESS=接入中心，EVALUATION=评测中心，LEDGER=台账中心，MONITORING=运行监控中心，SYSTEM=系统任务',
  `operator_id` BIGINT UNSIGNED NULL COMMENT '操作人用户主键',
  `operator_name_snapshot` VARCHAR(100) NULL COMMENT '生命周期操作人姓名快照',
  `event_detail` VARCHAR(1000) NULL COMMENT '生命周期事件详细说明',
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '事件发生时间',
  PRIMARY KEY (`id`),
  KEY `idx_lifecycle_ledger_time` (`ledger_id`, `occurred_at`),
  KEY `idx_lifecycle_event_type_time` (`event_type`, `occurred_at`),
  CONSTRAINT `fk_lifecycle_ledger` FOREIGN KEY (`ledger_id`) REFERENCES `led_agent_ledger` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_lifecycle_operator` FOREIGN KEY (`operator_id`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_lifecycle_event_type` CHECK (`event_type` IN ('ENTER_TRIAL', 'GO_ONLINE', 'DISABLE', 'ENABLE', 'RUNTIME_STATUS_CHANGE', 'INFO_CHANGE')),
  CONSTRAINT `ck_lifecycle_event_source` CHECK (`event_source` IN ('ACCESS', 'EVALUATION', 'LEDGER', 'MONITORING', 'SYSTEM'))
) ENGINE=InnoDB COMMENT='台账生命周期与状态变更时间线';

CREATE TABLE IF NOT EXISTS `led_risk_question` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `question_code` VARCHAR(20) NOT NULL COMMENT '风险问卷题目编码',
  `question_text` VARCHAR(500) NOT NULL COMMENT '风险问卷题目内容',
  `sort_no` INT UNSIGNED NOT NULL COMMENT '显示排序号',
  `status` VARCHAR(20) NOT NULL DEFAULT 'ENABLED' COMMENT '题目状态：ENABLED=启用，DISABLED=停用',
  `effective_from` DATE NOT NULL COMMENT '题目生效日期',
  `effective_to` DATE NULL COMMENT '题目失效日期',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_risk_question_code` (`question_code`),
  UNIQUE KEY `uk_risk_question_sort` (`sort_no`),
  CONSTRAINT `ck_risk_question_status` CHECK (`status` IN ('ENABLED', 'DISABLED'))
) ENGINE=InnoDB COMMENT='风险分级问卷题目';

CREATE TABLE IF NOT EXISTS `led_risk_option` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `question_id` BIGINT UNSIGNED NOT NULL COMMENT '关联风险问卷题目主键',
  `option_code` CHAR(1) NOT NULL COMMENT '选项编码：A=一般风险倾向，B=中度风险倾向，C=高度风险倾向',
  `option_text` VARCHAR(500) NOT NULL COMMENT '问卷选项内容',
  `risk_weight` TINYINT UNSIGNED NOT NULL COMMENT '风险权重：A选项=1，B选项=2，C选项=3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_risk_option` (`question_id`, `option_code`),
  UNIQUE KEY `uk_risk_option_question_id` (`question_id`, `id`),
  CONSTRAINT `fk_risk_option_question` FOREIGN KEY (`question_id`) REFERENCES `led_risk_question` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_risk_option_code` CHECK (`option_code` IN ('A', 'B', 'C')),
  CONSTRAINT `ck_risk_option_weight` CHECK (`risk_weight` BETWEEN 1 AND 3)
) ENGINE=InnoDB COMMENT='风险分级问卷选项';

CREATE TABLE IF NOT EXISTS `led_risk_assessment` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `assessment_no` VARCHAR(50) NOT NULL COMMENT '风险评定业务编号',
  `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键',
  `risk_level` VARCHAR(20) NOT NULL COMMENT '风险等级：HIGH=高度关注，MEDIUM=中度关注，GENERAL=一般关注',
  `decision_basis` VARCHAR(500) NOT NULL COMMENT '风险等级自动判定依据',
  `is_current` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '当前生效结果',
  `current_agent_id` BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN `is_current` THEN `agent_id` ELSE NULL END) STORED COMMENT '用于唯一约束：每个智能体仅一个当前结果',
  `submitted_by` BIGINT UNSIGNED NOT NULL COMMENT '提交人用户主键',
  `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '提交时间',
  `confirmed_by` BIGINT UNSIGNED NULL COMMENT '二次确认用户主键',
  `confirmed_at` DATETIME(3) NULL COMMENT '二次确认时间，确认后生效',
  `replaced_assessment_id` BIGINT UNSIGNED NULL COMMENT '被本次覆盖的旧评定',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_risk_assessment_no` (`assessment_no`),
  UNIQUE KEY `uk_risk_assessment_current_agent` (`current_agent_id`),
  KEY `idx_risk_assessment_agent_current` (`agent_id`, `is_current`, `confirmed_at`),
  CONSTRAINT `fk_risk_assessment_agent` FOREIGN KEY (`agent_id`) REFERENCES `agt_agent` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_risk_assessment_submitted_by` FOREIGN KEY (`submitted_by`) REFERENCES `iam_user` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_risk_assessment_confirmed_by` FOREIGN KEY (`confirmed_by`) REFERENCES `iam_user` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_risk_assessment_replaced` FOREIGN KEY (`replaced_assessment_id`) REFERENCES `led_risk_assessment` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_risk_assessment_level` CHECK (`risk_level` IN ('HIGH', 'MEDIUM', 'GENERAL'))
) ENGINE=InnoDB COMMENT='智能体风险分级评定';

CREATE TABLE IF NOT EXISTS `led_risk_answer` (
  `assessment_id` BIGINT UNSIGNED NOT NULL COMMENT '关联风险评定主键',
  `question_id` BIGINT UNSIGNED NOT NULL COMMENT '关联风险问卷题目主键',
  `option_id` BIGINT UNSIGNED NOT NULL COMMENT '关联问卷选项主键',
  PRIMARY KEY (`assessment_id`, `question_id`),
  KEY `idx_risk_answer_option` (`option_id`),
  CONSTRAINT `fk_risk_answer_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `led_risk_assessment` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_risk_answer_question` FOREIGN KEY (`question_id`) REFERENCES `led_risk_question` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_risk_answer_question_option` FOREIGN KEY (`question_id`, `option_id`) REFERENCES `led_risk_option` (`question_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB COMMENT='风险分级问卷作答';

CREATE TABLE IF NOT EXISTS `led_resource_link` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键',
  `external_resource_id` VARCHAR(100) NOT NULL COMMENT '医院资源管理中心的资源业务标识',
  `resource_name_snapshot` VARCHAR(200) NOT NULL COMMENT '对接资源名称快照',
  `owner_name_snapshot` VARCHAR(50) NULL COMMENT '资源负责人姓名快照',
  `owner_phone_snapshot` VARCHAR(20) NULL COMMENT '资源负责人联系方式快照',
  `link_type` VARCHAR(30) NOT NULL COMMENT '对接方式：API=应用程序接口，SDK=软件开发工具包，DB_DIRECT=数据库直连，FILE_EXCHANGE=文件交换，OTHER=其他',
  `link_note` VARCHAR(500) NULL COMMENT '资源对接补充说明',
  `link_status` VARCHAR(20) NOT NULL DEFAULT 'NORMAL' COMMENT '对接状态：NORMAL=正常，ABNORMAL=异常，DISCONNECTED=已断开',
  `topology_metadata` JSON NULL COMMENT '画像图层级、节点类型、角度等展示元数据',
  `linked_at` DATETIME(3) NOT NULL COMMENT '资源建立对接时间',
  `unlinked_at` DATETIME(3) NULL COMMENT '资源解除对接时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ledger_resource_link` (`agent_id`, `external_resource_id`),
  KEY `idx_ledger_resource_status` (`agent_id`, `link_status`),
  CONSTRAINT `fk_ledger_resource_agent` FOREIGN KEY (`agent_id`) REFERENCES `agt_agent` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_ledger_resource_link_type` CHECK (`link_type` IN ('API', 'SDK', 'DB_DIRECT', 'FILE_EXCHANGE', 'OTHER')),
  CONSTRAINT `ck_ledger_resource_status` CHECK (`link_status` IN ('NORMAL', 'ABNORMAL', 'DISCONNECTED'))
) ENGINE=InnoDB COMMENT='台账已对接资源引用/快照';

CREATE TABLE IF NOT EXISTS `led_evaluation_ref` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键',
  `agent_version` VARCHAR(30) NOT NULL COMMENT '智能体版本号',
  `external_task_id` VARCHAR(100) NOT NULL COMMENT '评测中心任务业务标识',
  `external_report_id` VARCHAR(100) NOT NULL COMMENT '评测中心报告业务标识',
  `evaluation_type` VARCHAR(20) NOT NULL DEFAULT 'ADMISSION' COMMENT '评测类型：ADMISSION=准入评测，RUNTIME=运行期评测',
  `total_score` DECIMAL(6,2) NOT NULL COMMENT '评测结果总分（0至100）',
  `dimension_scores` JSON NOT NULL COMMENT '能力/安全/伦理/鲁棒性得分与权重',
  `security_scores` JSON NULL COMMENT '输入/输出/行为/数据/工具安全明细',
  `report_url` VARCHAR(1000) NULL COMMENT '评测报告访问地址',
  `is_current` BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否为该智能体当前评测结果',
  `evaluated_at` DATETIME(3) NOT NULL COMMENT '评测完成时间',
  `synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '数据最近同步时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ledger_evaluation_report` (`external_report_id`),
  KEY `idx_ledger_evaluation_agent_time` (`agent_id`, `evaluated_at`),
  CONSTRAINT `fk_ledger_evaluation_agent` FOREIGN KEY (`agent_id`) REFERENCES `agt_agent` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_ledger_evaluation_type` CHECK (`evaluation_type` IN ('ADMISSION', 'RUNTIME')),
  CONSTRAINT `ck_ledger_evaluation_score` CHECK (`total_score` >= 0 AND `total_score` <= 100)
) ENGINE=InnoDB COMMENT='台账评测报告引用及查询快照';

CREATE TABLE IF NOT EXISTS `led_metric_snapshot` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联智能体主键',
  `period_type` VARCHAR(20) NOT NULL COMMENT '统计周期：DAY=日，WEEK=周，MONTH=月，TOTAL=累计',
  `period_start` DATETIME(3) NOT NULL COMMENT '统计周期开始时间',
  `period_end` DATETIME(3) NOT NULL COMMENT '统计周期结束时间',
  `call_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '统计周期内调用次数',
  `alarm_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '统计周期内告警次数',
  `online_instance_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '正常在线实例数量',
  `total_instance_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '运行实例总数',
  `normal_running_rate` DECIMAL(7,4) NULL COMMENT '0~1',
  `synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '数据最近同步时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ledger_metric_period` (`agent_id`, `period_type`, `period_start`, `period_end`),
  KEY `idx_ledger_metric_period_query` (`period_type`, `period_start`, `period_end`),
  CONSTRAINT `fk_ledger_metric_agent` FOREIGN KEY (`agent_id`) REFERENCES `agt_agent` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_ledger_metric_period_type` CHECK (`period_type` IN ('DAY', 'WEEK', 'MONTH', 'TOTAL')),
  CONSTRAINT `ck_ledger_metric_period` CHECK (`period_end` >= `period_start`),
  CONSTRAINT `ck_ledger_metric_rate` CHECK (`normal_running_rate` IS NULL OR (`normal_running_rate` >= 0 AND `normal_running_rate` <= 1)),
  CONSTRAINT `ck_ledger_metric_instances` CHECK (`online_instance_count` <= `total_instance_count`)
) ENGINE=InnoDB COMMENT='台账总览运行指标查询快照（来源运行监控中心）';

-- ==========================================================================
-- 5. 模块联动：事务消息 Outbox
-- ==========================================================================

CREATE TABLE IF NOT EXISTS `integration_outbox_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录主键',
  `event_uuid` CHAR(36) NOT NULL COMMENT '事件全局唯一标识',
  `aggregate_type` VARCHAR(50) NOT NULL COMMENT '聚合类型：USER=用户，REGISTRATION=接入申请，AGENT=智能体，LEDGER=台账，RISK_ASSESSMENT=风险评定',
  `aggregate_id` VARCHAR(100) NOT NULL COMMENT '聚合根业务标识',
  `event_type` VARCHAR(100) NOT NULL COMMENT '业务事件类型，例如REGISTRATION_APPROVED=接入审核通过，AGENT_DISABLED=智能体禁用',
  `payload` JSON NOT NULL COMMENT '待发布事件的结构化载荷，采用JSON格式',
  `event_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '发布状态：PENDING=待发布，PUBLISHING=发布中，PUBLISHED=已发布，FAILED=发布失败，DEAD=停止重试',
  `retry_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '事件发布重试次数',
  `next_retry_at` DATETIME(3) NULL COMMENT '事件下次重试时间',
  `published_at` DATETIME(3) NULL COMMENT '事件成功发布时间',
  `last_error` VARCHAR(1000) NULL COMMENT '最近一次发布失败原因',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_outbox_event_uuid` (`event_uuid`),
  KEY `idx_outbox_dispatch` (`event_status`, `next_retry_at`, `created_at`),
  KEY `idx_outbox_aggregate` (`aggregate_type`, `aggregate_id`, `created_at`),
  CONSTRAINT `ck_outbox_status` CHECK (`event_status` IN ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'DEAD'))
) ENGINE=InnoDB COMMENT='跨模块可靠事件发件箱';

-- ==========================================================================
-- 6. 必要基础数据（幂等初始化）
-- ==========================================================================

INSERT INTO `sys_schema_version` (`version_no`, `script_name`, `description`)
VALUES ('1.0', '医疗智能体管理平台_表结构_V1.0.sql', '用户登录、用户中心、智能体接入中心、统一台账中心首次表结构')
AS `new`
ON DUPLICATE KEY UPDATE
  `script_name` = `new`.`script_name`,
  `description` = `new`.`description`;

INSERT INTO `iam_role` (`role_code`, `role_name`, `description`, `is_system`, `status`)
VALUES
  ('HOSPITAL_LEADER', '医院领导', '拥有全局数据查看权限，通常只读，不参与具体配置与用户管理', 1, 'ENABLED'),
  ('IT_ADMIN', '信息科管理员', '拥有平台全部功能与数据权限，可管理所有模块、用户与权限配置', 1, 'ENABLED'),
  ('DEPT_ADMIN', '科室管理员', '负责本科室智能体的接入申请与日常管理', 1, 'ENABLED'),
  ('NORMAL_USER', '普通用户', '门户自助注册默认角色，可使用已授权智能体并查看个人使用记录', 1, 'ENABLED')
AS `new`
ON DUPLICATE KEY UPDATE
  `role_name` = `new`.`role_name`,
  `description` = `new`.`description`,
  `is_system` = `new`.`is_system`,
  `status` = `new`.`status`;

INSERT INTO `led_risk_question` (`question_code`, `question_text`, `sort_no`, `effective_from`)
VALUES
  ('Q1', '本智能体是否参与临床诊疗决策或治疗过程？', 1, '2026-01-01'),
  ('Q2', '本智能体的核心功能类型是什么？', 2, '2026-01-01'),
  ('Q3', '本智能体提供医疗信息支持的深度如何？', 3, '2026-01-01'),
  ('Q4', '当智能体发生错误时的影响如何？', 4, '2026-01-01'),
  ('Q5', '本智能体应用的医疗场景风险等级如何？', 5, '2026-01-01'),
  ('Q6', '本智能体处理的数据类型是什么？', 6, '2026-01-01'),
  ('Q7', '本智能体对医疗系统或流程的控制能力如何？', 7, '2026-01-01')
AS `new`
ON DUPLICATE KEY UPDATE
  `question_text` = `new`.`question_text`,
  `sort_no` = `new`.`sort_no`;

INSERT INTO `led_risk_option` (`question_id`, `option_code`, `option_text`, `risk_weight`)
SELECT q.id, x.option_code, x.option_text, x.risk_weight
FROM `led_risk_question` q
JOIN (
  SELECT 'Q1' question_code, 'A' option_code, '不参与临床诊疗，仅用于健康信息或流程辅助' option_text, 1 risk_weight
  UNION ALL SELECT 'Q1', 'B', '提供诊疗过程中的重要参考信息或关键技术支持', 2
  UNION ALL SELECT 'Q1', 'C', '参与辅助诊断或治疗，直接影响诊疗决策或治疗路径', 3
  UNION ALL SELECT 'Q2', 'A', '健康科普、导诊或非诊疗支持', 1
  UNION ALL SELECT 'Q2', 'B', '医疗信息处理或辅助分析工具', 2
  UNION ALL SELECT 'Q2', 'C', '临床辅助决策或治疗支持系统', 3
  UNION ALL SELECT 'Q3', 'A', '提供通用健康知识或流程信息', 1
  UNION ALL SELECT 'Q3', 'B', '提供结构化医疗信息支持', 2
  UNION ALL SELECT 'Q3', 'C', '提供影响临床判断的关键医疗信息或分析结果', 3
  UNION ALL SELECT 'Q4', 'A', '无临床影响或仅信息误差', 1
  UNION ALL SELECT 'Q4', 'B', '影响诊疗效率或可能导致延误', 2
  UNION ALL SELECT 'Q4', 'C', '可能导致错误诊疗或严重医疗后果', 3
  UNION ALL SELECT 'Q5', 'A', '非医疗或一般健康管理场景', 1
  UNION ALL SELECT 'Q5', 'B', '常见病或慢性病管理场景', 2
  UNION ALL SELECT 'Q5', 'C', '肿瘤、心脑血管或危重症等高风险医疗场景', 3
  UNION ALL SELECT 'Q6', 'A', '无患者数据，仅公开医学知识', 1
  UNION ALL SELECT 'Q6', 'B', '脱敏或匿名医疗数据', 2
  UNION ALL SELECT 'Q6', 'C', '真实患者医疗数据（病历、影像、检验等）', 3
  UNION ALL SELECT 'Q7', 'A', '独立运行，不对接医疗系统', 1
  UNION ALL SELECT 'Q7', 'B', '在医疗系统中只读或查询', 2
  UNION ALL SELECT 'Q7', 'C', '可写入系统或触发医疗业务、设备执行', 3
) x ON x.question_code = q.question_code
ON DUPLICATE KEY UPDATE
  `option_text` = `x`.`option_text`,
  `risk_weight` = `x`.`risk_weight`;

-- 风险判定规则由服务层按以下优先级执行：任一C=HIGH；否则任一B=MEDIUM；全部A=GENERAL。
-- 建议执行后核验：
-- SELECT version_no, installed_at FROM sys_schema_version ORDER BY installed_at DESC;
-- SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema = DATABASE();
-- SELECT role_code, role_name, status FROM iam_role ORDER BY id;
-- SELECT q.question_code, COUNT(o.id) AS option_count
-- FROM led_risk_question q LEFT JOIN led_risk_option o ON o.question_id = q.id
-- GROUP BY q.id, q.question_code ORDER BY q.sort_no;
