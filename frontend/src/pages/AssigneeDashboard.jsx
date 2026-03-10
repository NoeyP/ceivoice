import { useState, useEffect, useMemo } from "react";

function buildCommentTree(comments = []) {
  const keyOf = (value) => (value === null || value === undefined ? null : String(value));
  const nodes = new Map();
  comments.forEach((c) => {
    nodes.set(keyOf(c.id), { ...c, replies: [] });
  });

  const roots = [];
  nodes.forEach((node) => {
    const parentKey = keyOf(node.parentId);
    if (parentKey && nodes.has(parentKey)) {
      nodes.get(parentKey).replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default function AssigneeDashboard() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [resolutionComment, setResolutionComment] = useState("");

  const [allAssignees, setAllAssignees] = useState([]);

  const [history, setHistory] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentVisibility, setCommentVisibility] = useState("public");
  const [replyDraft, setReplyDraft] = useState("");
  const [replyVisibility, setReplyVisibility] = useState("public");
  const [replyTargetId, setReplyTargetId] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);


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

      alert("Ticket successfully reassigned.");

      const [historyRes, ticketsRes] = await Promise.all([
        fetch(`http://localhost:3000/api/tickets/${selectedTicket.id}/history`),
        fetch(`http://localhost:3000/api/assignee/${user.id}/tickets`)
      ]);

      const historyData = await historyRes.json();
      const ticketsData = await ticketsRes.json();

      setHistory(historyData);
      setTickets(ticketsData);
      setSelectedAssignees([]);
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
    setSelectedTicket({
      ...ticket,
      deadline: ticket.deadline
        ? new Date(ticket.deadline).toISOString().slice(0, 16)
        : ""
    });
    setNewStatus(ticket.status);
    setSelectedAssignees(ticket.assignees?.map(a => a.id) || []); 
    const [historyRes, commentsRes] = await Promise.all([
      fetch(`http://localhost:3000/api/tickets/${ticket.id}/history`),
      fetch(`http://localhost:3000/api/tickets/${ticket.id}/comments?scope=staff`)
    ]);
    const historyData = await historyRes.json();
    const commentData = await commentsRes.json();
    setHistory(historyData);
    setComments(commentData);
    setCommentDraft("");
    setCommentVisibility("public");
    setReplyDraft("");
    setReplyVisibility("public");
    setReplyTargetId(null);
  };

  const submitComment = async (rawMessage, parentId = null, visibility = "public") => {
    if (!selectedTicket) return;
    const message = String(rawMessage || "").trim();
    if (!message) return;

    setCommentSubmitting(true);
    try {
      const res = await fetch(`http://localhost:3000/api/tickets/${selectedTicket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          visibility,
          user_id: user?.id || null,
          actor_role: "assignee",
          parent_id: parentId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to post comment");
      }

      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      if (parentId) {
        setReplyDraft("");
        setReplyVisibility("public");
        setReplyTargetId(null);
      } else {
        setCommentDraft("");
      }
    } catch (err) {
      alert(err.message || "Failed to post comment");
    } finally {
      setCommentSubmitting(false);
    }
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
  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  const renderCommentNode = (node, depth = 0) => {
    const INDENT = 20;
    const badgeCls = node.visibility === "internal"
      ? "border-amber-200 bg-amber-100 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-700";

    return (
      <div
        key={node.id}
        className="relative space-y-2"
        style={{ marginLeft: depth > 0 ? `${depth * INDENT}px` : "0px" }}
      >
        {depth > 0 ? (
          <>
            <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-300" />
            <div className="absolute left-0 top-5 h-px w-3 bg-slate-300" />
          </>
        ) : null}

        <div className="ml-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 relative">
              <span className="text-xs font-semibold text-slate-800">{node.author || "Unknown"}</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${badgeCls}`}>
                {node.visibility}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">{new Date(node.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{node.message}</p>
          <button
            type="button"
            onClick={() => {
              setReplyTargetId(node.id);
              setReplyDraft("");
              setReplyVisibility(commentVisibility);
            }}
            className="mt-2 text-sm font-semibold text-blue-600 hover:underline"
          >
            Reply
          </button>

          {String(replyTargetId) === String(node.id) ? (
            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-blue-800">
                <span>Replying to {node.author || "User"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTargetId(null);
                    setReplyDraft("");
                    setReplyVisibility("public");
                  }}
                  className="font-semibold hover:underline"
                >
                  Cancel
                </button>
              </div>
              <div className="mb-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Visibility</label>
                <select
                  value={replyVisibility}
                  onChange={(e) => setReplyVisibility(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm bg-white"
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                </select>
              </div>
              <textarea
                className="w-full border rounded-lg p-2.5 h-24 bg-white"
                placeholder={`Reply to ${node.author || "User"}...`}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => submitComment(replyDraft, node.id, replyVisibility)}
                  disabled={commentSubmitting || !replyDraft.trim()}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {commentSubmitting ? "Posting..." : "Post Reply"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {node.replies.map((child) => renderCommentNode(child, depth + 1))}
      </div>
    );
  };

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
                          <p className="font-semibold text-slate-800">
                            {h.change_type === 'assignment' ? h.new_status : `Status: ${h.old_status} -> ${h.new_status}`}
                          </p>
                          <p className="text-slate-500">by {h.changed_by_name || 'System'}</p>
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
                    <div>
                      {commentTree.map((node) => (
                        <div key={`root-${node.id}`} className="pb-10 mb-6 border-b border-slate-200 last:pb-0 last:mb-0 last:border-b-0">
                          {renderCommentNode(node)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!replyTargetId ? (
                  <div className="mb-6 border rounded-lg p-4 bg-white">
                  <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Add Comment</h4>
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Visibility</label>
                    <select
                      value={commentVisibility}
                      onChange={(e) => setCommentVisibility(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm bg-slate-50"
                    >
                      <option value="public">Public</option>
                      <option value="internal">Internal</option>
                    </select>
                  </div>
                  <textarea
                    className="w-full border rounded-lg p-2.5 h-24"
                    placeholder="Write a comment or reply..."
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => submitComment(commentDraft, null, commentVisibility)}
                      disabled={commentSubmitting || !commentDraft.trim()}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      {commentSubmitting ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                  </div>
                ) : null}

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
