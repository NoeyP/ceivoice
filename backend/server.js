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


// create connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  port: 3306,
  user: 'support_user',
  password: 'support_password',
  database: 'ceivoice'
});
const db = connection.promise();

// Initialize AI(EP02-ST001)
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
}); // THIS DEFINES 'groq'

// Ai and email receipt logic
app.post('/api/tickets', async (req, res) => {
  // 1. Destructure all possible fields from the frontend
  const { title, description, message, email, category } = req.body;

  // 2. Pick the one that isn't empty (The "Whole Family" fallback)
  const finalDescription = description || message || "No content provided";
  const finalTitle = title || "New Support Request";
  const finalEmail = email;
  const finalCategory = category || "General";

  if (!finalEmail || finalDescription === "No content provided") {
    return res.status(400).json({ error: "Email and message are required." });
  }

  const trackingIdStr = `TIC-${Date.now()}`;
  let aiSummary = "Summary pending...";

  try {
    // --- PART 1: AI ANALYSIS (Groq) ---
    try {
      if (finalDescription !== "No content provided") {
        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: "user", content: `Summarize: ${finalDescription}` }],
          model: "llama-3.3-70b-versatile",
        });
        aiSummary = chatCompletion.choices[0]?.message?.content || aiSummary;
        console.log("🤖 AI Analysis complete");
      }
    } catch (aiError) {
      console.error("Groq Error:", aiError.message);
      // We continue even if AI fails so the ticket still gets created
    }

    // --- PART 2: DATABASE SAVE (Promise-based) ---
    const [result] = await db.execute(
      'INSERT INTO tickets (tracking_id, title, category, status, user_email, ai_analysis, original_message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [trackingIdStr, finalTitle, finalCategory, 'New', finalEmail, aiSummary, finalDescription]
    );
    console.log("💾 Ticket saved to DB with ID:", result.insertId);

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

const PORT = 3000; // Backend Checker
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend listening on port ${PORT}`);
});

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

// Tickets tracking system
app.get('/api/tickets/public/:tid', (req, res) => {
  const { tid } = req.params;

  // Use connection.query (not db.execute) to match the rest of your file
  const sql = `
    SELECT 
      tracking_id AS trackingId, 
      title, category, status, 
      created_at AS createdAt, 
      ai_analysis AS summary 
    FROM tickets 
    WHERE tracking_id = ? OR id = ?`;

  connection.query(sql, [tid, tid], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB Error" });
    if (!rows || rows.length === 0) return res.status(404).json({ message: "Not found" });

    const ticket = rows[0];
    ticket.publicComments = []; // Prevent frontend crash
    res.json(ticket);
  });
});

// GET tickets for a specific assignee (EP04-ST001)
app.get('/api/assignee/:userId/tickets', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.execute(
      `SELECT id, tracking_id, title, status, deadline 
       FROM tickets 
       WHERE assignee_id = ? AND status NOT IN ('Solved', 'Failed')`,
      [userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});


app.get('/api/tickets/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(`
      SELECT
        th.old_status,
        th.new_status,
        th.change_type,
        th.created_at,
        u.username as changed_by_name
      FROM ticket_history th
      LEFT JOIN users u ON th.changed_by = u.id
      WHERE th.ticket_id = ?
      ORDER BY th.created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.post("/api/tickets/:id/comments", async (req, res) => {
  const { id } = req.params;
  const { message, visibility, user_id } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Comment message is required." });
  }

  try {
    // Save the comment to the database (EP05-ST002)
    const [result] = await db.execute(
      `INSERT INTO ticket_comments (ticket_id, user_id, message, visibility) 
       VALUES (?, ?, ?, ?)`,
      [id, user_id || null, message, visibility || 'public']
    );

    // Fetch the inserted comment to return to the frontend
    const [newComment] = await db.execute(
      `SELECT id, message, visibility, created_at as createdAt 
       FROM ticket_comments WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(newComment[0]);
  } catch (error) {
    console.error("❌ Comment Error:", error.message);
    res.status(500).json({ error: "Failed to post comment" });
  }
});


app.get('/api/staff', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, username FROM users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});


app.patch('/api/tickets/:id/reassign', async (req, res) => {
  const { id } = req.params;
  const { new_assignee_id, changed_by } = req.body;

  try {
    const [[ticket]] = await db.execute('SELECT title FROM tickets WHERE id = ?', [id]);
    const [[newAssignee]] = await db.execute('SELECT email, username FROM users WHERE id = ?', [new_assignee_id]);

    await db.execute('UPDATE tickets SET assignee_id = ? WHERE id = ?', [new_assignee_id, id]);

    await db.execute(
      `INSERT INTO ticket_history (ticket_id, changed_by, change_type, old_status, new_status)
      VALUES (?, ?, 'assignment', ?, ?)`,
      [id, changed_by, ticket.assignee_id, new_assignee_id]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: newAssignee.email,
      subject: `New Ticket Assigned: ${ticket.title}`,
      text: `Hello ${newAssignee.username}, you have been assigned a new ticket (ID: ${id}). Please check your dashboard.`
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Reassign error:", error.message);
    res.status(500).json({ error: "Reassignment failed" });
  }
});
// Admin Route: Update Ticket Status
app.patch('/api/tickets/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, changed_by, comment } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status transition." });
  }

  try {
    const [oldRows] = await db.execute('SELECT status FROM tickets WHERE id = ?', [id]);
    const oldStatus = oldRows[0]?.status;

    // 1. Update ticket status
    await db.execute('UPDATE tickets SET status = ? WHERE id = ?', [status, id]);

    // 2. Log to history (Audit Trail)
    await db.execute(
      `INSERT INTO ticket_history (ticket_id, old_status, new_status, changed_by, change_type) VALUES (?, ?, ?, ?, 'status')`,
      [id, oldStatus, status, changed_by]
    );

    // 3. If there is a comment, save it as a public update
    if (comment) {
      await db.execute(
        `INSERT INTO ticket_comments (ticket_id, user_id, message, visibility) 
         VALUES (?, ?, ?, 'public')`,
        [id, changed_by, comment]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
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
// EP03-ST001: Unified Admin Ticket Fetch
app.get('/api/admin/tickets', async (req, res) => {
  try {
    // Adding LOWER() and including 'New' ensures nothing escapes the net
    const [rows] = await db.execute(`
      SELECT 
        id, 
        tracking_id, 
        title, 
        category, 
        status, 
        ai_analysis AS summary, 
        original_message AS message,
        created_at
      FROM tickets 
      WHERE LOWER(status) IN ('new', 'draft', 'analyzed', 'open')
      ORDER BY created_at DESC
    `);

    console.log(`✅ Admin fetched ${rows.length} tickets`); // Check Docker logs for this!
    res.json(rows);
  } catch (error) {
    console.error("❌ Admin Fetch Error:", error.message);
    res.status(500).json({ error: "Failed to load tickets" });
  }
});

