/**
 * PlatformSentinel — Self-healing & auto-immunity monitoring layer
 * Writes anomaly reports and pulse checks to `system_health_logs` in Supabase.
 */

import { createClient } from '@/lib/supabase/client';

export type AnomalySeverity = 'info' | 'warning' | 'error' | 'critical';
export type LogCategory = 'route' | 'api' | 'database' | 'auth' | 'payment' | 'realtime' | 'system' | 'pulse';

export interface SystemHealthLog {
  id?: string;
  category: LogCategory;
  severity: AnomalySeverity;
  source: string;
  message: string;
  details?: Record<string, unknown>;
  resolved: boolean;
  created_at?: string;
}

export interface PulseResult {
  status: 'healthy' | 'degraded' | 'down';
  latency_ms: number;
  checked_at: string;
  details?: string;
}

class PlatformSentinelService {
  /**
   * Report an anomaly / error to system_health_logs.
   * Safe to call from any client or server context — never throws.
   */
  async reportAnomaly(
    source: string,
    message: string,
    options: {
      severity?: AnomalySeverity;
      category?: LogCategory;
      details?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    try {
      const supabase = createClient();
      const { severity = 'error', category = 'system', details } = options;

      const { error } = await supabase.from('system_health_logs').insert({
        category,
        severity,
        source,
        message,
        details: details ?? null,
        resolved: false,
      });

      if (error) {
        // Silently log to console — never throw from sentinel
        console.warn('[PlatformSentinel] Failed to write anomaly log:', error.message);
      }
    } catch (err) {
      console.warn('[PlatformSentinel] reportAnomaly exception:', err);
    }
  }

  /**
   * Perform a pulse check against a URL and log the result.
   * Returns the pulse result regardless of whether the DB write succeeds.
   */
  async pulseCheck(
    source: string,
    url: string,
    options: {
      category?: LogCategory;
      timeoutMs?: number;
    } = {}
  ): Promise<PulseResult> {
    const { category = 'system', timeoutMs = 8000 } = options;
    const start = Date.now();
    let result: PulseResult;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      const latency_ms = Date.now() - start;
      const checked_at = new Date().toISOString();

      if (res.ok || res.status === 307 || res.status === 308 || res.status === 401 || res.status === 403) {
        result = { status: 'healthy', latency_ms, checked_at, details: `HTTP ${res.status}` };
      } else if (res.status >= 500) {
        result = { status: 'down', latency_ms, checked_at, details: `HTTP ${res.status} — Server Error` };
      } else {
        result = { status: 'degraded', latency_ms, checked_at, details: `HTTP ${res.status}` };
      }
    } catch (err: unknown) {
      const latency_ms = Date.now() - start;
      const checked_at = new Date().toISOString();
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      result = {
        status: 'down',
        latency_ms,
        checked_at,
        details: isTimeout ? `Timeout (>${timeoutMs}ms)` : (err instanceof Error ? err.message : 'Network error'),
      };
    }

    // Persist pulse result to system_health_logs
    try {
      const supabase = createClient();
      const severity: AnomalySeverity =
        result.status === 'healthy' ? 'info' :
        result.status === 'degraded' ? 'warning' : 'error';

      await supabase.from('system_health_logs').insert({
        category,
        severity,
        source,
        message: `Pulse check: ${result.status} — ${url}`,
        details: {
          url,
          status: result.status,
          latency_ms: result.latency_ms,
          http_details: result.details,
        },
        resolved: result.status === 'healthy',
      });
    } catch (dbErr) {
      console.warn('[PlatformSentinel] pulseCheck DB write failed:', dbErr);
    }

    return result;
  }

  /**
   * Mark a log entry as resolved.
   */
  async resolveLog(logId: string): Promise<void> {
    try {
      const supabase = createClient();
      await supabase
        .from('system_health_logs')
        .update({ resolved: true })
        .eq('id', logId);
    } catch (err) {
      console.warn('[PlatformSentinel] resolveLog failed:', err);
    }
  }

  /**
   * Fetch recent logs for the SystemHealthPanel.
   */
  async fetchRecentLogs(limit = 50): Promise<SystemHealthLog[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('system_health_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[PlatformSentinel] fetchRecentLogs error:', error.message);
        return [];
      }
      return (data ?? []) as SystemHealthLog[];
    } catch (err) {
      console.warn('[PlatformSentinel] fetchRecentLogs exception:', err);
      return [];
    }
  }
}

export const PlatformSentinel = new PlatformSentinelService();
