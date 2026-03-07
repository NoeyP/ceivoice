import { useMemo, useState, useEffect } from "react";

const FILTERS = ["Draft", "New", "All"];

function buildCommentTree(comments = []) {
  const nodes = new Map();
  comments.forEach((c) => {
    nodes.set(c.id, { ...c, replies: [] });
  });

  const roots = [];
  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId).replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default function Admin() {
  // CHANGED: Added setTickets so we can actually update the list
  const [tickets, setTickets] = useState([]); 
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeFilter, setActiveFilter] = useState("Draft");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentVisibility, setCommentVisibility] = useState("public");
  const [replyTargetId, setReplyTargetId] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const user = JSON.parse(localStorage.getItem("ceivoice_user") || "null");

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
            ai_analysis: "This is a test summary for EP03 review.", // Changed from summary
            suggested_resolution: "1. Check DB\n2. Verify API", // Added for ST005
            status: "Draft",
            user_email: "test@example.com",
            original_message: "The system is down!" // Added for context
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
  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);
  const toggleSelectTicket = (e, ticketId) => {
  e.stopPropagation(); // Prevents clicking the checkbox from opening the ticket detail
  setSelectedIds(prev => 
    prev.includes(ticketId) 
      ? prev.filter(id => id !== ticketId) 
      : [...prev, ticketId]
  );
};
  const openTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setCommentDraft("");
    setCommentVisibility("public");
    setReplyTargetId(null);

    try {
      const res = await fetch(`http://localhost:3000/api/tickets/${ticket.id}/comments?scope=staff`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error("Comment load error:", error);
      setComments([]);
    }
  };

  const submitComment = async () => {
    if (!selectedTicket) return;
    const message = commentDraft.trim();
    if (!message) return;

    setCommentSubmitting(true);
    try {
      const res = await fetch(`http://localhost:3000/api/tickets/${selectedTicket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          visibility: commentVisibility,
          user_id: user?.id || null,
          actor_role: "admin",
          parent_id: replyTargetId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to post comment");
      }

      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setCommentDraft("");
      setReplyTargetId(null);
    } catch (error) {
      alert(error.message || "Failed to post comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const renderCommentNode = (node, depth = 0) => (
    <div key={node.id} className="space-y-2">
      <div
        className="rounded-lg border bg-white p-3"
        style={{ marginLeft: depth > 0 ? `${Math.min(depth * 24, 72)}px` : "0px" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">{node.author || "Unknown"}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${node.visibility === "internal"
              ? "bg-amber-100 text-amber-800"
              : "bg-blue-100 text-blue-800"
              }`}>
              {node.visibility}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">{new Date(node.createdAt).toLocaleString()}</span>
        </div>
        <p className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">{node.message}</p>
        <button
          type="button"
          onClick={() => setReplyTargetId(node.id)}
          className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
        >
          Reply
        </button>
      </div>
      {node.replies.map((child) => renderCommentNode(child, depth + 1))}
    </div>
  );

  const handleUpdateTicket = async (newStatus) => {
  if (!selectedTicket) return;

  try {
    const response = await fetch(`http://localhost:3000/api/tickets/${selectedTicket.id}/status`, { 
  method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: selectedTicket.title,
        // ✅ TRAP FIXED: Use ai_analysis instead of summary
        ai_analysis: selectedTicket.ai_analysis, 
        // ✅ ST005: Save the internal action plan
        suggested_resolution: selectedTicket.suggested_resolution, 
        status: newStatus,
        category: selectedTicket.category || 'General Inquiry'
      }),
    });

    if (response.ok) {
      // Refresh logic remains the same
      const refreshRes = await fetch('http://localhost:3000/api/admin/tickets');
      const updatedData = await refreshRes.json();
      setTickets(updatedData);
      
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
                      onClick={() => openTicket(ticket)}
                      // Combined the logic into ONE className string
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

          {/* RIGHT COLUMN: The Edit/Review Panel */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-8">
            {!selectedTicket ? (
              <div className="flex h-full items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-10">
                <p className="text-lg text-slate-500 italic">No ticket selected. Click a ticket from the list to review it.</p>
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
                    <label className="block text-sm font-semibold text-slate-700 mb-1">AI-Suggested Title</label>
                    <input 
                      type="text" 
                      className="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-slate-900 outline-none"
                      value={selectedTicket.title || ""}
                      onChange={(e) => setSelectedTicket({...selectedTicket, title: e.target.value})}
                    />
                  </div>

                  {/* Summary - Mapped to summary */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">AI-Generated Summary (Public)</label>
                    <textarea 
                      rows="3"
                      className="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-slate-900 outline-none"
                      value={selectedTicket.ai_analysis || ""}
                      onChange={(e) => setSelectedTicket({...selectedTicket, ai_analysis: e.target.value})}
                    />
                  </div>

                  {/* Action Plan - ST005 Requirement */}
                  <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                    <label className="block text-sm font-bold text-indigo-700 mb-1 uppercase tracking-tight">
                      AI Suggested Solution
                    </label>
                    <textarea 
                      rows="4"
                      className="w-full rounded-lg border border-indigo-200 p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                      value={selectedTicket.suggested_resolution || ""}
                      onChange={(e) => setSelectedTicket({...selectedTicket, suggested_resolution: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                      <select 
                        className="w-full rounded-lg border border-slate-300 p-2.5 bg-white outline-none"
                        value={selectedTicket.category || "General Inquiry"}
                        onChange={(e) => setSelectedTicket({...selectedTicket, category: e.target.value})}
                      >
                        <option>Technical Support</option>
                        <option>Billing/Finance</option>
                        <option>Account Access</option>
                        <option>Feature Request</option>
                        <option>General Inquiry</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">User Email (Reference)</label>
                      <input 
                        type="text" 
                        disabled
                        className="w-full rounded-lg border border-slate-200 p-2.5 bg-slate-50 text-slate-500 cursor-not-allowed" 
                        value={selectedTicket.user_email || ""}
                      />
                    </div>
                  </div>

                  {/* Original Message - Important for Admin Review */}
                  <div className="mt-4 p-3 bg-slate-50 border rounded-lg">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Original User Message</p>
                    <p className="text-sm text-slate-600 italic">"{selectedTicket.original_message || "No content"}"</p>
                  </div>
                  {/* ACTION BUTTONS */}
                  <div className="flex gap-4 pt-4 border-t">
                    <button
                      // ✅ FIX: Added the click handler to save edits but keep it as a Draft
                      onClick={() => handleUpdateTicket('Draft')}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Keep as Draft
                    </button>
                    <button
                      // ✅ FIX: Added the click handler to flip status to 'Approved/Open'
                      onClick={() => handleUpdateTicket('Open')}
                      className="flex-[2] rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition shadow-lg"
                    >
                      Approve & Open
                    </button>
                  </div>

                  <div className="mt-6 border rounded-xl p-4 bg-slate-50">
                    <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Comment Thread</h3>
                    {comments.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No comments yet.</p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {commentTree.map((node) => renderCommentNode(node))}
                      </div>
                    )}

                    <div className="mt-4 border rounded-lg p-3 bg-white">
                      {replyTargetId ? (
                        <div className="mb-2 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                          <span>Replying to comment #{replyTargetId}</span>
                          <button
                            type="button"
                            onClick={() => setReplyTargetId(null)}
                            className="font-semibold hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                      <div className="mb-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Visibility</label>
                        <select
                          value={commentVisibility}
                          onChange={(e) => setCommentVisibility(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 p-2 text-sm bg-slate-50"
                        >
                          <option value="public">Public</option>
                          <option value="internal">Internal</option>
                        </select>
                      </div>
                      <textarea
                        rows="3"
                        className="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-slate-900 outline-none"
                        placeholder="Write a comment or reply..."
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                      />
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={submitComment}
                          disabled={commentSubmitting || !commentDraft.trim()}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {commentSubmitting ? "Posting..." : "Post Comment"}
                        </button>
                      </div>
                    </div>
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
