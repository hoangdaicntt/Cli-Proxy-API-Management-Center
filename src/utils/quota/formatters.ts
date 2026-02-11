/**
 * Formatting functions for quota display.
 */

import type { CodexUsageWindow } from '@/types';
import { normalizeNumberValue } from './parsers';

export function formatQuotaResetTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function formatRemainingTime(targetDate?: string | number | Date): string {
  if (!targetDate) return '';
  
  let target: Date;
  if (typeof targetDate === 'string') {
    target = new Date(targetDate);
  } else if (typeof targetDate === 'number') {
    // Check if timestamp is in seconds or milliseconds
    // If less than year 3000 in seconds (32503680000), treat as seconds
    // Otherwise treat as milliseconds
    if (targetDate < 32503680000) {
      target = new Date(targetDate * 1000);
    } else {
      target = new Date(targetDate);
    }
  } else {
    target = targetDate;
  }

  if (Number.isNaN(target.getTime())) return '';

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return '';

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function formatUnixSeconds(value: number | null): string {
  if (!value) return '-';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function formatCodexResetLabel(window?: CodexUsageWindow | null): string {
  if (!window) return '-';
  
  const resetAfter = normalizeNumberValue(window.reset_after_seconds ?? window.resetAfterSeconds);
  if (resetAfter !== null && resetAfter > 0) {
    const targetMs = Date.now() + (resetAfter * 1000);
    return formatRemainingTime(targetMs);
  }

  const resetAt = normalizeNumberValue(window.reset_at ?? window.resetAt);
  if (resetAt !== null && resetAt > 0) {
    // Check if resetAt is in future or past compared to now
    // If it's a huge number, it might be milliseconds already
    // If it's small (seconds), multiply by 1000
    // But formatRemainingTime handles the heuristic for sec/ms
    return formatRemainingTime(resetAt);
  }

  return '-';
}

export function createStatusError(message: string, status?: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  if (status !== undefined) {
    error.status = status;
  }
  return error;
}

export function getStatusFromError(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const rawStatus = (err as { status?: unknown }).status;
    if (typeof rawStatus === 'number' && Number.isFinite(rawStatus)) {
      return rawStatus;
    }
    const asNumber = Number(rawStatus);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber;
    }
  }
  return undefined;
}
