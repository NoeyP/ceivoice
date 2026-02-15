CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    raw_message TEXT NOT NULL,
    ai_title VARCHAR(100),
    ai_summary TEXT,
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Draft', -- Draft, Open, In Progress, Resolved
    parent_ticket_id INTEGER REFERENCES tickets(id), -- The "Whole Family" link
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);