import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

// ✅ Toggle this during checkpoint if backend isn't ready
const USE_MOCK = true;

// --- mock data (safe for demo) ---
const mockTicket = (id) => ({
  id,
  trackingId: id,
  title: "Cannot access HR portal",
  category: "Technical Support",
  status: "Solving", // Draft | New | Assigned | Solving | Solved | Failed | Renew
  createdAt: "2026-02-15T08:30:00Z",
  deadline: "2026-02-18T12:00:00Z",
  summary: "User reports HR portal access issue after password reset.",
  publicComments: [
    {
      id: "c1",
      author: "Support Team",
      message: "Thanks—our team is checking your account access now.",
      createdAt: "2026-02-15T09:05:00Z",
    },
    {
      id: "c2",
      author: "User",
      message: "I can’t login on mobile either.",
      createdAt: "2026-02-15T09:20:00Z",
    },
  ],
});

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function StatusBadge({ status }) {
  const { label, cls } = useMemo(() => {
    const s = (status || "").toLowerCase();
    if (s === "draft") return { label: "Draft", cls: "bg-gray-100 text-gray-700 border-gray-200" };
    if (s === "new") return { label: "New", cls: "bg-blue-50 text-blue-700 border-blue-200" };
    if (s === "assigned") return { label: "Assigned", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    if (s === "solving") return { label: "Solving", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    if (s === "solved") return { label: "Solved", cls: "bg-green-50 text-green-700 border-green-200" };
    if (s === "failed") return { label: "Failed", cls: "bg-red-50 text-red-700 border-red-200" };
    if (s === "renew") return { label: "Renew", cls: "bg-purple-50 text-purple-700 border-purple-200" };
    return { label: status || "Unknown", cls: "bg-gray-100 text-gray-700 border-gray-200" };
  }, [status]);

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${cls}`}>
      {label}
    </span>
  );
}

export default function Track() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  // supports /track/:trackingId and /track?tid=xxx
  const initialTid = params.trackingId || searchParams.get("tid") || "";

  const [inputTid, setInputTid] = useState(initialTid);
  const [activeTid, setActiveTid] = useState(initialTid);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [comment, setComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  async function fetchTicket(tid) {
    if (!tid) return;

    setLoading(true);
    setErr("");
    setTicket(null);

    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 500));
        setTicket(mockTicket(tid));
        return;
      }

      // ✅ Change to match your backend route
      // Example: GET /api/tickets/public/:trackingId
      const res = await fetch(`/api/tickets/public/${encodeURIComponent(tid)}`);
      if (!res.ok) throw new Error("Ticket not found or server error");
      const data = await res.json();
      setTicket(data);
    } catch (e) {
      setErr(e?.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }

  async function submitComment() {
    if (!ticket) return;
    const msg = comment.trim();
    if (!msg) return;

    setCommentBusy(true);
    setErr("");

    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        setTicket((prev) => ({
          ...prev,
          publicComments: [
            ...(prev?.publicComments || []),
            {
              id: `c-${Date.now()}`,
              author: "User",
              message: msg,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
        setComment("");
        return;
      }

      // ✅ Change to match your backend route
      // Example: POST /api/tickets/:ticketId/comments  { message, visibility:"public" }
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, visibility: "public" }),
      });

      if (!res.ok) throw new Error("Failed to add comment");
      const newComment = await res.json();

      setTicket((prev) => ({
        ...prev,
        publicComments: [...(prev?.publicComments || []), newComment],
      }));
      setComment("");
    } catch (e) {
      setErr(e?.message || "Failed to submit comment");
    } finally {
      setCommentBusy(false);
    }
  }

  // auto-load if opened with an ID
  useEffect(() => {
    if (initialTid) {
      setActiveTid(initialTid);
      fetchTicket(initialTid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTid]);

  function onTrack() {
    const tid = inputTid.trim();
    if (!tid) return;
    setActiveTid(tid);
    // push to URL so it’s shareable:
    navigate(`/track/${encodeURIComponent(tid)}`);
    // fetchTicket will run from useEffect because params changes
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Track Ticket</h1>
        <p className="text-gray-600 mt-2">
          Enter your tracking ID to view the latest ticket status and public updates.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white border rounded-2xl p-4 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={inputTid}
            onChange={(e) => setInputTid(e.target.value)}
            placeholder="e.g. TCK-2026-000123"
            className="w-full md:flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
          <button
            onClick={onTrack}
            className="px-5 py-3 rounded-xl bg-gray-900 text-white hover:bg-black transition"
          >
            Track
          </button>
        </div>

        {activeTid ? (
          <p className="text-sm text-gray-500 mt-3">
            Showing results for: <span className="font-medium text-gray-700">{activeTid}</span>
          </p>
        ) : null}
      </div>

      {/* States */}
      {loading ? (
        <div className="mt-6 bg-white border rounded-2xl p-6">
          <p className="text-gray-600">Loading ticket…</p>
        </div>
      ) : null}

      {err ? (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-5">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-700 mt-1">{err}</p>
        </div>
      ) : null}

      {/* Ticket */}
      {ticket && !loading ? (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview */}
            <div className="bg-white border rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{ticket.title || "Untitled Ticket"}</h2>
                  <p className="text-gray-600 mt-1">
                    Category: <span className="font-medium text-gray-800">{ticket.category || "-"}</span>
                  </p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>

              {ticket.summary ? (
                <p className="text-gray-700 mt-4 leading-relaxed">{ticket.summary}</p>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <div className="bg-gray-50 border rounded-xl p-4">
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="font-medium mt-1">{formatDate(ticket.createdAt)}</p>
                </div>
                <div className="bg-gray-50 border rounded-xl p-4">
                  <p className="text-xs text-gray-500">Deadline</p>
                  <p className="font-medium mt-1">{formatDate(ticket.deadline)}</p>
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Public Updates</h3>

              <div className="space-y-4">
                {(ticket.publicComments || []).length === 0 ? (
                  <p className="text-gray-600">No public comments yet.</p>
                ) : (
                  ticket.publicComments.map((c) => (
                    <div key={c.id} className="border rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium">{c.author || "Unknown"}</p>
                        <p className="text-xs text-gray-500">{formatDate(c.createdAt)}</p>
                      </div>
                      <p className="text-gray-700 mt-2 whitespace-pre-wrap">{c.message}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add comment */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add a public comment
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="Type your message…"
                  className="w-full border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={submitComment}
                    disabled={commentBusy || !comment.trim()}
                    className="px-5 py-3 rounded-xl bg-gray-900 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black transition"
                  >
                    {commentBusy ? "Posting…" : "Post Comment"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: quick info */}
          <div className="space-y-6">
            <div className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold">Tracking Info</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Tracking ID</span>
                  <span className="font-medium">{ticket.trackingId || ticket.id}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium">{ticket.status || "Unknown"}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Note: Internal staff notes are hidden from public tracking.
              </p>
            </div>

            <div className="bg-gray-900 text-white rounded-2xl p-6">
              <h3 className="font-semibold">Need faster help?</h3>
              <p className="text-white/80 mt-2 text-sm">
                Add details (device, screenshots, steps) in a public comment to speed up resolution.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
