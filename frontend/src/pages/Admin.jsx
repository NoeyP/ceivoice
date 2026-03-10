import { useMemo, useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const FILTERS = ["Draft", "New", "All"];

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

export default function Admin() {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeFilter, setActiveFilter] = useState("Draft");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentVisibility, setCommentVisibility] = useState("public");
  const [replyDraft, setReplyDraft] = useState("");
  const [replyVisibility, setReplyVisibility] = useState("public");
  const [replyTargetId, setReplyTargetId] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [mergedRequests, setMergedRequests] = useState([]);
  const [mergedCount, setMergedCount] = useState(0);
  const [linkedRequests, setLinkedRequests] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const user = JSON.parse(localStorage.getItem("ceivoice_user") || "null");
  const [availableTags, setAvailableTags] = useState([]);
  const [userScopes, setUserScopes] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;

  // =============================
  // API FETCH FUNCTIONS
  // =============================

  const handleLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    end.setDate(end.getDate() + 1);
    setDateRange([start, end]);
  };

  const handleAllTickets = () => {
    setDateRange([null, null]);
  };

  const [reportData, setReportData] = useState({
    statusBreakdown: [],
    categoryBreakdown: [],
    avgResolutionHours: 0,
    totalTickets: 0
  });

  const fetchReports = async () => {
    let url = "http://localhost:3000/api/admin/reports/stats";
    if (startDate && endDate) {
      const s = startDate.toISOString().split('T')[0];
      const e = endDate.toISOString().split('T')[0];
      url += `?startDate=${s}&endDate=${e}`;
    }
    const res = await fetch(url);
    if (res.ok) setReportData(await res.json());
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const fetchScopes = async () => {
    const tagsRes = await fetch("http://localhost:3000/api/admin/tags");
    const scopesRes = await fetch("http://localhost:3000/api/admin/user-scopes");
    if (tagsRes.ok) setAvailableTags(await tagsRes.json())
    if (scopesRes.ok) setUserScopes(await scopesRes.json());
  };

  const handleScopeToggle = async (userId, scopeId) => {
    const isActive = userScopes.some(s => s.user_id === userId && s.scope_id === scopeId);

    const res = await fetch("http://localhost:3000/api/admin/users/toggle-scope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, scopeId, active: !isActive })
    });

    if (res.ok) fetchScopes();
  }

  const fetchManagementUsers = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/admin/management/users");
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error("Management user fetch error:", err)
    }
  };

  const handleRoleToggle = async (userId, currentRole) => {
    const newRole = currentRole === 'user' ? 'assignee' : 'user';
    try {
      const res = await fetch(`http://localhost:3000/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        fetchManagementUsers();
        fetchUsers();
      }
    } catch (err) {
      console.error("Role toggle error:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/users");

      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("User fetch error:", err);
    }
  };

  const fetchTickets = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/admin/tickets");

      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };


  // =============================
  // INITIAL LOAD
  // =============================

  useEffect(() => {
    fetchUsers();
    fetchTickets();
    fetchManagementUsers();
    fetchScopes();
    fetchReports();

    const interval = setInterval(() => {
      fetchTickets();
    }, 5000); // refresh every 5 seconds

    return () => clearInterval(interval);

  }, []);


  // =============================
  // MEMOIZED VALUES
  // =============================

  const filteredTickets = useMemo(() => {
    if (activeFilter === "All") return tickets;
    return tickets.filter((ticket) => ticket.status === activeFilter);
  }, [tickets, activeFilter]);

  const draftCount = useMemo(() => {
    return tickets.filter((ticket) => ticket.status === "Draft").length;
  }, [tickets]);

  const mergeEnabled = selectedIds.length >= 2;

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  const participants =
    selectedTicket?.participants || {
      creator: null,
      assignees: [],
      followers: [],
    };


  // =============================
  // HELPERS
  // =============================

  const participantLabel = (person, fallbackName = "Unknown") => {
    if (!person) return fallbackName;

    const name = person.name || person.username || fallbackName;
    const email = person.email ? ` (${person.email})` : "";

    return `${name}${email}`;
  };

  const toggleSelectTicket = (e, ticketId) => {
    e.stopPropagation();

    setSelectedIds((prev) =>
      prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId]
    );
  };


  // =============================
  // OPEN TICKET
  // =============================
  const openTicket = async (ticket) => {
    setSelectedTicket({
      ...ticket,
      deadline: ticket.deadline
        ? new Date(ticket.deadline).toISOString().slice(0, 16)
        : ""
    });

    setCommentDraft("");
    setCommentVisibility("public");

    setReplyDraft("");
    setReplyVisibility("public");
    setReplyTargetId(null);

    // Load comments
    try {
      const res = await fetch(
        `http://localhost:3000/api/tickets/${ticket.id}/comments?scope=staff`
      );

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

    // 🔥 ADD THIS PART (load merged tickets)
    try {
      const res = await fetch(
        `http://localhost:3000/api/tickets/${ticket.id}/merged`
      );

      if (res.ok) {
        const data = await res.json();
        setMergedRequests(data.merged_requests);
        setMergedCount(data.count);
      } else {
        setMergedRequests([]);
        setMergedCount(0);
      }
    } catch (error) {
      console.error("Merged requests load error:", error);
      setMergedRequests([]);
      setMergedCount(0);
    }


    // 🔥 Load audit history
    try {
      const res = await fetch(
        `http://localhost:3000/api/tickets/${ticket.id}/history`
      );

      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      } else {
        setHistory([]);
      }

    } catch (error) {
      console.error("History load error:", error);
      setHistory([]);
    }

  };


  // =============================
  // SUBMIT COMMENT
  // =============================

  const submitComment = async (
    rawMessage,
    parentId = null,
    visibility = "public"
  ) => {
    if (!selectedTicket) return;

    const message = String(rawMessage || "").trim();
    if (!message) return;

    setCommentSubmitting(true);

    try {
      const res = await fetch(
        `http://localhost:3000/api/tickets/${selectedTicket.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            visibility,
            user_id: user?.id || null,
            actor_role: "admin",
            parent_id: parentId,
          }),
        }
      );

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
    } catch (error) {
      alert(error.message || "Failed to post comment");
    } finally {
      setCommentSubmitting(false);
    }
  };


  // =============================
  // COMMENT TREE RENDER
  // =============================

  const renderCommentNode = (node, depth = 0) => {
    const INDENT = 20;

    const badgeCls =
      node.visibility === "internal"
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
            <div className="relative flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800">{node.author || "Unknown"}</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${badgeCls}`}>
                {node.visibility}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">{new Date(node.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{node.message}</p>
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
                <label className="mb-1 block text-xs font-semibold text-slate-600">Visibility</label>
                <select
                  value={replyVisibility}
                  onChange={(e) => setReplyVisibility(e.target.value)}
                  className="w-full rounded-lg border p-2 text-sm bg-white"
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                </select>
              </div>
              <textarea
                className="h-24 w-full rounded-lg border bg-white p-2.5"
                placeholder={`Reply to ${node.author || "User"}...`}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => submitComment(replyDraft, node.id, replyVisibility)}
                  disabled={commentSubmitting || !replyDraft.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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

  //------------------------
  // Submit / Update Ticket
  //------------------------
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
            category: selectedTicket.category || "General Inquiry",
            deadline: selectedTicket.deadline
              ? new Date(selectedTicket.deadline)
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")
              : null
          })
        }
      );

      if (response.ok) {
        await fetchTickets();
        setSelectedTicket(null);
        alert(`Ticket successfully moved to ${newStatus}!`);
      }
    } catch (error) {
      console.error("Update error:", error);
    }
  };
  // Merge Tickets
  const handleMerge = async () => {
    console.log("MERGE CLICKED");

    try {

      if (!selectedTicket) {
        alert("Select a draft ticket to merge into.");
        return;
      }

      if (selectedIds.length < 2) {
        alert("Select at least two tickets to merge.");
        return;
      }

      const draftTicketId = selectedTicket.id;

      const response = await fetch("http://localhost:3000/api/admin/tickets/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          draft_ticket_id: draftTicketId,
          ticket_ids: selectedIds,
          admin_id: 1
        })
      });

      const data = await response.json();
      console.log("Merge result:", data);
      if (data.success) {
        openTicket(selectedTicket); // 🔥 refresh merged list
      }


      alert("Tickets merged successfully!");
      setSelectedIds([]);

    } catch (error) {
      console.error("Merge failed:", error);
    }
  };

  // --------------------------
  // ---------Unlink-----------
  // --------------------------
  const handleUnlink = async (ticketId) => {

    try {

      const response = await fetch(
        "http://localhost:3000/api/admin/tickets/unlink",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            draft_ticket_id: selectedTicket.id,
            original_ticket_id: ticketId,
            admin_id: 1
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        openTicket(selectedTicket); // 🔥 refresh merged list
      }

    } catch (error) {
      console.error("Unlink failed:", error);
    }

  };

  // Refreshed Ticket Assignees and people involved
  const fetchTicketDetails = async (ticketId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/tickets/${ticketId}`);
      const data = await res.json();

      const ticketData = data.ticket || data;

      let formattedDeadline = "";

      if (ticketData.deadline) {
        const date = new Date(ticketData.deadline);
        if (!isNaN(date.getTime())) {
          formattedDeadline = date.toISOString().slice(0, 16);
        }
      }

      setSelectedTicket({
        ...ticketData,
        deadline: formattedDeadline
      });

    } catch (error) {
      console.error("Failed to refresh ticket:", error);
    }
  };

  // ----------------------------
  // Assign Ticket to an assignee
  // ----------------------------
  const handleAssignTicket = async (userId) => {
    try {
      await fetch(`http://localhost:3000/api/tickets/${selectedTicket.id}/reassign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          new_assignee_ids: [Number(userId)],
          changed_by: user?.id || null
        })
      });

      alert("Ticket assigned successfully");

      // 👇 REFRESH TICKET DATA
      await fetchTicketDetails(selectedTicket.id);
      await fetchTickets(); // Refresh Ticket List

    } catch (err) {
      console.error("Assignment failed:", err);
    }
  };

  const loadMergedRequests = async (ticketId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/tickets/${ticketId}/merged`);
      const data = await res.json();

      setMergedRequests(data.merged_requests);
      setMergedCount(data.count);

    } catch (err) {
      console.error("Failed to fetch merged tickets", err);
    }
  };



  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <header className="mb-6">
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">Admin Dashboard</h1>
          <p className="mt-2 text-base text-slate-700 md:text-lg">
            Dashboard layout for managing and reviewing tickets.
          </p>
        </header>

        <div className="mb-6 flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-slate-700">Filter Stats Period:</p>
          <DatePicker
            selectsRange={true}
            startDate={startDate}
            endDate={endDate}
            onChange={(update) => setDateRange(update)}
            isClearable={true}
            placeholderText="Select a date range"
            className="rounded-lg border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-slate-900"
          />

          <button
            onClick={handleAllTickets}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${!startDate ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            All Tickets
          </button>

          <button
            onClick={handleLast30Days}
            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
          >
            Last 30 Days
          </button>
        </div>

        {/* Admin.jsx - Reporting Dashboard Section (EP06-ST003) */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Ticket Volume Metric */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total ticket</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{reportData.totalTickets}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Status Breakdown</p>
            <div className="flex flex-wrap gap-2">
              {reportData.statusBreakdown.length === 0 ? (
                <p className="text-sm italic text-slate-400">No status data available.</p>
              ) : (
                reportData.statusBreakdown.map(stat => (
                  <div key={stat.status} className="flex flex-col rounded-lg border bg-blue-50/50 px-3 py-2 border-blue-100">
                    <span className="text-[10px] font-bold uppercase text-blue-500">{stat.status}</span>
                    <span className="text-lg font-bold text-slate-800">{stat.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Average Resolution Time Metric */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Avg. Resolution</p>
            <p className="mt-2 text-3xl font-bold text-indigo-600">
              {reportData.avgResolutionHours} <span className="text-sm font-medium text-slate-400">hours</span>
            </p>
          </div>

          {/* Category Breakdown Metric */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Category Breakdown</p>
            <div className="flex flex-wrap gap-2">
              {reportData.categoryBreakdown.length === 0 ? (
                <p className="text-sm italic text-slate-400">No category data available yet.</p>
              ) : (
                reportData.categoryBreakdown.map(cat => (
                  <div key={cat.category} className="flex flex-col rounded-lg border bg-slate-50 px-3 py-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">{cat.category}</span>
                    <span className="text-lg font-bold text-slate-800">{cat.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm lg:col-span-4">
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
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${activeFilter === filter
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
                      className={`flex items-start gap-3 rounded-lg border p-3 transition cursor-pointer ${selectedIds.includes(ticket.id)
                        ? "border-slate-400 bg-slate-100/50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                        } ${selectedTicket?.id === ticket.id ? "ring-2 ring-slate-900" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 accent-slate-900 focus:ring-slate-900"
                        checked={selectedIds.includes(ticket.id)}
                        onChange={(e) => toggleSelectTicket(e, ticket.id)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{ticket.title}</p>
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
                onClick={handleMerge}
                className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Merge Selected Drafts
              </button>
            </div>


            <div className="mt-8 border-t border-slate-200 pt-5">
              <h3 className="text-xl font-semibold text-slate-950 mb-4">User Management</h3>
              <div className="space-y-3">
                {allUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">{u.username}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-500">{u.role}</p>
                      {u.role !== 'user' && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {availableTags.map(tag => (
                            <label key={tag.id} className="flex items-center gap-1 text-[10px] font-medium text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-300 accent-slate-900"
                                checked={userScopes.some(s => s.user_id === u.id && s.scope_id === tag.id)}
                                onChange={() => handleScopeToggle(u.id, tag.id)}
                              />
                              {tag.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRoleToggle(u.id, u.role)}
                      className={`ml-4 rounded-md px-2 py-1 text-xs font-bold transition-colors ${u.role === 'user'
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                        }`}
                    >
                      {u.role === 'user' ? 'Promote' : 'Demote'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm lg:col-span-8">
            {!selectedTicket ? (
              <div className="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-10">
                <p className="text-lg italic text-slate-500">
                  No ticket selected. Click a ticket from the list to review it.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Review Ticket</h2>
                    <p className="text-sm text-slate-500">{selectedTicket.tracking_id}</p>
                  </div>
                  <span className="inline-flex w-fit rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                    {selectedTicket.status?.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">AI-Suggested Title</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      value={selectedTicket.title || ""}
                      onChange={(e) => setSelectedTicket({ ...selectedTicket, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      AI-Generated Summary (Public)
                    </label>
                    <textarea
                      rows="3"
                      className="w-full rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      value={selectedTicket.ai_analysis || ""}
                      onChange={(e) => setSelectedTicket({ ...selectedTicket, ai_analysis: e.target.value })}
                    />
                  </div>

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                    <label className="mb-1 block text-sm font-bold uppercase tracking-tight text-indigo-700">
                      AI Suggested Solution
                    </label>
                    <textarea
                      rows="4"
                      className="w-full rounded-lg border border-indigo-200 bg-white p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedTicket.suggested_resolution || ""}
                      onChange={(e) => setSelectedTicket({ ...selectedTicket, suggested_resolution: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Deadline
                      </label>

                      <DatePicker
                        selected={
                          selectedTicket?.deadline
                            ? new Date(selectedTicket.deadline)
                            : null
                        }
                        onChange={(date) =>
                          setSelectedTicket((prev) => ({
                            ...prev,
                            deadline: date
                          }))
                        }
                        showTimeSelect
                        dateFormat="yyyy-MM-dd HH:mm"
                        className="w-full rounded-lg border border-slate-300 p-2.5"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Category</label>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none"
                        value={selectedTicket.category || "General Inquiry"}
                        onChange={(e) => setSelectedTicket({ ...selectedTicket, category: e.target.value })}
                      >
                        <option>Technical Support</option>
                        <option>Billing/Finance</option>
                        <option>Account Access</option>
                        <option>Feature Request</option>
                        <option>General Inquiry</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">User Email (Reference)</label>
                      <input
                        type="text"
                        disabled
                        className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-500"
                        value={selectedTicket.user_email || ""}
                      />
                    </div>
                  </div>

                  {/* Assign Ticket */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Assign Ticket
                    </label>

                    <select
                      className="w-full rounded-lg border border-slate-300 p-2.5"
                      onChange={(e) => {
                        const userId = e.target.value;
                        if (userId) handleAssignTicket(userId);
                      }}
                      value={selectedTicket.assignee_id || ""}
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

                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">People Involved</h3>
                    <div className="mt-3 space-y-3 text-sm">
                      <div>
                        <p className="text-xs uppercase text-slate-500">Creator</p>
                        <p className="font-medium text-slate-800">
                          {participantLabel(participants.creator, "Unknown Creator")}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase text-slate-500">Current Assignees</p>
                        {participants.assignees?.length ? (
                          <ul className="mt-1 space-y-1">
                            {participants.assignees.map((assignee) => (
                              <li key={`assignee-${assignee.id || assignee.email || assignee.name}`} className="text-slate-700">
                                {participantLabel(assignee)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 italic text-slate-500">No assignees</p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs uppercase text-slate-500">Followers</p>
                        {participants.followers?.length ? (
                          <ul className="mt-1 space-y-1">
                            {participants.followers.map((follower) => (
                              <li key={`follower-${follower.id || follower.email || follower.name}`} className="text-slate-700">
                                {participantLabel(follower)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 italic text-slate-500">No followers</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border bg-slate-50 p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Original User Message</p>
                    <p className="text-sm italic text-slate-600">"{selectedTicket.original_message || "No content"}"</p>
                  </div>
                  {/* Audit Trail */}
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                      Audit Trail
                    </h3>

                    {history.length === 0 ? (
                      <p className="mt-2 text-sm italic text-slate-500">
                        No history yet
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {history.map((h) => (
                          <li key={h.id} className="text-sm text-slate-700">
                            <span className="font-semibold">
                              {h.old_status} → {h.new_status}
                            </span>
                            <br />
                            by {h.changed_by_name || "System"}
                            <br />
                            <span className="text-xs text-slate-500">
                              {new Date(h.created_at).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {/* Linked Requests */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                      Linked Requests ({mergedCount})
                    </h3>

                    {mergedRequests.length === 0 ? (
                      <p className="mt-2 text-sm italic text-slate-500">
                        No merged requests
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {mergedRequests.map((req) => (

                          <li key={req.id} className="flex flex-col gap-2 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">

                            <span>
                              {req.tracking_id} – {req.title}
                            </span>

                            <button
                              onClick={() => handleUnlink(req.id)}
                              className="text-red-600 hover:underline text-xs"
                            >
                              Unlink
                            </button>

                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:gap-4">
                    <button
                      onClick={() => handleUpdateTicket("Draft")}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Keep as Draft
                    </button>
                    <button
                      onClick={() => handleUpdateTicket("New")}
                      className="flex-[2] rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 shadow-lg"
                    >
                      Submit
                    </button>
                  </div>

                  <div className="mt-6 rounded-xl border bg-slate-50 p-4">
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700">Comment Thread</h3>
                    {comments.length === 0 ? (
                      <p className="text-xs italic text-slate-500">No comments yet.</p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto pr-1">
                        {commentTree.map((node) => (
                          <div
                            key={`root-${node.id}`}
                            className="mb-6 border-b border-slate-200 pb-10 last:mb-0 last:border-b-0 last:pb-0"
                          >
                            {renderCommentNode(node)}
                          </div>
                        ))}
                      </div>
                    )}

                    {!replyTargetId ? (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                        <div className="mb-2">
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Visibility</label>
                          <select
                            value={commentVisibility}
                            onChange={(e) => setCommentVisibility(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-sm"
                          >
                            <option value="public">Public</option>
                            <option value="internal">Internal</option>
                          </select>
                        </div>
                        <textarea
                          rows="3"
                          className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="Write a comment or reply..."
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                        />
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => submitComment(commentDraft, null, commentVisibility)}
                            disabled={commentSubmitting || !commentDraft.trim()}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {commentSubmitting ? "Posting..." : "Post Comment"}
                          </button>
                        </div>
                      </div>
                    ) : null}
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
