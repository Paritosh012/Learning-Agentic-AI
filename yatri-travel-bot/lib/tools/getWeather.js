/**
 * Tool: getWeather
 *
 * Calls Open-Meteo API — free, no API key needed.
 *
 * BUG HISTORY (Day 3 debugging):
 *   Problem: Open-Meteo geocoder returned wrong "Manali" (Tamil Nadu suburb
 *   of Chennai, pop 35,248) instead of famous Manali in Himachal Pradesh
 *   (pop 8,096). Both have identical feature_code "PPL". Population sort
 *   always picks TN. Full-name queries ("Manali, Himachal Pradesh") return
 *   undefined — geocoder doesn't parse comma-separated admin names.
 *
 *   Solution: Hardcode lat/lon for known ambiguous tourist destinations.
 *   Skips geocoder entirely for these cities. Unambiguous cities still
 *   use the geocoder normally.
 *
 *   Key insight from debug: The LLM self-recovered by trying "Kullu"
 *   (Manali's district HQ) as a proxy — emergent agent reasoning.
 *   Our fix makes the direct query work so the proxy isn't needed.
 */

// ============================================================
// Known ambiguous cities — hardcoded coordinates
// These skip the geocoder entirely (no ambiguity possible)
// Coordinates verified via Google Maps
// ============================================================
const KNOWN_CITIES = {
  manali: {
    lat: 32.2396,
    lon: 77.1887,
    label: "Manali, Himachal Pradesh, India",
  },
  kashmir: {
    lat: 34.0837,
    lon: 74.7973,
    label: "Srinagar, Jammu & Kashmir, India",
  },
  srinagar: {
    lat: 34.0837,
    lon: 74.7973,
    label: "Srinagar, Jammu & Kashmir, India",
  },
  pondicherry: { lat: 11.9416, lon: 79.8083, label: "Puducherry, India" },
  mussoorie: {
    lat: 30.4598,
    lon: 78.0644,
    label: "Mussoorie, Uttarakhand, India",
  },
  "mcleod ganj": {
    lat: 32.2427,
    lon: 76.3219,
    label: "McLeod Ganj, Himachal Pradesh, India",
  },
  dharamshala: {
    lat: 32.219,
    lon: 76.3234,
    label: "Dharamshala, Himachal Pradesh, India",
  },
};

/**
 * @param {Object} args
 * @param {string} args.city - City name (e.g., "Manali", "Goa", "Paris")
 * @returns {Promise<Object>} - weather data or { error: string }
 */
export async function getWeather({ city }) {
  let latitude, longitude, cityLabel;

  // ─────────────────────────────────────────────────────────────
  // PATH A: Known ambiguous city → use hardcoded coordinates
  // ─────────────────────────────────────────────────────────────
  const cityKey = city.toLowerCase().trim();
  const known = KNOWN_CITIES[cityKey];

  if (known) {
    latitude = known.lat;
    longitude = known.lon;
    cityLabel = known.label;
  } else {
    // ─────────────────────────────────────────────────────────
    // PATH B: Unknown city → use geocoder with population sort
    // ─────────────────────────────────────────────────────────
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5`;

    let geoData;

    try {
      const geoResponse = await fetch(geoUrl);
      geoData = await geoResponse.json();
    } catch (err) {
      return { error: `Geocoding API failed: ${err.message}` };
    }

    if (!geoData.results || geoData.results.length === 0) {
      return {
        error: `City "${city}" not found. Try a different spelling or nearby major city.`,
      };
    }

    // Sort by population — works for most unambiguous cities
    const sorted = [...geoData.results].sort(
      (a, b) => (b.population || 0) - (a.population || 0),
    );
    const best = sorted[0];

    latitude = best.latitude;
    longitude = best.longitude;
    cityLabel = `${best.name}${best.admin1 ? ", " + best.admin1 : ""}, ${best.country}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Fetch weather — same for both paths
  // ─────────────────────────────────────────────────────────────
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;

  let weatherData;
  try {
    const weatherResponse = await fetch(weatherUrl);
    weatherData = await weatherResponse.json();
  } catch (err) {
    return { error: `Weather API failed: ${err.message}` };
  }

  const current = weatherData.current;
  if (!current) {
    return { error: `Weather API returned no data for ${cityLabel}` };
  }

  return {
    city: cityLabel,
    temperature_c: current.temperature_2m,
    conditions: weatherCodeToText(current.weather_code),
    humidity_percent: current.relative_humidity_2m,
    wind_kmh: current.wind_speed_10m,
    fetched_at: new Date().toISOString(),
  };
}

function weatherCodeToText(code) {
  if (code === 0) return "clear sky";
  if (code <= 3) return "partly cloudy";
  if (code <= 48) return "foggy";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rainy";
  if (code <= 77) return "snowy";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  return "thunderstorm";
}
