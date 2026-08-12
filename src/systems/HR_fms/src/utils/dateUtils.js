/**
 * dateUtils.js
 * Computes the previous processing month and year dynamically based on the current system date.
 * E.g., if today is August 2026, returns { month: 7, year: 2026 } (July 2026)
 * E.g., if today is January 2027, returns { month: 12, year: 2026 } (December 2026)
 */
export function getPreviousProcessingPeriod() {
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth(); // 0-indexed: Jan is 0, Dec is 11.
  
  if (month === 0) {
    month = 12;
    year = year - 1;
  }
  
  return {
    month,
    year
  };
}
