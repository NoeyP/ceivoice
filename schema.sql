CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT, -- Changed to allow NULL for Google-only users
    google_sub VARCHAR(255) UNIQUE, -- New: Stores the Google Unique ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tracking_id VARCHAR(50) UNIQUE,
    user_id INT, -- NEW: Links directly to users.id
    user_email VARCHAR(255), -- Keep this as a backup/reference
    title VARCHAR(255),
    category VARCHAR(100),
    original_message TEXT,
    ai_analysis TEXT,
    status VARCHAR(50) DEFAULT 'New',
    assignee_id INT,
    deadline DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);


-- Create the Audit Log table (EP04-ST003)
CREATE TABLE IF NOT EXISTS ticket_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_by INT,
    change_type VARCHAR(50), -- 'status' or 'assignment'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);


CREATE TABLE IF NOT EXISTS ticket_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT,
  user_id INT,
  message TEXT,
  visibility ENUM('public', 'internal') DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
