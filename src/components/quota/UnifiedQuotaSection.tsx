import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useInterval } from '@/hooks/useInterval';
import { useQuotaStore } from '@/stores';
import type {
  AntigravityQuotaState,
  AuthFileItem,
  CodexQuotaState,
  GeminiCliQuotaState,
} from '@/types';
import { normalizePlanType } from '@/utils/quota';
import styles from '@/pages/QuotaPage.module.scss';
import { QuotaProgressBar } from './QuotaCard';
import { useQuotaLoader } from './useQuotaLoader';
import { ANTIGRAVITY_CONFIG, CODEX_CONFIG, GEMINI_CLI_CONFIG } from './quotaConfigs';

type UnifiedQuotaRow = {
  id: string;
  fileName: string;
  cells: ReactNode[];
  planLabel?: string | null;
};

type UnifiedQuotaGroup = {
  id: 'antigravity' | 'codex' | 'gemini-cli';
  label: string;
  columns: { id: string; label: string }[];
  rows: UnifiedQuotaRow[];
};

interface UnifiedQuotaSectionProps {
  files: AuthFileItem[];
  loading: boolean;
}

const getCodexPlanLabel = (
  planType: string | null | undefined,
  t: (key: string) => string
): string | null => {
  const normalized = normalizePlanType(planType);
  if (!normalized) return null;
  if (normalized === 'plus') return t('codex_quota.plan_plus');
  if (normalized === 'team') return t('codex_quota.plan_team');
  if (normalized === 'free') return t('codex_quota.plan_free');
  return planType || normalized;
};

export function UnifiedQuotaSection({ files, loading }: UnifiedQuotaSectionProps) {
  const { t } = useTranslation();
  const setAntigravityQuota = useQuotaStore((state) => state.setAntigravityQuota);
  const setCodexQuota = useQuotaStore((state) => state.setCodexQuota);
  const setGeminiCliQuota = useQuotaStore((state) => state.setGeminiCliQuota);

  const antigravityFiles = useMemo(
    () => files.filter((file) => ANTIGRAVITY_CONFIG.filterFn(file)),
    [files]
  );
  const codexFiles = useMemo(() => files.filter((file) => CODEX_CONFIG.filterFn(file)), [files]);
  const geminiCliFiles = useMemo(
    () => files.filter((file) => GEMINI_CLI_CONFIG.filterFn(file)),
    [files]
  );

  const { quota: antigravityQuota, loadQuota: loadAntigravityQuota } = useQuotaLoader(
    ANTIGRAVITY_CONFIG
  );
  const { quota: codexQuota, loadQuota: loadCodexQuota } = useQuotaLoader(CODEX_CONFIG);
  const { quota: geminiCliQuota, loadQuota: loadGeminiCliQuota } = useQuotaLoader(
    GEMINI_CLI_CONFIG
  );

  const handleSetQuotaLoading = useCallback(() => {}, []);

  const fetchQuotaData = useCallback(() => {
    const tasks: Promise<unknown>[] = [];

    if (antigravityFiles.length > 0) {
      tasks.push(loadAntigravityQuota(antigravityFiles, 'all', handleSetQuotaLoading));
    }
    if (codexFiles.length > 0) {
      tasks.push(loadCodexQuota(codexFiles, 'all', handleSetQuotaLoading));
    }
    if (geminiCliFiles.length > 0) {
      tasks.push(loadGeminiCliQuota(geminiCliFiles, 'all', handleSetQuotaLoading));
    }

    if (tasks.length > 0) {
      void Promise.all(tasks);
    }
  }, [
    antigravityFiles,
    codexFiles,
    geminiCliFiles,
    loadAntigravityQuota,
    loadCodexQuota,
    loadGeminiCliQuota,
    handleSetQuotaLoading,
  ]);

  const hasQuotaFiles =
    antigravityFiles.length > 0 || codexFiles.length > 0 || geminiCliFiles.length > 0;
  const prevFilesLoadingRef = useRef(loading);
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    const wasLoading = prevFilesLoadingRef.current;
    prevFilesLoadingRef.current = loading;

    if (!loading && wasLoading && hasQuotaFiles) {
      fetchQuotaData();
      initialLoadDoneRef.current = true;
    }

    if (!loading && hasQuotaFiles && !initialLoadDoneRef.current) {
      fetchQuotaData();
      initialLoadDoneRef.current = true;
    }
  }, [loading, hasQuotaFiles, fetchQuotaData]);

  useInterval(() => {
    if (document.hidden) return;
    fetchQuotaData();
  }, 60000);

  useEffect(() => {
    if (loading) return;
    if (antigravityFiles.length === 0) {
      setAntigravityQuota({});
      return;
    }

    setAntigravityQuota((prev) => {
      const nextState: Record<string, AntigravityQuotaState> = {};
      antigravityFiles.forEach((file) => {
        const cached = prev[file.name];
        if (cached) {
          nextState[file.name] = cached;
        }
      });
      return nextState;
    });
  }, [antigravityFiles, loading, setAntigravityQuota]);

  useEffect(() => {
    if (loading) return;
    if (codexFiles.length === 0) {
      setCodexQuota({});
      return;
    }

    setCodexQuota((prev) => {
      const nextState: Record<string, CodexQuotaState> = {};
      codexFiles.forEach((file) => {
        const cached = prev[file.name];
        if (cached) {
          nextState[file.name] = cached;
        }
      });
      return nextState;
    });
  }, [codexFiles, loading, setCodexQuota]);

  useEffect(() => {
    if (loading) return;
    if (geminiCliFiles.length === 0) {
      setGeminiCliQuota({});
      return;
    }

    setGeminiCliQuota((prev) => {
      const nextState: Record<string, GeminiCliQuotaState> = {};
      geminiCliFiles.forEach((file) => {
        const cached = prev[file.name];
        if (cached) {
          nextState[file.name] = cached;
        }
      });
      return nextState;
    });
  }, [geminiCliFiles, loading, setGeminiCliQuota]);

  const renderHelpers = useMemo(
    () => ({
      styles,
      QuotaProgressBar,
    }),
    []
  );

  const groups = useMemo<UnifiedQuotaGroup[]>(() => {
    const antigravityColumnMap = new Map<string, { id: string; label: string }>();
    antigravityFiles.forEach((file) => {
      const quota = antigravityQuota[file.name];
      if (!quota) return;
      ANTIGRAVITY_CONFIG.getQuotaColumns(quota, t).forEach((column) => {
        if (!antigravityColumnMap.has(column.id)) {
          antigravityColumnMap.set(column.id, column);
        }
      });
    });
    const antigravityColumns = Array.from(antigravityColumnMap.values()).slice(0, 3);

    const antigravityRows: UnifiedQuotaRow[] = antigravityFiles.map((file) => {
      const quota = antigravityQuota[file.name];
      const cells = antigravityColumns.map((column) =>
        quota ? ANTIGRAVITY_CONFIG.renderQuotaCell(quota, column.id, t, renderHelpers) : null
      );

      return {
        id: `antigravity:${file.name}`,
        fileName: file.name,
        cells,
      };
    });

    const codexColumnMap = new Map<string, { id: string; label: string }>();
    codexFiles.forEach((file) => {
      const quota = codexQuota[file.name];
      if (!quota) return;
      CODEX_CONFIG.getQuotaColumns(quota, t)
        .filter((column) => column.id !== 'plan')
        .forEach((column) => {
          if (!codexColumnMap.has(column.id)) {
            codexColumnMap.set(column.id, column);
          }
        });
    });
    const codexColumns = Array.from(codexColumnMap.values()).slice(0, 3);

    const codexRows: UnifiedQuotaRow[] = codexFiles.map((file) => {
      const quota = codexQuota[file.name];
      const cells = codexColumns.map((column) =>
        quota ? CODEX_CONFIG.renderQuotaCell(quota, column.id, t, renderHelpers) : null
      );

      return {
        id: `codex:${file.name}`,
        fileName: file.name,
        cells,
        planLabel: getCodexPlanLabel(quota?.planType, t),
      };
    });

    const geminiColumnMap = new Map<string, { id: string; label: string }>();
    geminiCliFiles.forEach((file) => {
      const quota = geminiCliQuota[file.name];
      if (!quota) return;
      GEMINI_CLI_CONFIG.getQuotaColumns(quota, t).forEach((column) => {
        if (!geminiColumnMap.has(column.id)) {
          geminiColumnMap.set(column.id, column);
        }
      });
    });
    const geminiColumns = Array.from(geminiColumnMap.values()).slice(0, 3);

    const geminiRows: UnifiedQuotaRow[] = geminiCliFiles.map((file) => {
      const quota = geminiCliQuota[file.name];
      const cells = geminiColumns.map((column) =>
        quota ? GEMINI_CLI_CONFIG.renderQuotaCell(quota, column.id, t, renderHelpers) : null
      );

      return {
        id: `gemini:${file.name}`,
        fileName: file.name,
        cells,
      };
    });

    return [
      {
        id: 'antigravity',
        label: t('antigravity_quota.title'),
        columns: antigravityColumns,
        rows: antigravityRows,
      },
      {
        id: 'codex',
        label: t('codex_quota.title'),
        columns: codexColumns,
        rows: codexRows,
      },
      {
        id: 'gemini-cli',
        label: t('gemini_cli_quota.title'),
        columns: geminiColumns,
        rows: geminiRows,
      },
    ];
  }, [
    antigravityFiles,
    codexFiles,
    geminiCliFiles,
    antigravityQuota,
    codexQuota,
    geminiCliQuota,
    renderHelpers,
    t,
  ]);

  const totalRows = groups.reduce((sum, group) => sum + group.rows.length, 0);
  if (totalRows === 0) {
    return null;
  }

  return (
    <div>
      <table className={styles.quotaTable}>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.id}>
              <tr className={styles.groupDividerRow}>
                <td className={styles.groupDividerCell}>
                  <span className={styles.groupDividerLabel}>{group.label}</span>
                </td>
                {[0, 1, 2].map((columnIndex) => {
                  const column = group.columns[columnIndex];
                  return (
                    <td key={`${group.id}-column-${columnIndex}`} className={styles.groupDividerCell}>
                      <span className={styles.groupColumnLabel}>{column?.label || '-'}</span>
                    </td>
                  );
                })}
              </tr>
              {group.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className={styles.tableFileNameCell}>
                      <span className={styles.tableFileName} title={row.fileName}>
                        {row.fileName}
                      </span>
                      {row.planLabel ? <span className={styles.codexPlanBadge}>{row.planLabel}</span> : null}
                    </div>
                  </td>
                  {[0, 1, 2].map((columnIndex) => {
                    const cell = row.cells[columnIndex];
                    return (
                      <td key={`${row.id}-cell-${columnIndex}`}>
                        {cell ? (
                          <div className={styles.unifiedQuotaCell}>
                            {cell}
                          </div>
                        ) : (
                          <span className={styles.unifiedQuotaEmpty}>-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
