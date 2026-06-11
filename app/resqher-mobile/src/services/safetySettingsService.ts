import * as SecureStore from 'expo-secure-store';

import api from './api';

export const SAFETY_SETTINGS_KEY = 'resqher_safety_settings_v1';

export type SafetySettingsBase = {
  sosCancelTimerSec: 10 | 15 | 20;
  notifyEmergencyContacts: boolean;
  pushNotifications: boolean;
  smsBackupAlert: boolean;
  maxResponders: 3 | 5;
  allowEmergencyAutoEvidenceRecording: boolean;
};

export type SafetySettings = SafetySettingsBase & {
  maxResponseDistance?: 3 | 4 | 5;
  receiveSosAlerts?: boolean;
};

export const DEFAULT_SAFETY_SETTINGS: SafetySettingsBase = {
  sosCancelTimerSec: 10,
  notifyEmergencyContacts: true,
  pushNotifications: true,
  smsBackupAlert: false,
  maxResponders: 5,
  allowEmergencyAutoEvidenceRecording: false,
};

const VALID_CANCEL_TIMERS = new Set([10, 15, 20]);
const VALID_RESPONDER_COUNTS = new Set([3, 5]);

function normalizeSettings(raw: any, fallback: Partial<SafetySettings> = {}): SafetySettings {
  const sosCancelTimerSec = Number(raw?.sosCancelTimerSec ?? raw?.sos_cancel_timer_sec ?? fallback.sosCancelTimerSec ?? DEFAULT_SAFETY_SETTINGS.sosCancelTimerSec);
  const maxResponders = Number(raw?.maxResponders ?? raw?.max_responders ?? fallback.maxResponders ?? DEFAULT_SAFETY_SETTINGS.maxResponders);
  return {
    ...fallback,
    sosCancelTimerSec: (VALID_CANCEL_TIMERS.has(sosCancelTimerSec) ? sosCancelTimerSec : DEFAULT_SAFETY_SETTINGS.sosCancelTimerSec) as 10 | 15 | 20,
    notifyEmergencyContacts: Boolean(raw?.notifyEmergencyContacts ?? raw?.notify_emergency_contacts ?? fallback.notifyEmergencyContacts ?? DEFAULT_SAFETY_SETTINGS.notifyEmergencyContacts),
    pushNotifications: Boolean(raw?.pushNotifications ?? raw?.push_notifications ?? fallback.pushNotifications ?? DEFAULT_SAFETY_SETTINGS.pushNotifications),
    smsBackupAlert: Boolean(raw?.smsBackupAlert ?? raw?.sms_backup_alert ?? fallback.smsBackupAlert ?? DEFAULT_SAFETY_SETTINGS.smsBackupAlert),
    maxResponders: (VALID_RESPONDER_COUNTS.has(maxResponders) ? maxResponders : DEFAULT_SAFETY_SETTINGS.maxResponders) as 3 | 5,
    allowEmergencyAutoEvidenceRecording: Boolean(
      raw?.allowEmergencyAutoEvidenceRecording ??
      raw?.allow_emergency_auto_evidence_recording ??
      fallback.allowEmergencyAutoEvidenceRecording ??
      DEFAULT_SAFETY_SETTINGS.allowEmergencyAutoEvidenceRecording,
    ),
  };
}

async function readCachedSettings(): Promise<SafetySettings | null> {
  try {
    const raw = await SecureStore.getItemAsync(SAFETY_SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function cacheSettings(settings: SafetySettings) {
  try {
    await SecureStore.setItemAsync(SAFETY_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Cache is best-effort only; backend remains the source of truth.
  }
}

export const safetySettingsService = {
  async getSettings(extraLocalDefaults: Partial<SafetySettings> = {}): Promise<SafetySettings> {
    const cached = await readCachedSettings();
    try {
      const res = await api.get('/api/safety-settings');
      const settings = normalizeSettings(res.data?.settings, { ...extraLocalDefaults, ...cached });
      await cacheSettings(settings);
      return settings;
    } catch {
      if (cached) return normalizeSettings(cached, extraLocalDefaults);
      return normalizeSettings({}, extraLocalDefaults);
    }
  },

  async saveSettings(next: SafetySettings): Promise<SafetySettings> {
    const res = await api.put('/api/safety-settings', {
      sosCancelTimerSec: next.sosCancelTimerSec,
      notifyEmergencyContacts: next.notifyEmergencyContacts,
      pushNotifications: next.pushNotifications,
      smsBackupAlert: next.smsBackupAlert,
      maxResponders: next.maxResponders,
      allowEmergencyAutoEvidenceRecording: next.allowEmergencyAutoEvidenceRecording,
    });
    const saved = normalizeSettings(res.data?.settings, next);
    await cacheSettings(saved);
    return saved;
  },

  cacheSettings,
};
