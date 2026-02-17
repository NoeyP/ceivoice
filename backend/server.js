const connection = mysql.createConnection({
  host: 'db',
  port: 3306, // Use 3306 here because it's container-to-container
  user: 'support_user',
  password: 'support_password',
  database: 'ceivoice'
});

app.use(express.json());
// The Route Postman is looking for
app.post('/api/tickets', (req, res) => {
  const { email, message } = req.body;

  // Requirement EP01-ST001: Mandatory fields check 
  if (!email || !message) {
    return res.status(400).json({ error: "Email and message are required." });
  }

  const sql = 'INSERT INTO tickets (user_email, original_message, status) VALUES (?, ?, "Draft")';
  
  connection.query(sql, [email, message], (err, result) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Database failure" });
    }

    // Success response for Postman (Requirement EP01-ST002) 
    res.status(201).json({ 
      success: true, 
      trackingId: result.insertId,
      message: "Ticket created as Draft. AI analysis starting..." 
    });

    console.log(`✅ Ticket ${result.insertId} saved. Ready for AI processing (EP02-ST001).`);
  });
});

app.listen(3000, () => console.log('🚀 Backend listening on port 3000'));