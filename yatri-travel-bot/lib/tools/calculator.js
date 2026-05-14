/**
 * Tool: calculator
 *
 * Evaluates a math expression. CRITICAL because LLMs are notoriously
 * bad at arithmetic — they predict tokens, not compute numbers.
 * Remember the ₹5,000 cost-total drift from Day 2? This tool fixes it.
 *
 * SECURITY:
 *   - Whitelist regex blocks anything that isn't math characters
 *   - Function() (not eval()) — runs in clean isolated scope
 *   - Validates result is a finite number
 *   NEVER eval untrusted input in production without these guards!
 */

/**
 * @param {Object} args
 * @param {string} args.expression - Math expression like "2500 * 15 + 800"
 * @returns {Object} - { expression, result } or { error }
 */
export function calculator({ expression }) {
  // Whitelist: only digits, basic operators, parens, decimals, whitespace
  const safePattern = /^[\d+\-*/().\s]+$/;

  if (!safePattern.test(expression)) {
    return {
      error: `Unsafe expression. Only digits and + - * / ( ) . allowed. Got: "${expression}"`,
    };
  }

  try {
    // Function() creates a fresh isolated scope (safer than eval)
    const result = new Function(`return (${expression})`)();

    if (typeof result !== "number" || !isFinite(result)) {
      return {
        error: `Expression did not produce a finite number: "${expression}"`,
      };
    }

    return { expression, result };
  } catch (err) {
    return { error: `Math error: ${err.message}` };
  }
}
