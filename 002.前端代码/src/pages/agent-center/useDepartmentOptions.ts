import { useEffect, useState } from 'react';
import { agentAccessApi } from '../../services/agentAccess';

export const useDepartmentOptions = () => {
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);
  useEffect(() => {
    let active = true;
    void agentAccessApi.meta().then(({ departments }) => {
      if (active) setOptions(departments.map(({ label }) => ({ label, value: label })));
    }).catch(() => { if (active) setOptions([]); });
    return () => { active = false; };
  }, []);
  return options;
};
