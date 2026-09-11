import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router';
import BasicLayout from './layouts/BasicLayout';
import Login from './pages/portal/Login';
import HomePage from './pages/home';
import AutoTaskForm from './pages/home/AutoTaskForm';
import AutoTaskTemplateList from './pages/home/AutoTaskTemplateList';

/** 独立版仅保留登录与医小知工作台，旧官网和平台管理页面不再暴露。 */
const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <Login /> },
  {
    path: '/app',
    element: <BasicLayout />,
    children: [
      { index: true, element: <Navigate to="/app/home/overview" replace /> },
      {
        path: 'home',
        children: [
          { index: true, element: <Navigate to="/app/home/overview" replace /> },
          { path: 'overview', element: <HomePage /> },
          { path: 'connector', element: <HomePage /> },
          { path: 'skill', element: <HomePage /> },
          { path: 'skill/manage', element: <HomePage /> },
          { path: 'auto-tasks', element: <HomePage /> },
          { path: 'auto-tasks/templates', element: <AutoTaskTemplateList /> },
          { path: 'auto-tasks/new', element: <AutoTaskForm /> },
          { path: '*', element: <Navigate to="/app/home/overview" replace /> },
        ],
      },
      { path: '*', element: <Navigate to="/app/home/overview" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
];

export default createBrowserRouter(routes);
