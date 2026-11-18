"use client";
import { useEffect, useState } from "react";
import { api } from "./store-provider";
type Report = {
  release_decision: string;
  scope: string;
  unenrolled_active_staff: number;
  checks: { name: string; status: string }[];
  external_campaigns: { id: string; status: string }[];
};
export function ReleaseChecks() {
  const [data, setData] = useState<Report | null>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      setData(await api<Report>("admin/readiness"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel">
      <h2>Release checks</h2>
      <p>
        Configuration checks help prepare staging. They do not prove a
        successful payment, refund, courier booking, message delivery, restore
        or managed-database race.
      </p>
      <button className="text-link" onClick={() => void load()}>
        Refresh release checks
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {data && (
        <>
          <p>
            <strong>{data.release_decision}</strong> · {data.scope}
          </p>
          <p>
            Active team accounts without MFA enrollment:{" "}
            {data.unenrolled_active_staff}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Prerequisite</th>
                  <th>Configuration result</th>
                </tr>
              </thead>
              <tbody>
                {data.checks.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name.replaceAll("_", " ")}</td>
                    <td>{c.status.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            External acceptance:{" "}
            {data.external_campaigns
              .map((c) => `${c.id} ${c.status}`)
              .join(" · ")}
          </p>
        </>
      )}
    </section>
  );
}
