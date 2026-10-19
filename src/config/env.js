import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config(); // Render & production environment
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../Backend/.env') });

function getOrsKey() {
  const raw = process.env.OPENROUTESERVICE_API_KEY || process.env.WEATHER || '';
  if (raw.startsWith('eyJ')) {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      if (parsed.org && parsed.id) {
        return `${parsed.org}${parsed.id}`;
      }
    } catch (e) {}
  }
  return raw;
}

export const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: (process.env.MONGODB_URI || '').trim(),
  jwtSecret: (process.env.JWT_SECRET || 'agriconnect_ai_dev_jwt_secret_2026').trim(),
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:3000').trim(),
  mlServiceUrl: (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').trim(),
  
  // External APIs
  dataGovApiKey: (process.env.DATA_GOV_API_KEY || process.env.DATAGOV_API_KEY || '').trim(),
  dataGovResource: (process.env.DATA_GOVT || process.env.DAILY || 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070').trim(),
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: (process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim(),
  
  // Weather API (WeatherAPI.com from ROUTE variable, or Open-Meteo)
  weatherApiKey: (process.env.WEATHER_API_KEY || (process.env.ROUTE && process.env.ROUTE.length === 30 ? process.env.ROUTE : '')).trim(),
  
  // OpenRouteService
  openRouteServiceApiKey: getOrsKey().trim()
};
