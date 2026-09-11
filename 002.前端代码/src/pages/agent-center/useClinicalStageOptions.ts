import { useEffect, useState } from 'react';
import { agentAccessApi } from '../../services/agentAccess';

export const useClinicalStageOptions = () => {
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    let active = true;
    void agentAccessApi.meta()
      .then(({ clinicalStages }) => {
        if (active) {
          setOptions(clinicalStages.map(({ label }) => ({ label, value: label })));
        }
      })
      .catch(() => {
        if (active) setOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return options;
};
