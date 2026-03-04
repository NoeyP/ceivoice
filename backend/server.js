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
  const { email, message } = req.body;

  if (!email || !message) {
    return res.status(400).json({ error: "Email and message are required." });
  }

  const sql = 'INSERT INTO tickets (user_email, original_message, status) VALUES (?, ?, "Draft")';

  connection.query(sql, [email, message], async (err, result) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Database failure" });
    }

    const trackingId = result.insertId;

    // 1. Trigger AI (Background)
    analyzeTicketWithAI(trackingId, message);

    // 2. TRIGGER EMAIL (Add this part here!)
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Request Received - CEiVoice',
        text: `Hello! We received your message: "${message}". Ticket ID: ${trackingId}`
      });
      console.log("📧 Email sent successfully from /api/tickets");
    } catch (mailError) {
      console.error("❌ Email failed:", mailError.message);
    }

    res.status(201).json({
      success: true,
      trackingId: trackingId,
      message: "Ticket created. AI starting, Email attempted."
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

