import { useState, useEffect, useMemo } from "react";

export default function AssigneeDashboard() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [resolutionComment, setResolutionComment] = useState("");

  const [allAssignees, setAllAssignees] = useState([]);

  const [history, setHistory] = useState([]);
  const [comments, setComments] = useState([]);


  const [selectedAssignees, setSelectedAssignees] = useState([]);

  const toggleAssignee = (userId) => {
    setSelectedAssignees(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleReassign = async () => {
    const res = await fetch(`http://localhost:3000/api/tickets/${selectedTicket.id}/reassign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_assignee_ids: selectedAssignees,
        changed_by: user.id
      }),
    });

    if (res.ok) {
      alert("Ticket successfully reassigned to multiple users.");
      setSelectedTicket(null);
      setSelectedAssignees([]);
      // Refresh your list here...
      const response = await fetch(`http://localhost:3000/api/assignee/${user.id}/tickets`);
      const data = await response.json();
      setTickets(data);
    }
  };

  useEffect(() => {
    const fetchStaff = async () => {
      const res = await fetch('http://localhost:3000/api/staff');
      const data = await res.json();
      setAllAssignees(data);
    };
    fetchStaff();
  }, []);

  const handleManage = async (ticket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    const [historyRes, commentsRes] = await Promise.all([
      fetch(`http://localhost:3000/api/tickets/${ticket.id}/history`),
      fetch(`http://localhost:3000/api/tickets/${ticket.id}/comments?scope=staff`)
    ]);
    const historyData = await historyRes.json();
    const commentData = await commentsRes.json();
    setHistory(historyData);
    setComments(commentData);
  };

  const submitStatusUpdate = async () => {
    if ((newStatus === 'Solved' || newStatus === 'Failed') && !resolutionComment.trim()) {
      alert("Please provide a resolution comment to close this ticket.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:3000/api/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          changed_by: user.id,
          comment: resolutionComment || "",
          title: selectedTicket.title || "No Title",
          ai_analysis: selectedTicket.ai_analysis || "No ai_analysis",
          suggested_resolution: selectedTicket.suggested_resolution || "No suggested resolution",
          category: selectedTicket.category || "General"
        }),
      });
      if (res.ok) {
        const response = await fetch(`http://localhost:3000/api/assignee/${user.id}/tickets`);
        const data = await response.json();
        setTickets(data);

        setSelectedTicket(null);
        setResolutionComment("");
        alert("Ticket updated successfully!");
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.message}`);
      }
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  // Get current logged-in user from localStorage
  const user = JSON.parse(localStorage.getItem("ceivoice_user"));

  useEffect(() => {
    const fetchMyWorkload = async () => {
      try {
        // You'll need to create this endpoint in server.js
        const response = await fetch(`http://localhost:3000/api/assignee/${user.id}/tickets`);
        const data = await response.json();
        setTickets(data);
      } catch (error) {
        console.error("Error fetching workload:", error);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) fetchMyWorkload();
  }, [user?.id]);

  // EP04-ST001: Sortable by urgency (Deadline)
  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }, [tickets]);

  if (loading) return <div className="p-10">Loading your workload...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Workload</h1>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-4 font-semibold text-slate-700">Ticket ID</th>
              <th className="p-4 font-semibold text-slate-700">Subject</th>
              <th className="p-4 font-semibold text-slate-700">Status</th>
              <th className="p-4 font-semibold text-slate-700">Deadline (Urgency)</th>
              <th className="p-4 font-semibold text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedTickets.map((ticket) => (
              <tr key={ticket.id} className="border-b hover:bg-slate-50">
                <td className="p-4 font-mono text-sm">{ticket.tracking_id}</td>
                <td className="p-4 font-medium">{ticket.title}</td>
                <td className="p-4">
                  <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800 uppercase font-bold">
                    {ticket.status}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-600">
                  {ticket.deadline ? new Date(ticket.deadline).toLocaleString() : "No Deadline Set"}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleManage(ticket)}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {selectedTicket && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Manage Ticket: {selectedTicket.tracking_id}</h3>
                <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">
                  Reassign Ticket (Escalation)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border rounded-lg bg-slate-50">
                  {allAssignees.map(staff => (
                    <label key={staff.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={selectedAssignees.includes(staff.id)}
                        onChange={() => toggleAssignee(staff.id)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-sm text-slate-700">{staff.username}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleReassign}
                  className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
                >
                  Confirm Reassignment
                </button>
              </div>

              <div className="space-y-4">

                <div className="mb-6 bg-slate-50 p-4 rounded-lg border max-h-40 overflow-y-auto">
                  <h4 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Audit Trail</h4>
                  {history.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No history yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((h, i) => (
                        <li key={i} className="text-xs border-l-2 border-slate-300 pl-2">
                          <span className="font-semibold">{h.new_status}</span>
                          <span className="text-slate-500"> by {h.changed_by_name}</span>
                          <p className="text-[10px] text-slate-400">{new Date(h.created_at).toLocaleString()}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mb-6 bg-slate-50 p-4 rounded-lg border max-h-56 overflow-y-auto">
                  <h4 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Comment Thread</h4>
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No comments yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {comments.map((c) => (
                        <li key={c.id} className="rounded-lg border bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-800">{c.author || "Unknown"}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.visibility === "internal"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                                }`}>
                                {c.visibility}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">{c.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Status Dropdown (EP04-ST002) */}
                <div>
                  <label className="block text-sm font-semibold mb-1">Update Status</label>
                  <select
                    className="w-full border rounded-lg p-2.5 bg-slate-50"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    <option value="New">New</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Solving">Solving</option>
                    <option value="Solved">Solved</option>
                    <option value="Failed">Failed</option>
                    <option value="Renew">Renew</option>
                  </select>
                </div>

                {/* Resolution Comment (Required for Solved/Failed per EP04-ST002) */}
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Resolution Comment {(newStatus === 'Solved' || newStatus === 'Failed') && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    className="w-full border rounded-lg p-2.5 h-32"
                    placeholder="Describe the resolution or why it failed..."
                    value={resolutionComment}
                    onChange={(e) => setResolutionComment(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="flex-1 py-2.5 border rounded-xl hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitStatusUpdate}
                    className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {sortedTickets.length === 0 && (
          <p className="p-10 text-center text-slate-500 italic">No active tickets assigned to you.</p>
        )}
      </div>
    </div>
  );
}
