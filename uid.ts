/**
 * Patient Unique Identification Number (UID) Utilities for Physio Voice
 */

/**
 * Standard format: PV-YYYY-XXXX (e.g., PV-2026-0001)
 */
export function formatPatientUID(sequenceNumber: number, year = new Date().getFullYear()): string {
  const padded = String(sequenceNumber).padStart(4, '0');
  return `PV-${year}-${padded}`;
}

/**
 * Normalizes user input for UID searching
 * Accepts: "pv 1042", "pv-2026-0042", "1042", "PV1042" -> standardized lookup string
 */
export function normalizeUID(input: string): string {
  if (!input) return '';
  return input.trim().toUpperCase().replace(/\s+/g, '-');
}

/**
 * Validates whether a string matches any valid Physio Voice UID pattern
 */
export function isValidUID(input: string): boolean {
  const normalized = normalizeUID(input);
  // Matches PV-YYYY-XXXX, PV-XXXX, or pure numbers
  const uidRegex = /^(?:PV-)?(?:\d{4}-)?\d{1,6}$/;
  return uidRegex.test(normalized);
}
