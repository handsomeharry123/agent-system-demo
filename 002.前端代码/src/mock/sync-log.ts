import type { SyncLogEntry, SyncStatus } from '../types/user';

/** 上次同步概要：用于页面顶部状态条 */
export const lastSync = {
  syncAt: '2026-06-09 02:00:00',
  result: 'success' as SyncStatus,
  added: 0,
  updated: 3,
  disabled: 1,
};

/** 员工同步历史日志 */
export const mockSyncLog: SyncLogEntry[] = [
  {
    id: 'log-2026060902',
    syncAt: '2026-06-09 02:00:00',
    result: 'success',
    added: 0,
    updated: 3,
    disabled: 1,
    message: '定时同步完成：停用 EMP015（信息中心·高峰）',
  },
  {
    id: 'log-2026060802',
    syncAt: '2026-06-08 02:00:00',
    result: 'success',
    added: 1,
    updated: 5,
    disabled: 0,
    message: '定时同步完成：新增 EMP017（心内科·冯丽华），转岗更新 5 人',
  },
  {
    id: 'log-2026060702',
    syncAt: '2026-06-07 02:00:00',
    result: 'partial',
    added: 0,
    updated: 0,
    disabled: 0,
    message: '部分失败：医院组织系统返回超时，仅获取元数据',
  },
  {
    id: 'log-2026060602',
    syncAt: '2026-06-06 02:00:00',
    result: 'success',
    added: 0,
    updated: 2,
    disabled: 0,
    message: '定时同步完成：更新 2 名用户的手机号',
  },
  {
    id: 'log-2026060502',
    syncAt: '2026-06-05 02:00:00',
    result: 'success',
    added: 0,
    updated: 0,
    disabled: 0,
    message: '定时同步完成：无变更',
  },
  {
    id: 'log-2026060402',
    syncAt: '2026-06-04 02:00:00',
    result: 'failed',
    added: 0,
    updated: 0,
    disabled: 0,
    message: '同步失败：医院员工系统 HTTP 500，请联系医院信息科',
  },
];
