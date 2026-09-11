-- 新建接入页的参数量以十亿（B）为单位，允许录入一位小数。
-- 此变更与前端 InputNumber 的 precision=1 保持一致。
ALTER TABLE `agt_registration_model`
  MODIFY COLUMN `parameter_count` DECIMAL(12,1) UNSIGNED NULL COMMENT '模型参数量（单位：十亿/B）';
