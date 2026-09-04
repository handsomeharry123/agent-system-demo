import { useCallback, useEffect, useMemo, useState } from 'react';
import { skills, type SkillItem, type SkillKey } from '../../mock/skills';

type SkillRuntimeState = Record<SkillKey, { installed: boolean; enabled: boolean }>;

const STORAGE_KEY = 'home.skillState.v1';
const STATE_EVENT = 'home-skill-state-change';

const defaultRuntimeState = (): SkillRuntimeState =>
  Object.fromEntries(
    skills.map((skill) => [
      skill.key,
      {
        installed: Boolean(skill.installed),
        enabled: skill.enabled !== false,
      },
    ]),
  ) as SkillRuntimeState;

const readRuntimeState = (): SkillRuntimeState => {
  const defaults = defaultRuntimeState();

  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<Record<SkillKey, Partial<{ installed: boolean; enabled: boolean }>>>;

    return Object.fromEntries(
      skills.map((skill) => {
        const item = saved[skill.key];
        return [
          skill.key,
          {
            installed: typeof item?.installed === 'boolean' ? item.installed : defaults[skill.key].installed,
            enabled: typeof item?.enabled === 'boolean' ? item.enabled : defaults[skill.key].enabled,
          },
        ];
      }),
    ) as SkillRuntimeState;
  } catch {
    return defaults;
  }
};

const writeRuntimeState = (state: SkillRuntimeState) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent<SkillRuntimeState>(STATE_EVENT, { detail: state }));
  });
};

const mergeSkills = (state: SkillRuntimeState): SkillItem[] =>
  skills.map((skill) => ({
    ...skill,
    installed: state[skill.key]?.installed ?? Boolean(skill.installed),
    enabled: state[skill.key]?.enabled ?? skill.enabled !== false,
  }));

export const useSkillState = () => {
  const [runtimeState, setRuntimeState] = useState<SkillRuntimeState>(() => readRuntimeState());

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setRuntimeState(readRuntimeState());
    };
    const handleSkillStateChange = (event: Event) => {
      setRuntimeState((event as CustomEvent<SkillRuntimeState>).detail ?? readRuntimeState());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(STATE_EVENT, handleSkillStateChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(STATE_EVENT, handleSkillStateChange);
    };
  }, []);

  const updateSkill = useCallback((key: SkillKey, patch: Partial<{ installed: boolean; enabled: boolean }>) => {
    setRuntimeState((prev) => {
      const next = {
        ...prev,
        [key]: {
          installed: patch.installed ?? prev[key].installed,
          enabled: patch.enabled ?? prev[key].enabled,
        },
      };
      writeRuntimeState(next);
      return next;
    });
  }, []);

  const allSkills = useMemo(() => mergeSkills(runtimeState), [runtimeState]);
  const installedSkills = useMemo(() => allSkills.filter((skill) => skill.installed), [allSkills]);

  return {
    skills: allSkills,
    installedSkills,
    installSkill: (key: SkillKey) => updateSkill(key, { installed: true, enabled: true }),
    closeSkill: (key: SkillKey) => updateSkill(key, { enabled: false }),
    uninstallSkill: (key: SkillKey) => updateSkill(key, { installed: false, enabled: false }),
    setSkillEnabled: (key: SkillKey, enabled: boolean) => updateSkill(key, { enabled }),
  };
};
