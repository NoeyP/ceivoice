# CEiVoice

Support AI-enhanced Support Ticket Management System

---

## Setup

### 1. Start Docker and frontend.

From project root (Start Docker now also execute both node server.js and npm start, if not then contact Noey.): 
You also need both __Dockerfiles__ and __package.json__ in backend for this command to work. This step should be taking quite a while
if you are doing it for the first time.

```bash
docker-compose up --build
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

## Read!!!
### .env file
I've already implemented ai logic into the code, so you guys will need this file.
For submitting tickets to work. Devs need to create __.env__ file and put openai key from openai api platform then click generate key.
Then put the following code.
```bash
OPENAI_API_KEY=
```
---


### Access URLs
__Frontend:__
http://localhost:5173

__phpMyAdmin:__
http://localhost:8081
```bash
user:root
pw:root_password
If you use support_user and support_pw then you can only view but can't edit db.
```
---
### Myphpadmin ticket table code
paste this code into sql tab. I will fix this by creating db file and put sql code there later.
```bash
CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    original_message TEXT NOT NULL,
    ai_analysis TEXT, 
    status VARCHAR(50) DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
