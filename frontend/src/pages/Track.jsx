import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const USE_MOCK = false;

const mockTicket = (id) => ({
  id,
  trackingId: id,
  title: "Cannot access HR portal",
  category: "Technical Support",
  status: "Solving",
  createdAt: "2026-02-15T08:30:00Z",
  deadline: "2026-02-18T12:00:00Z",
  summary: "User reports HR portal access issue after password reset.",
  comments: [
    {
      id: "c1",
      author: "Support Team",
      message: "Thanks, our team is checking your account access now.",
      visibility: "public",
      createdAt: "2026-02-15T09:05:00Z",
    },
    {
      id: "c2",
      author: "User",
      message: "I can't login on mobile either.",
      visibility: "public",
      createdAt: "2026-02-15T09:20:00Z",
    },
  ],
});

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

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

  const [history, setHistory] = useState([]);

  const initialTid = params.trackingId || searchParams.get("tid") || "";

  const [inputTid, setInputTid] = useState(initialTid);
  const [activeTid, setActiveTid] = useState(initialTid);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [comment, setComment] = useState("");
  const [replyComment, setReplyComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const user = JSON.parse(localStorage.getItem("ceivoice_user") || "null");
  const commentTree = useMemo(() => buildCommentTree(ticket?.comments || []), [ticket?.comments]);
  const participants = ticket?.participants || { creator: null, assignees: [], followers: [] };

  function participantLabel(person, fallbackName = "Unknown") {
    if (!person) return fallbackName;
    const name = person.name || person.username || fallbackName;
    const email = person.email ? ` (${person.email})` : "";
    return `${name}${email}`;
  }

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

      const res = await fetch(`http://localhost:3000/api/tickets/public/${encodeURIComponent(tid)}`);
      if (!res.ok) throw new Error("Ticket not found or server error");
      const data = await res.json();
      setTicket({
        ...data,
        comments: data.comments || data.publicComments || [],
      });

      const historyRes = await fetch(`http://localhost:3000/api/tickets/${data.id}/history`);
      const historyData = await historyRes.json();
      setHistory(historyData);
    } catch (e) {
      setErr(e?.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }

  async function submitComment(message, parentId = null) {
    if (!ticket) return;
    const msg = message.trim();
    if (!msg) return;

    setCommentBusy(true);
    setErr("");

    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        setTicket((prev) => ({
          ...prev,
          comments: [
            ...(prev?.comments || []),
            {
              id: `c-${Date.now()}`,
              author: "User",
              message: msg,
              visibility: "public",
              parentId,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
        if (parentId) {
          setReplyComment("");
          setReplyTarget(null);
        } else {
          setComment("");
        }
        return;
      }

      const res = await fetch(`http://localhost:3000/api/tickets/${encodeURIComponent(ticket.id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          visibility: "public",
          user_id: user?.id || null,
          actor_role: "user",
          parent_id: parentId,
        }),
      });

      if (!res.ok) throw new Error("Failed to add comment");
      const newComment = await res.json();

      setTicket((prev) => ({
        ...prev,
        comments: [...(prev?.comments || []), newComment],
      }));
      if (parentId) {
        setReplyComment("");
        setReplyTarget(null);
      } else {
        setComment("");
      }
    } catch (e) {
      setErr(e?.message || "Failed to submit comment");
    } finally {
      setCommentBusy(false);
    }
  }

  function renderCommentNode(node, depth = 0) {
    const INDENT = 20;
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
              <p className="font-medium">{node.author || "Unknown"}</p>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                Public
              </span>
              <p className="text-xs font-semibold text-gray-500">{formatDate(node.createdAt)}</p>
            </div>
          </div>
          <p className="text-gray-700 mt-2 whitespace-pre-wrap">{node.message}</p>
          <button
            type="button"
            onClick={() => {
              setReplyTarget({ id: node.id, author: node.author || "User" });
              setReplyComment("");
            }}
            className="mt-2 text-sm font-medium text-blue-600 hover:underline"
          >
            Reply
          </button>

          {replyTarget?.id === node.id ? (
            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
              <div className="mb-2 flex items-center justify-between text-sm text-blue-800">
                <span>Replying to {replyTarget.author}</span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTarget(null);
                    setReplyComment("");
                  }}
                  className="font-semibold hover:underline"
                >
                  Cancel reply
                </button>
              </div>
              <textarea
                value={replyComment}
                onChange={(e) => setReplyComment(e.target.value)}
                rows={3}
                placeholder={`Reply to ${replyTarget.author}...`}
                className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => submitComment(replyComment, node.id)}
                  disabled={commentBusy || !replyComment.trim()}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black transition"
                >
                  {commentBusy ? "Posting..." : "Post Reply"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {node.replies.map((child) => renderCommentNode(child, depth + 1))}
      </div>
    );
  }

  useEffect(() => {
    if (initialTid) {
      setActiveTid(initialTid);
      fetchTicket(initialTid);
    }
  }, [initialTid]);

  function onTrack() {
    const tid = inputTid.trim();
    if (!tid) return;
    setActiveTid(tid);
    navigate(`/track/${encodeURIComponent(tid)}`);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Track Ticket</h1>
        <p className="text-gray-600 mt-2">
          Enter your tracking ID to view the latest ticket status and public updates.
        </p>
      </div>

      <div className="bg-white border rounded-2xl p-4 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={inputTid}
            onChange={(e) => setInputTid(e.target.value)}
            placeholder="e.g. TIC-2026-000123"
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

      {loading ? (
        <div className="mt-6 bg-white border rounded-2xl p-6">
          <p className="text-gray-600">Loading ticket...</p>
        </div>
      ) : null}

      {err ? (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-5">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-700 mt-1">{err}</p>
        </div>
      ) : null}

      {ticket && !loading ? (
        <>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Ticket Journey (Audit Log)</h3>
              <div className="space-y-4">
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No history recorded yet.</p>
                ) : (
                  history.map((h, index) => (
                    <div key={index} className="flex gap-4 items-start">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-slate-900 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          Status changed from <span className="text-slate-500 line-through">{h.old_status}</span> to <b>{h.new_status}</b>
                        </p>
                        <p className="text-xs text-slate-500">
                          Updated by {h.changed_by_name} on {new Date(h.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
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
            </div>

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

              <div className="bg-white border rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold">People Involved</h3>
                <div className="mt-3 space-y-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Creator</p>
                    <p className="mt-1 font-medium text-gray-800">
                      {participantLabel(participants.creator, "Unknown Creator")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Current Assignees</p>
                    {participants.assignees?.length ? (
                      <ul className="mt-1 space-y-1">
                        {participants.assignees.map((assignee) => (
                          <li key={`assignee-${assignee.id || assignee.email || assignee.name}`} className="text-gray-800">
                            {participantLabel(assignee)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-gray-500 italic">No assignees</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Followers</p>
                    {participants.followers?.length ? (
                      <ul className="mt-1 space-y-1">
                        {participants.followers.map((follower) => (
                          <li key={`follower-${follower.id || follower.email || follower.name}`} className="text-gray-800">
                            {participantLabel(follower)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-gray-500 italic">No followers</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 text-white rounded-2xl p-6">
                <h3 className="font-semibold">Need faster help?</h3>
                <p className="text-white/80 mt-2 text-sm">
                  Add details (device, screenshots, steps) in a public comment to speed up resolution.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Comment Thread</h3>

            <div>
              {(ticket.comments || []).length === 0 ? (
                <p className="text-gray-600">No public comments yet.</p>
              ) : (
                commentTree.map((node) => (
                  <div key={`root-${node.id}`} className="pb-10 mb-6 border-b border-slate-200 last:pb-0 last:mb-0 last:border-b-0">
                    {renderCommentNode(node)}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add a public comment
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="Type your message..."
                className="w-full border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => submitComment(comment)}
                  disabled={commentBusy || !comment.trim()}
                  className="px-5 py-3 rounded-xl bg-gray-900 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black transition"
                >
                  {commentBusy ? "Posting..." : "Post Comment"}
                </button>
              </div>
            </div>

          </div>
        </>
      ) : null}
    </div>
  );
}
