'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket }      from '@/hooks/useWebSocket';
import { useJobs }           from '@/hooks/useJobs';
import { useNotifications }  from '@/hooks/useNotifications';
import { useApplications }   from '@/hooks/useApplications';
import JobCard               from '@/components/JobCard';
import FilterBar             from '@/components/FilterBar';
import StatsBar              from '@/components/StatsBar';
import ProposalModal         from '@/components/ProposalModal';
import NotificationToast     from '@/components/NotificationToast';
import ApplicationModal      from '@/components/ApplicationModal';
import ApplicationTracker    from '@/components/ApplicationTracker';
import { fetchStats, fetchTopPicks } from '@/lib/api';

const DEFAULT_FILTERS = { sortBy: 'posted_at' };

export default function Dashboard() {
  const [filters,      setFilters]      = useState(DEFAULT_FILTERS);
  const [stats,        setStats]        = useState(null);
  const [lastUpdate,   setLastUpdate]   = useState(null);
  const [toasts,       setToasts]       = useState([]);
  const [proposalJob,  setProposalJob]  = useState(null);
  const [applyTarget,  setApplyTarget]  = useState(null); // job being marked applied
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [topPicks,     setTopPicks]     = useState([]);
  const [activeTab,    setActiveTab]    = useState('all'); // 'all' | 'top' | 'tracker'
  const toastId = useRef(0);

  const { jobs, loading, error, loadJobs, addJobs }  = useJobs();
  const { requestPermission, notify, playAlert }      = useNotifications();
  const {
    applications, stats: appStats, appliedIds,
    apply, update: updateApp, remove: removeApp,
  } = useApplications();

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    loadJobs(DEFAULT_FILTERS);
    fetchStats().then(setStats).catch(() => {});
    fetchTopPicks(120, 20).then(d => setTopPicks(d.jobs || [])).catch(() => {});
  }, [loadJobs]);

  // Refresh job stats every 30 s
  useEffect(() => {
    const t = setInterval(() => {
      fetchStats().then(s => { setStats(s); setLastUpdate(Date.now()); }).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  // ── Toasts ─────────────────────────────────────────────────────────────────
  const pushToast = useCallback((title, body, urgent = false) => {
    const id = ++toastId.current;
    setToasts(prev => [{ id, title, body, urgent }, ...prev].slice(0, 5));
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── WebSocket: handle incoming jobs ───────────────────────────────────────
  const handleNewJobs = useCallback((incoming, count) => {
    addJobs(incoming);
    setLastUpdate(Date.now());

    const fastWins = incoming.filter(j => j.labels?.includes('FAST_WIN'));
    const hot      = incoming.filter(j => j.labels?.includes('HOT'));
    const isUrgent = fastWins.length > 0 || hot.length > 0;

    if (soundEnabled) playAlert(isUrgent ? 'urgent' : 'soft');

    if (fastWins.length) {
      setTopPicks(prev => {
        const merged = [...fastWins, ...prev];
        const seen   = new Set();
        return merged
          .filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; })
          .slice(0, 20);
      });
    }

    if (notifEnabled && isUrgent) {
      const best = fastWins[0] || hot[0];
      notify(
        `🏆 ${count} new job${count > 1 ? 's' : ''} — Win ${best.win_probability}%`,
        best.title,
        best.url
      );
    }

    const best = incoming[0];
    if (best) {
      const label = fastWins.length
        ? `🏆 FAST WIN — ${fastWins.length} top job${fastWins.length > 1 ? 's' : ''}`
        : `⚡ ${count} new job${count > 1 ? 's' : ''}`;
      pushToast(label, best.title, isUrgent);
    }
  }, [addJobs, soundEnabled, notifEnabled, playAlert, notify, pushToast]);

  const { connected } = useWebSocket({
    onNewJobs:     handleNewJobs,
    onConnected:   () => {},
    onDisconnected:() => {},
  });

  // ── Notifications permission ───────────────────────────────────────────────
  const handleEnableNotif = useCallback(async () => {
    const perm = await requestPermission();
    setNotifEnabled(perm === 'granted');
  }, [requestPermission]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const handleApply = useCallback((f) => {
    setFilters(f);
    loadJobs(f);
  }, [loadJobs]);

  // ── Application tracking handlers ──────────────────────────────────────────
  const handleMarkApplied = useCallback((job) => {
    setApplyTarget(job);
  }, []);

  const handleSaveApplication = useCallback(async ({ status, notes, appliedAt }) => {
    if (!applyTarget) return;
    await apply(applyTarget, { status, notes, appliedAt });
    pushToast('📤 Application tracked', applyTarget.title);
    setApplyTarget(null);
  }, [applyTarget, apply, pushToast]);

  // ── Displayed jobs ─────────────────────────────────────────────────────────
  const displayedJobs = activeTab === 'top' ? topPicks : jobs;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
            🎯 <span className="text-indigo-400">Job</span>Sniper
          </h1>
          <span className="text-xs text-gray-500 hidden sm:block">Real-time freelance job radar</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(s => !s)}
              title="Toggle sound alerts"
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                soundEnabled ? 'border-indigo-500 text-indigo-400' : 'border-gray-700 text-gray-500'
              }`}
            >
              {soundEnabled ? '🔔' : '🔕'}
            </button>
            <button
              onClick={notifEnabled ? () => setNotifEnabled(false) : handleEnableNotif}
              title="Toggle browser notifications"
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                notifEnabled ? 'border-green-500 text-green-400' : 'border-gray-700 text-gray-500'
              }`}
            >
              {notifEnabled ? '🟢 Alerts' : '⚪ Alerts'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        <StatsBar stats={stats} connected={connected} lastUpdate={lastUpdate} />

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-700 rounded-xl p-1 w-fit flex-wrap">
          {[
            { key: 'all',     label: '📋 All Jobs' },
            { key: 'top',     label: '🏆 Fast Win Picks' },
            {
              key: 'tracker',
              label: `📤 My Applications${appStats?.total ? ` (${appStats.total})` : ''}`,
            },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Application Tracker tab ──────────────────────────────────────── */}
        {activeTab === 'tracker' && (
          <ApplicationTracker
            applications={applications}
            stats={appStats}
            onUpdate={updateApp}
            onRemove={removeApp}
          />
        )}

        {/* ── Job feed tabs ─────────────────────────────────────────────────── */}
        {activeTab !== 'tracker' && (
          <>
            {activeTab === 'all' && (
              <FilterBar
                filters={filters}
                onChange={setFilters}
                onApply={handleApply}
                jobCount={jobs.length}
              />
            )}

            {/* Win probability banner for top tab */}
            {activeTab === 'top' && (
              <div className="bg-gray-900 border border-indigo-900/60 rounded-xl p-4 text-xs space-y-2">
                <p className="text-indigo-300 font-semibold text-sm">
                  🏆 Auto-ranked by Fastest Win Probability
                </p>
                <p className="text-gray-400">
                  Three signals combine to surface the jobs you're most likely to win fastest.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                  <ScorePill color="blue"   label="Competition  40%" tip="Fewer applicants + freshly posted" />
                  <ScorePill color="yellow" label="Urgency  35%"     tip="Urgent keywords + recency + budget" />
                  <ScorePill color="green"  label="Simplicity  25%"  tip="Micro-task, clear scope, deliverable" />
                </div>
              </div>
            )}

            {loading && (
              <div className="text-center py-16 text-gray-500 animate-pulse">Loading jobs…</div>
            )}
            {error && (
              <div className="text-center py-8 text-red-400 text-sm">
                ⚠️ {error}
                <br />
                <span className="text-gray-500 text-xs">Make sure the Worker is deployed and <code>NEXT_PUBLIC_API_URL</code> is set correctly.</span>
              </div>
            )}
            {!loading && !error && displayedJobs.length === 0 && (
              <div className="text-center py-16 text-gray-500 text-sm">
                No jobs found yet — the Worker cron fetches listings every minute.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  applicationStatus={appliedIds.has(job.id)
                    ? (applications.find(a => a.job_id === job.id)?.status ?? 'applied')
                    : null
                  }
                  onProposal={setProposalJob}
                  onMarkApplied={handleMarkApplied}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {proposalJob && (
        <ProposalModal job={proposalJob} onClose={() => setProposalJob(null)} />
      )}
      {applyTarget && (
        <ApplicationModal
          job={applyTarget}
          existing={applications.find(a => a.job_id === applyTarget.id) || null}
          onSave={handleSaveApplication}
          onClose={() => setApplyTarget(null)}
        />
      )}

      {/* Toasts */}
      <NotificationToast notifications={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function ScorePill({ color, label, tip }) {
  const colors = {
    blue:   'bg-blue-900/40 border-blue-700/40 text-blue-300',
    yellow: 'bg-yellow-900/40 border-yellow-700/40 text-yellow-300',
    green:  'bg-green-900/40 border-green-700/40 text-green-300',
  };
  return (
    <div className={`border rounded-lg p-2 ${colors[color]}`}>
      <p className="font-semibold">{label}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{tip}</p>
    </div>
  );
}


