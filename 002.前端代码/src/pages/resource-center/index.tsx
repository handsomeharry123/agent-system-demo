/**
 * 医院资源管理中心 - 一级模块入口
 * 默认跳转到「申请管理页(2.1)」
 *
 * 选择「申请管理」作为默认落地的理由：
 *  1. 资源管理（1.1）已收紧为仅信息科管理员可见；为避免科室管理员
 *     点开父菜单时出现「闪一下资源管理 → 跳回工作台」的一帧抖动，
 *     父路径直接落到对两类角色都开放的申请管理。
 *  2. 信息科管理员如需进入资源管理，可点侧边栏「资源管理」菜单。
 */
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

const ResourceCenter = () => <Navigate to="/app/resource-center/applies" replace />;

export default ResourceCenter;
