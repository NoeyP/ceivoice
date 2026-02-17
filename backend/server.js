const express = require('express');
const mysql = require('mysql2');
const { OpenAI } = require('openai'); // Added for EP02
require('dotenv').config();
const cors = require('cors');
const app = express();
app.use(cors()); // Allow the frontend to talk to the backend
app.use(express.json());

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  port: 3306,
  user: 'support_user',
  password: 'support_password',
  database: 'ceivoice'
});

// Initialize OpenAI (EP02-ST001)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/tickets', (req, res) => {
  const { email, message } = req.body;

  if (!email || !message) {
    return res.status(400).json({ error: "Email and message are required." });
  }

  const sql = 'INSERT INTO tickets (user_email, original_message, status) VALUES (?, ?, "Draft")';
  
  connection.query(sql, [email, message], (err, result) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Database failure" });
    }

    const trackingId = result.insertId;

    // Trigger AI Analysis (EP02-ST002)
    // We run this without 'await' so the user gets their response immediately
    analyzeTicketWithAI(trackingId, message);

    res.status(201).json({ 
      success: true, 
      trackingId: trackingId,
      message: "Ticket created as Draft. AI analysis starting..." 
    });
  });
});

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