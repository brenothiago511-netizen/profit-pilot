/**
 * Utility functions for handling dates with Brasilia timezone (UTC-3)
 * 
 * When parsing date strings from the database (YYYY-MM-DD format),
 * JavaScript interprets them as UTC midnight. This causes dates to
 * shift when displayed in local time (e.g., Brazil UTC-3).
 * 
 * By appending 'T12:00:00' we ensure the date stays on the correct day
 * regardless of timezone.
 */

/**
 * Parse a date string from the database (YYYY-MM-DD) safely,
 * avoiding timezone shift issues.
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object set to noon on that date (to avoid timezone shifts)
 */
export function parseDate(dateString: string): Date {
  if (!dateString) {
    return new Date();
  }
  
  // If the date string already has a time component, use it as-is
  if (dateString.includes('T')) {
    return new Date(dateString);
  }
  
  // Append T12:00:00 to avoid timezone shifts
  return new Date(dateString + 'T12:00:00');
}

/**
 * Compare two date strings for sorting (descending order)
 * 
 * @param dateA - First date string
 * @param dateB - Second date string
 * @returns Negative if dateB > dateA, positive if dateA > dateB
 */
export function compareDatesDesc(dateA: string, dateB: string): number {
  return parseDate(dateB).getTime() - parseDate(dateA).getTime();
}

/**
 * Compare two date strings for sorting (ascending order)
 * 
 * @param dateA - First date string
 * @param dateB - Second date string
 * @returns Negative if dateA < dateB, positive if dateA > dateB
 */
export function compareDatesAsc(dateA: string, dateB: string): number {
  return parseDate(dateA).getTime() - parseDate(dateB).getTime();
}
