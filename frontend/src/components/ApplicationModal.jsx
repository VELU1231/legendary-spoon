'use client';
import { useState, useEffect } from 'react';

const STATUSES = [
  { value: 'applied',      label: '📤 Applied',      color: 'bg-blue-600' },
  { value: 'interviewing', label: '💬 Interviewing',  color: 'bg-yellow-600' },
  { value: 'offer',        label: '🎉 Offer',         color: 'bg-green-600' },
  { value: 'accepted',     label: '✅ Accepted',      color: 'bg-emerald-700' },
  { value: 'rejected',     label: '❌ Rejected',      color: 'bg-red-700' },
  { value: 'withdrawn',    label: '🚫 Withdrawn',     color: 'bg-gray-600' },
];

export default function ApplicationModal({ job, existing, onSave, onClose }) {
  const [status,    setStatus]    = useState(existing?.status    || 'applied');
  const [notes,     setNotes]     = useState(existing?.notes     || '');
  const [appliedAt, setAppliedAt] = useState(
    existing?.applied_at
      ? new Date(existing.applied_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  // Reset when job changes
  useEffect(() => {
    setStatus(existing?.status    || 'applied');
    setNotes(existing?.notes      || '');
    setAppliedAt(
      existing?.applied_at
        ? new Date(existing.applied_at).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16)
    );
    setError(null);
  }, [job?.id, existing]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ status, notes, appliedAt });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!job) return null;

  const isEditing = !!existing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col gap-4 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-100 text-sm">
              {isEditing ? '✏️ Update Application' : '📤 Mark as Applied'}
            </h2>
            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{job.title}</p>
            {job.company && (
              <p className="text-xs text-gray-500">@ {job.company}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Status selector */}
        <div>
          <label className="text-xs font-semibold text-gray-400 mb-2 block">
            Application Status
          </label>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={`text-xs font-semibold py-2 px-2 rounded-lg border-2 transition-all ${
                  status === s.value
                    ? `${s.color} border-transparent text-white`
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date applied */}
        <div>
          <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
            Date & Time Applied
          </label>
          <input
            type="datetime-local"
            value={appliedAt}
            onChange={e => setAppliedAt(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
            Notes / Status Updates
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Sent proposal at 10am. Client asked for timeline. Follow up on Friday..."
            rows={4}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[10px] text-gray-500 mt-1">{notes.length}/2000 characters</p>
        </div>

        {error && (
          <p className="text-xs text-red-400">⚠️ {error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : isEditing ? '💾 Update' : '📤 Mark Applied'}
          </button>
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
