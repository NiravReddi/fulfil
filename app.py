import flask
from flask import Flask

from flask import request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
@app.route('/')
def index():
    return "Hello, World!"
if __name__ == '__main__':
    app.run(debug=True)
    app.run(host='0.0.0.0', port=5000)

