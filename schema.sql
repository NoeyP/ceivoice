CREATE TABLE IF NOT EXISTS users ( -- Login
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    google_sub VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets ( -- Ticket
    id INT AUTO_INCREMENT PRIMARY KEY,
    tracking_id VARCHAR(50) UNIQUE,
    user_id INT,
    user_email VARCHAR(255),
    title VARCHAR(255),
    category VARCHAR(100),
    original_message TEXT,
    ai_analysis TEXT,
    suggested_resolution TEXT,
    status VARCHAR(50) DEFAULT 'New',
    deadline DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_tracking_id (tracking_id),
    INDEX idx_status (status),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Audit log for status/assignment changes (EP04)
CREATE TABLE IF NOT EXISTS ticket_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT,
    old_status TEXT,
    new_status TEXT,
    changed_by INT NULL,
    change_type VARCHAR(50), -- 'status' or 'assignment'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- Comments system
CREATE TABLE IF NOT EXISTS ticket_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT,
    parent_comment_id INT NULL,
    message TEXT NOT NULL,
    visibility ENUM('public', 'internal') DEFAULT 'public',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_ticket_id (ticket_id),
    INDEX idx_parent_comment_id (parent_comment_id),

    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_comment_id) REFERENCES ticket_comments(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS ticket_assignees (
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    PRIMARY KEY (ticket_id, user_id),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
