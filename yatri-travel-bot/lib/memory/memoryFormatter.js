/**
 * Memory Formatter — turns the user profile into prompt context.
 *
 * Why a separate file?
 *   - Profile format may evolve, but the prompt injection format
 *     should be controlled centrally.
 *   - Easy to A/B test different formats (verbose vs concise).
 */

/**
 * Format the profile as a human-readable context block for the LLM.
 * Returns an empty string if no facts are known yet.
 *
 * @param {Object} profile - user profile object
 * @returns {string} - formatted context (or "" if profile is empty)
 */
export function formatProfileForPrompt(profile) {
  const facts = [];

  // Name
  if (profile.name) {
    facts.push(`Name: ${profile.name}`);
  }

  // Preferences
  const prefs = profile.preferences || {};
  if (prefs.diet) facts.push(`Diet: ${prefs.diet}`);
  if (prefs.travel_style) facts.push(`Travel style: ${prefs.travel_style}`);
  if (prefs.pace) facts.push(`Pace preference: ${prefs.pace}`);
  if (prefs.budget_tier) facts.push(`Budget tier: ${prefs.budget_tier}`);

  // Constraints
  const cons = profile.constraints || {};
  if (cons.fears?.length) facts.push(`Fears: ${cons.fears.join(", ")}`);
  if (cons.allergies?.length)
    facts.push(`Allergies: ${cons.allergies.join(", ")}`);
  if (cons.accessibility_needs?.length)
    facts.push(`Accessibility needs: ${cons.accessibility_needs.join(", ")}`);
  if (cons.family_context) facts.push(`Family context: ${cons.family_context}`);

  // History (just the most relevant ones — last 5)
  const hist = profile.history || {};
  if (hist.places_visited?.length) {
    const recent = hist.places_visited.slice(-5);
    facts.push(`Recently visited: ${recent.join(", ")}`);
  }
  if (hist.places_wishlist?.length) {
    const recent = hist.places_wishlist.slice(-5);
    facts.push(`Wishlist: ${recent.join(", ")}`);
  }

  if (facts.length === 0) return "";

  return `\n\nABOUT THE USER (use this to personalize responses):\n${facts.map((f) => `- ${f}`).join("\n")}\n`;
}
