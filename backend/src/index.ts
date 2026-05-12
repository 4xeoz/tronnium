import { createApp } from "./app";
import { appConfig } from "./config/config";
import { initScheduler } from "./lib/scan-scheduler";

const app = createApp();

app.listen(appConfig.port, () => {
  console.log(`Backend listening on http://localhost:${appConfig.port}`);
  initScheduler().catch((e) => console.error("[Scheduler] Init failed:", e.message));
});
