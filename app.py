import flask
from flask import Flask
from flask import request, jsonify, render_template, Response, send_from_directory
from io import StringIO
import csv
from flask_cors import CORS   
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import func, create_engine
import os
import json
import requests
from datetime import datetime
# Database configuration from environment variables
DATABASE_USERNAME = os.getenv('DATABASE_USERNAME', 'postgres')
DATABASE_PASSWORD = os.getenv('DATABASE_PASSWORD', '')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'fulfil_db')
DATABASE_HOST = os.getenv('DATABASE_HOST', 'localhost')
DATABASE_PORT = os.getenv('DATABASE_PORT', '5432')

app = Flask(__name__)
# Configure static file serving - but API routes will be matched first
app.static_folder = 'Frontend'
app.static_url_path = ''

# Construct database URI
if os.getenv('DATABASE_URL'):
    # Use DATABASE_URL if provided (common in cloud deployments)
    # Convert postgres:// to postgresql+psycopg:// for psycopg3 compatibility
    database_url = os.getenv('DATABASE_URL')
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql+psycopg://', 1)
    elif database_url.startswith('postgresql://'):
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    # Construct from individual components - use psycopg3 driver
    app.config['SQLALCHEMY_DATABASE_URI'] = f'postgresql+psycopg://{DATABASE_USERNAME}:{DATABASE_PASSWORD}@{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_NAME}'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # Recommended to disable
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_size': 10,
    'max_overflow': 20,
    'pool_recycle': 3600,
    # Explicitly use psycopg (psycopg3) driver
    'connect_args': {}
}

# Import psycopg to ensure it's available before SQLAlchemy initializes
# This ensures SQLAlchemy recognizes psycopg3 when using postgresql+psycopg://
try:
    import psycopg
    # Explicitly import the psycopg dialect to register it with SQLAlchemy
    # This is needed for SQLAlchemy to recognize postgresql+psycopg:// URLs
    from sqlalchemy.dialects.postgresql.psycopg import PGDialect_psycopg
except (ImportError, AttributeError):
    # If psycopg is not available, the connection will fail with a clear error
    pass

db = SQLAlchemy(app)
CORS(app)

class Product(db.Model):
        SKU = db.Column(db.String(80), primary_key=True)
        Name = db.Column(db.String(80), unique=False)
        Description = db.Column(db.String(500), unique=False)
        IsActive = db.Column(db.Boolean, default=True)

        def __repr__(self):
            return '<User %r>' % self.Name

class Webhook(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        url = db.Column(db.String(500), nullable=False)
        event_type = db.Column(db.String(100), nullable=False)
        enabled = db.Column(db.Boolean, default=True)
        created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
        last_test_at = db.Column(db.DateTime, nullable=True)
        last_test_status = db.Column(db.Integer, nullable=True)
        last_test_response_time = db.Column(db.Float, nullable=True)

        def __repr__(self):
            return f'<Webhook {self.id}: {self.url}>'
        
        def to_dict(self):
            return {
                'id': self.id,
                'url': self.url,
                'event_type': self.event_type,
                'enabled': self.enabled,
                'created_at': self.created_at.isoformat() if self.created_at else None,
                'last_test_at': self.last_test_at.isoformat() if self.last_test_at else None,
                'last_test_status': self.last_test_status,
                'last_test_response_time': self.last_test_response_time
            }

with app.app_context():
    db.create_all()

@app.route('/upload', methods=['POST'])
def upload_csv():
    if request.method == 'POST':
        if 'csv_file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
            
        csv_file = request.files['csv_file']
        if csv_file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        if csv_file:
            # Read file content while request context is still active
            try:
                file_content = csv_file.stream.read().decode("UTF-8", errors='ignore')
            except Exception as e:
                return jsonify({'error': 'Error reading file', 'message': str(e)}), 400
            
            def generate():
                # Push application context for the generator
                with app.app_context():
                    try:
                        # Batch size for processing and committing
                        BATCH_SIZE = 1000
                        
                        # First pass: count total rows for progress calculation
                        csv_data_count = StringIO(file_content)
                        csv_reader_count = csv.reader(csv_data_count)
                        next(csv_reader_count, None)  # Skip header
                        total_rows = sum(1 for row in csv_reader_count if len(row) >= 3)
                        total_batches = (total_rows + BATCH_SIZE - 1) // BATCH_SIZE  # Ceiling division
                        
                        # Send initial progress
                        yield f"data: {json.dumps({'type': 'progress', 'total_batches': total_batches, 'current_batch': 0, 'total_rows': total_rows, 'rows_processed': 0})}\n\n"
                        
                        # Reset for second pass - process the data
                        csv_data = StringIO(file_content)
                        csv_reader = csv.reader(csv_data)
                        next(csv_reader, None)  # Skip header

                        rows_processed = 0
                        batch = []
                        batch_count = 0
                        
                        for row in csv_reader:
                            if len(row) >= 3:  # Ensure row has at least 3 columns
                                batch.append({
                                    'SKU': row[1].strip(),
                                    'Name': row[0].strip(),
                                    'Description': row[2].strip() if len(row) > 2 else '',
                                    'IsActive': True  # Default to True for new/updated products
                                })
                                rows_processed += 1
                                
                                # Process in batches for better performance
                                if len(batch) >= BATCH_SIZE:
                                    _bulk_upsert_products(batch)
                                    batch_count += 1
                                    batch = []
                                    
                                    # Send progress update
                                    yield f"data: {json.dumps({'type': 'progress', 'total_batches': total_batches, 'current_batch': batch_count, 'total_rows': total_rows, 'rows_processed': rows_processed})}\n\n"
                        
                        # Process remaining rows
                        if batch:
                            _bulk_upsert_products(batch)
                            batch_count += 1
                            yield f"data: {json.dumps({'type': 'progress', 'total_batches': total_batches, 'current_batch': batch_count, 'total_rows': total_rows, 'rows_processed': rows_processed})}\n\n"
                        
                        # Send final success message
                        yield f"data: {json.dumps({'type': 'complete', 'success': True, 'message': 'CSV uploaded and data saved successfully!', 'rows_processed': rows_processed})}\n\n"
                        
                    except Exception as e:
                        db.session.rollback()
                        yield f"data: {json.dumps({'type': 'error', 'error': 'Error processing CSV file', 'message': str(e)})}\n\n"
            
            return Response(generate(), mimetype='text/event-stream')
        
        return jsonify({'error': 'Invalid file'}), 400
    
    return jsonify({'error': 'Method not allowed'}), 405

@app.route('/delete', methods=['POST'])
def delete_products():
    if request.method == 'POST':
        try:
            db.session.query(Product).delete()
            db.session.commit()
            return jsonify({'success': True, 'message': 'All products deleted successfully'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Error deleting products', 'message': str(e)}), 500
    return jsonify({'error': 'Method not allowed'}), 405

@app.route('/get_by_sku', methods=['GET'])
def get_by_sku():
    if request.method == 'GET':
        sku = request.args.get('sku')
        if not sku:
            return jsonify({'error': 'SKU parameter is required'}), 400
        
        products = Product.query.filter_by(SKU=sku).all()
        
        # Convert SQLAlchemy objects to dictionaries for JSON serialization
        products_list = [{
            'SKU': p.SKU,
            'Name': p.Name,
            'Description': p.Description,
            'IsActive': p.IsActive
        } for p in products]
        
        return jsonify({
            'success': True,
            'products': products_list,
            'count': len(products_list)
        }), 200
    return jsonify({'error': 'Method not allowed'}), 405

@app.route('/get_by_name', methods=['GET'])
def get_by_name():
    if request.method == 'GET':
        name = request.args.get('name')
        if not name:
            return jsonify({'error': 'Name parameter is required'}), 400
        products = Product.query.filter_by(Name=name).all()

        products_list = [{
            'SKU': p.SKU,
            'Name': p.Name,
            'Description': p.Description,
            'IsActive': p.IsActive
        } for p in products]
        return jsonify({'success': True, 'products': products_list}), 200
    return jsonify({'error': 'Method not allowed'}), 405

@app.route('/get_by_description', methods=['GET'])
def get_by_description():
    if request.method == 'GET':
        description = request.args.get('description')
        if not description:
            return jsonify({'error': 'Description parameter is required'}), 400
        products = Product.query.filter_by(Description=description).all()

        products_list = [{
            'SKU': p.SKU,
            'Name': p.Name,
            'Description': p.Description,
            'IsActive': p.IsActive
        } for p in products]
        return jsonify({'success': True, 'products': products_list}), 200
    return jsonify({'error': 'Method not allowed'}), 405

@app.route('/get_all_products', methods=['GET'])
def get_all_products():
    if request.method == 'GET':
        products = Product.query.all()

        products_list = [{
            'SKU': p.SKU,
            'Name': p.Name,
            'Description': p.Description,
            'IsActive': p.IsActive
        } for p in products]
        return jsonify({'success': True, 'products': products_list}), 200
    return jsonify({'error': 'Method not allowed'}), 405

@app.route('/get_by_is_active', methods=['GET'])
def get_by_is_active():
    if request.method == 'GET':
        is_active_param = request.args.get('is_active')
        if is_active_param is None:
            return jsonify({'error': 'IsActive parameter is required'}), 400
        
        # Convert string parameter to boolean
        # Accepts: 'true', 'false', '1', '0', 'yes', 'no' (case insensitive)
        if isinstance(is_active_param, str):
            is_active_bool = is_active_param.lower() in ('true', '1', 'yes')
        else:
            is_active_bool = bool(is_active_param)
        
        products = Product.query.filter_by(IsActive=is_active_bool).all()

        products_list = [{
            'SKU': p.SKU,
            'Name': p.Name,
            'Description': p.Description,
            'IsActive': p.IsActive
        } for p in products]
        return jsonify({
            'success': True,
            'products': products_list,
            'count': len(products_list)
        }), 200
    return jsonify({'error': 'Method not allowed'}), 405




@app.route('/update_by_sku', methods=['POST'])
def update_by_sku():
    data = request.get_json()
    sku = data.get('SKU')
    if not sku:
        return jsonify(error="SKU is required"), 400

    product = Product.query.filter_by(SKU=sku).first()
    if not product:
        return jsonify(error="Product with given SKU not found"), 404

    # Update fields if provided
    product.Name = data.get('Name', product.Name)
    product.Description = data.get('Description', product.Description)
    product.IsActive = data.get('IsActive', product.IsActive)

    try:
        db.session.commit()
        return jsonify(success=True, message="Product updated successfully"), 200
    except Exception as e:
        db.session.rollback()
        return jsonify(error="Error updating product", message=str(e)), 500


@app.route('/insert_by_sku', methods=['POST'])
def insert_by_sku():
    data = request.get_json()
    sku = data.get('SKU')
    if not sku:
        return jsonify(error="SKU is required"), 400

    existing = Product.query.filter_by(SKU=sku).first()
    if existing:
        return jsonify(error="Product with this SKU already exists"), 400

    new_product = Product(
        SKU=sku,
        Name=data.get('Name', ''),
        Description=data.get('Description', ''),
        IsActive=data.get('IsActive', True)
    )
    db.session.add(new_product)

    try:
        db.session.commit()
        return jsonify(success=True, message="Product inserted successfully"), 201
    except Exception as e:
        db.session.rollback()
        return jsonify(error="Error inserting product", message=str(e)), 500

@app.route('/delete_by_sku', methods=['POST'])
def delete_by_sku():
    data = request.get_json()
    sku = data.get('SKU')
    if not sku:
        return jsonify(error="SKU is required"), 400

    product = Product.query.filter_by(SKU=sku).first()
    if not product:
        return jsonify(error="Product with given SKU not found"), 404

    try:
        db.session.delete(product)
        db.session.commit()
        return jsonify(success=True, message="Product deleted successfully"), 200
    except Exception as e:
        db.session.rollback()
        return jsonify(error="Error deleting product", message=str(e)), 500



# Webhook initialization endpoint (to ensure table exists)
@app.route('/webhooks/init', methods=['POST'])
def init_webhooks():
    try:
        with app.app_context():
            db.create_all()
        return jsonify({'success': True, 'message': 'Webhook tables initialized'}), 200
    except Exception as e:
        import traceback
        return jsonify({'error': 'Error initializing webhooks', 'message': str(e), 'traceback': traceback.format_exc()}), 500

# Webhook endpoints
@app.route('/webhooks', methods=['GET'])
def get_webhooks():
    try:
        webhooks = Webhook.query.all()
        return jsonify({
            'success': True,
            'webhooks': [w.to_dict() for w in webhooks]
        }), 200
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        print(f"Error fetching webhooks: {error_msg}")
        print(traceback_str)
        return jsonify({'error': 'Error fetching webhooks', 'message': error_msg}), 500

@app.route('/webhooks', methods=['POST'])
def create_webhook():
    data = request.get_json()
    url = data.get('url')
    event_type = data.get('event_type')
    enabled = data.get('enabled', True)
    
    if not url or not event_type:
        return jsonify({'error': 'URL and event_type are required'}), 400
    
    try:
        new_webhook = Webhook(
            url=url,
            event_type=event_type,
            enabled=enabled
        )
        db.session.add(new_webhook)
        db.session.commit()
        # Refresh to get the ID
        db.session.refresh(new_webhook)
        return jsonify({
            'success': True,
            'message': 'Webhook created successfully',
            'webhook': new_webhook.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        print(f"Error creating webhook: {error_msg}")
        print(traceback_str)
        return jsonify({'error': 'Error creating webhook', 'message': error_msg}), 500

@app.route('/webhooks/<int:webhook_id>', methods=['PUT'])
def update_webhook(webhook_id):
    data = request.get_json()
    webhook = Webhook.query.get(webhook_id)
    
    if not webhook:
        return jsonify({'error': 'Webhook not found'}), 404
    
    try:
        if 'url' in data:
            webhook.url = data['url']
        if 'event_type' in data:
            webhook.event_type = data['event_type']
        if 'enabled' in data:
            webhook.enabled = data['enabled']
        
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Webhook updated successfully',
            'webhook': webhook.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error updating webhook', 'message': str(e)}), 500

@app.route('/webhooks/<int:webhook_id>', methods=['DELETE'])
def delete_webhook(webhook_id):
    webhook = Webhook.query.get(webhook_id)
    
    if not webhook:
        return jsonify({'error': 'Webhook not found'}), 404
    
    try:
        db.session.delete(webhook)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Webhook deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error deleting webhook', 'message': str(e)}), 500

@app.route('/webhooks/<int:webhook_id>/test', methods=['POST'])
def test_webhook(webhook_id):
    import time
    
    webhook = Webhook.query.get(webhook_id)
    
    if not webhook:
        return jsonify({'error': 'Webhook not found'}), 404
    
    try:
        # Prepare test payload
        test_payload = {
            'event': 'webhook.test',
            'timestamp': datetime.now().isoformat(),
            'data': {
                'message': 'This is a test webhook call',
                'webhook_id': webhook_id
            }
        }
        
        # Send webhook request
        start_time = time.time()
        response = requests.post(
            webhook.url,
            json=test_payload,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        # Update webhook with test results
        webhook.last_test_at = datetime.now()
        webhook.last_test_status = response.status_code
        webhook.last_test_response_time = round(response_time, 2)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'status_code': response.status_code,
            'response_time': round(response_time, 2),
            'response_body': response.text[:500],  # Limit response body length
            'webhook': webhook.to_dict()
        }), 200
    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'error': 'Webhook request timed out',
            'status_code': None,
            'response_time': None
        }), 408
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': f'Webhook request failed: {str(e)}',
            'status_code': None,
            'response_time': None
        }), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error testing webhook', 'message': str(e)}), 500

@app.route('/webhooks/<int:webhook_id>/toggle', methods=['POST'])
def toggle_webhook(webhook_id):
    webhook = Webhook.query.get(webhook_id)
    
    if not webhook:
        return jsonify({'error': 'Webhook not found'}), 404
    
    try:
        webhook.enabled = not webhook.enabled
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Webhook {"enabled" if webhook.enabled else "disabled"} successfully',
            'webhook': webhook.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error toggling webhook', 'message': str(e)}), 500

def _bulk_upsert_products(batch):
    """Bulk upsert products using PostgreSQL's ON CONFLICT for better performance.
    SKU is treated as case-insensitive for duplicate detection."""
    if not batch:
        return
    
    # Deduplicate batch by SKU (case-insensitive) - keep last occurrence (most recent data wins)
    # This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    unique_batch = {}
    for item in batch:
        # Use uppercase SKU as key for case-insensitive comparison
        sku_key = item['SKU'].upper()
        unique_batch[sku_key] = item
    
    deduplicated_batch = list(unique_batch.values())
    
    if not deduplicated_batch:
        return
    
    # Normalize SKU to uppercase for consistency (case-insensitive matching)
    for item in deduplicated_batch:
        item['SKU'] = item['SKU'].upper()
    
    # Use PostgreSQL's INSERT ... ON CONFLICT (upsert) for much faster processing
    # Note: This requires SKU column to be case-insensitive or use UPPER(SKU) in index
    stmt = insert(Product).values(deduplicated_batch)
    stmt = stmt.on_conflict_do_update(
        index_elements=['SKU'],
        set_=dict(
            Name=stmt.excluded.Name,
            Description=stmt.excluded.Description,
            IsActive=stmt.excluded.IsActive
        )
    )
    
    db.session.execute(stmt)
    db.session.commit()

# Serve frontend files - must be after all API routes
@app.route('/')
def index():
    return send_from_directory('Frontend', 'main.html')

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug, host=host, port=port)

