// Starts the background job worker inside the web server process, so no
// separate Railway service is needed. Set WORKER_ENABLED=false to turn it off.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
