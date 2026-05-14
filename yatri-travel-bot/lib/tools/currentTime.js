/**
 * Tool: currentTime
 *
 * LLMs have a training cutoff (months/years ago). They don't know
 * what "today", "tomorrow", or "this weekend" means in real time.
 * This tool grounds them in NOW.
 *
 * Takes no arguments — always returns the current moment.
 */

/**
 * @returns {Object} - current date/time info
 */
export function currentTime() {
  const now = new Date();
  return {
    iso: now.toISOString(),
    readable: now.toDateString(),
    day_of_week: now.toLocaleDateString("en-US", { weekday: "long" }),
    time: now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
