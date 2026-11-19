import sqlite3, threading, time
import config
_lock = threading.Lock()

def _c():
    c = sqlite3.connect(config.DB_PATH); c.row_factory = sqlite3.Row; return c

def init_db():
    with _lock, _c() as c:
        c.execute("CREATE TABLE IF NOT EXISTS players(name TEXT PRIMARY KEY, rating INTEGER DEFAULT 1000)")
        c.execute("""CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY, code TEXT, start TEXT, target TEXT,
            p1 TEXT, p2 TEXT, winner TEXT, moves INTEGER, duration REAL, reason TEXT, ended_at REAL)""")

def save_match(g):
    with _lock, _c() as c:
        c.execute("INSERT INTO matches(code,start,target,p1,p2,winner,moves,duration,reason,ended_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                  (g.code, g.start, g.target, g.players[0]["name"], g.players[1]["name"],
                   g.players[g.winner]["name"], len(g.moves), g.ended - g.created, g.reason, g.ended))
        a, b = g.players[0]["name"], g.players[1]["name"]
        if a != b:                                                   # ELO, K=32
            ra, rb = _rating(c, a), _rating(c, b)
            sa = 1 if g.winner == 0 else 0
            ea = 1 / (1 + 10 ** ((rb - ra) / 400))
            for n, r in ((a, round(ra + 32 * (sa - ea))), (b, round(rb + 32 * (ea - sa)))):
                c.execute("INSERT INTO players(name,rating) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET rating=?", (n, r, r))

def _rating(c, name):
    r = c.execute("SELECT rating FROM players WHERE name=?", (name,)).fetchone()
    return r["rating"] if r else 1000

def stats(name):
    with _lock, _c() as c:
        r = c.execute("""SELECT COUNT(*) m, SUM(winner=?) w, AVG(CASE WHEN winner=? THEN moves END) avg_moves,
            MIN(CASE WHEN winner=? THEN duration END) fastest FROM matches WHERE p1=? OR p2=?""", (name,) * 5).fetchone()
    m, w = r["m"] or 0, r["w"] or 0
    return {"matches": m, "wins": w, "losses": m - w, "win_pct": round(100 * w / m) if m else 0, "rating": _r(name),
            "avg_moves": round(r["avg_moves"], 1) if r["avg_moves"] else None, "fastest": r["fastest"]}

def _r(name):
    with _c() as c: return _rating(c, name)

def leaderboard(limit=10):
    with _lock, _c() as c:
        rows = c.execute("""SELECT winner name, COUNT(*) wins, COALESCE((SELECT rating FROM players p WHERE p.name=m.winner),1000) rating
                            FROM matches m GROUP BY winner ORDER BY rating DESC, wins DESC LIMIT ?""", (limit,)).fetchall()
    return [dict(r) for r in rows]
