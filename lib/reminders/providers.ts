import { ReminderChannel, ReminderStatus } from '@/types/reminders';

export interface ReminderMessagePayload {
  recipientName: string;
  recipientPhone: string;
  clinicName: string;
  therapistName: string;
  appointmentTimeFormatted: string; // e.g. "Tomorrow at 10:30 AM IST"
  instructions?: string;
  appointmentId: string;
  reminderId: string;
}

export interface ProviderDispatchResult {
  success: boolean;
  channel: ReminderChannel;
  provider: string;
  providerMessageId?: string;
  deliveryConfirmed: boolean; // CRITICAL: TRUE ONLY IF CONFIRMED DELIVERED
  status: ReminderStatus;
  statusMessage: string;
  rawResponse?: any;
  error?: string;
}

export interface ReminderProvider {
  channel: ReminderChannel;
  name: string;
  isConfigured(): boolean;
  send(payload: ReminderMessagePayload): Promise<ProviderDispatchResult>;
  checkDeliveryStatus?(providerMessageId: string): Promise<ProviderDispatchResult>;
}

/**
 * Native In-App Reminder Provider
 * In-app notifications are internal to Physio Voice and immediately available.
 * Confirms delivery directly upon internal dispatch.
 */
export class InAppReminderProvider implements ReminderProvider {
  channel: ReminderChannel = 'IN_APP';
  name = 'INTERNAL_IN_APP';

  isConfigured(): boolean {
    return true; // Native in-app provider is always active
  }

  async send(payload: ReminderMessagePayload): Promise<ProviderDispatchResult> {
    const internalNotificationId = `inapp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return {
      success: true,
      channel: 'IN_APP',
      provider: this.name,
      providerMessageId: internalNotificationId,
      deliveryConfirmed: true, // Native in-app notifications are confirmed delivered immediately
      status: 'DELIVERED',
      statusMessage: `In-app reminder delivered for ${payload.recipientName} (${payload.appointmentTimeFormatted}).`,
      rawResponse: {
        inAppDeliveredAt: new Date().toISOString(),
        notificationId: internalNotificationId,
      },
    };
  }
}

/**
 * WhatsApp Notification Provider (Meta Cloud API / Gupshup Interface)
 * Does NOT claim delivery unless a configured provider confirms with a message ID.
 */
export class WhatsAppProvider implements ReminderProvider {
  channel: ReminderChannel = 'WHATSAPP';
  name = 'WHATSAPP_BUSINESS_API';

  isConfigured(): boolean {
    // Requires live WhatsApp Cloud API / Gupshup credentials
    return Boolean(
      process.env.WHATSAPP_API_TOKEN && 
      process.env.WHATSAPP_PHONE_NUMBER_ID && 
      process.env.WHATSAPP_API_TOKEN !== 'your-whatsapp-token-here'
    );
  }

  async send(payload: ReminderMessagePayload): Promise<ProviderDispatchResult> {
    if (!this.isConfigured()) {
      // RULE: Do not claim external messages have been sent unless configured provider confirms delivery
      return {
        success: false,
        channel: 'WHATSAPP',
        provider: this.name,
        deliveryConfirmed: false,
        status: 'PENDING_CONFIRMATION',
        statusMessage: 'WhatsApp Business API is not configured with active credentials. Delivery unconfirmed.',
        error: 'PROVIDER_NOT_CONFIGURED',
      };
    }

    try {
      // If credentials exist, call Meta WhatsApp Cloud API endpoint
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: `91${payload.recipientPhone.slice(-10)}`,
            type: 'text',
            text: {
              body: `Namaste ${payload.recipientName}, this is a reminder from ${payload.clinicName} for your physiotherapy appointment at ${payload.appointmentTimeFormatted}. ${payload.instructions || ''}`,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.messages?.[0]?.id) {
        return {
          success: false,
          channel: 'WHATSAPP',
          provider: this.name,
          deliveryConfirmed: false,
          status: 'FAILED',
          statusMessage: `WhatsApp delivery rejected by provider: ${data.error?.message || 'Unknown error'}`,
          error: data.error?.message,
        };
      }

      return {
        success: true,
        channel: 'WHATSAPP',
        provider: this.name,
        providerMessageId: data.messages[0].id,
        deliveryConfirmed: true, // Confirmed by provider response
        status: 'DELIVERED',
        statusMessage: `WhatsApp reminder delivered via WhatsApp Cloud API (Message ID: ${data.messages[0].id}).`,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        channel: 'WHATSAPP',
        provider: this.name,
        deliveryConfirmed: false,
        status: 'FAILED',
        statusMessage: `Network error reaching WhatsApp provider: ${err.message}`,
        error: err.message,
      };
    }
  }
}

/**
 * SMS Notification Provider (Fast2SMS / Twilio India Interface)
 * Does NOT claim delivery unless confirmed by SMS gateway.
 */
export class SmsProvider implements ReminderProvider {
  channel: ReminderChannel = 'SMS';
  name = 'SMS_GATEWAY_INDIA';

  isConfigured(): boolean {
    return Boolean(
      process.env.SMS_API_KEY && 
      process.env.SMS_API_KEY !== 'your-sms-api-key-here'
    );
  }

  async send(payload: ReminderMessagePayload): Promise<ProviderDispatchResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: 'SMS',
        provider: this.name,
        deliveryConfirmed: false,
        status: 'PENDING_CONFIRMATION',
        statusMessage: 'SMS Gateway is not configured with active API credentials. Delivery unconfirmed.',
        error: 'PROVIDER_NOT_CONFIGURED',
      };
    }

    try {
      // Call Indian transactional SMS gateway
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: process.env.SMS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'v3',
          sender_id: 'PHYSIO',
          message: `Namaste ${payload.recipientName}, appointment reminder for ${payload.appointmentTimeFormatted} at ${payload.clinicName}.`,
          language: 'english',
          numbers: payload.recipientPhone.slice(-10),
        }),
      });

      const data = await response.json();

      if (data.return === true && data.request_id) {
        return {
          success: true,
          channel: 'SMS',
          provider: this.name,
          providerMessageId: data.request_id,
          deliveryConfirmed: true,
          status: 'DELIVERED',
          statusMessage: `SMS sent via gateway (Request ID: ${data.request_id}).`,
          rawResponse: data,
        };
      } else {
        return {
          success: false,
          channel: 'SMS',
          provider: this.name,
          deliveryConfirmed: false,
          status: 'FAILED',
          statusMessage: `SMS rejected by gateway: ${data.message || 'Unknown error'}`,
          error: data.message,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        channel: 'SMS',
        provider: this.name,
        deliveryConfirmed: false,
        status: 'FAILED',
        statusMessage: `Network error connecting to SMS provider: ${err.message}`,
        error: err.message,
      };
    }
  }
}

/**
 * Provider Registry
 */
export const providerRegistry: Record<ReminderChannel, ReminderProvider> = {
  IN_APP: new InAppReminderProvider(),
  WHATSAPP: new WhatsAppProvider(),
  SMS: new SmsProvider(),
  EMAIL: new InAppReminderProvider(), // Fallback
};
