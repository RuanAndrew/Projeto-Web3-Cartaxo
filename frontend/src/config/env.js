// URL do API Gateway (definida em VITE_API_URL no docker-compose / .env).
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

// Token de TESTE, lido apenas em desenvolvimento (npm run dev), até existir login real.
// Tudo que começa com VITE_ vai para o JavaScript do navegador: nunca use um token real aqui.
export const DEV_TOKEN = import.meta.env.DEV ? import.meta.env.VITE_DEV_TOKEN || "" : "";
