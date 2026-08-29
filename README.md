# Universal Auto-Buyer Bot

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)

**Universal Auto-Buyer Bot** is an automated, headless Node.js bot powered by Puppeteer and FastAPI. It is specifically designed to continuously monitor product pages on retail websites (like Target and Pokémon Center), tracking stock availability and price changes, and instantly notifying you via Discord webhooks.

## 🚀 Features

- **Real-Time Stock Monitoring**: Continuously checks retail product pages for in-stock status and price updates.
- **Interactive Dashboard (FastAPI)**: A clean web interface to dynamically add or remove products, and adjust bot configurations on the fly without restarting the bot.
- **Security & Authentication**: Dashboard protected by HTTP Basic Auth. API protected by secure X-API-Key.
- **Checkout Controls**: Includes DRY_RUN=true safety default, manual confirmation modes, and a global Emergency Stop.
- **Discord Integrations**: Delivers rich Discord notifications containing product details, images, and direct checkout links whenever a status changes. Includes a reliable queue with deduplication and retries.
- **Advanced Proxy Support**: Dynamically loads authenticated proxies from the Dashboard and instantly rotates browser sessions.
- **Anti-Bot Mitigation**: Utilizes puppeteer-extra-plugin-stealth and CDP interception to avoid detection.
- **Automated Testing**: Fully integrated test suite to guarantee functionality across API and Bot.
- **Docker Support**: Fully containerized environment using docker-compose for rapid deployment.

---

## 🏗️ Architecture

The application is split into two primary components:
1. **The Dashboard (Backend API)**: Built with Python and FastAPI, this provides a REST API and web interface to manage your monitored products and bot settings. It uses a PostgreSQL database in Docker or SQLite locally.
2. **The Bot (Worker)**: Built with Node.js and Puppeteer, this worker regularly fetches product data based on the configurations set in the dashboard.

---

## 🎯 Easy Setup Guide (Beginners)

This guide will walk you through exactly how to set up and run the bot on your computer, step by step.

### Step 1: Install Required Software

Before the bot can run, your computer needs two programs installed to understand the code.

1. **Install Python (For the Dashboard)**
   - Go to the official website: [Python.org Downloads](https://www.python.org/downloads/)
   - Download the latest version for Windows.
   - **CRITICAL STEP:** When you open the installer, **check the box that says "Add Python to PATH"** at the very bottom before you click Install. If you miss this, the bot won't work!

2. **Install Node.js (For the Monitor)**
   - Go to the official website: [Node.js Downloads](https://nodejs.org/)
   - Download the **LTS (Long Term Support)** version.
   - Run the installer and just click "Next" through all the default options.

3. **Install Tampermonkey (For your Browser)**
   - If you use Google Chrome, go to the Chrome Web Store and search for **Tampermonkey**.
   - Click "Add to Chrome" to install the extension.

---

### Step 2: Set Up the Bot Files

1. **Open the bot folder:** Open the `Target-Monitor-Bot` folder on your computer.
2. **Open Command Prompt:** 
   - Click inside the folder path bar at the very top of your File Explorer window.
   - Type `cmd` and press **Enter**. This will open a black terminal window right in that folder.
3. **Install Node modules:** 
   - In that black window, type: `npm install` and press **Enter**.
   - Wait for it to finish downloading.
4. **Install Python modules:**
   - Next, type: `pip install -r dashboard/requirements.txt` and press **Enter**.
   - Wait for it to finish.
5. **Set up the password:**
   - Look for a file named `.env` in the bot folder (if it says `.env.example`, rename it to just `.env`).
   - Open it with Notepad and make sure it has this line: `BOT_API_KEY=your_secret_password_here`. 
   - You can change the password to whatever you want. Save the file.

---

### Step 3: Start the Bot

You will need to leave two black terminal windows open for the bot to run.

1. **Start the Dashboard (Terminal 1)**
   - Open a Command Prompt (`cmd`) in your bot folder.
   - Type `cd dashboard` and press **Enter**.
   - Type `python -m uvicorn main:app` and press **Enter**.
   - You should see text saying the server has started. **Leave this window open!**

2. **Start the Monitor (Terminal 2)**
   - Open a **second** Command Prompt (`cmd`) in your main bot folder.
   - Type `npm start` and press **Enter**.
   - You will see it launch a browser in the background. **Leave this window open!**

---

### Step 4: Add the Script to your Browser

1. Inside the bot folder, find the file named `target_updated.js` and open it with Notepad.
2. Select all the text (`Ctrl + A`) and copy it (`Ctrl + C`).
3. Click the Tampermonkey icon in the top right of your browser and select **Dashboard**.
4. Click the `+` icon to create a new script.
5. Delete all the existing text, paste (`Ctrl + V`) your copied code, and press **File > Save** (or `Ctrl + S`).

---

### Step 5: How to Use It!

Everything is set up! Here is how you use it to secure items:

1. **Configure the Dashboard:** 
   - Open your browser and go to `http://localhost:8000`
   - Log in using `admin` as the username and `admin` as the password.
   - Here you can add the Target product URLs you want the bot to monitor.
2. **Run the Browser Bot:**
   - Go to Target.com and make sure you are logged into your account.
   - You will see a new "Target Auto Buyer" box on the screen.
   - **TCIN:** Type the unique code of the product you want to buy (or leave it blank to buy anything that restocks).
   - Enter your CCV and click **Start**.
3. **Sit back and wait!**
   - You can leave this tab idle. As soon as the headless monitor detects a restock, it will instantly tell your browser tab to fly into the cart and check out! 🚀

---

## 🐳 Quick Start: Docker Setup (Recommended)

1. **Set up your environment file**:
   Copy `.env.example` to `.env`. Ensure `TARGET_API_KEY` is set to a secure string.

2. **Start the containers**:
   ```bash
   docker-compose up -d --build
   ```

3. **Access the Dashboard**:
   Open your web browser and go to http://localhost:8000. 
   Login using the default credentials configured in `.env`.

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file in the root directory based on `.env.example`. Common options include:

- `API_HOST`: The host for the backend API.
- `TARGET_API_KEY`: Secure key for Bot <-> API communication.
- `DATABASE_URL`: Connection string. Defaults to PostgreSQL in Docker.
- `DASHBOARD_USER` / `DASHBOARD_PASS`: Credentials for dashboard access.

*Note: Discord webhooks, proxy strings, and checkout configurations are managed securely through the Dashboard UI and stored directly in the database.*

---

## 💬 Adding Discord Notifications & Proxies

All settings can be easily configured through the Dashboard (http://localhost:8000/settings).
Paste your Discord Webhook URL and Proxy connection string into the designated fields and hit **Save**. The bot will instantly pick up the new configuration without requiring a restart!

---

## 🛡️ Automated Tests

To ensure code stability, a full suite of automated logic and backend integration tests are included. 
To run them:
```bash
python -m pytest tests/
```

---

## ⚠️ Disclaimer

This bot is for educational and personal use only. Automated scraping of retail websites may violate their Terms of Service. Use responsibly and ensure you adhere to Target's robots.txt and terms of use.
# Universal-Auto-Buyer-Bot
