# CEiVoice

Support AI-enhanced Support Ticket Management System

---

## Setup

### 1. Start Docker and frontend.

From project root (Start Docker now also execute both node server.js and npm start, if not then contact Noey.): 
You also need Dockerfile and package.json in backend for this command to work. This step should be taking quite a while
if you are doing it for the first time.

```bash
docker-compose up --build
```
If that shit doesn't work then you also need to go to frontend and cmd there then type the following to start up the vite.
```bash
npm run dev
```

---
### 2. Restart Docker

```bash
docker-compose restart app
```
---

### 3. Down Docker
Before shutting off everything, this step is crucial so that u guys can work with other projects without docker confusing ports and shit.
use -v version for removing all newly created tickets.
```bash
docker-compose down
docker-compose down -v
```
---

### 3. .env file

For submitting tickets to work. Devs need to create .env file and put openai key from openai api platform then click generate key.
Then put the following code.
```bash
OPENAI_API_KEY=
```
---
### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
---

### Access URLs
Frontend:
http://localhost:5173

phpMyAdmin:
http://localhost:8081
```bash
user:root
pw:root_password
If you use support_user and support_pw then you can only view but can't edit db.
```
---
### myphpadmin ticket table code
paste this code into sql tab
```bash
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    trackingId VARCHAR(50) NOT NULL,
    status ENUM('open', 'in-progress', 'closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
