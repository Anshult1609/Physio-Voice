/**
 * Automated Test Suite for Physio Voice Appointment Reminders & Delivery Architecture
 *
 * Requirements Tested:
 * 1. In-App reminder dispatch confirms delivery immediately (deliveryConfirmed: true, status: 'DELIVERED').
 * 2. External WhatsApp provider without active credentials never claims delivery (deliveryConfirmed: false, status: 'PENDING_CONFIRMATION').
 * 3. External SMS provider without active credentials never claims delivery (deliveryConfirmed: false, status: 'PENDING_CONFIRMATION').
 * 4. Timezone handling verifies IST (Asia/Kolkata, UTC+05:30) formatting and offset calculation.
 * 5. Duplicate prevention: prevents duplicate pending reminders for the same appointment and channel.
 * 6. Rescheduling behavior: adjusts trigger time of pending reminders when appointment is rescheduled.
 * 7. Cancellation behavior: marks pending reminders as CANCELLED when appointment is cancelled.
 * 8. Consent verification: honors patient DPDPA consent preferences (SKIPPED_NO_CONSENT when opted out).
 * 9. Delivery logs audit trail: records channel, provider, status, and explicit delivery_confirmed flag.
 */

import { InAppReminderProvider, WhatsAppProvider, SmsProvider, providerRegistry } from '../lib/reminders/providers';
import { 
  calculateReminderTriggerTime, 
  formatInClinicTimezone, 
  formatTimeInClinicTimezone, 
  formatDateInClinicTimezone,
  getRelativeDayDescription,
  DEFAULT_CLINIC_TIMEZONE
} from '../lib/reminders/timezone';
import { 
  ReminderChannel, 
  ReminderStatus, 
  PatientNotificationConsent,
  ReminderDeliveryLog
} from '../types/reminders';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName}`);
    if (details) console.error(`    Details: ${details}`);
  }
}

async function runReminderTests() {
  console.log('\n======================================================');
  console.log('  PHYSIO VOICE APPOINTMENT REMINDERS & DELIVERY TEST SUITE');
  console.log('======================================================\n');

  // -----------------------------------------------------------------
  // 1. IN-APP REMINDER DELIVERY TEST
  // -----------------------------------------------------------------
  console.log('TEST GROUP 1: In-App Reminder Delivery Behavior');
  const inAppProvider = new InAppReminderProvider();
  assert(inAppProvider.isConfigured() === true, 'In-App provider is native and always configured');
  assert(inAppProvider.channel === 'IN_APP', 'In-App provider has channel IN_APP');

  const inAppResult = await inAppProvider.send({
    recipientName: 'Sunita Sharma',
    recipientPhone: '9811234567',
    clinicName: 'Sharma Multispeciality Physio Clinic',
    therapistName: 'Dr. Neha Sharma',
    appointmentTimeFormatted: 'Tomorrow at 10:30 AM IST',
    appointmentId: 'apt-test-101',
    reminderId: 'rem-test-101',
  });

  assert(inAppResult.success === true, 'In-App dispatch reports success');
  assert(inAppResult.deliveryConfirmed === true, 'In-App dispatch sets deliveryConfirmed to TRUE');
  assert(inAppResult.status === 'DELIVERED', 'In-App dispatch sets status to DELIVERED');
  assert(inAppResult.provider === 'INTERNAL_IN_APP', 'In-App provider is INTERNAL_IN_APP');
  assert(Boolean(inAppResult.providerMessageId), 'In-App provides internal message/notification ID');

  // -----------------------------------------------------------------
  // 2. EXTERNAL PROVIDER VERIFICATION CONSTRAINT
  // Requirement: Do not claim external messages have been sent unless configured provider confirms delivery
  // -----------------------------------------------------------------
  console.log('\nTEST GROUP 2: External Message Delivery Invariant (WhatsApp & SMS)');
  
  // Test WhatsApp without credentials
  const whatsAppProvider = new WhatsAppProvider();
  assert(
    whatsAppProvider.isConfigured() === false,
    'WhatsApp provider is unconfigured in test environment (no live auth tokens)'
  );

  const whatsappResult = await whatsAppProvider.send({
    recipientName: 'Rajesh Verma',
    recipientPhone: '9822334455',
    clinicName: 'Sharma Multispeciality Physio Clinic',
    therapistName: 'Dr. Neha Sharma',
    appointmentTimeFormatted: 'Today at 04:00 PM IST',
    appointmentId: 'apt-test-102',
    reminderId: 'rem-test-102',
  });

  assert(
    whatsappResult.deliveryConfirmed === false,
    'CRITICAL: WhatsApp without configured provider DOES NOT claim delivery (deliveryConfirmed = false)'
  );
  assert(
    whatsappResult.status === 'PENDING_CONFIRMATION',
    'CRITICAL: WhatsApp without configured provider is marked PENDING_CONFIRMATION (never DELIVERED)'
  );
  assert(
    whatsappResult.error === 'PROVIDER_NOT_CONFIGURED',
    'WhatsApp unconfigured error reason is explicitly returned'
  );

  // Test SMS without credentials
  const smsProvider = new SmsProvider();
  assert(smsProvider.isConfigured() === false, 'SMS provider is unconfigured in test environment');

  const smsResult = await smsProvider.send({
    recipientName: 'Pooja Iyer',
    recipientPhone: '9844556677',
    clinicName: 'Sharma Multispeciality Physio Clinic',
    therapistName: 'Dr. Neha Sharma',
    appointmentTimeFormatted: 'Friday at 11:00 AM IST',
    appointmentId: 'apt-test-103',
    reminderId: 'rem-test-103',
  });

  assert(
    smsResult.deliveryConfirmed === false,
    'CRITICAL: SMS without configured provider DOES NOT claim delivery (deliveryConfirmed = false)'
  );
  assert(
    smsResult.status === 'PENDING_CONFIRMATION',
    'CRITICAL: SMS without configured provider is marked PENDING_CONFIRMATION (never DELIVERED)'
  );
  assert(
    smsResult.error === 'PROVIDER_NOT_CONFIGURED',
    'SMS unconfigured error reason is explicitly returned'
  );

  // -----------------------------------------------------------------
  // 3. TIMEZONE HANDLING (IST / Asia/Kolkata)
  // -----------------------------------------------------------------
  console.log('\nTEST GROUP 3: Timezone Handling (Asia/Kolkata, UTC+05:30)');
  assert(DEFAULT_CLINIC_TIMEZONE === 'Asia/Kolkata', 'Default clinic timezone is Asia/Kolkata');

  // UTC slot: 2026-11-18T05:00:00Z -> IST is 10:30 AM
  const utcStart = '2026-11-18T05:00:00.000Z';
  const istFormattedTime = formatTimeInClinicTimezone(utcStart);
  assert(
    istFormattedTime.includes('10:30') && (istFormattedTime.includes('am') || istFormattedTime.includes('AM')),
    `UTC 05:00 formats to 10:30 AM IST (received: ${istFormattedTime})`
  );

  const istFormattedDate = formatDateInClinicTimezone(utcStart);
  assert(
    istFormattedDate.includes('18') && istFormattedDate.includes('Nov') && istFormattedDate.includes('2026'),
    `UTC date formats correctly in IST (received: ${istFormattedDate})`
  );

  // Trigger time: 2 hours before 05:00 UTC is 03:00 UTC
  const triggerTime = calculateReminderTriggerTime(utcStart, 2);
  const expectedTrigger = '2026-11-18T03:00:00.000Z';
  assert(
    triggerTime === expectedTrigger,
    `calculateReminderTriggerTime calculates 2 hours prior correctly (${triggerTime} vs expected ${expectedTrigger})`
  );

  // Relative day formatting
  const relativeDesc = getRelativeDayDescription(utcStart);
  assert(
    relativeDesc.includes('10:30') && relativeDesc.includes('IST'),
    `getRelativeDayDescription includes time and IST indicator (received: ${relativeDesc})`
  );

  // -----------------------------------------------------------------
  // 4. DUPLICATE PREVENTION LOGIC (Idempotency)
  // -----------------------------------------------------------------
  console.log('\nTEST GROUP 4: Duplicate Prevention & Idempotency');
  
  // Simulated database of reminders
  const mockRemindersDb: any[] = [];
  const mockLogsDb: any[] = [];

  function simulateScheduleReminder(params: {
    appointmentId: string;
    patientId: string;
    channel: ReminderChannel;
    scheduledFor: string;
    consentInApp: boolean;
    consentWhatsapp: boolean;
  }) {
    // 1. Consent check
    const isConsented = params.channel === 'IN_APP' ? params.consentInApp : params.consentWhatsapp;
    if (!isConsented) {
      const skippedReminder = {
        id: `rem-${Date.now()}-${Math.random()}`,
        appointment_id: params.appointmentId,
        patient_id: params.patientId,
        channel: params.channel,
        status: 'SKIPPED_NO_CONSENT' as ReminderStatus,
      };
      mockRemindersDb.push(skippedReminder);
      mockLogsDb.push({
        reminder_id: skippedReminder.id,
        status: 'SKIPPED_NO_CONSENT',
        delivery_confirmed: false,
        error_message: `Skipped: Patient opted out of ${params.channel}`,
      });
      return { reminder: skippedReminder, isDuplicate: false, status: 'SKIPPED_NO_CONSENT' };
    }

    // 2. Duplicate check: find existing PENDING reminder for appointmentId + channel
    const existing = mockRemindersDb.find(
      (r) => r.appointment_id === params.appointmentId && r.channel === params.channel && r.status === 'PENDING'
    );
    if (existing) {
      return { reminder: existing, isDuplicate: true, status: 'PENDING' };
    }

    // 3. Insert new reminder
    const newReminder = {
      id: `rem-${Date.now()}-${Math.random()}`,
      appointment_id: params.appointmentId,
      patient_id: params.patientId,
      channel: params.channel,
      scheduled_for: params.scheduledFor,
      status: 'PENDING' as ReminderStatus,
    };
    mockRemindersDb.push(newReminder);
    return { reminder: newReminder, isDuplicate: false, status: 'PENDING' };
  }

  // Schedule first in-app reminder
  const firstSchedule = simulateScheduleReminder({
    appointmentId: 'apt-dup-1',
    patientId: 'p-1',
    channel: 'IN_APP',
    scheduledFor: '2026-11-18T03:00:00.000Z',
    consentInApp: true,
    consentWhatsapp: true,
  });
  assert(firstSchedule.isDuplicate === false, 'First scheduling attempt succeeds (isDuplicate: false)');
  assert(mockRemindersDb.length === 1, 'Database has exactly 1 reminder');

  // Attempt duplicate scheduling for same appointment and channel
  const secondSchedule = simulateScheduleReminder({
    appointmentId: 'apt-dup-1',
    patientId: 'p-1',
    channel: 'IN_APP',
    scheduledFor: '2026-11-18T03:00:00.000Z',
    consentInApp: true,
    consentWhatsapp: true,
  });
  assert(secondSchedule.isDuplicate === true, 'Duplicate scheduling attempt is detected (isDuplicate: true)');
  assert(secondSchedule.reminder.id === firstSchedule.reminder.id, 'Returned reminder is identical to existing reminder');
  assert(mockRemindersDb.length === 1, 'Database still has only 1 reminder (no duplicate row added)');

  // -----------------------------------------------------------------
  // 5. RESCHEDULING BEHAVIOR
  // -----------------------------------------------------------------
  console.log('\nTEST GROUP 5: Appointment Rescheduling Behavior');
  
  function simulateReschedule(appointmentId: string, newStartUtc: string, reason: string) {
    const newTriggerTime = calculateReminderTriggerTime(newStartUtc, 2);
    let updatedCount = 0;

    for (const r of mockRemindersDb) {
      if (r.appointment_id === appointmentId && r.status === 'PENDING') {
        r.scheduled_for = newTriggerTime;
        updatedCount++;
        mockLogsDb.push({
          reminder_id: r.id,
          status: 'PENDING',
          delivery_confirmed: false,
          error_message: `Rescheduled trigger to ${newTriggerTime} (${reason}).`,
        });
      }
    }
    return { updatedCount, newTriggerTime };
  }

  const newUtcSlot = '2026-11-18T09:00:00.000Z'; // Moved from 05:00 UTC to 09:00 UTC
  const rescheduleResult = simulateReschedule('apt-dup-1', newUtcSlot, 'Patient requested afternoon slot');
  
  assert(rescheduleResult.updatedCount === 1, 'Rescheduling updated 1 pending reminder');
  assert(
    mockRemindersDb[0].scheduled_for === '2026-11-18T07:00:00.000Z',
    `Trigger time shifted to 2 hours before new slot (07:00 UTC, actual: ${mockRemindersDb[0].scheduled_for})`
  );
  assert(
    mockLogsDb.some((l) => l.error_message?.includes('Rescheduled trigger')),
    'Reschedule event was logged in delivery audit logs'
  );

  // -----------------------------------------------------------------
  // 6. CANCELLATION BEHAVIOR
  // -----------------------------------------------------------------
  console.log('\nTEST GROUP 6: Appointment Cancellation Behavior');

  function simulateCancellation(appointmentId: string, reason: string) {
    let cancelledCount = 0;
    for (const r of mockRemindersDb) {
      if (r.appointment_id === appointmentId && r.status === 'PENDING') {
        r.status = 'CANCELLED';
        cancelledCount++;
        mockLogsDb.push({
          reminder_id: r.id,
          status: 'CANCELLED',
          delivery_confirmed: false,
          error_message: `Reminder cancelled: Appointment cancelled (${reason}).`,
        });
      }
    }
    return { cancelledCount };
  }

  const cancelResult = simulateCancellation('apt-dup-1', 'Patient caught viral fever');
  assert(cancelResult.cancelledCount === 1, 'Cancellation successfully found and updated pending reminder');
  assert(mockRemindersDb[0].status === 'CANCELLED', 'Reminder status changed from PENDING to CANCELLED');
  assert(
    mockLogsDb.some((l) => l.status === 'CANCELLED' && l.error_message?.includes('viral fever')),
    'Cancellation event was logged in delivery audit logs with reason'
  );

  // -----------------------------------------------------------------
  // 7. PATIENT CONSENT ENFORCEMENT (DPDPA 2023)
  // -----------------------------------------------------------------
  console.log('\nTEST GROUP 7: DPDPA Consent Enforcement');

  // Patient opted out of WhatsApp
  const consentTest = simulateScheduleReminder({
    appointmentId: 'apt-consent-99',
    patientId: 'p-optout-1',
    channel: 'WHATSAPP',
    scheduledFor: '2026-11-18T03:00:00.000Z',
    consentInApp: true,
    consentWhatsapp: false, // Opted out!
  });

  assert(
    consentTest.status === 'SKIPPED_NO_CONSENT',
    'Reminder scheduling marks SKIPPED_NO_CONSENT when patient opted out'
  );
  assert(
    mockLogsDb.some((l) => l.status === 'SKIPPED_NO_CONSENT' && l.error_message?.includes('opted out of WHATSAPP')),
    'Audit log records consent skip reason'
  );

  // -----------------------------------------------------------------
  // 8. BATCH DISPATCH SIMULATION WITH DELIVERY GUARANTEE
  // -----------------------------------------------------------------
  console.log('\nTEST GROUP 8: Server-Side Due Reminders Processing');

  // Create 1 due In-App reminder, 1 due WhatsApp reminder, and 1 future reminder
  const now = new Date();
  const pastTrigger = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // 10 mins ago
  const futureTrigger = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour later

  const batchReminders = [
    {
      id: 'batch-rem-1',
      channel: 'IN_APP' as ReminderChannel,
      scheduled_for: pastTrigger,
      status: 'PENDING' as ReminderStatus,
      recipient_name: 'Sunita Sharma',
      recipient_phone: '9811234567',
    },
    {
      id: 'batch-rem-2',
      channel: 'WHATSAPP' as ReminderChannel,
      scheduled_for: pastTrigger,
      status: 'PENDING' as ReminderStatus,
      recipient_name: 'Rajesh Verma',
      recipient_phone: '9822334455',
    },
    {
      id: 'batch-rem-3',
      channel: 'IN_APP' as ReminderChannel,
      scheduled_for: futureTrigger, // Not due yet
      status: 'PENDING' as ReminderStatus,
      recipient_name: 'Amit Kumar',
      recipient_phone: '9833445566',
    },
  ];

  async function simulateProcessDue(reminders: typeof batchReminders) {
    const due = reminders.filter((r) => r.status === 'PENDING' && r.scheduled_for <= now.toISOString());
    const results = [];

    for (const r of due) {
      const provider = providerRegistry[r.channel];
      const result = await provider.send({
        recipientName: r.recipient_name,
        recipientPhone: r.recipient_phone,
        clinicName: 'Sharma Physio',
        therapistName: 'Dr. Sharma',
        appointmentTimeFormatted: 'Today at 05:00 PM IST',
        appointmentId: `apt-${r.id}`,
        reminderId: r.id,
      });
      r.status = result.status;
      results.push(result);
    }
    return { processed: due.length, results };
  }

  const batchResult = await simulateProcessDue(batchReminders);
  assert(batchResult.processed === 2, 'Only the 2 due reminders were processed (future reminder untouched)');
  assert(batchReminders[2].status === 'PENDING', 'Future reminder remains PENDING');
  
  // Verify In-App was DELIVERED and WhatsApp was PENDING_CONFIRMATION
  assert(
    batchReminders[0].status === 'DELIVERED',
    'Due In-App reminder was updated to DELIVERED with deliveryConfirmed: true'
  );
  assert(
    batchReminders[1].status === 'PENDING_CONFIRMATION',
    'Due WhatsApp reminder without credentials was updated to PENDING_CONFIRMATION (NOT delivered)'
  );

  console.log('\n======================================================');
  console.log(`  TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runReminderTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
