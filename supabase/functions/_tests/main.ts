// No external network credentials; all workers receive synthetic configuration.
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  const path = new URL(request.url).pathname;
  const servicePath = path === "/function" ? "/test/function" : path === "/ai" ? "/test/ai" : "/test/worker";
  const worker = await EdgeRuntime.userWorkers.create({
    servicePath, memoryLimitMb: 256, workerTimeoutMs: 30_000,
    cpuTimeSoftLimitMs: 2_000, cpuTimeHardLimitMs: 2_000,
    envVars: [
      ["SUPABASE_URL", "http://127.0.0.1:9"],
      ["SUPABASE_SERVICE_ROLE_KEY", "synthetic-server-key"],
      ["SUPABASE_ANON_KEY", "synthetic-public-key"],
    ],
  });
  return worker.fetch(request);
});
