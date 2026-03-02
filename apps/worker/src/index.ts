import {
  claimJobs,
  createDailyUpdate,
  listProjectsByUser,
  processJob,
  refreshRelevantNews,
} from "@aitutor/shared";

const workerId = process.env.WORKER_ID ?? `worker_${Math.random().toString(36).slice(2, 8)}`;
const claimLimit = Number(process.env.CLAIM_LIMIT ?? "5");
const pollMs = Number(process.env.WORKER_POLL_MS ?? "2000");
const schedulerMs = Number(process.env.SCHEDULER_POLL_MS ?? "60000");
const defaultUserId = process.env.DEFAULT_USER_ID ?? "user_test_0001";

function safeRun(name: string, fn: () => void) {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[worker] ${name} failed: ${message}`);
  }
}

function processClaimedJobs() {
  const jobs = claimJobs(workerId, claimLimit);
  if (!jobs.length) return;

  for (const job of jobs) {
    const result = processJob(job.id);
    if (!result?.ok) {
      console.error(`[worker] job failed: ${job.id} code=${result?.job.lastErrorCode ?? "UNKNOWN"}`);
    } else {
      console.log(`[worker] job completed: ${job.id} type=${job.type}`);
    }
  }
}

function runSchedulers() {
  safeRun("news-refresh", () => {
    const refresh = refreshRelevantNews();
    if (!refresh.ok) {
      throw new Error(refresh.errorCode);
    }
    console.log(`[worker] news refreshed: ${refresh.insights.length}`);
  });

  safeRun("daily-update", () => {
    const projects = listProjectsByUser(defaultUserId);
    if (!projects.length) {
      console.log("[worker] daily update skipped: no projects");
      return;
    }

    const update = createDailyUpdate({ userId: defaultUserId });
    if (!update.ok) {
      throw new Error(update.errorCode);
    }
    console.log(`[worker] daily update sent: ${update.update.id}`);
  });
}

function start() {
  console.log(`[worker] starting id=${workerId} pollMs=${pollMs} schedulerMs=${schedulerMs}`);

  setInterval(() => {
    safeRun("process-jobs", processClaimedJobs);
  }, pollMs);

  runSchedulers();
  setInterval(() => {
    runSchedulers();
  }, schedulerMs);
}

start();
