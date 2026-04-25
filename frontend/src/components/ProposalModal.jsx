'use client';
import { useState, useEffect, useCallback } from 'react';
import { fetchProposals } from '@/lib/api';

export default function ProposalModal({ job, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [copied,    setCopied]    = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!job) return;
    setLoading(true);
    fetchProposals(job.id, job.title)
      .then(({ templates }) => {
        setTemplates(templates);
        setSelected(templates[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [job]);

  const handleCopy = useCallback(() => {
    if (!selected?.text) return;
    navigator.clipboard.writeText(selected.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selected]);

  if (!job) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col gap-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-100 text-sm leading-snug line-clamp-2">
              📋 Proposal for: {job.title}
            </h2>
            {job.company && (
              <p className="text-xs text-gray-400 mt-0.5">@ {job.company}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading templates…</p>
        ) : (
          <>
            {/* Template selector */}
            <div className="flex gap-2 flex-wrap">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelected(t); setCopied(false); }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    selected?.id === t.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Proposal text */}
            {selected && (
              <textarea
                className="w-full h-52 bg-gray-800 border border-gray-600 rounded-xl p-3 text-sm text-gray-100 resize-none focus:outline-none focus:border-indigo-500"
                value={selected.text}
                onChange={e => setSelected({ ...selected, text: e.target.value })}
              />
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {copied ? '✓ Copied!' : '📋 Copy Proposal'}
              </button>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-green-600 hover:bg-green-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                🚀 Open Job
              </a>
            </div>

            <p className="text-[10px] text-gray-500 text-center">
              Tip: Customise the proposal above before copying, then paste it into the job application.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
