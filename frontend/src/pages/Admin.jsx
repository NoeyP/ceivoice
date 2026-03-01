import { useMemo, useState } from "react";

const FILTERS = ["Draft", "New", "All"];

export default function Admin() {
  const [tickets] = useState([]);
  const [selectedIds] = useState([]);
  const [activeFilter, setActiveFilter] = useState("Draft");

  const filteredTickets = useMemo(() => {
    if (activeFilter === "All") return tickets;
    return tickets.filter((ticket) => ticket.status === activeFilter);
  }, [tickets, activeFilter]);

  const draftCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "Draft").length,
    [tickets],
  );

  const mergeEnabled = selectedIds.length >= 2;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <header className="mb-6">
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-base text-slate-700 md:text-lg">
            Dashboard layout for managing and reviewing tickets. Data will be
            connected in a later backend integration step.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-950">Tickets</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
                {draftCount} Draft
              </span>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {FILTERS.map((filter) => {
                const isActive = activeFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>

            <div className="mb-5 min-h-[100px]">
              {filteredTickets.length === 0 ? (
                <p className="text-base text-slate-600">No tickets for this filter.</p>
              ) : null}
            </div>

            <div className="border-t border-slate-200 pt-5">
              <h3 className="text-xl font-semibold text-slate-950">Merge into Draft</h3>
              <p className="mt-2 text-sm text-slate-600">
                Select 2+ draft tickets, then merge.
              </p>
              <button
                type="button"
                disabled={!mergeEnabled}
                className="mt-5 w-full rounded-xl bg-slate-400 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-100"
              >
                Merge Selected Drafts
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-8">
            <p className="text-lg text-slate-600">No ticket selected.</p>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">
            Active Workload Queue (New Tickets)
          </h2>
          <p className="mt-3 text-base text-slate-600">No submitted tickets yet.</p>
        </section>
      </div>
    </div>
  );
}
