import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const RoleBasedRedirect = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    // 所有角色登录后统一以首页数据大屏作为默认落地页。
    navigate('/app/home/dashboard', { replace: true });
  }, [currentUser, navigate]);

  return null;
};

export default RoleBasedRedirect;
