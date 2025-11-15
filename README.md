# Product Management System

A scalable web application for importing, managing, and tracking products from CSV files. Built with Flask and PostgreSQL, optimized for handling large datasets (500,000+ records).

## Features

- 📤 **CSV Upload** - Upload and process large CSV files (up to 500,000 products) with real-time progress tracking
- 📊 **Product Management** - View, create, update, and delete products with filtering and pagination
- 🗑️ **Bulk Operations** - Delete all products with confirmation
- 🔗 **Webhook Configuration** - Configure and test webhooks for product events
- ⚡ **Performance Optimized** - Batch processing and PostgreSQL UPSERT for efficient data handling

## Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL 12+
- pip

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd fulfil
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Run the application:**
   ```bash
   python app.py
   ```

5. **Access the application:**
   - Open http://localhost:5000 in your browser

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for:
- Render.com
- Heroku
- Railway
- AWS/GCP

## Project Structure

```
fulfil/
├── app.py                 # Flask backend application
├── requirements.txt       # Python dependencies
├── Procfile              # Deployment configuration
├── .env.example          # Environment variables template
├── Frontend/
│   ├── main.html        # Main HTML page
│   ├── script.js        # Main JavaScript
│   ├── config.js        # API configuration
│   ├── Upload/          # Upload page
│   ├── Manage/          # Product management page
│   ├── Delete/          # Delete page
│   └── Webhooks/        # Webhook configuration page
└── products.csv         # Sample CSV file
```

## API Endpoints

- `POST /upload` - Upload CSV file
- `GET /get_all_products` - Get all products (paginated)
- `GET /get_by_sku?sku=...` - Get product by SKU
- `GET /get_by_name?name=...` - Get products by name
- `GET /get_by_description?description=...` - Get products by description
- `GET /get_by_is_active?is_active=...` - Get products by active status
- `POST /update_by_sku` - Update product by SKU
- `POST /insert_by_sku` - Insert new product
- `POST /delete_by_sku` - Delete product by SKU
- `POST /delete` - Delete all products
- `GET /webhooks` - Get all webhooks
- `POST /webhooks` - Create webhook
- `PUT /webhooks/<id>` - Update webhook
- `DELETE /webhooks/<id>` - Delete webhook
- `POST /webhooks/<id>/test` - Test webhook
- `POST /webhooks/<id>/toggle` - Toggle webhook enabled status

## Requirements Compliance

See [REQUIREMENTS_CHECKLIST.md](REQUIREMENTS_CHECKLIST.md) for detailed compliance with all project requirements.

## Technology Stack

- **Backend:** Flask 3.0.0, SQLAlchemy, PostgreSQL
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Deployment:** Gunicorn (production WSGI server)

## License

This project is part of a technical assessment.
