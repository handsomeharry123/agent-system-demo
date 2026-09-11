/**
 * 统一运行监控中心 — V1.8 入口聚合（替换旧 V1.6/V1.7 入口）
 *
 * 模块层级：
 * 1. 监控告警总览
 * 2. 业务监控
 * 3. 状态监控
 * 4. 成本监控
 * 5. 告警规则管理（仅管理员）
 * 6. 告警事件处置
 */
import { Navigate } from 'react-router-dom';

import Overview from './Overview';
import BusinessV18 from './BusinessV18';
import StatusV18 from './StatusV18';
import CostV18 from './CostV18';
import SecurityV21 from './SecurityV21';
import AlertEventListV18 from './AlertEventListV18';
import AlertEventAssign from './AlertEventAssign';
import AlertEventHandle from './AlertEventHandle';
import AlertEventReview from './AlertEventReview';
import AlertEventDetail from './AlertEventDetail';
import RuleManage from './RuleManage';
import RuleForm from './RuleForm';
import RuleDetail from './RuleDetail';

export {
  Overview,
  BusinessV18, StatusV18, CostV18, SecurityV21,
  AlertEventListV18,
  AlertEventAssign, AlertEventHandle, AlertEventReview, AlertEventDetail,
  RuleManage, RuleForm, RuleDetail,
};

export default Overview;
