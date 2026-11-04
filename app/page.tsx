
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const stats = [
  { label: "Registered Products", icon: "▣", color: "#dbeafe" },
  { label: "Active Warranties", icon: "✓", color: "#dcfce7" },
  { label: "Open Service Requests", icon: "⚙", color: "#fef3c7" },
  { label: "Expiring Soon", icon: "◷", color: "#fce7f3" },
];

const products = [
  {
    name: "Dell Laptop",
    serial: "DEMO-SN-LAP-001",
    purchase: "10 Jun 2026",
    expiry: "9 Jun 2028",
    status: "In Warranty",
    color: "#2563eb",
  },
  {
    name: "LG Refrigerator",
    serial: "DEMO-SN-REF-001",
    purchase: "15 Aug 2026",
    expiry: "14 Aug 2027",
    status: "In Warranty",
    color: "#7c3aed",
  },
];

const services = [
  {
    product: "Dell Laptop",
    issue: "Overheating",
    status: "In Progress",
    color: "#b45309",
  },
  {
    product: "LG Refrigerator",
    issue: "Cooling issue",
    status: "Resolved",
    color: "#15803d",
  },
];

export default function Home() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("Overview");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const [statsValues, setStatsValues] = useState(["2", "2", "1", "0"]);

  useEffect(() => {
    async function loadDashboardStats() {
      try {
        const response = await fetch("/api/dashboard");

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load dashboard statistics");
        }

        const data = await response.json();

        setStatsValues([
          String(data.registered_products ?? 0),
          String(data.active_warranties ?? 0),
          String(data.open_service_requests ?? 0),
          String(data.expiring_soon ?? 0),
        ]);
      } catch (error) {
        console.error("Dashboard statistics error:", error);
      }
    }

    loadDashboardStats();
  }, [router]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      setNotice("Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  }

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.serial}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const tabs = ["Overview", "Warranties", "Service Requests"];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-slate-200 bg-white p-6 md:flex">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
            W
          </div>
          <div>
            <h1 className="font-bold">Warrantiq</h1>
            <p className="text-xs text-slate-500">
              Warranty Management
            </p>
          </div>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </p>

        <nav className="space-y-2">
          {tabs.map((tab, index) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setNotice("");
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{["▦", "✓", "⚙"][index]}</span>
              {tab}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl bg-slate-900 p-4 text-white">
          <p className="font-semibold">Warranty support</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            Keep your products protected and your service history organized.
          </p>
          <button
            onClick={() =>
              setNotice("Contact your system administrator for support.")
            }
            className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900"
          >
            Get help
          </button>
        </div>
      </aside>

      <section className="md:ml-64">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 md:px-10">
          <div>
            <p className="text-sm text-slate-500">
              Workspace / {activeTab}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              {activeTab === "Overview"
                ? "Dashboard Overview"
                : activeTab}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              ● Demo environment
            </span>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
              A
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </header>

        <div className="p-5 md:p-10">
          {notice && (
            <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              {notice}
              <button
                className="ml-3 font-bold underline"
                onClick={() => setNotice("")}
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === "Overview" && (
            <>
              <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-600 p-7 text-white shadow-lg md:p-9">
                <p className="text-sm font-medium text-blue-100">
                  YOUR PRODUCTS, ONE PLACE
                </p>
                <h3 className="mt-3 max-w-xl text-3xl font-bold">
                  Stay ahead of every warranty.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">
                  Monitor coverage, follow repair progress, and keep product
                  service information organized.
                </p>
                <button
                  onClick={() => setActiveTab("Warranties")}
                  className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  View warranties →
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat, index) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-slate-800"
                      style={{ backgroundColor: stat.color }}
                    >
                      {stat.icon}
                    </div>
                    <p className="mt-5 text-sm text-slate-500">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-3xl font-bold">
                      {statsValues[index]}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">Your products</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Sample records from your warranty project
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("Warranties")}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                    >
                      View all →
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {products.map((product) => (
                      <div
                        key={product.serial}
                        className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-100 p-4"
                      >
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white"
                          style={{ backgroundColor: product.color }}
                        >
                          {product.name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{product.name}</p>
                          <p className="mt-1 break-all text-xs text-slate-500">
                            {product.serial}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                          {product.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="text-lg font-bold">Recent service</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Latest sample service records
                  </p>
                  <div className="mt-5 space-y-5">
                    {services.map((service) => (
                      <div
                        key={service.product}
                        className="border-b border-slate-100 pb-4 last:border-0"
                      >
                        <p className="font-semibold">{service.product}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {service.issue}
                        </p>
                        <p
                          className="mt-2 text-xs font-semibold"
                          style={{ color: service.color }}
                        >
                          ● {service.status}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setActiveTab("Service Requests")}
                    className="mt-2 text-sm font-semibold text-blue-600 hover:underline"
                  >
                    Open service requests →
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "Warranties" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7">
              <h3 className="text-xl font-bold">Warranty tracking</h3>
              <p className="mt-2 text-sm text-slate-500">
                Search products by name or serial number.
              </p>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product or serial number..."
                className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-3 font-medium">Product</th>
                      <th className="p-3 font-medium">Serial number</th>
                      <th className="p-3 font-medium">Purchased</th>
                      <th className="p-3 font-medium">Warranty ends</th>
                      <th className="p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr
                        key={product.serial}
                        className="border-b border-slate-100"
                      >
                        <td className="p-3 font-semibold">{product.name}</td>
                        <td className="p-3">{product.serial}</td>
                        <td className="p-3">{product.purchase}</td>
                        <td className="p-3">{product.expiry}</td>
                        <td className="p-3">
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            {product.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-6 text-center text-slate-500"
                        >
                          No matching products found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "Service Requests" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7">
              <h3 className="text-xl font-bold">Service requests</h3>
              <p className="mt-2 text-sm text-slate-500">
                Review the current sample repair records.
              </p>

              <div className="mt-6 space-y-4">
                {services.map((service) => (
                  <div
                    key={service.product}
                    className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">
                      ⚙
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{service.product}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Reported issue: {service.issue}
                      </p>
                    </div>
                    <span
                      className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold"
                      style={{ color: service.color }}
                    >
                      {service.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500">
            <p>Warrantiq · Digital Warranty Management</p>
            <p>Prototype dashboard · Sample records</p>
          </footer>
        </div>
      </section>
    </main>
  );
}
