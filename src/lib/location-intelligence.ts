import type { EstimateRegionalContext } from "@/types";

type Season = EstimateRegionalContext["season"];

type RegionalProfile = {
  state: string;
  timezone: string;
  climateZone: string;
  pricingRegion: string;
  marketTier: EstimateRegionalContext["marketTier"];
  laborIndex: number;
  materialIndex: number;
  equipmentIndex: number;
  logisticsBase: number;
  defaultCoordinates: { latitude: number; longitude: number };
  weather: {
    summerHeat: number;
    winterFreeze: number;
    stormRisk: number;
    humidity: number;
  };
};

type MetroOverride = {
  marketTier?: EstimateRegionalContext["marketTier"];
  pricingRegion?: string;
  laborIndex?: number;
  materialIndex?: number;
  equipmentIndex?: number;
  logisticsBase?: number;
  coordinates?: { latitude: number; longitude: number };
};

type RegionalInput = {
  address?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  dueDate?: Date | string | null;
  trades: string[];
  companyWorkZones?: string[];
};

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL",
  arizona: "AZ",
  california: "CA",
  colorado: "CO",
  florida: "FL",
  georgia: "GA",
  illinois: "IL",
  massachusetts: "MA",
  nevada: "NV",
  newyork: "NY",
  "new jersey": "NJ",
  northcarolina: "NC",
  oregon: "OR",
  texas: "TX",
  utah: "UT",
  virginia: "VA",
  washington: "WA",
};

const STATE_PROFILES: Record<string, RegionalProfile> = {
  CA: {
    state: "CA",
    timezone: "America/Los_Angeles",
    climateZone: "dry-coastal-west",
    pricingRegion: "California",
    marketTier: "premium",
    laborIndex: 1.16,
    materialIndex: 1.11,
    equipmentIndex: 1.07,
    logisticsBase: 1.02,
    defaultCoordinates: { latitude: 36.7783, longitude: -119.4179 },
    weather: { summerHeat: 0.02, winterFreeze: 0.01, stormRisk: 0.01, humidity: 0.01 },
  },
  TX: {
    state: "TX",
    timezone: "America/Chicago",
    climateZone: "south-central-heat",
    pricingRegion: "Texas",
    marketTier: "elevated",
    laborIndex: 1.05,
    materialIndex: 1.04,
    equipmentIndex: 1.03,
    logisticsBase: 1.01,
    defaultCoordinates: { latitude: 31.9686, longitude: -99.9018 },
    weather: { summerHeat: 0.05, winterFreeze: 0.01, stormRisk: 0.03, humidity: 0.02 },
  },
  FL: {
    state: "FL",
    timezone: "America/New_York",
    climateZone: "humid-subtropical",
    pricingRegion: "Florida",
    marketTier: "elevated",
    laborIndex: 1.07,
    materialIndex: 1.05,
    equipmentIndex: 1.03,
    logisticsBase: 1.02,
    defaultCoordinates: { latitude: 27.6648, longitude: -81.5158 },
    weather: { summerHeat: 0.04, winterFreeze: 0, stormRisk: 0.06, humidity: 0.04 },
  },
  WA: {
    state: "WA",
    timezone: "America/Los_Angeles",
    climateZone: "marine-rain",
    pricingRegion: "Washington",
    marketTier: "premium",
    laborIndex: 1.12,
    materialIndex: 1.08,
    equipmentIndex: 1.06,
    logisticsBase: 1.02,
    defaultCoordinates: { latitude: 47.7511, longitude: -120.7401 },
    weather: { summerHeat: 0.01, winterFreeze: 0.02, stormRisk: 0.03, humidity: 0.03 },
  },
  NY: {
    state: "NY",
    timezone: "America/New_York",
    climateZone: "northeast-four-season",
    pricingRegion: "New York",
    marketTier: "premium",
    laborIndex: 1.17,
    materialIndex: 1.12,
    equipmentIndex: 1.08,
    logisticsBase: 1.03,
    defaultCoordinates: { latitude: 42.9538, longitude: -75.5268 },
    weather: { summerHeat: 0.02, winterFreeze: 0.05, stormRisk: 0.03, humidity: 0.02 },
  },
  NJ: {
    state: "NJ",
    timezone: "America/New_York",
    climateZone: "northeast-four-season",
    pricingRegion: "New Jersey",
    marketTier: "premium",
    laborIndex: 1.14,
    materialIndex: 1.1,
    equipmentIndex: 1.07,
    logisticsBase: 1.03,
    defaultCoordinates: { latitude: 40.0583, longitude: -74.4057 },
    weather: { summerHeat: 0.02, winterFreeze: 0.04, stormRisk: 0.03, humidity: 0.02 },
  },
  CO: {
    state: "CO",
    timezone: "America/Denver",
    climateZone: "mountain-dry",
    pricingRegion: "Colorado",
    marketTier: "elevated",
    laborIndex: 1.08,
    materialIndex: 1.06,
    equipmentIndex: 1.04,
    logisticsBase: 1.03,
    defaultCoordinates: { latitude: 39.5501, longitude: -105.7821 },
    weather: { summerHeat: 0.02, winterFreeze: 0.04, stormRisk: 0.02, humidity: 0.01 },
  },
  AZ: {
    state: "AZ",
    timezone: "America/Phoenix",
    climateZone: "desert-heat",
    pricingRegion: "Arizona",
    marketTier: "elevated",
    laborIndex: 1.06,
    materialIndex: 1.05,
    equipmentIndex: 1.03,
    logisticsBase: 1.02,
    defaultCoordinates: { latitude: 34.0489, longitude: -111.0937 },
    weather: { summerHeat: 0.06, winterFreeze: 0, stormRisk: 0.02, humidity: 0.01 },
  },
  NV: {
    state: "NV",
    timezone: "America/Los_Angeles",
    climateZone: "desert-heat",
    pricingRegion: "Nevada",
    marketTier: "elevated",
    laborIndex: 1.06,
    materialIndex: 1.05,
    equipmentIndex: 1.04,
    logisticsBase: 1.03,
    defaultCoordinates: { latitude: 38.8026, longitude: -116.4194 },
    weather: { summerHeat: 0.06, winterFreeze: 0.01, stormRisk: 0.01, humidity: 0.01 },
  },
  OR: {
    state: "OR",
    timezone: "America/Los_Angeles",
    climateZone: "marine-rain",
    pricingRegion: "Oregon",
    marketTier: "elevated",
    laborIndex: 1.08,
    materialIndex: 1.05,
    equipmentIndex: 1.04,
    logisticsBase: 1.02,
    defaultCoordinates: { latitude: 43.8041, longitude: -120.5542 },
    weather: { summerHeat: 0.01, winterFreeze: 0.02, stormRisk: 0.03, humidity: 0.03 },
  },
  IL: {
    state: "IL",
    timezone: "America/Chicago",
    climateZone: "midwest-four-season",
    pricingRegion: "Illinois",
    marketTier: "elevated",
    laborIndex: 1.07,
    materialIndex: 1.05,
    equipmentIndex: 1.03,
    logisticsBase: 1.02,
    defaultCoordinates: { latitude: 40.6331, longitude: -89.3985 },
    weather: { summerHeat: 0.02, winterFreeze: 0.05, stormRisk: 0.03, humidity: 0.02 },
  },
  GA: {
    state: "GA",
    timezone: "America/New_York",
    climateZone: "humid-subtropical",
    pricingRegion: "Georgia",
    marketTier: "standard",
    laborIndex: 1.03,
    materialIndex: 1.02,
    equipmentIndex: 1.01,
    logisticsBase: 1.01,
    defaultCoordinates: { latitude: 32.1656, longitude: -82.9001 },
    weather: { summerHeat: 0.04, winterFreeze: 0.01, stormRisk: 0.03, humidity: 0.03 },
  },
  NC: {
    state: "NC",
    timezone: "America/New_York",
    climateZone: "humid-subtropical",
    pricingRegion: "North Carolina",
    marketTier: "standard",
    laborIndex: 1.03,
    materialIndex: 1.02,
    equipmentIndex: 1.01,
    logisticsBase: 1.01,
    defaultCoordinates: { latitude: 35.7596, longitude: -79.0193 },
    weather: { summerHeat: 0.03, winterFreeze: 0.01, stormRisk: 0.03, humidity: 0.03 },
  },
  MA: {
    state: "MA",
    timezone: "America/New_York",
    climateZone: "northeast-four-season",
    pricingRegion: "Massachusetts",
    marketTier: "premium",
    laborIndex: 1.12,
    materialIndex: 1.08,
    equipmentIndex: 1.05,
    logisticsBase: 1.02,
    defaultCoordinates: { latitude: 42.4072, longitude: -71.3824 },
    weather: { summerHeat: 0.02, winterFreeze: 0.05, stormRisk: 0.03, humidity: 0.02 },
  },
  VA: {
    state: "VA",
    timezone: "America/New_York",
    climateZone: "mid-atlantic",
    pricingRegion: "Virginia",
    marketTier: "standard",
    laborIndex: 1.04,
    materialIndex: 1.03,
    equipmentIndex: 1.02,
    logisticsBase: 1.01,
    defaultCoordinates: { latitude: 37.4316, longitude: -78.6569 },
    weather: { summerHeat: 0.03, winterFreeze: 0.02, stormRisk: 0.02, humidity: 0.02 },
  },
  UT: {
    state: "UT",
    timezone: "America/Denver",
    climateZone: "mountain-dry",
    pricingRegion: "Utah",
    marketTier: "standard",
    laborIndex: 1.03,
    materialIndex: 1.02,
    equipmentIndex: 1.01,
    logisticsBase: 1.01,
    defaultCoordinates: { latitude: 39.321, longitude: -111.0937 },
    weather: { summerHeat: 0.02, winterFreeze: 0.04, stormRisk: 0.01, humidity: 0.01 },
  },
};

const METRO_OVERRIDES: Record<string, MetroOverride> = {
  "los angeles,ca": {
    pricingRegion: "Los Angeles Metro",
    laborIndex: 1.19,
    materialIndex: 1.13,
    equipmentIndex: 1.08,
    coordinates: { latitude: 34.0522, longitude: -118.2437 },
  },
  "pasadena,ca": {
    pricingRegion: "Los Angeles Metro",
    laborIndex: 1.18,
    materialIndex: 1.12,
    equipmentIndex: 1.08,
    coordinates: { latitude: 34.1478, longitude: -118.1445 },
  },
  "burbank,ca": {
    pricingRegion: "Los Angeles Metro",
    laborIndex: 1.17,
    materialIndex: 1.12,
    equipmentIndex: 1.07,
    coordinates: { latitude: 34.1808, longitude: -118.309 },
  },
  "glendale,ca": {
    pricingRegion: "Los Angeles Metro",
    laborIndex: 1.17,
    materialIndex: 1.12,
    equipmentIndex: 1.07,
    coordinates: { latitude: 34.1425, longitude: -118.2551 },
  },
  "long beach,ca": {
    pricingRegion: "Los Angeles Metro",
    laborIndex: 1.16,
    materialIndex: 1.11,
    equipmentIndex: 1.07,
    coordinates: { latitude: 33.7701, longitude: -118.1937 },
  },
  "frisco,tx": {
    pricingRegion: "Dallas-Fort Worth",
    marketTier: "elevated",
    laborIndex: 1.08,
    materialIndex: 1.06,
    equipmentIndex: 1.04,
    coordinates: { latitude: 33.1507, longitude: -96.8236 },
  },
  "plano,tx": {
    pricingRegion: "Dallas-Fort Worth",
    marketTier: "elevated",
    laborIndex: 1.08,
    materialIndex: 1.06,
    equipmentIndex: 1.04,
    coordinates: { latitude: 33.0198, longitude: -96.6989 },
  },
  "dallas,tx": {
    pricingRegion: "Dallas-Fort Worth",
    marketTier: "elevated",
    laborIndex: 1.09,
    materialIndex: 1.07,
    equipmentIndex: 1.05,
    coordinates: { latitude: 32.7767, longitude: -96.797 },
  },
  "fort worth,tx": {
    pricingRegion: "Dallas-Fort Worth",
    marketTier: "elevated",
    laborIndex: 1.08,
    materialIndex: 1.06,
    equipmentIndex: 1.04,
    coordinates: { latitude: 32.7555, longitude: -97.3308 },
  },
  "mckinney,tx": {
    pricingRegion: "Dallas-Fort Worth",
    laborIndex: 1.07,
    materialIndex: 1.06,
    equipmentIndex: 1.04,
    coordinates: { latitude: 33.1976, longitude: -96.6153 },
  },
  "irving,tx": {
    pricingRegion: "Dallas-Fort Worth",
    laborIndex: 1.08,
    materialIndex: 1.06,
    equipmentIndex: 1.04,
    coordinates: { latitude: 32.814, longitude: -96.9489 },
  },
  "wichita falls,tx": {
    pricingRegion: "North Texas",
    marketTier: "standard",
    laborIndex: 1.03,
    materialIndex: 1.03,
    equipmentIndex: 1.02,
    coordinates: { latitude: 33.9137, longitude: -98.4934 },
  },
  "sanger,tx": {
    pricingRegion: "North Texas",
    marketTier: "standard",
    laborIndex: 1.03,
    materialIndex: 1.03,
    equipmentIndex: 1.02,
    coordinates: { latitude: 33.3632, longitude: -97.1739 },
  },
  "tyler,tx": {
    pricingRegion: "East Texas",
    marketTier: "standard",
    laborIndex: 1.02,
    materialIndex: 1.02,
    equipmentIndex: 1.01,
    coordinates: { latitude: 32.3513, longitude: -95.3011 },
  },
};

const TRADE_PREMIUMS: Record<
  string,
  {
    labor: number;
    material: number;
    equipment: number;
  }
> = {
  general: { labor: 0.01, material: 0.01, equipment: 0 },
  concrete: { labor: 0.02, material: 0.04, equipment: 0.03 },
  framing: { labor: 0.02, material: 0.02, equipment: 0.01 },
  drywall: { labor: 0.01, material: 0.01, equipment: 0 },
  electrical: { labor: 0.04, material: 0.02, equipment: 0.01 },
  plumbing: { labor: 0.03, material: 0.03, equipment: 0.01 },
  mechanical: { labor: 0.03, material: 0.03, equipment: 0.02 },
  painting: { labor: 0.01, material: 0.01, equipment: 0 },
  finishes: { labor: 0.02, material: 0.02, equipment: 0 },
};

function round(value: number) {
  return Number(value.toFixed(2));
}

function normalizeToken(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTradeKey(value?: string | null) {
  return normalizeToken(value).replace(/\s+/g, "-") || "general";
}

function findSeason(value?: Date | string | null): Season {
  const month = value ? new Date(value).getMonth() : new Date().getMonth();
  if (month <= 1 || month === 11) return "winter";
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  return "fall";
}

function resolveStateCode(value?: string | null) {
  const token = normalizeToken(value);
  if (!token) return undefined;
  if (token.length === 2) return token.toUpperCase();

  const flattened = token.replace(/\s+/g, "");
  return STATE_NAME_TO_CODE[flattened] || STATE_NAME_TO_CODE[token];
}

function parseLocationTokens(input: RegionalInput) {
  const address = input.address || "";
  const location = input.location || "";
  const source = [address, location].filter(Boolean).join(", ");

  const addressMatch =
    source.match(/,\s*([^,]+),\s*([A-Za-z]{2}|[A-Za-z ]+)(?:\s+(\d{5}))?/i) || [];
  const city = addressMatch[1]?.trim();
  const state = resolveStateCode(addressMatch[2]);
  const postalCode = addressMatch[3]?.trim();

  if (city || state) {
    return { city, state, postalCode };
  }

  const locationParts = location.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    city: locationParts[0],
    state: resolveStateCode(locationParts[1]),
    postalCode: undefined,
  };
}

function resolveProfile(state?: string) {
  return STATE_PROFILES[state || ""] || {
    state: state || "US",
    timezone: "America/Chicago",
    climateZone: "continental-mixed",
    pricingRegion: state || "United States",
    marketTier: "standard" as const,
    laborIndex: 1,
    materialIndex: 1,
    equipmentIndex: 1,
    logisticsBase: 1.01,
    defaultCoordinates: { latitude: 39.8283, longitude: -98.5795 },
    weather: { summerHeat: 0.02, winterFreeze: 0.02, stormRisk: 0.02, humidity: 0.01 },
  };
}

function resolveMetro(city?: string, state?: string) {
  const key = `${normalizeToken(city)},${(state || "").toLowerCase()}`;
  return METRO_OVERRIDES[key] || null;
}

function isTradeExposed(trade: string) {
  return ["concrete", "painting", "general", "civil", "roofing"].some((token) =>
    normalizeTradeKey(trade).includes(token)
  );
}

function isTradeSemiExposed(trade: string) {
  return ["framing", "mechanical", "plumbing"].some((token) =>
    normalizeTradeKey(trade).includes(token)
  );
}

function resolveCoordinates(input: RegionalInput, city?: string, state?: string, metro?: MetroOverride) {
  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    return {
      latitude: input.latitude,
      longitude: input.longitude,
      coordinateSource: "opportunity" as const,
    };
  }

  if (metro?.coordinates) {
    return {
      ...metro.coordinates,
      coordinateSource: "city-centroid" as const,
    };
  }

  const profile = resolveProfile(state);
  if (city || state) {
    return {
      ...profile.defaultCoordinates,
      coordinateSource: city ? ("city-centroid" as const) : ("state-centroid" as const),
    };
  }

  return {
    latitude: null,
    longitude: null,
    coordinateSource: "none" as const,
  };
}

function resolveLogisticsFactor(companyWorkZones: string[] | undefined, city?: string, state?: string, pricingRegion?: string) {
  const zones = (companyWorkZones || []).map((zone) => normalizeToken(zone));
  const candidates = [city, state, pricingRegion].map((value) => normalizeToken(value));
  const inPrimaryZone = candidates.some((candidate) => candidate && zones.some((zone) => zone.includes(candidate) || candidate.includes(zone)));
  return inPrimaryZone ? 1 : 1.03;
}

function buildWeatherAdjustments(profile: RegionalProfile, season: Season, trades: string[]) {
  const exposed = trades.some((trade) => isTradeExposed(trade));
  const semiExposed = trades.some((trade) => isTradeSemiExposed(trade));
  let weatherFactor = 1;
  let scheduleRiskFactor = 1;
  const drivers: string[] = [];

  if (season === "summer" && profile.weather.summerHeat > 0) {
    weatherFactor += exposed ? profile.weather.summerHeat : profile.weather.summerHeat * 0.45;
    scheduleRiskFactor += semiExposed ? profile.weather.summerHeat * 0.4 : profile.weather.summerHeat * 0.2;
    drivers.push("summer heat exposure");
  }

  if (season === "winter" && profile.weather.winterFreeze > 0) {
    weatherFactor += exposed ? profile.weather.winterFreeze : profile.weather.winterFreeze * 0.35;
    scheduleRiskFactor += profile.weather.winterFreeze * 0.45;
    drivers.push("winter protection and cure risk");
  }

  if ((season === "spring" || season === "fall") && profile.weather.stormRisk > 0) {
    weatherFactor += exposed ? profile.weather.stormRisk * 0.6 : profile.weather.stormRisk * 0.25;
    scheduleRiskFactor += profile.weather.stormRisk * 0.5;
    drivers.push("storm and moisture interruptions");
  }

  if (profile.weather.humidity > 0.02 && trades.some((trade) => ["painting", "finishes", "drywall"].includes(normalizeTradeKey(trade)))) {
    scheduleRiskFactor += profile.weather.humidity * 0.25;
    drivers.push("humidity-sensitive finish work");
  }

  return {
    weatherFactor: round(weatherFactor),
    scheduleRiskFactor: round(scheduleRiskFactor),
    weatherSummary:
      drivers.length > 0
        ? `Seasonal adjustments applied for ${drivers.join(", ")}.`
        : "No major seasonal climate pressure detected for the current mix of trades.",
  };
}

export function resolveRegionalContext(input: RegionalInput): EstimateRegionalContext {
  const { city, state, postalCode } = parseLocationTokens(input);
  const profile = resolveProfile(state);
  const metro = resolveMetro(city, state);
  const season = findSeason(input.dueDate);
  const coordinates = resolveCoordinates(input, city, state, metro);
  const pricingRegion = metro?.pricingRegion || profile.pricingRegion;
  const marketTier = metro?.marketTier || profile.marketTier;
  const laborIndex = round(metro?.laborIndex || profile.laborIndex);
  const materialIndex = round(metro?.materialIndex || profile.materialIndex);
  const equipmentIndex = round(metro?.equipmentIndex || profile.equipmentIndex);
  const logisticsFactor = round(
    (metro?.logisticsBase || profile.logisticsBase) *
      resolveLogisticsFactor(input.companyWorkZones, city, state, pricingRegion)
  );
  const weather = buildWeatherAdjustments(profile, season, input.trades);
  const tradeAdjustments = Object.fromEntries(
    [...new Set(input.trades.map((trade) => normalizeTradeKey(trade)).filter(Boolean))].map((trade) => {
      const premium = TRADE_PREMIUMS[trade] || TRADE_PREMIUMS.general;
      return [
        trade,
        {
          labor: round(laborIndex + premium.labor),
          material: round(materialIndex + premium.material),
          equipment: round(equipmentIndex + premium.equipment),
        },
      ];
    })
  );
  const marketFactor = round(
    ((laborIndex * 0.45 + materialIndex * 0.4 + equipmentIndex * 0.15) * logisticsFactor)
  );
  const drivers = [
    `${pricingRegion} pricing region`,
    `market tier ${marketTier}`,
    logisticsFactor > 1 ? "out-of-zone logistics" : "within primary service zone",
    ...weather.weatherSummary
      .replace("Seasonal adjustments applied for ", "")
      .replace(/\.$/, "")
      .split(", ")
      .filter((item) => item && item !== "No major seasonal climate pressure detected for the current mix of trades"),
  ].filter(Boolean);

  return {
    source: "heuristic",
    address: input.address || input.location || undefined,
    city: city || undefined,
    state: state || undefined,
    postalCode,
    metro: metro?.pricingRegion || undefined,
    pricingRegion,
    marketTier,
    timezone: profile.timezone,
    climateZone: profile.climateZone,
    season,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    coordinateSource: coordinates.coordinateSource,
    geocodingProvider: "heuristic",
    weatherProvider: "heuristic",
    marketDataProvider: "heuristic",
    locationSummary: city && state ? `${city}, ${state} • ${pricingRegion}` : pricingRegion,
    weatherSummary: weather.weatherSummary,
    weatherFactor: weather.weatherFactor,
    marketFactor,
    logisticsFactor,
    scheduleRiskFactor: weather.scheduleRiskFactor,
    laborIndex,
    materialIndex,
    equipmentIndex,
    drivers,
    liveDataNotes: [],
    weatherSnapshot: null,
    marketSeries: null,
    tradeAdjustments,
  };
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "FRG-Builder/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Remote request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchOpenMeteoGeocoding(address: string) {
  const endpoint =
    process.env.OPEN_METEO_GEOCODING_BASE_URL || "https://geocoding-api.open-meteo.com";
  const url = `${endpoint.replace(/\/+$/, "")}/v1/search?name=${encodeURIComponent(address)}&count=1&language=en&format=json`;
  const payload = await fetchJson<{
    results?: Array<{
      name?: string;
      country_code?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
      admin1?: string;
      admin1_code?: string;
      postcodes?: string[];
    }>;
  }>(url);

  return payload.results?.[0] || null;
}

function shouldUseLiveWeather(dueDate?: Date | string | null) {
  if (!dueDate) return false;
  const today = new Date();
  const target = new Date(dueDate);
  const dayDiff = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  return dayDiff >= -1 && dayDiff <= 15;
}

async function fetchOpenMeteoWeather(input: {
  latitude: number;
  longitude: number;
  timezone: string;
  dueDate?: Date | string | null;
}) {
  const endpoint = process.env.OPEN_METEO_WEATHER_BASE_URL || "https://api.open-meteo.com";
  const dueDate = input.dueDate ? new Date(input.dueDate) : new Date();
  const date = dueDate.toISOString().slice(0, 10);
  const url =
    `${endpoint.replace(/\/+$/, "")}/v1/forecast?latitude=${input.latitude}&longitude=${input.longitude}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
    `&timezone=${encodeURIComponent(input.timezone || "auto")}&start_date=${date}&end_date=${date}`;
  const payload = await fetchJson<{
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      wind_speed_10m_max?: number[];
    };
  }>(url);

  if (!payload.daily?.time?.length) {
    return null;
  }

  return {
    date: payload.daily.time[0],
    temperatureMaxC: payload.daily.temperature_2m_max?.[0],
    temperatureMinC: payload.daily.temperature_2m_min?.[0],
    precipitationMm: payload.daily.precipitation_sum?.[0],
    windSpeedMaxKph: payload.daily.wind_speed_10m_max?.[0],
  };
}

async function fetchFredObservation(seriesId: string, apiKey: string, baseline: number) {
  const endpoint = process.env.FRED_API_BASE_URL || "https://api.stlouisfed.org";
  const url =
    `${endpoint.replace(/\/+$/, "")}/fred/series/observations?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(apiKey)}&file_type=json&sort_order=desc&limit=1`;
  const payload = await fetchJson<{
    observations?: Array<{ date?: string; value?: string }>;
  }>(url);
  const observation = payload.observations?.find((item) => item.value && item.value !== ".");
  const value = Number(observation?.value);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const multiplier = round(Math.min(Math.max(value / baseline, 0.85), 1.35));

  return {
    provider: "fred" as const,
    seriesId,
    date: observation?.date,
    value,
    baseline,
    multiplier,
  };
}

function applyLiveWeatherAdjustments(
  context: EstimateRegionalContext,
  trades: string[],
  weatherSnapshot: NonNullable<EstimateRegionalContext["weatherSnapshot"]>
) {
  let weatherFactor = context.weatherFactor;
  let scheduleRiskFactor = context.scheduleRiskFactor;
  const liveDrivers = [...context.drivers];
  const notes = [...(context.liveDataNotes || [])];
  const exposed = trades.some((trade) => isTradeExposed(trade));

  if ((weatherSnapshot.precipitationMm || 0) >= 8) {
    weatherFactor += exposed ? 0.03 : 0.01;
    scheduleRiskFactor += 0.03;
    liveDrivers.push("forecast precipitation");
  }

  if ((weatherSnapshot.windSpeedMaxKph || 0) >= 30) {
    weatherFactor += exposed ? 0.02 : 0.01;
    scheduleRiskFactor += 0.02;
    liveDrivers.push("forecast wind exposure");
  }

  if ((weatherSnapshot.temperatureMaxC || 0) >= 35) {
    weatherFactor += 0.03;
    scheduleRiskFactor += 0.02;
    liveDrivers.push("forecast heat window");
  }

  if ((weatherSnapshot.temperatureMinC || 20) <= 2) {
    weatherFactor += 0.03;
    scheduleRiskFactor += 0.03;
    liveDrivers.push("forecast cold protection");
  }

  notes.push("Open-Meteo forecast applied to weather and schedule factors.");

  return {
    ...context,
    source: "hybrid-live" as const,
    weatherProvider: "open-meteo" as const,
    weatherFactor: round(weatherFactor),
    scheduleRiskFactor: round(scheduleRiskFactor),
    weatherSummary: `Live forecast for ${weatherSnapshot.date}: max ${weatherSnapshot.temperatureMaxC ?? "?"}C, min ${weatherSnapshot.temperatureMinC ?? "?"}C, precipitation ${weatherSnapshot.precipitationMm ?? "?"} mm, wind ${weatherSnapshot.windSpeedMaxKph ?? "?"} kph.`,
    weatherSnapshot,
    drivers: [...new Set(liveDrivers)],
    liveDataNotes: notes,
  };
}

function rebuildTradeAdjustments(context: EstimateRegionalContext) {
  const rebuilt = Object.fromEntries(
    Object.keys(context.tradeAdjustments).map((trade) => {
      const premium = TRADE_PREMIUMS[trade] || TRADE_PREMIUMS.general;
      return [
        trade,
        {
          labor: round(context.laborIndex + premium.labor),
          material: round(context.materialIndex + premium.material),
          equipment: round(context.equipmentIndex + premium.equipment),
        },
      ];
    })
  );

  return {
    ...context,
    tradeAdjustments: rebuilt,
  };
}

export async function resolveRegionalContextLive(
  input: RegionalInput
): Promise<EstimateRegionalContext> {
  let context = resolveRegionalContext(input);

  try {
    if (
      (!context.latitude || !context.longitude) &&
      (input.address || input.location)
    ) {
      const geocoded = await fetchOpenMeteoGeocoding(input.address || input.location || "");
      if (geocoded?.latitude && geocoded?.longitude) {
        const state = resolveStateCode(geocoded.admin1_code || geocoded.admin1);
        const profile = resolveProfile(state);
        const metro = resolveMetro(geocoded.name, state);
        const pricingRegion = metro?.pricingRegion || profile.pricingRegion;
        context = {
          ...context,
          source: "hybrid-live",
          city: geocoded.name || context.city,
          state: state || context.state,
          postalCode: geocoded.postcodes?.[0] || context.postalCode,
          timezone: geocoded.timezone || context.timezone,
          pricingRegion,
          metro: metro?.pricingRegion || context.metro,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          coordinateSource: "open-meteo",
          geocodingProvider: "open-meteo",
          locationSummary:
            geocoded.name && state ? `${geocoded.name}, ${state} • ${pricingRegion}` : context.locationSummary,
          liveDataNotes: [...(context.liveDataNotes || []), "Open-Meteo geocoding resolved live coordinates."],
        };
      }
    }
  } catch (error) {
    context = {
      ...context,
      liveDataNotes: [
        ...(context.liveDataNotes || []),
        `Live geocoding unavailable: ${error instanceof Error ? error.message : "unknown error"}.`,
      ],
    };
  }

  try {
    if (
      typeof context.latitude === "number" &&
      typeof context.longitude === "number" &&
      shouldUseLiveWeather(input.dueDate)
    ) {
      const weatherSnapshot = await fetchOpenMeteoWeather({
        latitude: context.latitude,
        longitude: context.longitude,
        timezone: context.timezone,
        dueDate: input.dueDate,
      });

      if (weatherSnapshot) {
        context = applyLiveWeatherAdjustments(context, input.trades, weatherSnapshot);
      }
    }
  } catch (error) {
    context = {
      ...context,
      liveDataNotes: [
        ...(context.liveDataNotes || []),
        `Live weather unavailable: ${error instanceof Error ? error.message : "unknown error"}.`,
      ],
    };
  }

  try {
    const apiKey = process.env.FRED_API_KEY;
    const laborSeries = process.env.FRED_LABOR_SERIES_ID;
    const materialSeries = process.env.FRED_MATERIAL_SERIES_ID;
    const equipmentSeries = process.env.FRED_EQUIPMENT_SERIES_ID;
    const laborBaseline = Number(process.env.FRED_LABOR_BASELINE || 100);
    const materialBaseline = Number(process.env.FRED_MATERIAL_BASELINE || 100);
    const equipmentBaseline = Number(process.env.FRED_EQUIPMENT_BASELINE || 100);

    if (apiKey && (laborSeries || materialSeries || equipmentSeries)) {
      const [laborObservation, materialObservation, equipmentObservation] = await Promise.all([
        laborSeries ? fetchFredObservation(laborSeries, apiKey, laborBaseline) : Promise.resolve(null),
        materialSeries
          ? fetchFredObservation(materialSeries, apiKey, materialBaseline)
          : Promise.resolve(null),
        equipmentSeries
          ? fetchFredObservation(equipmentSeries, apiKey, equipmentBaseline)
          : Promise.resolve(null),
      ]);

      if (laborObservation || materialObservation || equipmentObservation) {
        const laborIndex = round(context.laborIndex * (laborObservation?.multiplier || 1));
        const materialIndex = round(context.materialIndex * (materialObservation?.multiplier || 1));
        const equipmentIndex = round(
          context.equipmentIndex * (equipmentObservation?.multiplier || 1)
        );

        context = rebuildTradeAdjustments({
          ...context,
          source: "hybrid-live",
          marketDataProvider: "fred",
          laborIndex,
          materialIndex,
          equipmentIndex,
          marketFactor: round(
            ((laborIndex * 0.45 + materialIndex * 0.4 + equipmentIndex * 0.15) *
              context.logisticsFactor)
          ),
          marketSeries: {
            labor: laborObservation || undefined,
            material: materialObservation || undefined,
            equipment: equipmentObservation || undefined,
          },
          liveDataNotes: [
            ...(context.liveDataNotes || []),
            "FRED market indices applied to labor, material and equipment multipliers.",
          ],
        });
      }
    }
  } catch (error) {
    context = {
      ...context,
      liveDataNotes: [
        ...(context.liveDataNotes || []),
        `FRED market data unavailable: ${error instanceof Error ? error.message : "unknown error"}.`,
      ],
    };
  }

  return context;
}
