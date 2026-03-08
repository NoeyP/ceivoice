require('dotenv').config(); // MUST BE LINE 1
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();
const Groq = require("groq-sdk"); // Importing Groq
app.use(cors()); // Allow the frontend to talk to the backend
app.use(express.json());
const crypto = require("crypto");
const { OAuth2Client } = require('google-auth-library');


const VALID_STATUSES = ['New', 'Assigned', 'Solving', 'Solved', 'Failed', 'Renew'];
const STAFF_ROLES = new Set(['assignee', 'admin']);
const ALL_COMMENT_ROLES = new Set(['user', 'creator', 'follower', 'assignee', 'admin']);
let hasParentCommentIdColumnCache = null;
const tableExistsCache = new Map();
const columnExistsCache = new Map();


// create connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  port: 3306,
  user: 'support_user',
  password: 'support_password',
  database: 'ceivoice'
});
const db = connection.promise();

async function hasParentCommentIdColumn() {
  if (hasParentCommentIdColumnCache !== null) {
    return hasParentCommentIdColumnCache;
  }

  try {
    const [rows] = await db.execute(
      `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'ticket_comments'
       AND COLUMN_NAME = 'parent_comment_id'
       LIMIT 1`
    );
    hasParentCommentIdColumnCache = rows.length > 0;
  } catch (error) {
    console.error("Schema check failed for ticket_comments.parent_comment_id:", error.message);
    hasParentCommentIdColumnCache = false;
  }

  return hasParentCommentIdColumnCache;
}

async function hasTable(tableName) {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName);
  }

  try {
    const [rows] = await db.execute(
      `SELECT 1
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       LIMIT 1`,
      [tableName]
    );
    const exists = rows.length > 0;
    tableExistsCache.set(tableName, exists);
    return exists;
  } catch (error) {
    console.error(`Schema check failed for table ${tableName}:`, error.message);
    tableExistsCache.set(tableName, false);
    return false;
  }
}

async function hasColumn(tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  if (columnExistsCache.has(key)) {
    return columnExistsCache.get(key);
  }

  try {
    const [rows] = await db.execute(
      `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
       LIMIT 1`,
      [tableName, columnName]
    );
    const exists = rows.length > 0;
    columnExistsCache.set(key, exists);
    return exists;
  } catch (error) {
    console.error(`Schema check failed for column ${key}:`, error.message);
    columnExistsCache.set(key, false);
    return false;
  }
}

async function getTicketParticipants(ticketId, creatorEmail) {
  const creator = {
    name: null,
    email: creatorEmail || null,
  };

  if (creator.email) {
    try {
      const [creatorRows] = await db.execute(
        `SELECT username, email
         FROM users
         WHERE LOWER(email) = LOWER(?)
         LIMIT 1`,
        [creator.email]
      );
      if (creatorRows.length > 0) {
        creator.name = creatorRows[0].username || null;
        creator.email = creatorRows[0].email || creator.email;
      }
    } catch (error) {
      console.error("Creator lookup failed:", error.message);
    }
  }

  let assignees = [];
  try {
    const [assigneeRows] = await db.execute(
      `SELECT DISTINCT u.id, u.username AS name, u.email
       FROM ticket_assignees ta
       JOIN users u ON u.id = ta.user_id
       WHERE ta.ticket_id = ?
       ORDER BY u.username ASC`,
      [ticketId]
    );
    assignees = assigneeRows || [];
  } catch (error) {
    console.error("Assignee lookup failed:", error.message);
  }

  let followers = [];
  try {
    if (await hasTable('ticket_followers')) {
      const [followerRows] = await db.execute(
        `SELECT DISTINCT u.id, u.username AS name, u.email
         FROM ticket_followers tf
         JOIN users u ON u.id = tf.user_id
         WHERE tf.ticket_id = ?
         ORDER BY u.username ASC`,
        [ticketId]
      );
      followers = followerRows || [];
    } else if (await hasColumn('ticket_comments', 'actor_role')) {
      const [followerRows] = await db.execute(
        `SELECT DISTINCT u.id, u.username AS name, u.email
         FROM ticket_comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.ticket_id = ?
         AND c.actor_role = 'follower'
         ORDER BY u.username ASC`,
        [ticketId]
      );
      followers = followerRows || [];
    }
  } catch (error) {
    console.error("Follower lookup failed:", error.message);
  }

  return { creator, assignees, followers };
}

// Initialize AI(EP02-ST001)
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
}); // THIS DEFINES 'groq'

// Sending Email Function
async function sendNotificationEmail(email, type, trackingId) {
  try {

    const mailOptions = {
      from: `"CEI Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Update on your ticket ${trackingId}`,
      text: `
Hello,

There is an update on your support request.

Ticket ID: ${trackingId}
Update: ${type}

You can track your ticket here:
http://localhost:5173/track/${trackingId}

Best regards,
CEI Support Team
      `
    };

    await transporter.sendMail(mailOptions);

    console.log("📧 Notification email sent");

  } catch (error) {
    console.error("Email notification failed:", error.message);
  }
}

// Ai and email receipt logic
app.post('/api/tickets', async (req, res) => {
  // 1. Destructure all possible fields from the frontend
  const { title, description, message, email, category } = req.body;

  // 2. Pick the one that isn't empty (The "Whole Family" fallback)
  const finalDescription = description || message || "No content provided";
  let finalTitle = title || "New Support Request";
  const finalEmail = email;
  let finalCategory = category || "General";

  if (!finalEmail || finalDescription === "No content provided") {
    return res.status(400).json({ error: "Email and message are required." });
  }

  const trackingIdStr = `TIC-${Date.now()}`;
  let aiSummary = "Summary pending...";
  let suggestedSolution = "No automated suggestion available.";

  try {
    // --- PART 1: AI ANALYSIS (Groq) ---
    try {
      if (finalDescription !== "No content provided") {
        const chatCompletion = await groq.chat.completions.create({
          messages: [{
            role: "user",
            content: `Analyze this support request: "${finalDescription}". 
                      Provide a JSON response with:
                      1. "title": concise title (max 100 chars).
                      2. "summary": structured summary (max 500 chars).
                      Do NOT return JSON inside the summary.
                      3. "category": ONE from: [Technical Support, Billing, Account Access, Feature Request, General Inquiry].
                      4. "suggested_solution": Propose 1-3 actionable steps or resources to resolve this issue.`
          }],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }
        });

        const aiData = JSON.parse(chatCompletion.choices[0]?.message?.content);
        aiSummary = aiData.summary || "No summary available";
        finalTitle = aiData.title || finalTitle;
        finalCategory = aiData.category || finalCategory;

        // 2. ASSIGN IT HERE (Make sure the name matches your DB call exactly)
        if (Array.isArray(aiData.suggested_solution)) {
          suggestedSolution = aiData.suggested_solution.join("\n");
        } else {
          suggestedSolution = aiData.suggested_solution || suggestedSolution;
        }

        console.log(`🤖 AI Result: [${finalCategory}] ${finalTitle}`);

        aiSummary = aiData.summary || aiSummary;
        finalTitle = aiData.title || finalTitle;
        // This clears ST003:
        finalCategory = aiData.category || finalCategory;

        console.log(`🤖 AI Result: [${finalCategory}] ${finalTitle}`);
      }
    } catch (aiError) {
      console.error("Groq Error:", aiError.message);
    }

    // --- PART 2: DATABASE SAVE (Promise-based) ---
    const [result] = await db.execute(
      'INSERT INTO tickets (tracking_id, title, category, status, user_email, ai_analysis, original_message, suggested_resolution) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        trackingIdStr,
        finalTitle,
        finalCategory,
        'Draft',           // ✅ CHANGED: Now satisfies ST007 requirement
        finalEmail,
        aiSummary, // Ensure this is a string for the DB
        finalDescription,
        suggestedSolution  // AI's suggested steps from ST005
      ]
    );
    console.log("💾 Ticket saved as DRAFT with ID:", result.insertId);

    // --- PART 3: AUTOMATED EMAIL ---
    try {
      console.log("--- DEBUG EMAIL ---");
      const sender = process.env.EMAIL_USER || process.env.GMAIL_USER;
      const trackingUrl = `http://localhost:5173/track/${trackingIdStr}`;

      await transporter.sendMail({
        from: sender,
        to: finalEmail,
        subject: 'Request Received - CEiVoice',
        text: `Hello! We received your message. \n\nTracking ID: ${trackingIdStr}\nTrack status here: ${trackingUrl}`
      });
      console.log("✅ EMAIL SENT SUCCESSFULLY");
    } catch (mailError) {
      console.error("❌ EMAIL LOGIC FAILED:", mailError.message);
      // Still return success to user because ticket is in DB
    }

    // --- FINAL RESPONSE ---
    return res.status(201).json({
      success: true,
      trackingId: trackingIdStr,
      message: "Ticket created successfully."
    });

  } catch (dbError) {
    console.error("❌ DATABASE ERROR:", dbError.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// register stuff
app.post("/api/register", (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required." });
  }

  const cleanUsername = String(username).trim();
  const cleanEmail = String(email).trim().toLowerCase();

  if (!cleanUsername || !cleanEmail || !String(password)) {
    return res.status(400).json({ error: "Invalid input." });
  }

  const passwordHash = hashPassword(String(password));

  const sql = `
    INSERT INTO users (username, email, password_hash)
    VALUES (?, ?, ?)
    `;

  connection.query(sql, [cleanUsername, cleanEmail, passwordHash], (err, result) => {
    if (err) {
      // duplicate username/email
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Username or email already exists." });
      }
      console.error("❌ Register DB Error:", err);
      return res.status(500).json({ error: "Database failure" });
    }

    return res.status(201).json({
      success: true,
      user: {
        id: result.insertId,
        username: cleanUsername,
        email: cleanEmail,
      },
    });
  });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required." });
  }

  const cleanUsername = String(username).trim();

  const sql = `
    SELECT id, username, email, password_hash, google_sub
    FROM users
    WHERE username = ?
    LIMIT 1
    `;

  connection.query(sql, [cleanUsername], (err, rows) => {
    if (err) {
      console.error("❌ Login DB Error:", err);
      return res.status(500).json({ error: "Database failure" });
    }

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const user = rows[0];

    // If this account was created by Google login (password_hash is NULL)
    if (!user.password_hash) {
      return res.status(401).json({ error: "This account uses Google login." });
    }

    const ok = verifyPassword(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  });
});

// Login stuff
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;

  const parts = stored.split(":");
  if (parts.length !== 2) return false;

  const [salt, hashHex] = parts;
  if (!salt || !hashHex) return false;

  const derivedKey = crypto.scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hashHex, "hex");

  // If DB value is corrupted / wrong format, avoid crashing
  if (hashBuf.length !== derivedKey.length) return false;

  return crypto.timingSafeEqual(hashBuf, derivedKey);
}


// AI Analysis Logic (EP02/EP03 Core) - Updated for Groq
async function analyzeTicketWithAI(id, text) {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Powerful and fast free-tier model
      messages: [
        {
          role: "system",
          content: "You are a support assistant. Summarize the user's issue into a short title and a 1-sentence summary."
        },
        { role: "user", content: text }
      ],
    });

    const analysis = response.choices[0].message.content;

    // EP03-ST001: Update the record with status "Draft" so it shows up for Admin review
    const updateSql = 'UPDATE tickets SET ai_analysis = ?, status = "Draft" WHERE id = ?';

    // Using await with db.execute is safer than connection.query if you're using the promise wrapper
    await db.execute(updateSql, [analysis, id]);

    console.log(`✨ Groq Analysis complete for Ticket ${id}`);
  } catch (error) {
    console.error("⚠️ Groq Analysis failed:", error.message);
    // Even if it fails, let's set it to Draft so the Admin can see the empty ticket
    await db.execute('UPDATE tickets SET status = "Draft" WHERE id = ?', [id]);
  }
}

// 1. Create the transporter ONCE
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // Helps with Docker network quirks
  }
});

// Verify connection configuration on startup
transporter.verify(function (error, success) {
  if (error) {
    console.log("❌ Transporter connection error:", error);
  } else {
    console.log("✅ Server is ready to take our messages");
  }
});

// Tickets tracking system + Commenting
app.get('/api/tickets/public/:trackingId', async (req, res) => {

  const { trackingId } = req.params;

  try {

    // 1️ Get ticket
    const [tickets] = await db.execute(
      `SELECT 
        id,
        tracking_id AS trackingId,
        title,
        category,
        status,
        user_email AS userEmail,
        ai_analysis,
        created_at AS createdAt
       FROM tickets
       WHERE tracking_id = ?`,
      [trackingId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const ticket = tickets[0];

    // 2️ Get public comments
    const supportsReplies = await hasParentCommentIdColumn();
    const parentColumnSelect = supportsReplies
      ? "c.parent_comment_id AS parentId,"
      : "NULL AS parentId,";

    const [comments] = await db.execute(
      `SELECT 
        c.id,
        ${parentColumnSelect}
        c.message,
        c.visibility,
        c.created_at AS createdAt,
        COALESCE(u.username, 'User') AS author
      FROM ticket_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = ? 
      AND c.visibility = 'public'
      ORDER BY c.created_at ASC`,
      [ticket.id]
    );

    // 3️ Attach comments
    ticket.comments = comments;
    ticket.publicComments = comments;
    ticket.participants = await getTicketParticipants(ticket.id, ticket.userEmail);

    // 4️ Send response
    res.json(ticket);

  } catch (error) {
    console.error("Public ticket fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get('/api/tickets/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { scope } = req.query;
  const isStaffScope = scope === 'staff';

  try {
    const whereVisibility = isStaffScope
      ? `c.visibility IN ('public', 'internal')`
      : `c.visibility = 'public'`;

    const supportsReplies = await hasParentCommentIdColumn();
    const parentColumnSelect = supportsReplies
      ? "c.parent_comment_id AS parentId,"
      : "NULL AS parentId,";

    const [rows] = await db.execute(
      `SELECT
        c.id,
        ${parentColumnSelect}
        c.ticket_id AS ticketId,
        c.message,
        c.visibility,
        c.created_at AS createdAt,
        COALESCE(u.username, 'User') AS author
      FROM ticket_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = ?
      AND ${whereVisibility}
      ORDER BY c.created_at ASC`,
      [id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Ticket comment fetch error:", error);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

// Admin Route: Update Ticket Status + Admin Edits
app.patch('/api/tickets/:id/status', async (req, res) => {
  const { id } = req.params;

  const {
    status,
    title,
    ai_analysis,
    suggested_resolution,
    category,
    changed_by,
    comment
  } = req.body;

  try {

    // 1️ Get current ticket
    const [tickets] = await db.execute(
      'SELECT status, user_email, tracking_id FROM tickets WHERE id = ?',
      [id]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const oldStatus = tickets[0].status;
    const userEmail = tickets[0].user_email;
    const trackingId = tickets[0].tracking_id;

    // 2️ Update ticket (admin edits + status)
    await db.execute(
      `UPDATE tickets 
       SET status = ?, 
           title = ?, 
           ai_analysis = ?, 
           suggested_resolution = ?, 
           category = ?
       WHERE id = ?`,
      [
        status,
        title,
        ai_analysis,
        suggested_resolution,
        category,
        id
      ]
    );

    let deadlineUpdate = "";
    if (oldStatus === 'Draft' && status === 'Open') {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      await db.execute('UPDATE tickets SET deadline = ? WHERE id = ?', [threeDaysFromNow, id]);
    }

    // 3️ Log history (EP04 Audit Trail)
    await db.execute(
      `INSERT INTO ticket_history 
       (ticket_id, old_status, new_status, changed_by, change_type)
       VALUES (?, ?, ?, ?, 'status')`,
      [id, oldStatus, status, changed_by || null]
    );

    // 4️ Save comment if provided
    if (comment) {
      await db.execute(
        `INSERT INTO ticket_comments (ticket_id, user_id, message, visibility)
         VALUES (?, ?, ?, 'public')`,
        [id, changed_by || null, comment]
      );
    }

    // 5️ Send email notification (EP01-ST005)
    if (['Open', 'Solved', 'Failed'].includes(status)) {
      try {
        await sendNotificationEmail(userEmail, status, trackingId);
      } catch (mailError) {
        console.error("Email notification failed:", mailError.message);
      }
    }

    res.json({
      success: true,
      message: `Ticket updated successfully (${oldStatus} → ${status})`
    });

  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Admin Ticket Fetch
app.get('/api/admin/tickets', async (req, res) => {
  try {

    const [rows] = await db.execute(`
      SELECT 
        t.id,
        t.tracking_id,
        t.title,
        t.category,
        t.status,
        t.user_email,
        t.ai_analysis,
        t.suggested_resolution,
        t.original_message,
        GROUP_CONCAT(u.username) AS assignee_name,
        t.created_at
      FROM tickets t
      LEFT JOIN ticket_assignees ta ON t.id = ta.ticket_id
      LEFT JOIN users u ON ta.user_id = u.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);

    console.log(`✅ Admin fetched ${rows.length} tickets`);
    const rowsWithParticipants = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        participants: await getTicketParticipants(row.id, row.user_email),
      }))
    );
    res.json(rowsWithParticipants);

  } catch (error) {
    console.error("Admin ticket fetch error:", error);
    res.status(500).json({ error: "Failed to load tickets" });
  }
});

// Fetch users 
app.get('/api/users', async (req, res) => {
  try {

    const [rows] = await db.execute(`
      SELECT id, username
      FROM users
      ORDER BY username ASC
    `);

    res.json(rows);

  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ error: "Failed to load users" });
  }
});


// ------------------------------
// EP04 FEATURES
// ------------------------------

// Staff workload
app.get('/api/assignee/:userId/tickets', async (req, res) => {
  const { userId } = req.params;

  try {

    const [rows] = await db.execute(`
      SELECT
        t.id,
        t.tracking_id,
        t.title,
        t.status,
        t.deadline,
        t.category,
        t.ai_analysis,
        t.suggested_resolution
      FROM tickets t
      JOIN ticket_assignees ta ON t.id = ta.ticket_id
      WHERE ta.user_id = ?
      AND t.status NOT IN ('Solved', 'Failed')
      ORDER BY t.deadline ASC`,
      [userId]
    );

    res.json(rows);

  } catch (error) {
    console.error("Workload fetch error:", error);
    res.status(500).json({ error: "Failed to load workload" });
  }
});


// Ticket history
app.get('/api/tickets/:id/history', async (req, res) => {
  const { id } = req.params;

  try {

    const [rows] = await db.execute(`
      SELECT h.*, u.username as changed_by_name 
      FROM ticket_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.ticket_id = ?
      ORDER BY h.created_at DESC`,
      [id]
    );

    res.json(rows);

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});


// Reassign ticket
app.patch('/api/tickets/:id/reassign', async (req, res) => {

  const { id } = req.params;
  const { new_assignee_ids, changed_by } = req.body;

  try {

    const [oldAssignees] = await db.execute(`
      SELECT u.username FROM users u
      JOIN ticket_assignees ta ON u.id = ta.user_id
      WHERE ta.ticket_id = ?`,
      [id]
    );

    const oldNames = oldAssignees.length > 0
      ? oldAssignees.map(a => a.username).join(", ")
      : "None";

    await db.execute('DELETE FROM ticket_assignees WHERE ticket_id = ?', [id]);

    let newNames = "None";

    if (new_assignee_ids && new_assignee_ids.length > 0) {

      const values = new_assignee_ids.map((uid) => [id, uid]);

      await db.execute(
        'INSERT INTO ticket_assignees (ticket_id, user_id) VALUES ?',
        [values]
      );

      const [newRows] = await db.execute(
        'SELECT username FROM users WHERE id IN (?)',
        [new_assignee_ids]
      );

      newNames = newRows.map(u => u.username).join(", ");

      await db.execute(
        'UPDATE tickets SET status = "Assigned" WHERE id = ?',
        [id]
      );
    }

    const historyMessage = `Reassigned from [${oldNames}] to [${newNames}]`;

    await db.execute(
      `INSERT INTO ticket_history 
       (ticket_id, changed_by, change_type, old_status, new_status) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, changed_by, 'assignment', 'Assigned', historyMessage]
    );

    res.json({ success: true });

  } catch (error) {
    console.error("Reassignment failed:", error);
    res.status(500).json({ error: "Reassignment failed" });
  }
});


// Staff list
app.get('/api/staff', async (req, res) => {
  try {

    const [rows] = await db.execute(
      'SELECT id, username FROM users'
    );

    res.json(rows);

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

// Google Login/Registration
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post("/api/google-login", async (req, res) => {
  const { credential } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub, email, name } = payload;

    // Check if user exists by google_sub OR email
    const findSql = "SELECT id, username, email FROM users WHERE google_sub = ? OR email = ? LIMIT 1";

    connection.query(findSql, [sub, email], (err, rows) => {
      if (rows && rows.length > 0) {
        // User exists - Log them in
        return res.json({ success: true, user: rows[0] });
      } else {
        // New User - Create them (The "Whole Family" Rule)
        const insertSql = "INSERT INTO users (username, email, google_sub, password_hash) VALUES (?, ?, ?, NULL)";
        connection.query(insertSql, [name, email, sub], (err, result) => {
          if (err) return res.status(500).json({ error: "Creation failed" });
          res.status(201).json({
            success: true,
            user: { id: result.insertId, username: name, email: email }
          });
        });
      }
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid Google Token" });
  }
});

// Commenting + Email receipt after an update on commenting
app.post('/api/tickets/:id/comments', async (req, res) => {

  const { id } = req.params;
  const {
    message,
    visibility = 'public',
    user_id = null,
    actor_role = 'user',
    parent_id = null
  } = req.body;
  const normalizedVisibility = String(visibility || 'public').toLowerCase();
  const normalizedRole = String(actor_role || 'user').toLowerCase();
  const cleanMessage = String(message || "").trim();
  const parentId = parent_id ? Number(parent_id) : null;

  if (!cleanMessage) {
    return res.status(400).json({ message: "Comment message is required" });
  }

  if (!ALL_COMMENT_ROLES.has(normalizedRole)) {
    return res.status(400).json({ message: "Invalid actor role" });
  }

  if (!Number.isInteger(parentId) && parentId !== null) {
    return res.status(400).json({ message: "Invalid parent comment id" });
  }

  if (!['public', 'internal'].includes(normalizedVisibility)) {
    return res.status(400).json({ message: "Invalid visibility value" });
  }

  if (!STAFF_ROLES.has(normalizedRole) && normalizedVisibility !== 'public') {
    return res.status(403).json({ message: "Only staff can post internal comments" });
  }

  try {
    const supportsReplies = await hasParentCommentIdColumn();

    if (parentId !== null && !supportsReplies) {
      return res.status(400).json({ message: "Reply comments require database migration" });
    }

    if (parentId !== null) {
      const [parentRows] = await db.execute(
        `SELECT id FROM ticket_comments WHERE id = ? AND ticket_id = ? LIMIT 1`,
        [parentId, id]
      );
      if (parentRows.length === 0) {
        return res.status(400).json({ message: "Reply target not found for this ticket" });
      }
    }

    // 1️ Save comment
    let result;
    if (supportsReplies) {
      const [insertResult] = await db.execute(
        `INSERT INTO ticket_comments (ticket_id, user_id, parent_comment_id, message, visibility)
         VALUES (?, ?, ?, ?, ?)`,
        [id, user_id || null, parentId, cleanMessage, normalizedVisibility]
      );
      result = insertResult;
    } else {
      const [insertResult] = await db.execute(
        `INSERT INTO ticket_comments (ticket_id, user_id, message, visibility)
         VALUES (?, ?, ?, ?)`,
        [id, user_id || null, cleanMessage, normalizedVisibility]
      );
      result = insertResult;
    }

    // 2️ Get ticket info
    const [ticket] = await db.execute(
      `SELECT user_email, tracking_id
       FROM tickets
       WHERE id = ?`,
      [id]
    );

    if (ticket.length > 0) {
      const userEmail = ticket[0].user_email;
      const trackingId = ticket[0].tracking_id;

      // 3️ Send email notification
      await sendNotificationEmail(userEmail, "New Comment", trackingId);
    }

    // 4️ Return comment to frontend
    let author = "User";
    if (user_id) {
      const [users] = await db.execute(
        `SELECT username FROM users WHERE id = ? LIMIT 1`,
        [user_id]
      );
      author = users.length > 0 ? users[0].username : "Staff";
    }

    res.json({
      id: result.insertId,
      parentId,
      message: cleanMessage,
      visibility: normalizedVisibility,
      author,
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Comment error:", error);
    res.status(500).json({ success: false });
  }
});

const PORT = 3000; // Backend Checker !!! Always has to be at the last line of the file !!!
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend listening on port ${PORT}`);
});
