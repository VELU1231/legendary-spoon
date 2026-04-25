'use client';
import { useState, useCallback, useEffect } from 'react';
import {
  fetchApplications,
  fetchApplicationStats,
  markApplied,
  updateApplication,
  removeApplication,
} from '@/lib/api';

export function useApplications() {
  const [applications, setApplications] = useState([]);
  const [stats,        setStats]        = useState(null);
  const [appliedIds,   setAppliedIds]   = useState(new Set());
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  // ── Load all applications ──────────────────────────────────────────────────
  const load = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const [{ applications: apps }, appStats] = await Promise.all([
        fetchApplications(filters),
        fetchApplicationStats(),
      ]);
      setApplications(apps);
      setStats(appStats);
      setAppliedIds(new Set(apps.map(a => a.job_id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => { load(); }, [load]);

  // ── Mark applied ───────────────────────────────────────────────────────────
  const apply = useCallback(async (job, { status = 'applied', appliedAt = null, notes = '' } = {}) => {
    const app = await markApplied(job, status, appliedAt, notes);
    setApplications(prev => {
      const without = prev.filter(a => a.job_id !== app.job_id);
      return [app, ...without];
    });
    setAppliedIds(prev => new Set([...prev, app.job_id]));
    // Reload stats from server to stay accurate
    fetchApplicationStats().then(setStats).catch(() => {});
    return app;
  }, []);

  // ── Update an existing application ────────────────────────────────────────
  const update = useCallback(async (jobId, changes) => {
    const updated = await updateApplication(jobId, changes);
    setApplications(prev =>
      prev.map(a => (a.job_id === jobId ? updated : a))
    );
    // Reload stats to stay accurate
    fetchApplicationStats().then(setStats).catch(() => {});
    return updated;
  }, []);

  // ── Remove tracking ────────────────────────────────────────────────────────
  const remove = useCallback(async (jobId) => {
    await removeApplication(jobId);
    setApplications(prev => prev.filter(a => a.job_id !== jobId));
    setAppliedIds(prev => { const s = new Set(prev); s.delete(jobId); return s; });
    fetchApplicationStats().then(setStats).catch(() => {});
  }, []);

  return {
    applications,
    stats,
    appliedIds,
    loading,
    error,
    load,
    apply,
    update,
    remove,
  };
}
