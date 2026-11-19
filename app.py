from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO
import config
from database import db
from game import socket_events

app = Flask(__name__)
app.config["SECRET_KEY"] = config.SECRET_KEY
socketio = SocketIO(app, cors_allowed_origins=config.CORS_ORIGINS, async_mode=config.ASYNC_MODE)
db.init_db()
socket_events.register(socketio)

@app.after_request
def headers(r):
    r.headers["X-Content-Type-Options"] = "nosniff"; r.headers["X-Frame-Options"] = "DENY"
    return r

@app.route("/")
def index(): return render_template("index.html")

@app.route("/api/leaderboard")
def leaderboard(): return jsonify(db.leaderboard())

@app.route("/api/stats")
def stats(): return jsonify(db.stats(request.args.get("name", "")[:16]))

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)
