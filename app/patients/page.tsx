'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Search, 
  UserPlus, 
  Phone, 
  Calendar, 
  ChevronRight, 
  Activity, 
  AlertTriangle, 
  Mic, 
  DollarSign, 
  HeartPulse, 
  Send, 
  Plus,
  Layers,
  X
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { generateWhatsAppReminderUrl, generatePackageUpdateUrl } from '@/lib/whatsapp/generator';

function PatientsDirectoryContent() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') === 'LOW_BALANCE' ? 'LOW_BALANCE' : 'ALL';

  const { patients, setIsVoiceModalOpen, therapist } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'LOW_BALANCE' | 'ACTIVE'>(initialFilter);

  // Sync filter if URL changes
  useEffect(() => {
    if (searchParams.get('filter') === 'LOW_BALANCE') {
      setSelectedFilter('LOW_BALANCE');
    }
  }, [searchParams]);

  // Robust multi-field search: Full Name, Phone, Patient Code (PV-26-XXXX), Body Part, or Episode Title
  const filteredPatients = patients.filter((patient) => {
    const query = searchQuery.toLowerCase().trim();
    const activeEp = patient.episodes[0];

    const matchesSearch =
      !query ||
      patient.full_name.toLowerCase().includes(query) ||
      patient.phone.includes(query) ||
      patient.patient_code.toLowerCase().includes(query) ||
      patient.episodes.some(
        (ep) =>
          ep.title.toLowerCase().includes(query) ||
          ep.affected_body_part.toLowerCase().includes(query) ||
          ep.chief_complaint.toLowerCase().includes(query)
      );

    if (!matchesSearch) return false;

    if (selectedFilter === 'LOW_BALANCE') {
      return activeEp && activeEp.remaining_sessions <= 2 && activeEp.status === 'ACTIVE';
    }

    if (selectedFilter === 'ACTIVE') {
      return activeEp && activeEp.status === 'ACTIVE';
    }

    return true;
  });

  const lowCount = patients.filter((p) => {
    const ep = p.episodes[0];
    return ep && ep.remaining_sessions <= 2 && ep.status === 'ACTIVE';
  }).length;

  const handlePackageWhatsApp = (e: React.MouseEvent, patient: typeof patients[0]) => {
    e.preventDefault();
    e.stopPropagation();
    const ep = patient.episodes[0];
    if (!ep) return;

    const url = generatePackageUpdateUrl({
      patientName: patient.full_name,
      patientPhone: patient.phone,
      clinicName: therapist.clinic_name,
      episodeTitle: ep.title,
      attendedSessions: ep.attended_sessions,
      remainingSessions: ep.remaining_sessions,
    });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Patients Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage treatment records, track session attendance, and view clinical history
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm active:scale-95 transition-all"
          >
            <Mic className="w-3.5 h-3.5 text-teal-600" />
            <span>Voice Intake</span>
          </button>

          <Link
            href="/patients/register"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/20 active:scale-95 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Register Patient</span>
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          
          {/* Multi-Field Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, 10-digit mobile, or Patient Code (e.g. PV-26-1001)..."
              className="w-full pl-10 pr-10 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 self-end sm:self-center overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedFilter === 'ALL'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({patients.length})
            </button>
            
            <button
              onClick={() => setSelectedFilter('LOW_BALANCE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedFilter === 'LOW_BALANCE'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Low Sessions ({lowCount})</span>
            </button>

            <button
              onClick={() => setSelectedFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedFilter === 'ACTIVE'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Active
            </button>
          </div>

        </div>

        {/* Results summary counter */}
        {searchQuery && (
          <div className="text-xs text-slate-500 px-1 flex items-center justify-between">
            <span>
              Showing <strong>{filteredPatients.length}</strong> of <strong>{patients.length}</strong> patients matching &ldquo;{searchQuery}&rdquo;
            </span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-teal-600 hover:underline font-bold"
            >
              Clear search
            </button>
          </div>
        )}
      </div>

      {/* Patient Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPatients.length === 0 ? (
          <div className="md:col-span-2 text-center py-12 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
            <Search className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">No matching patients found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No patient records matched &ldquo;{searchQuery}&rdquo;. Try another keyword, check for typos in the phone number, or register a new patient.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
                >
                  Clear Search
                </button>
              )}
              <Link
                href="/patients/register"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Patient</span>
              </Link>
            </div>
          </div>
        ) : (
          filteredPatients.map((patient) => {
            const ep = patient.episodes[0];
            const isLow = ep && ep.remaining_sessions <= 2 && ep.status === 'ACTIVE';
            const progressPercent = ep && ep.total_package_sessions > 0 
              ? (ep.attended_sessions / ep.total_package_sessions) * 100 
              : 0;

            return (
              <Link
                key={patient.id}
                href={`/patients/${patient.id}`}
                className="group bg-white p-5 rounded-3xl border border-slate-200 hover:border-teal-400 hover:shadow-lg transition-all space-y-4 block"
              >
                {/* Header: Name, Code & Phone */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-base text-slate-900 group-hover:text-teal-600 transition-colors">
                        {patient.full_name}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {patient.patient_code}
                      </span>
                      {patient.episodes.length > 1 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>{patient.episodes.length} Episodes</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                      <span>{patient.age ? `${patient.age} yrs` : 'Age N/A'}, {patient.gender.toLowerCase()}</span>
                      <span>•</span>
                      <span>{patient.occupation || 'Consultation'}</span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 shrink-0">
                    <Phone className="w-3 h-3 text-teal-600" />
                    +91 {patient.phone}
                  </span>
                </div>

                {/* Active Episode Details */}
                {ep && (
                  <div className={`p-4 rounded-2xl border space-y-2.5 ${
                    isLow 
                      ? 'bg-amber-50/70 border-amber-200' 
                      : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                        <Activity className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">{ep.title}</span>
                      </span>
                      
                      <span className={`font-extrabold px-2 py-0.5 rounded-full text-[10px] shrink-0 ${
                        isLow 
                          ? 'bg-amber-200 text-amber-900 animate-pulse' 
                          : 'bg-teal-100 text-teal-800'
                      }`}>
                        {ep.remaining_sessions} sessions left
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isLow ? 'bg-amber-500' : 'bg-teal-600'
                          }`}
                          style={{ width: `${Math.min(100, progressPercent)}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>Attended: <strong className="text-slate-800">{ep.attended_sessions}</strong> of {ep.total_package_sessions}</span>
                        <span>{Math.round(progressPercent)}% completed</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comorbidities / Medical Alert Badges */}
                {patient.comorbidities && patient.comorbidities.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {patient.comorbidities.map((item, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200"
                      >
                        ⚠️ {item}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer with Quick WhatsApp action */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  {isLow ? (
                    <button
                      type="button"
                      onClick={(e) => handlePackageWhatsApp(e, patient)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100/60 px-2 py-1 rounded-lg"
                    >
                      <Send className="w-3 h-3 text-amber-700" />
                      <span>WhatsApp Package Notice</span>
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[11px]">
                      {ep?.sessions.length ? `${ep.sessions.length} logged sessions` : 'Intake active'}
                    </span>
                  )}

                  <span className="text-teal-600 font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                    <span>Clinical Profile</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

    </div>
  );
}

export default function PatientsDirectoryPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-xs text-slate-500 font-semibold">Loading patients directory...</p>
      </div>
    }>
      <PatientsDirectoryContent />
    </Suspense>
  );
}
