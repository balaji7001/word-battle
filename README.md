# WORD BATTLE
Real-time two-player word transformation game. Flask + Flask-SocketIO backend (authoritative), vanilla JS frontend, SQLite history.

## Run locally
```
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py        # http://localhost:5000  (open on two devices/tabs)
```
Tests: `python -m unittest discover -s tests` (no network or Flask needed).

## Dictionary
Default: free dictionaryapi.dev (results cached; failures reject the move without consuming the turn).
Curated list (recommended, offline, blocks obscure words): `WORDLIST_PATH=/path/words.txt` (one word per line).
`USE_DICTIONARY_API=0` disables the API.

## Configuration (env vars)
SECRET_KEY, CORS_ORIGINS (set to your https origin), DB_PATH, TIMEOUT_RULE=skip|forfeit, ASYNC_MODE=eventlet.

## Deploy (Render / Railway / Fly / Heroku-style)
Start command from `Procfile`: `gunicorn -k eventlet -w 1 -b 0.0.0.0:$PORT app:app`. Set `ASYNC_MODE=eventlet`, a random `SECRET_KEY`, and `CORS_ORIGINS`. Use ONE worker (game state is in memory). The platform's HTTPS terminates TLS; Socket.IO automatically uses wss://. Attach a persistent disk for `DB_PATH`.

## Notes
Quick match pairs two waiting players automatically; Rematch replays the same words in the same room (loser starts); ELO (K=32) ranks the leaderboard.
Players are guest names (no passwords). Reconnect uses a per-room token kept in sessionStorage; disconnect for >30s forfeits.
