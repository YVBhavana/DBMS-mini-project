
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Service = {
  service_id: number;
  reported_date: string;
  issue_description: string;
  diagnosis: string | null;
  resolution: string | null;
  service_status: string;
  service_cost: number | string | null;
  technician_id: number;
  serial_number: string;
  product_name: string;
  brand: string;
  model_number?: string;
  customer_name: string;
};

type Draft = {
  diagnosis: string;
  resolution: string;
};

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

export default function TechnicianPage() {
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [pageError, setPageError] = useState("");
  const [message, setMessage] = useState("");

  const loadServices = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const response = await fetch("/api/technician", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        setPageError(
          "Access denied. Please sign in using a technician account."
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load service requests."
        );
      }

      const rows: Service[] = data.services ?? [];
      setServices(rows);

      setDrafts((current) => {
        const next = { ...current };

        for (const service of rows) {
          // Keep unsaved text when refreshing the dashboard.
          if (!next[service.service_id]) {
            next[service.service_id] = {
              diagnosis: service.diagnosis ?? "",
              resolution: service.resolution ?? "",
            };
          }
        }

        return next;
      });
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to load service requests."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  function updateDraft(
    serviceId: number,
    field: keyof Draft,
    value: string
  ) {
    setDrafts((current) => ({
      ...current,
      [serviceId]: {
        diagnosis: current[serviceId]?.diagnosis ?? "",
        resolution: current[serviceId]?.resolution ?? "",
        [field]: value,
      },
    }));
  }

  async function updateService(
    service: Service,
    newStatus: string
  ) {
    if (savingId !== null) return;

    const serviceId = Number(service.service_id);
    const draft = drafts[serviceId] ?? {
      diagnosis: service.diagnosis ?? "",
      resolution: service.resolution ?? "",
    };

    setSavingId(serviceId);
    setPageError("");
    setMessage("");

    try {
      console.log("Saving technician service:", serviceId);

      const response = await fetch("/api/technician", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          service_id: serviceId,
          // The API expects "status", not "service_status".
          status: newStatus,
          diagnosis: draft.diagnosis,
          resolution: draft.resolution,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error(
          "Access denied. Please sign in using a technician account."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save the service request."
        );
      }

      const updated = data.service;

      setServices((current) =>
        current.map((item) =>
          Number(item.service_id) === serviceId
            ? {
                ...item,
                service_status: updated.service_status,
                diagnosis: updated.diagnosis,
                resolution: updated.resolution,
              }
            : item
        )
      );

      setDrafts((current) => ({
        ...current,
        [serviceId]: {
          diagnosis: updated.diagnosis ?? "",
          resolution: updated.resolution ?? "",
        },
      }));

      setMessage(
        `Service #${serviceId} saved successfully.`
      );
    } catch (error) {
      console.error("Technician save error:", error);

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to save the service request."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      window.location.replace("/login");
    }
  }

  function formatDate(value: string) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString("en-IN");
  }

  function statusClass(status: string) {
    switch (status.toLowerCase()) {
      case "resolved":
        return "border-emerald-800 bg-emerald-950 text-emerald-300";
      case "in_progress":
        return "border-amber-800 bg-amber-950 text-amber-300";
      default:
        return "border-slate-700 bg-slate-800 text-slate-300";
    }
  }

  const openCount = services.filter(
    (service) => service.service_status !== "resolved"
  ).length;

  const resolvedCount = services.filter(
    (service) => service.service_status === "resolved"
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold tracking-widest text-cyan-400">
              WARRANTIQ
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              Technician Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Manage your assigned service requests.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div>
          <h2 className="text-xl font-semibold">
            Work Overview
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            View customer issues, record your diagnosis, and track repairs.
          </p>
        </div>

        {pageError && (
          <div
            role="alert"
            className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-300"
          >
            {pageError}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-4 text-emerald-300"
          >
            {message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Assigned Requests", value: services.length },
            { label: "Open / In Progress", value: openCount },
            { label: "Resolved", value: resolvedCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">
                {stat.label}
              </p>
              <p className="mt-3 text-3xl font-bold">
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold">
                Assigned Service Requests
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Only requests assigned to your technician account are shown.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadServices()}
              disabled={loading || savingId !== null}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="p-6 text-slate-400">
              Loading assigned requests...
            </p>
          ) : services.length === 0 ? (
            <p className="p-6 text-slate-400">
              No service requests are assigned to your account yet.
            </p>
          ) : (
            <div className="space-y-5 p-5">
              {services.map((service) => {
                const serviceId = Number(service.service_id);

                const draft = drafts[serviceId] ?? {
                  diagnosis: service.diagnosis ?? "",
                  resolution: service.resolution ?? "",
                };

                const isSaving = savingId === serviceId;

                return (
                  <article
                    key={serviceId}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-cyan-300">
                          Service #{serviceId}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold">
                          {service.product_name}
                        </h3>
                        <p className="text-sm text-slate-400">
                          {service.brand} {service.model_number ?? ""}
                        </p>
                        <p className="mt-2 font-mono text-xs text-cyan-300">
                          Serial: {service.serial_number}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs capitalize ${statusClass(service.service_status)}`}
                      >
                        {service.service_status.replaceAll("_", " ")}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-slate-400">
                            Customer
                          </p>
                          <p className="font-medium">
                            {service.customer_name}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-400">
                            Reported issue
                          </p>
                          <p>{service.issue_description}</p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-400">
                            Reported date
                          </p>
                          <p>{formatDate(service.reported_date)}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label
                            htmlFor={`status-${serviceId}`}
                            className="mb-2 block text-sm text-slate-300"
                          >
                            Update status
                          </label>

                          <select
                            id={`status-${serviceId}`}
                            value={service.service_status}
                            disabled={savingId !== null}
                            onChange={(event) =>
                              void updateService(
                                service,
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-cyan-500 disabled:opacity-50"
                          >
                            {STATUSES.map((status) => (
                              <option
                                key={status.value}
                                value={status.value}
                              >
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`diagnosis-${serviceId}`}
                            className="mb-2 block text-sm text-slate-300"
                          >
                            Diagnosis
                          </label>

                          <textarea
                            id={`diagnosis-${serviceId}`}
                            rows={3}
                            maxLength={2000}
                            value={draft.diagnosis}
                            disabled={isSaving}
                            onChange={(event) =>
                              updateDraft(
                                serviceId,
                                "diagnosis",
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-cyan-500 disabled:opacity-50"
                            placeholder="Describe the problem found..."
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`resolution-${serviceId}`}
                            className="mb-2 block text-sm text-slate-300"
                          >
                            Resolution notes
                          </label>

                          <textarea
                            id={`resolution-${serviceId}`}
                            rows={3}
                            maxLength={2000}
                            value={draft.resolution}
                            disabled={isSaving}
                            onChange={(event) =>
                              updateDraft(
                                serviceId,
                                "resolution",
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-cyan-500 disabled:opacity-50"
                            placeholder="Describe the repair or next steps..."
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void updateService(
                              service,
                              service.service_status
                            )
                          }
                          disabled={savingId !== null}
                          className="w-full cursor-pointer rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSaving
                            ? "Saving..."
                            : "Save diagnosis and notes"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-xs text-slate-500">
          Warrantiq · Digital Warranty &amp; Product Service Management
        </p>
      </section>
    </main>
  );
}
