'use client';
import { useState, useCallback, useRef } from 'react';
import { fetchJobs } from '@/lib/api';

const MAX_JOBS = 500;

export function useJobs() {
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const seenIds = useRef(new Set());

  // Deduplicate and prepend new jobs; keep list trimmed to MAX_JOBS
  const addJobs = useCallback((incoming) => {
    const fresh = incoming.filter(j => !seenIds.current.has(j.id));
    if (!fresh.length) return;
    fresh.forEach(j => seenIds.current.add(j.id));
    setJobs(prev => {
      const merged = [...fresh, ...prev];
      return merged.slice(0, MAX_JOBS);
    });
  }, []);

  const loadJobs = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const { jobs: fetched } = await fetchJobs(filters);
      // On full reload, reset seen-id set and replace list
      seenIds.current = new Set(fetched.map(j => j.id));
      setJobs(fetched);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { jobs, loading, error, loadJobs, addJobs };
}
