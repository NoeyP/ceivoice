import { useMemo, useState, useEffect } from "react";

const FILTERS = ["Draft", "New", "All"];

export default function Admin() {
  // CHANGED: Added setTickets so we can actually update the list
  const [tickets, setTickets] = useState([]); 
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeFilter, setActiveFilter] = useState("Draft");
  const [selectedTicket, setSelectedTicket] = useState(null);

  // EP03-ST001: Fetch real tickets from the backend
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/admin/tickets');
        if (response.ok) {
          const data = await response.json();
          setTickets(data);
        } else {
          // If backend isn't ready, let's use 1 fake ticket so you can see the UI
          setTickets([{
            id: 1,
            tracking_id: "TIC-8888",
            title: "Sample Draft Ticket",
            summary: "This is a test summary for EP03 review.",
            status: "Draft",
            user_email: "test@example.com"
          }]);
        }
      } catch (error) {
        console.error("Fetch error:", error);
      }
    };
    fetchTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    if (activeFilter === "All") return tickets;
    return tickets.filter((ticket) => ticket.status === activeFilter);
  }, [tickets, activeFilter]);

  const draftCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "Draft").length,
    [tickets],
  );

  const mergeEnabled = selectedIds.length >= 2;
  const handleUpdateTicket = async (newStatus) => {
    if (!selectedTicket) return;

    try {
      const response = await fetch(`http://localhost:3000/api/admin/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedTicket.title,
          summary: selectedTicket.summary,
          status: newStatus, // This will be 'New' or 'Draft'
          category: selectedTicket.category || 'General Inquiry'
        }),
      });

      if (response.ok) {
        // 1. Refresh the main list to show the change
        const refreshRes = await fetch('http://localhost:3000/api/admin/tickets');
        const updatedData = await refreshRes.json();
        setTickets(updatedData);
        
        // 2. Clear selection or update local state
        setSelectedTicket(null); 
        alert(`Ticket successfully moved to ${newStatus}!`);
      }
    } catch (error) {
      console.error("Update error:", error);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <header className="mb-6">
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-base text-slate-700 md:text-lg">
            Dashboard layout for managing and reviewing tickets.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* LEFT COLUMN: Ticket List */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-950">Tickets</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
                {draftCount} Draft
              </span>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    activeFilter === filter
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="mb-5 min-h-[100px]">
              {filteredTickets.length === 0 ? (
                <p className="text-base text-slate-600">No tickets for this filter.</p>
              ) : (
                <div className="space-y-2">
                  {filteredTickets.map((ticket) => (
                    <div 
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        selectedTicket?.id === ticket.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <p className="font-bold text-sm text-slate-900">{ticket.title}</p>
                      <p className="text-xs text-slate-500">{ticket.tracking_id}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-5">
              <h3 className="text-xl font-semibold text-slate-950">Merge into Draft</h3>
              <button
                disabled={!mergeEnabled}
                className="mt-5 w-full rounded-xl bg-slate-400 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Merge Selected Drafts
              </button>
            </div>
          </section>

          {/* RIGHT COLUMN: The Edit/Review Panel */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-8">
            {!selectedTicket ? (
              <div className="flex h-full items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-10">
                <p className="text-lg text-slate-500 italic">No ticket selected. Click a ticket from the list to review it.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <h2 className="text-2xl font-bold text-slate-900">Review Ticket Details</h2>
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">{selectedTicket.status.toUpperCase()}</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">AI-Suggested Title</label>
                    <input 
                      type="text" 
                      className="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-slate-900 outline-none"
                      value={selectedTicket.title || ""}
                      onChange={(e) => setSelectedTicket({...selectedTicket, title: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">AI-Generated Summary</label>
                    <textarea 
                      rows="4"
                      className="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-slate-900 outline-none"
                      value={selectedTicket.summary || ""}
                      onChange={(e) => setSelectedTicket({...selectedTicket, summary: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                      <select 
                        className="w-full rounded-lg border border-slate-300 p-2.5 bg-white outline-none"
                        value={selectedTicket.category || "Technical Support"}
                        onChange={(e) => setSelectedTicket({...selectedTicket, category: e.target.value})}
                      >
                        <option>Technical Support</option>
                        <option>Billing/Finance</option>
                        <option>General Inquiry</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Resolution Deadline</label>
                      <input 
                        type="datetime-local" 
                        className="w-full rounded-lg border border-slate-300 p-2.5 outline-none" 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 border-t">
                  <button 
                    onClick={() => handleUpdateTicket('Draft')}
                    className="flex-1 rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Save as Draft
                  </button>
                  <button 
                    onClick={() => handleUpdateTicket('New')}
                    className="flex-1 rounded-xl bg-slate-900 py-3 font-semibold text-white hover:bg-slate-800 transition shadow-lg shadow-slate-200"
                  >
                    Submit as 'New'
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}