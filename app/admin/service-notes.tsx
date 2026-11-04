"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type ServiceOption = { service_id: number; product_name: string; serial_number: string };
type Note = { _id: string; serviceId: number; note: string; authorRole: string; createdAt: string; updatedAt: string };

export default function ServiceNotes({ services }: { services: ServiceOption[] }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [serviceId, setServiceId] = useState(services[0]?.service_id?.toString() ?? "");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/service-notes", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not read MongoDB notes.");
      setNotes(data.notes ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "MongoDB is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  async function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/service-notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: Number(serviceId || services[0]?.service_id), note: draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create note.");
      setDraft(""); setMessage(data.message); await loadNotes();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create note."); }
    finally { setBusy(false); }
  }

  async function saveNote(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/service-notes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, note: editing[id] ?? "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update note.");
      setMessage(data.message); await loadNotes();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update note."); }
    finally { setBusy(false); }
  }

  async function deleteNote(id: string) {
    if (!window.confirm("Delete this activity note from MongoDB?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/service-notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete note.");
      setMessage(data.message); await loadNotes();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete note."); }
    finally { setBusy(false); }
  }

  function serviceLabel(id: number) {
    const service = services.find((item) => Number(item.service_id) === Number(id));
    return service ? `#${id} · ${service.product_name} · ${service.serial_number}` : `Service #${id}`;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-900/70 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">MongoDB · Service Activity Notes</h2>
            <p className="mt-1 text-sm text-slate-400">Create, read, update, and delete service notes stored as MongoDB documents.</p>
          </div>
          <span className="rounded-full border border-violet-800 bg-violet-950/50 px-3 py-1 text-xs text-violet-200">NoSQL CRUD</span>
        </div>
      </div>
      {message && <p role="status" className="border-b border-emerald-900 bg-emerald-950/30 px-6 py-3 text-sm text-emerald-300">{message}</p>}
      {error && <p role="alert" className="border-b border-red-900 bg-red-950/30 px-6 py-3 text-sm text-red-300">{error}</p>}
      <form onSubmit={createNote} className="grid gap-3 border-b border-slate-800 p-6 md:grid-cols-[minmax(0,1fr)_2fr_auto]">
        <label className="text-sm text-slate-300">Related service
          <select value={serviceId || services[0]?.service_id?.toString() || ""} onChange={(event) => setServiceId(event.target.value)} required disabled={!services.length} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
            {services.map((service) => <option key={service.service_id} value={service.service_id}>{serviceLabel(service.service_id)}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-300">Activity note
          <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} required placeholder="e.g. Customer contacted; replacement part requested" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500" />
        </label>
        <button disabled={busy || !services.length || !draft.trim()} className="self-end rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">Add note</button>
      </form>
      <div className="divide-y divide-slate-800">
        {loading ? <p className="p-6 text-sm text-slate-400">Loading MongoDB documents…</p> : notes.length === 0 ? <p className="p-6 text-sm text-slate-400">No activity notes yet. Add one above to create the first MongoDB document.</p> : notes.map((note) => (
          <article key={note._id} className="grid gap-3 p-6 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">{serviceLabel(note.serviceId)} · {note.authorRole}</p>
              <textarea value={editing[note._id] ?? note.note} onChange={(event) => setEditing((current) => ({ ...current, [note._id]: event.target.value }))} rows={2} maxLength={2000} className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              <p className="mt-2 text-xs text-slate-500">Created: {new Date(note.createdAt).toLocaleString("en-IN")} · Document ID: <span className="font-mono">{note._id}</span></p>
            </div>
            <div className="flex items-start gap-2 md:flex-col">
              <button disabled={busy || (editing[note._id] ?? note.note).trim() === note.note} onClick={() => saveNote(note._id)} className="rounded-lg border border-violet-700 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-950 disabled:opacity-40">Save edit</button>
              <button disabled={busy} onClick={() => deleteNote(note._id)} className="rounded-lg border border-red-900 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-950 disabled:opacity-40">Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
