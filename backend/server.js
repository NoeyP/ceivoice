const express = require('express');
const mysql = require('mysql2');
const { OpenAI } = require('openai'); // Added for EP02
require('dotenv').config();
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();
app.use(cors()); // Allow the frontend to talk to the backend
app.use(express.json());
const crypto = require("crypto");
const { OAuth2Client } = require('google-auth-library');


const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  port: 3306,
  user: 'support_user',
  password: 'support_password',
  database: 'ceivoice'
});

// Initialize OpenAI (EP02-ST001)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

app.post('/api/tickets', (req, res) => {
  // 1. Destructure the extra fields from the frontend
  const { email, message, title, category } = req.body; 

  if (!email || !message) {
    return res.status(400).json({ error: "Email and message are required." });
  }

  // 2. Generate the "Unique Link" string (e.g., TIC-174110)
  const trackingIdStr = `TIC-${Date.now()}`; 

  // 3. Update SQL to fill the new columns (tracking_id, title, category)
  const sql = 'INSERT INTO tickets (tracking_id, user_email, title, category, original_message, status) VALUES (?, ?, ?, ?, ?, "New")';

  connection.query(sql, [trackingIdStr, email, title || "Support Request", category || "General", message], async (err, result) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Database failure" });
    }

    const dbId = result.insertId;

    // Trigger AI using the numeric ID for internal lookups
    analyzeTicketWithAI(dbId, message);

    // 4. Update the email to send the tracking link
    try {
      const trackingUrl = `http://localhost:5173/track/${trackingIdStr}`;
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Request Received - CEiVoice',
        text: `Hello! We received your message. \n\nTracking ID: ${trackingIdStr}\nTrack status here: ${trackingUrl}`
      });
      console.log("📧 Email sent with tracking link");
    } catch (mailError) {
      console.error("❌ Email failed:", mailError.message);
    }

    // 5. Send the string back so the frontend can redirect correctly
    res.status(201).json({
      success: true,
      trackingId: trackingIdStr, 
      message: "Ticket created successfully."
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


// AI Analysis Logic (EP02 Core)
async function analyzeTicketWithAI(id, text) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a support assistant. Summarize the user's issue into a short title and a category." },
        { role: "user", content: text }
      ],
    });

    const analysis = response.choices[0].message.content;

    // Update the record with AI results
    const updateSql = 'UPDATE tickets SET ai_analysis = ?, status = "Analyzed" WHERE id = ?';
    connection.query(updateSql, [analysis, id]);
    console.log(`✨ AI Analysis complete for Ticket ${id}`);
  } catch (error) {
    console.error("⚠️ AI Analysis failed:", error.message);
  }
}

const PORT = 3000; // Backend Checker
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend listening on port ${PORT}`);
});

// 1. Create the transporter ONCE
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
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

// Admin Route: Update Ticket Status
app.patch('/api/tickets/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // e.g., "Solving" or "Solved"

    try {
        const [result] = await db.execute(
            'UPDATE tickets SET status = ? WHERE id = ?',
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        res.json({ success: true, message: `Status updated to ${status}` });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ success: false, message: "Server error" });
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