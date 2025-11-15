# Deployment Guide

This guide will help you deploy the Product Management application to a cloud platform.

## Prerequisites

- Python 3.12 (Python 3.13 has compatibility issues with psycopg2-binary)
- PostgreSQL database (local or cloud-hosted)
- Git (for version control)
- Account on a deployment platform (Heroku, Render, Railway, etc.)

## Environment Variables

Create a `.env` file in the root directory (or set environment variables on your deployment platform):

```env
# Database Configuration
# Option 1: Use DATABASE_URL (recommended for cloud deployments)
DATABASE_URL=postgresql://username:password@host:port/database_name

# Option 2: Use individual components (for local development)
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=fulfil_db
DATABASE_HOST=localhost
DATABASE_PORT=5432

# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=your-secret-key-here-change-in-production

# Server Configuration
PORT=5000
HOST=0.0.0.0
```

## Deployment Options

### Option 1: Render.com (Recommended - Free Tier Available)

1. **Create a Render account** at https://render.com

2. **Create a PostgreSQL Database:**
   - Go to Dashboard → New → PostgreSQL
   - Choose a name and region
   - Note the connection string (DATABASE_URL)

3. **Create a Web Service:**
   - Go to Dashboard → New → Web Service
   - Connect your GitHub repository
   - Configure:
     - **Build Command:** `pip install -r requirements.txt`
     - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT`
     - **Python Version:** 3.12 (important - 3.13 has psycopg2 compatibility issues)
     - **Environment Variables:**
       - `DATABASE_URL` (from PostgreSQL service - automatically set if using Render PostgreSQL)
       - `FLASK_ENV=production`
       - `FLASK_DEBUG=False`
       - `SECRET_KEY` (generate a random string)

4. **Deploy:**
   - Render will automatically deploy on every push to main branch

### Option 2: Heroku

1. **Install Heroku CLI** and login:
   ```bash
   heroku login
   ```

2. **Create Heroku app:**
   ```bash
   heroku create your-app-name
   ```

3. **Add PostgreSQL addon:**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

4. **Set environment variables:**
   ```bash
   heroku config:set FLASK_ENV=production
   heroku config:set FLASK_DEBUG=False
   heroku config:set SECRET_KEY=your-secret-key
   ```

5. **Deploy:**
   ```bash
   git push heroku main
   ```

### Option 3: Railway

1. **Create Railway account** at https://railway.app

2. **Create new project** from GitHub repository

3. **Add PostgreSQL service:**
   - Click "New" → "Database" → "PostgreSQL"

4. **Configure environment variables:**
   - Railway automatically provides `DATABASE_URL`
   - Add `FLASK_ENV=production`
   - Add `FLASK_DEBUG=False`
   - Add `SECRET_KEY`

5. **Deploy:**
   - Railway auto-deploys on git push

## Local Development Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up PostgreSQL:**
   - Install PostgreSQL locally
   - Create a database: `CREATE DATABASE fulfil_db;`

3. **Create `.env` file:**
   ```env
   DATABASE_USERNAME=postgres
   DATABASE_PASSWORD=your_password
   DATABASE_NAME=fulfil_db
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   FLASK_ENV=development
   FLASK_DEBUG=True
   ```

4. **Run the application:**
   ```bash
   python app.py
   ```
   Or with Flask:
   ```bash
   flask run
   ```

5. **Access the application:**
   - Open http://localhost:5000 in your browser

## Database Schema

The application automatically creates the following tables on first run:
- `products` - Stores product information (SKU, Name, Description, IsActive)
- `webhooks` - Stores webhook configurations

## Features

✅ **STORY 1 - File Upload via UI**
- Upload CSV files up to 500,000 records
- Real-time progress indicator with animated progress bar
- Automatic duplicate handling (case-insensitive SKU)
- Batch processing for optimal performance

✅ **STORY 1A - Upload Progress Visibility**
- Real-time progress updates via Server-Sent Events (SSE)
- Visual progress bar with animation
- Status messages and error handling

✅ **STORY 2 - Product Management UI**
- View, create, update, and delete products
- Filtering by SKU, name, active status, or description
- Paginated viewing with navigation controls
- Inline editing and modal forms
- Confirmation dialogs for deletions

✅ **STORY 3 - Bulk Delete from UI**
- Delete all products with confirmation dialog
- Success/failure notifications
- Visual feedback during processing

✅ **STORY 4 - Webhook Configuration via UI**
- Add, edit, test, and delete webhooks
- Display webhook URLs, event types, and status
- Visual confirmation with response code and time
- Non-blocking webhook processing

## Technical Stack

- **Web Framework:** Flask 3.0.0
- **ORM:** SQLAlchemy
- **Database:** PostgreSQL
- **Frontend:** Vanilla JavaScript, HTML, CSS
- **Deployment:** Gunicorn (production WSGI server)

## Performance Optimizations

- Batch processing (1000 records per batch)
- PostgreSQL UPSERT for efficient duplicate handling
- Connection pooling for database connections
- Server-Sent Events for real-time progress updates
- Case-insensitive SKU handling

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL or individual database credentials
- Check if PostgreSQL is running and accessible
- Ensure firewall allows connections

### Import Errors
- Run `pip install -r requirements.txt`
- Verify Python version (3.11+)

### Port Already in Use
- Change PORT in .env file
- Kill process using the port: `lsof -ti:5000 | xargs kill`

## Security Notes

- Never commit `.env` file to version control
- Use strong SECRET_KEY in production
- Set FLASK_DEBUG=False in production
- Use HTTPS in production (most platforms provide this automatically)

