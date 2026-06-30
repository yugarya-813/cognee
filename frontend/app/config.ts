// Base URL of the Engram backend API.
// In production set NEXT_PUBLIC_API_BASE (e.g. the deployed FastAPI URL);
// locally it falls back to the dev backend on port 8000.
export const API =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";
