import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ─── Your Day 3 Manali bug fix carries forward ───
const KNOWN_CITIES = {
  manali: { lat: 32.2396, lon: 77.1887 },
  goa: { lat: 15.2993, lon: 74.124 },
  shimla: { lat: 31.1048, lon: 77.1734 },
  jaipur: { lat: 26.9124, lon: 75.7873 },
  bhopal: { lat: 23.2599, lon: 77.4126 },
};

const getWeather = tool(
  async ({ city }) => {
    try {
      let latitude, longitude, name;
      const key = city.toLowerCase().trim();

      if (KNOWN_CITIES[key]) {
        latitude = KNOWN_CITIES[key].lat;
        longitude = KNOWN_CITIES[key].lon;
        name = city;
      } else {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
        );
        const geoData = await geoRes.json();
        if (!geoData.results?.length) return `Could not find location: ${city}`;
        ({ latitude, longitude, name } = geoData.results[0]);
      }

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
      );
      const w = (await weatherRes.json()).current_weather;
      return `Weather in ${name}: ${w.temperature}°C, wind speed ${w.windspeed} km/h`;
    } catch (err) {
      return `Weather fetch failed: ${err.message}`;
    }
  },
  {
    name: "getWeather",
    description:
      "Get current weather for any city. Use when user asks about weather, what to pack, or best time to visit.",
    schema: z.object({
      city: z.string().describe("City name to get weather for"),
    }),
  },
);

const calculator = tool(
  async ({ expression }) => {
    try {
      const result = new Function(`return ${expression}`)();
      return `Result: ${result}`;
    } catch (err) {
      return `Calculation error: ${err.message}`;
    }
  },
  {
    name: "calculator",
    description:
      "Evaluate a math expression. Use for ANY arithmetic — costs, totals, currency conversion. Never do math in your head.",
    schema: z.object({
      expression: z.string().describe("Math expression like '1500 * 3 * 1.18'"),
    }),
  },
);

const currentTime = tool(
  async () => {
    return `Current date and time: ${new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "full",
      timeStyle: "short",
    })}`;
  },
  {
    name: "currentTime",
    description:
      "Get current real date and time in India. Use when user says 'today', 'tomorrow', 'this weekend'.",
    schema: z.object({
      placeholder: z.string().optional().describe("Not used, pass any string"),
    }),
  },
);

export const tools = [getWeather, calculator, currentTime];
