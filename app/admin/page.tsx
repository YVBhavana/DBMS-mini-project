
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ServiceNotes from "./service-notes";

type AppUser = {
  user_id: number;
  full_name: string;
  email: string;
  role: "admin" | "customer" | "technician";
  created_at: string;
};

type Product = {
  purchase_item_id: number;
  serial_number: string;
  product_name: string;
  brand: string;
  model_number: string;
  category: string;
  warranty_period_months: number;
  start_date: string | null;
  end_date: string | null;
  warranty_status: string | null;
  current_warranty_state: string;
};

type Service = {
  service_id: number;
  reported_date: string;
  issue_description: string;
  diagnosis: string | null;
  resolution: string | null;
  service_status: string;
  service_cost: number | string | null;
  serial_number: string;
  product_name: string;
  brand: string;
  model_number: string;
  customer_name: string;
  technician_id: number | null;
  technician_name: string | null;
};

const SERVICE_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
] as const;

export default function AdminPage() {
  const router = useRouter();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingServiceId, setUpdatingServiceId] = useState<number | null>(
    null
  );
  const [serviceMessage, setServiceMessage] = useState("");
  const [serviceError, setServiceError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const responses = await Promise.all([
          fetch("/api/admin", { cache: "no-store" }),
          fetch("/api/products", { cache: "no-store" }),
          fetch("/api/services", { cache: "no-store" }),
        ]);

        if (responses.some((response) => response.status === 401)) {
          router.replace("/login");
          return;
        }

        if (responses.some((response) => response.status === 403)) {
          router.replace("/");
          return;
        }

        if (responses.some((response) => !response.ok)) {
          throw new Error("Unable to load dashboard data.");
        }

        const [usersData, productsData, servicesData] = await Promise.all(
          responses.map((response) => response.json())
        );

        if (!cancelled) {
          setUsers(usersData.users ?? []);
          setProducts(productsData.products ?? []);
          setServices(servicesData.services ?? []);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Unable to load some dashboard data. Check the API routes and refresh."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  async function handleServiceStatusChange(
    serviceId: number,
    newStatus: string
  ) {
    const currentService = services.find(
      (service) => Number(service.service_id) === Number(serviceId)
    );

    if (
      !currentService ||
      currentService.service_status === newStatus ||
      updatingServiceId !== null
    ) {
      return;
    }

    const previousStatus = currentService.service_status;
    const previousDiagnosis = currentService.diagnosis;
    const previousResolution = currentService.resolution;

    setUpdatingServiceId(serviceId);
    setServiceMessage("");
    setServiceError("");

    // Optimistically update the controlled dropdown and status badge immediately.
    setServices((currentServices) =>
      currentServices.map((service) =>
        Number(service.service_id) === Number(serviceId)
          ? { ...service, service_status: newStatus }
          : service
      )
    );

    try {
      const response = await fetch("/api/services", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          service_id: Number(serviceId),
          service_status: newStatus,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error || `Could not update status (HTTP ${response.status}).`
        );
      }

      // Keep the selected value in the UI. Do not immediately overwrite it
      // with a second GET request, which could return stale data.
      setServices((currentServices) =>
        currentServices.map((service) =>
          Number(service.service_id) === Number(serviceId)
            ? {
                ...service,
                service_status: newStatus,
                diagnosis: data?.service?.diagnosis ?? service.diagnosis,
                resolution: data?.service?.resolution ?? service.resolution,
              }
            : service
        )
      );

      setServiceMessage(
        `Service #${serviceId} status changed to ${newStatus.replaceAll("_", " ")}.`
      );
    } catch (err) {
      // Revert the UI if the server reports a failure.
      setServices((currentServices) =>
        currentServices.map((service) =>
          Number(service.service_id) === Number(serviceId)
            ? {
                ...service,
                service_status: previousStatus,
                diagnosis: previousDiagnosis,
                resolution: previousResolution,
              }
            : service
        )
      );

      setServiceError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while updating the status."
      );
    } finally {
      setUpdatingServiceId(null);
    }
  }

  const adminCount = users.filter((user) => user.role === "admin").length;
  const customerCount = users.filter(
    (user) => user.role === "customer"
  ).length;
  const technicianCount = users.filter(
    (user) => user.role === "technician"
  ).length;

  const openServices = services.filter(
    (service) =>
      !["resolved", "closed", "cancelled"].includes(
        service.service_status.toLowerCase()
      )
  ).length;

  const resolvedServices = services.filter((service) =>
    ["resolved", "closed"].includes(service.service_status.toLowerCase())
  ).length;

  function formatDate(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString();
  }

  function statusStyle(status: string) {
    switch (status.toLowerCase()) {
      case "active":
      case "resolved":
      case "closed":
        return "border-emerald-800 bg-emerald-950 text-emerald-300";
      case "expired":
      case "cancelled":
        return "border-red-800 bg-red-950 text-red-300";
      case "claimed":
      case "in_progress":
      case "in progress":
        return "border-amber-800 bg-amber-950 text-amber-300";
      default:
        return "border-slate-700 bg-slate-800 text-slate-300";
    }
  }

  function money(value: number | string | null) {
    const amount = Number(value ?? 0);

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold tracking-widest text-cyan-400">
              WARRANTIQ
            </p>
            <h1 className="mt-1 text-2xl font-bold">Admin Dashboard</h1>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <div>
          <h2 className="text-xl font-semibold">System Overview</h2>
          <p className="mt-2 text-sm text-slate-400">
            Monitor users, registered products, warranties, and service
            requests.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-300"
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Total Users", value: users.length },
            { label: "Administrators", value: adminCount },
            { label: "Customers", value: customerCount },
            { label: "Technicians", value: technicianCount },
            { label: "Open Services", value: openServices },
            { label: "Resolved Services", value: resolvedServices },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className="mt-3 text-3xl font-bold">
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Registered Users */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-6 py-5">
            <h2 className="text-lg font-semibold">Registered Users</h2>
            <p className="mt-1 text-sm text-slate-400">
              Accounts retrieved from PostgreSQL.
            </p>
          </div>

          {loading ? (
            <p className="p-6 text-slate-400">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-slate-400">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/60 text-slate-400">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {users.map((user) => (
                    <tr
                      key={user.user_id}
                      className="hover:bg-slate-800/40"
                    >
                      <td className="px-6 py-4">{user.user_id}</td>
                      <td className="px-6 py-4 font-medium">
                        {user.full_name}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs capitalize">
                          {user.role}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-400">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Registered Products */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold">Registered Products</h2>
              <p className="mt-1 text-sm text-slate-400">
                Products and warranties loaded from PostgreSQL.
              </p>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-sm">
              {loading ? "Loading..." : `${products.length} products`}
            </span>
          </div>

          {loading ? (
            <p className="p-6 text-slate-400">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="p-6 text-slate-400">
              No registered products found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/60 text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Brand / Model</th>
                    <th className="px-6 py-4">Serial Number</th>
                    <th className="px-6 py-4">Warranty Period</th>
                    <th className="px-6 py-4">Expiry Date</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {products.map((product) => (
                    <tr
                      key={product.purchase_item_id}
                      className="hover:bg-slate-800/40"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium">{product.product_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {product.category}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {product.brand}
                        <p className="mt-1 text-xs text-slate-500">
                          {product.model_number}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs">
                        {product.serial_number}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {product.warranty_period_months} months
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {formatDate(product.end_date)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs capitalize ${statusStyle(product.current_warranty_state)}`}
                        >
                          {product.current_warranty_state.replaceAll("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Service Requests */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold">Service Requests</h2>
              <p className="mt-1 text-sm text-slate-400">
                Reported issues, assigned technicians, and resolutions.
              </p>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-sm">
              {loading ? "Loading..." : `${services.length} requests`}
            </span>
          </div>

          {serviceMessage && (
            <p
              role="status"
              className="border-b border-emerald-900 bg-emerald-950/30 px-6 py-3 text-sm text-emerald-300"
            >
              {serviceMessage}
            </p>
          )}

          {serviceError && (
            <p
              role="alert"
              className="border-b border-red-900 bg-red-950/30 px-6 py-3 text-sm text-red-300"
            >
              {serviceError}
            </p>
          )}

          {loading ? (
            <p className="p-6 text-slate-400">Loading service requests...</p>
          ) : services.length === 0 ? (
            <p className="p-6 text-slate-400">
              No service requests found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/60 text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Request</th>
                    <th className="px-6 py-4">Product / Serial</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Issue</th>
                    <th className="px-6 py-4">Technician</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Cost</th>
                    <th className="px-6 py-4">Reported</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {services.map((service) => (
                    <tr
                      key={service.service_id}
                      className="align-top hover:bg-slate-800/40"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        #{service.service_id}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium">{service.product_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {service.brand} {service.model_number}
                        </p>
                        <p className="mt-1 font-mono text-xs text-cyan-300">
                          {service.serial_number}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {service.customer_name}
                      </td>
                      <td className="min-w-56 px-6 py-4">
                        <p>{service.issue_description}</p>
                        {service.diagnosis && (
                          <p className="mt-2 text-xs text-slate-400">
                            Diagnosis: {service.diagnosis}
                          </p>
                        )}
                        {service.resolution && (
                          <p className="mt-2 text-xs text-emerald-300">
                            Resolution: {service.resolution}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {service.technician_name ?? "Not assigned"}
                      </td>
                      <td className="min-w-44 px-6 py-4">
                        <div className="space-y-2">
                          <select
                            aria-label={`Status for service request ${service.service_id}`}
                            value={service.service_status}
                            disabled={updatingServiceId !== null}
                            onChange={(event) =>
                              handleServiceStatusChange(
                                Number(service.service_id),
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {!SERVICE_STATUSES.some(
                              (option) =>
                                option.value === service.service_status
                            ) && (
                              <option value={service.service_status}>
                                {service.service_status.replaceAll("_", " ")}
                              </option>
                            )}

                            {SERVICE_STATUSES.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <span
                            className={`inline-block whitespace-nowrap rounded-full border px-3 py-1 text-xs capitalize ${statusStyle(service.service_status)}`}
                          >
                            {SERVICE_STATUSES.find(
                              (option) =>
                                option.value === service.service_status
                            )?.label ??
                              service.service_status.replaceAll("_", " ")}
                          </span>

                          {updatingServiceId === service.service_id && (
                            <p className="text-xs text-cyan-300">Saving...</p>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {money(service.service_cost)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-400">
                        {formatDate(service.reported_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <ServiceNotes services={services.map((service) => ({ service_id: service.service_id, product_name: service.product_name, serial_number: service.serial_number }))} />

        <p className="text-xs text-slate-500">
          Warrantiq · Digital Warranty &amp; Product Service Management
        </p>
      </section>
    </main>
  );
}
