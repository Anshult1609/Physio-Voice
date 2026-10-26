'use client';

import React, { useState } from 'react';
import { submitPatientFeedback } from '@/lib/supabase';

export default function FeedbackModal({
  patientId,
  treatmentPlanId,
  onClose,
  onSuccess,
}: {
  patientId: string;
  treatmentPlanId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [painRelief, setPainRelief] = useState(80);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitPatientFeedback({
        patientId,
        treatmentPlanId,
        rating,
        comment,
        painReliefPercentage: painRelief,
      });
      alert('Thank you! Feedback submitted successfully.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Feedback submission failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-bold text-slate-900">⭐ Session & Treatment Feedback</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Star Rating (1 to 5) */}
          <div className="text-center">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Overall Treatment Rating (1 - 5 Stars) *
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-3xl focus:outline-none transition-transform hover:scale-110"
                >
                  <span
                    className={
                      (hoverRating || rating) >= star
                        ? 'text-amber-400'
                        : 'text-slate-200'
                    }
                  >
                    ★
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {rating === 5 && 'Outstanding (5/5)'}
              {rating === 4 && 'Very Good (4/5)'}
              {rating === 3 && 'Average (3/5)'}
              {rating === 2 && 'Needs Improvement (2/5)'}
              {rating === 1 && 'Unsatisfactory (1/5)'}
            </p>
          </div>

          {/* Pain Relief Slider */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
              <span>Reported Pain Relief</span>
              <span className="font-bold text-indigo-600">{painRelief}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={painRelief}
              onChange={e => setPainRelief(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Comment Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Comments & Observations
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="e.g. Significant improvement in shoulder rotation; pain level decreased from 8 to 2..."
              className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Save Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
