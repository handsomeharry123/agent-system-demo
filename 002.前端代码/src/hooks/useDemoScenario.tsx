import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import {
  generateMonitoringData,
  generateAlerts,
  generateSecurityRisks,
  generateLedgerRecords,
  generateEvaluationRecords,
  generateFlows,
  starAgents,
} from '../mock';

export type DemoScenario = 'normal' | 'alert';

interface DemoScenarioContextValue {
  scenario: DemoScenario;
  switchScenario: (scenario: DemoScenario) => void;
  getMonitoringData: () => ReturnType<typeof generateMonitoringData>;
  getAlerts: () => ReturnType<typeof generateAlerts>;
  getSecurityRisks: () => ReturnType<typeof generateSecurityRisks>;
  getLedgerRecords: () => ReturnType<typeof generateLedgerRecords>;
  getEvaluationRecords: () => ReturnType<typeof generateEvaluationRecords>;
  getFlows: () => ReturnType<typeof generateFlows>;
}

const DemoScenarioContext = createContext<DemoScenarioContextValue | null>(null);

export const DemoScenarioProvider = ({ children }: { children: ReactNode }) => {
  const [scenario, setScenario] = useState<DemoScenario>('normal');

  const switchScenario = useCallback((newScenario: DemoScenario) => {
    setScenario(newScenario);
  }, []);

  const getMonitoringData = useCallback(() => {
    return generateMonitoringData(scenario);
  }, [scenario]);

  const getAlerts = useCallback(() => {
    return generateAlerts(scenario);
  }, [scenario]);

  const getSecurityRisks = useCallback(() => {
    return generateSecurityRisks(scenario);
  }, [scenario]);

  const getLedgerRecords = useCallback(() => {
    return generateLedgerRecords();
  }, [scenario]);

  const getEvaluationRecords = useCallback(() => {
    return generateEvaluationRecords();
  }, [scenario]);

  const getFlows = useCallback(() => {
    return generateFlows();
  }, [scenario]);

  useEffect(() => {
    if (scenario === 'alert') {
      console.warn('[Demo] 异常告警态已激活 - 2个异常智能体、5条未处理告警、安全风险');
    }
  }, [scenario]);

  return (
    <DemoScenarioContext.Provider
      value={{
        scenario,
        switchScenario,
        getMonitoringData,
        getAlerts,
        getSecurityRisks,
        getLedgerRecords,
        getEvaluationRecords,
        getFlows,
      }}
    >
      {children}
    </DemoScenarioContext.Provider>
  );
};

export const useDemoScenario = (): DemoScenarioContextValue => {
  const context = useContext(DemoScenarioContext);
  if (!context) {
    throw new Error('useDemoScenario must be used within a DemoScenarioProvider');
  }
  return context;
};

export { starAgents };
