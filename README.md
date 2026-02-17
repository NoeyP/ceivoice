# CEiVoice

Support AI-enhanced Support Ticket Management System

---

## Setup

### 1. Start Docker

From project root (Start Docker now also execute both node server.js and npm start, if not then contact Noey.): 

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
