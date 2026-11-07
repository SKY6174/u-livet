import { fileURLToPath } from "node:url";

// Use the lockfile-pinned CLI even when a script is run directly with node.
export const SUPABASE_CLI = fileURLToPath(new URL("../../node_modules/.bin/supabase", import.meta.url));
