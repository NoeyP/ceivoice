CREATE TABLE IF NOT EXISTS users ( -- Login
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    google_sub VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets ( -- Ticket
    id INT AUTO_INCREMENT PRIMARY KEY,
    tracking_id VARCHAR(50) UNIQUE,
    user_id INT,
    assignee_id INT,
    user_email VARCHAR(255),
    title VARCHAR(255),
    category VARCHAR(100),
    original_message TEXT,
    ai_analysis TEXT,
    suggested_resolution TEXT,
    status VARCHAR(50) DEFAULT 'New',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_tracking_id (tracking_id),
    INDEX idx_status (status),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE ticket_comments ( -- For commenting on the track page
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  author VARCHAR(100),
  comment TEXT NOT NULL,
  visibility VARCHAR(20) DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_ticket_id (ticket_id),

  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
