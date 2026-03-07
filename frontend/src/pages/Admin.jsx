import { useMemo, useState, useEffect } from "react";

const FILTERS = ["Draft", "New", "All"];

export default function Admin() {
// ===============================
// State
// ===============================
const [tickets, setTickets] = useState([]);
const [users, setUsers] = useState([]);
const [selectedTicket, setSelectedTicket] = useState(null);
const [selectedIds, setSelectedIds] = useState([]);
const [activeFilter, setActiveFilter] = useState("All");


// ===============================
// Fetch Tickets
// ===============================
useEffect(() => {

  const fetchTickets = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/admin/tickets");

      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      } else {

        // fallback demo ticket
        setTickets([
          {
            id: 1,
            tracking_id: "TIC-8888",
            title: "Sample Draft Ticket",
            ai_analysis: "This is a test summary for EP03 review.",
            suggested_resolution: "1. Check DB\n2. Verify API",
            status: "Draft",
            user_email: "test@example.com",
            original_message: "The system is down!"
          }
        ]);

      }

    } catch (error) {
      console.error("Ticket fetch error:", error);
    }
  };


  const fetchUsers = async () => {
  try {

    const res = await fetch("http://localhost:3000/api/users");

    if (res.ok) {
      const userData = await res.json();

      console.log("Fetched users:", userData); // 👈 ADD THIS

      setUsers(userData);
    }

  } catch (error) {
    console.error("User fetch error:", error);
  }
};


  fetchTickets();
  fetchUsers();

}, []);


// ===============================
// Filters
// ===============================
const filteredTickets = useMemo(() => {
  if (activeFilter === "All") return tickets;
  return tickets.filter((ticket) => ticket.status === activeFilter);
}, [tickets, activeFilter]);


const draftCount = useMemo(
  () => tickets.filter((ticket) => ticket.status === "Draft").length,
  [tickets]
);


// ===============================
// Selection
// ===============================
const mergeEnabled = selectedIds.length >= 2;

const toggleSelectTicket = (e, ticketId) => {
  e.stopPropagation();

  setSelectedIds(prev =>
    prev.includes(ticketId)
      ? prev.filter(id => id !== ticketId)
      : [...prev, ticketId]
  );
};


// ===============================
// Update Ticket Status
// ===============================
const handleUpdateTicket = async (newStatus) => {

  if (!selectedTicket) return;

  try {

    const response = await fetch(
      `http://localhost:3000/api/tickets/${selectedTicket.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedTicket.title,
          ai_analysis: selectedTicket.ai_analysis,
          suggested_resolution: selectedTicket.suggested_resolution,
          status: newStatus,
          category: selectedTicket.category || "General Inquiry"
        })
      }
    );

    if (response.ok) {

      const refreshRes = await fetch("http://localhost:3000/api/admin/tickets");
      const updatedData = await refreshRes.json();

      setTickets(updatedData);
      setSelectedTicket(null);

      alert(`Ticket successfully moved to ${newStatus}!`);
    }

  } catch (error) {
    console.error("Update error:", error);
  }
};


// ===============================
// Assign Ticket
// ===============================
const handleAssignTicket = async (userId) => {

  if (!selectedTicket) return;

  try {

    const response = await fetch(
      `http://localhost:3000/api/tickets/${selectedTicket.id}/assign`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignee_id: userId,
          changed_by: 1
        })
      }
    );

    if (response.ok) {

      // refresh ticket list
      const refreshRes = await fetch("http://localhost:3000/api/admin/tickets");
      const updatedData = await refreshRes.json();

      setTickets(updatedData);
      setSelectedTicket(null);

      alert("Ticket assigned successfully!");

    }

  } catch (error) {
    console.error("Assignment error:", error);
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
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-start gap-3 ${
                      selectedIds.includes(ticket.id) 
                        ? 'border-slate-400 bg-slate-100/50' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    } ${selectedTicket?.id === ticket.id ? 'ring-2 ring-slate-900' : ''}`}
                  >
                    <input 
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
                      checked={selectedIds.includes(ticket.id)}
                      onChange={(e) => toggleSelectTicket(e, ticket.id)}
                      onClick={(e) => e.stopPropagation()} 
                    />

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900">{ticket.title}</p>
                      <p className="text-xs text-slate-500">{ticket.tracking_id}</p>
                    </div>
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

        {/* RIGHT COLUMN: Ticket Review */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-8">
          {!selectedTicket ? (
            <div className="flex h-full items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-10">
              <p className="text-lg text-slate-500 italic">
                No ticket selected. Click a ticket from the list to review it.
              </p>
            </div>
          ) : (
            <div className="space-y-6">

              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Review Ticket</h2>
                  <p className="text-sm text-slate-500">{selectedTicket.tracking_id}</p>
                </div>
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">
                  {selectedTicket.status?.toUpperCase()}
                </span>
              </div>

              <div className="space-y-4">

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    AI-Suggested Title
                  </label>
                  <input 
                    type="text" 
                    className="w-full rounded-lg border border-slate-300 p-2.5"
                    value={selectedTicket.title || ""}
                    onChange={(e) =>
                      setSelectedTicket({
                        ...selectedTicket,
                        title: e.target.value
                      })
                    }
                  />
                </div>

                {/* Summary */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    AI-Generated Summary (Public)
                  </label>
                  <textarea 
                    rows="3"
                    className="w-full rounded-lg border border-slate-300 p-2.5"
                    value={selectedTicket.ai_analysis || ""}
                    onChange={(e) =>
                      setSelectedTicket({
                        ...selectedTicket,
                        ai_analysis: e.target.value
                      })
                    }
                  />
                </div>

                {/* Suggested Solution */}
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                  <label className="block text-sm font-bold text-indigo-700 mb-1 uppercase">
                    AI Suggested Solution
                  </label>
                  <textarea 
                    rows="4"
                    className="w-full rounded-lg border border-indigo-200 p-2.5 bg-white"
                    value={selectedTicket.suggested_resolution || ""}
                    onChange={(e) =>
                      setSelectedTicket({
                        ...selectedTicket,
                        suggested_resolution: e.target.value
                      })
                    }
                  />
                </div>

                {/* Category + Email */}
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-300 p-2.5"
                      value={selectedTicket.category || "General Inquiry"}
                      onChange={(e) =>
                        setSelectedTicket({
                          ...selectedTicket,
                          category: e.target.value
                        })
                      }
                    >
                      <option>Technical Support</option>
                      <option>Billing/Finance</option>
                      <option>Account Access</option>
                      <option>Feature Request</option>
                      <option>General Inquiry</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      User Email
                    </label>
                    <input 
                      type="text"
                      disabled
                      className="w-full rounded-lg border border-slate-200 p-2.5 bg-slate-50"
                      value={selectedTicket.user_email || ""}
                    />
                  </div>

                </div>

                {/* ASSIGN USER DROPDOWN */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Assign Ticket
                  </label>

                  <select
                    className="w-full rounded-lg border border-slate-300 p-2.5"
                    onChange={(e) => handleAssignTicket(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select user...
                    </option>

                    {users.length === 0 ? (
                      <option disabled>No users available</option>
                    ) : (
                      users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Original Message */}
                <div className="mt-4 p-3 bg-slate-50 border rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Original User Message
                  </p>
                  <p className="text-sm text-slate-600 italic">
                    "{selectedTicket.original_message || "No content"}"
                  </p>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex gap-4 pt-4 border-t">
                  <button
                    onClick={() => handleUpdateTicket('Draft')}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700"
                  >
                    Keep as Draft
                  </button>

                  <button
                    onClick={() => handleUpdateTicket('Open')}
                    className="flex-[2] rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
                  >
                    Approve & Open
                  </button>
                </div>

              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  </div>
);
}