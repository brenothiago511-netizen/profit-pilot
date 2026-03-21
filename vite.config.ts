import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const FALLBACK_SUPABASE_URL = "https://gyovaxenxtrogrxmbjde.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3ZheGVueHRyb2dyeG1iamRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTM5NzQsImV4cCI6MjA4MjA2OTk3NH0.juN8Ilhw9t1UdefZVsiLISnLweiOQ3fDzk8aDzQOCxI";

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL ?? FALLBACK_SUPABASE_URL,
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    ),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
      process.env.VITE_SUPABASE_PROJECT_ID ?? "gyovaxenxtrogrxmbjde",
    ),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
