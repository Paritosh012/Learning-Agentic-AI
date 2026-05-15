/**
 * Profile Store — read/write Yatri's persistent memory.
 *
 * Why a separate file?
 *   - Single responsibility: ONLY does file I/O.
 *   - Day 9 we'll swap this for MongoDB — only this file changes.
 *   - Easy to mock for testing.
 *
 * The pattern: load on startup, mutate in memory, save after changes.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname } from "path";

const PROFILE_PATH = "./data/user-profile.json";

// Default empty profile shape — also used to reset
const EMPTY_PROFILE = {
  name: null,
  preferences: {
    diet: null,
    travel_style: null,
    pace: null,
    budget_tier: null,
  },
  constraints: {
    fears: [],
    allergies: [],
    accessibility_needs: [],
    family_context: null,
  },
  history: {
    places_discussed: [],
    places_visited: [],
    places_wishlist: [],
  },
  metadata: {
    created_at: null,
    last_updated: null,
  },
};

/**
 * Load the profile from disk. Creates a fresh one if file doesn't exist.
 * @returns {Promise<Object>} the profile object
 */
export async function loadProfile() {
  try {
    if (!existsSync(PROFILE_PATH)) {
      // First run — create directory + empty profile
      await mkdir(dirname(PROFILE_PATH), { recursive: true });
      const fresh = { ...EMPTY_PROFILE };
      fresh.metadata.created_at = new Date().toISOString();
      await saveProfile(fresh);
      return fresh;
    }

    const raw = await readFile(PROFILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("⚠️  Profile load failed:", err.message);
    console.error("    Starting with empty profile.");
    return { ...EMPTY_PROFILE };
  }
}

/**
 * Save the profile to disk. Always updates the last_updated timestamp.
 * @param {Object} profile
 */
export async function saveProfile(profile) {
  profile.metadata.last_updated = new Date().toISOString();
  await writeFile(PROFILE_PATH, JSON.stringify(profile, null, 2), "utf-8");
}

/**
 * Reset the profile to empty (used by /forget command).
 */
export async function resetProfile() {
  const fresh = JSON.parse(JSON.stringify(EMPTY_PROFILE)); // deep clone
  fresh.metadata.created_at = new Date().toISOString();
  await saveProfile(fresh);
  return fresh;
}
