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

For the email receipt to work, you also need to do the following. 1. Put these two lines into __.env__ 2. You get the code from https://myaccount.google.com/ 3. Don't forget to 2-FA it. 4. Search __App password__. 5. Create a name like ceivoicedocker or any shit. 5. Create and copy the secret key.
Why? Because Google thinks snitchers could hack your school project, so they decided to take the security up a notch by providing password created specifically for this app.
```bash
EMAIL_USER=youremailhere
EMAIL_PASS=codegeneratedfromgoogleaccount
```

For the google login to work, you guys will need to do the following. 1. go to __https://console.cloud.google.com__ 2. go to credentials -> create credentials then name it whatever you want. then put this url in the field __http://localhost:5173__ 3. Create then copy the client id and then paste it in the .env file.
```bash
_CLIENT_ID = yourid
```


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
paste this code into sql tab. I will fix this by creating db file and put sql code there later. (I fixed it, no need to put the code in sql tab.)
```bash
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    original_message TEXT NOT NULL,
    ai_analysis TEXT, 
    status VARCHAR(50) DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) DEFAULT NULL,
  google_sub VARCHAR(255) UNIQUE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```
