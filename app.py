import flask
from flask import Flask
from flask import request, jsonify, render_template
from io import StringIO
import csv
from flask_cors import CORS   
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import insert
import os
DATABASE_USERNAME = os.getenv('DATABASE_USERNAME')
DATABASE_PASSWORD = os.getenv('DATABASE_PASSWORD')
DATABASE_NAME = os.getenv('DATABASE_NAME')
app = Flask(__name__)
# Replace 'your_username', 'your_password', 'your_database_name' with your PostgreSQL credentials
app.config['SQLALCHEMY_DATABASE_URI'] = f'postgresql://{DATABASE_USERNAME}:{DATABASE_PASSWORD}@localhost:5433/{DATABASE_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # Recommended to disable
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_size': 10,
    'max_overflow': 20,
    'pool_recycle': 3600,
}
db = SQLAlchemy(app)
CORS(app)

class Product(db.Model):
        SKU = db.Column(db.String(80), primary_key=True)
        Name = db.Column(db.String(80), unique=False)
        Description = db.Column(db.String(500), unique=False)
        IsActive = db.Column(db.Boolean, default=True)

        def __repr__(self):
            return '<User %r>' % self.Name

from app import app, db 

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
            try:
                # Batch size for processing and committing
                BATCH_SIZE = 1000
                
                # Read and decode CSV in chunks for memory efficiency
                csv_data = StringIO(csv_file.stream.read().decode("UTF-8", errors='ignore'))
                csv_reader = csv.reader(csv_data)
                    
                # Skip header row if present
                next(csv_reader, None) 

                rows_processed = 0
                batch = []
                
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
                            batch = []
                    
                # Process remaining rows
                if batch:
                    _bulk_upsert_products(batch)
                
                return jsonify({
                    'success': True,
                    'message': 'CSV uploaded and data saved successfully!',
                    'rows_processed': rows_processed
                }), 200
            except Exception as e:
                db.session.rollback()
                return jsonify({
                    'error': 'Error processing CSV file',
                    'message': str(e)
                }), 500
        
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



def _bulk_upsert_products(batch):
    """Bulk upsert products using PostgreSQL's ON CONFLICT for better performance."""
    if not batch:
        return
    
    # Deduplicate batch by SKU - keep last occurrence (most recent data wins)
    # This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    unique_batch = {}
    for item in batch:
        unique_batch[item['SKU']] = item
    
    deduplicated_batch = list(unique_batch.values())
    
    if not deduplicated_batch:
        return
    
    # Use PostgreSQL's INSERT ... ON CONFLICT (upsert) for much faster processing
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

