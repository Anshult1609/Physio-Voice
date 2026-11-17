'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Send, 
  ShieldCheck, 
  X, 
  ExternalLink,
  MessageSquare,
  Smartphone,
  Info,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { ReminderChannel, ReminderStatus } from '@/types/reminders';

export interface UIInAppNotification {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_code: string;
  appointment_id?: string | null;
  channel: ReminderChannel;
  scheduled_for: string;
  message_payload: string;
  status: ReminderStatus;
  delivery_confirmed: boolean;
  is_read: boolean;
  created_at: string;
}

export function NotificationPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'IN_APP' | 'EXTERNAL' | 'LOGS'>('IN_APP');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Initial standard notifications for immediate clinical feedback
  const [notifications, setNotifications] = useState<UIInAppNotification[]>([
    {
      id: 'notif-1',
      patient_id: 'p-1',
      patient_name: 'Sunita Sharma',
      patient_code: 'PV-26-1001',
      appointment_id: 'apt-1',
      channel: 'IN_APP',
      scheduled_for: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      message_payload: 'Upcoming session: TKA Right knee rehab at 10:30 AM IST. Patellar mobilization & quadriceps review.',
      status: 'DELIVERED',
      delivery_confirmed: true,
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'notif-2',
      patient_id: 'p-2',
      patient_name: 'Rajesh Verma',
      patient_code: 'PV-26-1002',
      appointment_id: 'apt-2',
      channel: 'IN_APP',
      scheduled_for: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      message_payload: 'Upcoming session: L4-L5 Lumbar Radiculopathy core stabilization at 11:30 AM IST.',
      status: 'DELIVERED',
      delivery_confirmed: true,
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'notif-3',
      patient_id: 'p-3',
      patient_name: 'Pooja Iyer',
      patient_code: 'PV-26-1003',
      appointment_id: 'apt-3',
      channel: 'WHATSAPP',
      scheduled_for: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      message_payload: 'Automated WhatsApp reminder queued for Cervical Spondylosis traction review.',
      status: 'PENDING_CONFIRMATION',
      delivery_confirmed: false,
      is_read: false,
      created_at: new Date().toISOString(),
    },
  ]);

  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch reminders and logs from backend on popover open
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      fetchLogs();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/reminders?type=ALL');
      if (res.ok) {
        const data = await res.json();
        if (data.reminders && data.reminders.length > 0) {
          const mapped: UIInAppNotification[] = data.reminders.map((r: any) => ({
            id: r.id,
            patient_id: r.patient_id,
            patient_name: r.patients?.full_name || 'Patient',
            patient_code: r.patients?.patient_code || 'PV-26-XXXX',
            appointment_id: r.appointment_id,
            channel: r.channel || 'IN_APP',
            scheduled_for: r.scheduled_for,
            message_payload: r.message_payload || 'Appointment reminder',
            status: r.status,
            delivery_confirmed: r.status === 'DELIVERED',
            is_read: r.is_read || false,
            created_at: r.created_at,
          }));
          setNotifications(mapped);
        }
      }
    } catch (err) {
      console.warn('Using local in-app notifications fallback:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/reminders/logs?limit=15');
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setDeliveryLogs(data.logs);
        }
      }
    } catch (err) {
      console.warn('Failed to load delivery logs:', err);
    }
  };

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId: id, isRead: true }),
      });
    } catch (err) {}
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true }),
      });
    } catch (err) {}
  };

  const triggerProcessDueReminders = async () => {
    setIsProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch('/api/reminders/process', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setProcessResult(`Processed ${data.processedCount || 0} due reminder(s) successfully.`);
        fetchNotifications();
        fetchLogs();
      } else {
        setProcessResult(`Error: ${data.error || 'Failed to process reminders'}`);
      }
    } catch (err: any) {
      setProcessResult(`Error processing: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'IN_APP') return n.channel === 'IN_APP';
    if (activeTab === 'EXTERNAL') return n.channel === 'WHATSAPP' || n.channel === 'SMS';
    return true;
  });

  const formatIST = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        day: 'numeric',
        month: 'short',
      }) + ' IST';
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="In-App Reminders and Notification Center"
        aria-expanded={isOpen}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        title="In-App Reminders & Delivery Center"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 mt-3 sm:w-[440px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="bg-slate-900 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">Reminders & Notifications</h3>
                  <p className="text-[11px] text-slate-400">Clinic Timezone: Asia/Kolkata (IST)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close notification panel"
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800 text-xs">
              <button
                onClick={triggerProcessDueReminders}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-semibold transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>{isProcessing ? 'Processing...' : 'Process Due Reminders'}</span>
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-slate-300 hover:text-teal-300 text-[11px] font-medium transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {processResult && (
              <div className="mt-2 text-[11px] bg-slate-800 text-teal-300 p-2 rounded-lg border border-teal-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{processResult}</span>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab('IN_APP')}
              className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'IN_APP'
                  ? 'border-teal-600 text-teal-700 bg-white font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>In-App Alerts</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-800">
                {notifications.filter((n) => n.channel === 'IN_APP').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('EXTERNAL')}
              className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'EXTERNAL'
                  ? 'border-teal-600 text-teal-700 bg-white font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp / SMS</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                {notifications.filter((n) => n.channel !== 'IN_APP').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('LOGS')}
              className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'LOGS'
                  ? 'border-teal-600 text-teal-700 bg-white font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Delivery Logs</span>
            </button>
          </div>

          {/* Notification List Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-2">
            {activeTab !== 'LOGS' ? (
              filteredNotifications.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <CheckCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No {activeTab === 'IN_APP' ? 'in-app alerts' : 'external messages'} pending.
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-xl transition-all mb-1 ${
                      notif.is_read ? 'bg-white opacity-85' : 'bg-teal-50/50 border border-teal-100/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            {notif.patient_name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {notif.patient_code}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                          {notif.message_payload}
                        </p>

                        <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
                          {/* Channel Badge */}
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                            {notif.channel === 'IN_APP' && <Info className="w-3 h-3 text-teal-600" />}
                            {notif.channel === 'WHATSAPP' && <MessageSquare className="w-3 h-3 text-emerald-600" />}
                            {notif.channel === 'SMS' && <Smartphone className="w-3 h-3 text-blue-600" />}
                            <span>{notif.channel}</span>
                          </span>

                          <span className="text-slate-300">•</span>

                          {/* Trigger Time */}
                          <span className="text-slate-500 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatIST(notif.scheduled_for)}
                          </span>

                          <span className="text-slate-300">•</span>

                          {/* Delivery Status Badge */}
                          {notif.status === 'DELIVERED' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Check className="w-3 h-3" />
                              DELIVERED (In-App)
                            </span>
                          ) : notif.status === 'PENDING' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Clock className="w-3 h-3" />
                              SCHEDULED (Pending)
                            </span>
                          ) : notif.status === 'PENDING_CONFIRMATION' ? (
                            <span 
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200"
                              title="External message delivery unconfirmed: Requires verified API credentials before claiming sent."
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              PENDING_CONFIRMATION (Unverified)
                            </span>
                          ) : notif.status === 'CANCELLED' ? (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              CANCELLED
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              {notif.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Read status action */}
                      {!notif.is_read && (
                        <button
                          type="button"
                          onClick={() => markAsRead(notif.id)}
                          className="text-slate-400 hover:text-teal-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )
            ) : (
              /* Delivery Logs View */
              <div className="space-y-2">
                {deliveryLogs.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No delivery audit logs recorded yet.
                  </div>
                ) : (
                  deliveryLogs.map((log) => (
                    <div key={log.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{log.channel} via {log.provider}</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          log.delivery_confirmed 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {log.delivery_confirmed ? 'Confirmed Delivered' : 'Unconfirmed'}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-1">
                        Status: <span className="font-medium text-slate-700">{log.status}</span>
                      </p>
                      {log.error_message && (
                        <p className="text-amber-700 mt-0.5 font-mono text-[10px]">
                          Note: {log.error_message}
                        </p>
                      )}
                      <p className="text-slate-400 text-[10px] mt-1">
                        Logged: {formatIST(log.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Verification Disclaimer Footer */}
          <div className="bg-slate-50 p-3 border-t border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
            <p className="leading-tight">
              <span className="font-bold text-slate-700">Delivery Invariant: </span>
              In-app reminders deliver directly. External WhatsApp and SMS messages are never claimed as sent or delivered unless a configured provider confirms delivery.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
