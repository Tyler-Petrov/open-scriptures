import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// API.Bible terms: cached copyrighted text must not outlive 30 days.
crons.daily(
  "purge expired chapter cache",
  { hourUTC: 4, minuteUTC: 0 },
  internal.chapters.purgeExpired,
  {}
);

export default crons;
