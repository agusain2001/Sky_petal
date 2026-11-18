"use client";
import { useEffect, useState } from "react";
import { api } from "./store-provider";
type Job = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  last_error: string | null;
  next_run_at: string;
};
export function BackgroundOperations() {
  const [jobs, setJobs] = useState<Job[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setJobs(await api<Job[]>("admin/jobs"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function run(path: string, body: unknown = {}) {
    setBusy(true);
    setError("");
    try {
      await api(path, body);
      await load();
      setMessage("Operation recorded. Review current job states below.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Background work</h2>
      <p>
        Durable work survives process restarts. Pending provider operations
        remain unconfirmed until evidence is verified. Configure the protected
        maintenance scheduler for automatic processing.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <button
        className="button outline"
        disabled={busy}
        onClick={() => void run("admin/jobs/run")}
      >
        Process queued work
      </button>
      <button
        className="text-link"
        disabled={busy}
        onClick={() => void load().catch((e) => setError(e.message))}
      >
        Refresh background work
      </button>
      {!jobs.length && <p>No background jobs recorded.</p>}
      {jobs.map((job) => (
        <article
          className="panel"
          key={job.id}
          style={{ marginTop: 16, overflowWrap: "anywhere" }}
        >
          <h3>
            {job.kind} · {job.status}
          </h3>
          <p>
            Attempts: {job.attempts} · Next eligible run:{" "}
            {new Date(job.next_run_at).toLocaleString("en-IN")}
          </p>
          {job.last_error && <p>{job.last_error}</p>}
          {["failed", "dead"].includes(job.status) && (
            <button
              className="button outline"
              disabled={busy}
              onClick={() => void run("admin/jobs/retry", { id: job.id })}
            >
              Retry background job
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
