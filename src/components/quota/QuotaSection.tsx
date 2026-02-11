/**
 * Generic quota section component.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuotaStore } from '@/stores';
import { useInterval } from '@/hooks/useInterval';
import type { AuthFileItem } from '@/types';
import type { QuotaStatusState } from './QuotaCard';
import { useQuotaLoader } from './useQuotaLoader';
import type { QuotaConfig } from './quotaConfigs';
import styles from '@/pages/QuotaPage.module.scss';
import { QuotaProgressBar } from './QuotaCard';

type QuotaUpdater<T> = T | ((prev: T) => T);

type QuotaSetter<T> = (updater: QuotaUpdater<T>) => void;

interface QuotaSectionProps<TState extends QuotaStatusState, TData> {
  config: QuotaConfig<TState, TData>;
  files: AuthFileItem[];
  loading: boolean;
  disabled?: boolean;
}

export function QuotaSection<TState extends QuotaStatusState, TData>({
  config,
  files,
  loading
}: QuotaSectionProps<TState, TData>) {
  const { t } = useTranslation();
  const setQuota = useQuotaStore((state) => state[config.storeSetter]) as QuotaSetter<
    Record<string, TState>
  >;

  const [_quotaLoading, setQuotaLoading] = useState(false);

  // Filter files based on config
  const filteredFiles = useMemo(() => files.filter((file) => config.filterFn(file)), [
    files,
    config
  ]);

  const { quota, loadQuota } = useQuotaLoader(config);

  // Helper to update loading state, matching the signature expected by loadQuota
  const handleSetQuotaLoading = useCallback((isLoading: boolean) => {
    setQuotaLoading(isLoading);
  }, []);

  // Compute table columns based on loaded quota
  const columns = useMemo(() => {
    const colMap = new Map<string, { id: string; label: string }>();

    filteredFiles.forEach(file => {
      const q = quota[file.name];
      if (q && config.getQuotaColumns) {
        const cols = config.getQuotaColumns(q, t);
        cols.forEach(col => {
          if (!colMap.has(col.id)) {
            colMap.set(col.id, col);
          }
        });
      }
    });

    return Array.from(colMap.values());
  }, [filteredFiles, quota, config, t]);

  const fetchQuotaData = useCallback(() => {
    if (filteredFiles.length === 0) return;
    loadQuota(filteredFiles, 'all', handleSetQuotaLoading);
  }, [filteredFiles, loadQuota, handleSetQuotaLoading]);

  // Initial load when files are ready (and not loading from parent)
  const prevFilesLoadingRef = useRef(loading);
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    const wasLoading = prevFilesLoadingRef.current;
    prevFilesLoadingRef.current = loading;

    // If parent finished loading files, trigger quota fetch
    if (!loading && wasLoading && filteredFiles.length > 0) {
      fetchQuotaData();
      initialLoadDoneRef.current = true;
    }

    // Also trigger if we have files but haven't loaded quota yet (e.g. initial mount with cached files)
    if (!loading && filteredFiles.length > 0 && !initialLoadDoneRef.current) {
        fetchQuotaData();
        initialLoadDoneRef.current = true;
    }
  }, [loading, filteredFiles.length, fetchQuotaData]);

  // Auto-reload every 60 seconds if page is visible
  useInterval(() => {
    if (document.hidden) return;
    fetchQuotaData();
  }, 60000);

  // Clear quota when files are cleared
  useEffect(() => {
    if (loading) return;
    if (filteredFiles.length === 0) {
      setQuota({});
      return;
    }
    setQuota((prev) => {
      const nextState: Record<string, TState> = {};
      filteredFiles.forEach((file) => {
        const cached = prev[file.name];
        if (cached) {
          nextState[file.name] = cached;
        }
      });
      return nextState;
    });
  }, [filteredFiles, loading, setQuota]);

  useEffect(() => {
     // This effect ensures that if the parent triggers a refresh (files reload),
     // we also reload quota once files are back.
     // Already implemented above.
  }, []);

  const renderHelpers = useMemo(() => ({

    styles,
    QuotaProgressBar
  }), []);

  return (
    <div className={styles.quotaSectionWrapper}>
      {filteredFiles.length > 0 && (
        <>
          <h3 className={styles.sectionTitle}>{t(`${config.i18nPrefix}.title`)}</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.quotaTable}>
              <thead>
                <tr>
                  <th>{'File Name'}</th>
                  {columns.map(col => (
                    <th key={col.id}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((item) => {
                  const itemQuota = quota[item.name];
                  return (
                    <tr key={item.name}>
                      <td>
                        <span className={styles.tableFileName} title={item.name}>
                          {item.name}
                        </span>
                      </td>
                      {columns.map(col => (
                        <td key={col.id}>
                          {itemQuota && config.renderQuotaCell
                            ? config.renderQuotaCell(itemQuota, col.id, t, renderHelpers)
                            : null}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
