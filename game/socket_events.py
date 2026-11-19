import re, time, random
from collections import defaultdict, deque
from flask import request
from flask_socketio import emit, join_room
import config
from database import db
from game.game_manager import manager, check_setup

sessions, hits = {}, defaultdict(deque)   # sid -> (code, idx)

def _name(n): return re.sub(r"[^A-Za-z0-9 _-]", "", str(n or ""))[:16].strip() or "Guest"

def _limited():
    q, now = hits[request.sid], time.time()
    while q and now - q[0] > config.RATE_LIMIT[1]: q.popleft()
    q.append(now)
    return len(q) > config.RATE_LIMIT[0]

def register(sio):
    def err(code, msg): emit("err", {"code": code, "msg": msg})
    def push(g): sio.emit("state", g.public(), to=g.code)
    def finish_save(g):
        if g.status == "finished": db.save_match(g)

    def auth(d):
        if _limited(): err("rate_limit", "Slow down."); return None, None
        g = manager.get(d.get("code"))
        if not g: err("no_room", "Room not found."); return None, None
        for i, p in enumerate(g.players):
            if p["token"] == d.get("token"): return g, i
        err("unauthorized", "You are not in this room."); return None, None

    def seat(g, idx):
        sessions[request.sid] = (g.code, idx); join_room(g.code)
        g.set_connected(idx, True)

    @sio.on("create_room")
    def create_room(d):
        if _limited(): return err("rate_limit", "Slow down.")
        e = check_setup(d.get("start"), d.get("target"))
        if e: return err("bad_setup", e)
        timer = d.get("timer") if d.get("timer") in config.TIMERS else 30
        g = manager.create(d["start"], d["target"], timer)
        idx = g.add_player(_name(d.get("name"))); seat(g, idx)
        emit("joined", {"code": g.code, "token": g.players[idx]["token"], "idx": idx}); push(g)

    @sio.on("join_room")
    def join(d):
        if _limited(): return err("rate_limit", "Slow down.")
        g = manager.get(d.get("code"))
        if not g: return err("no_room", "Room not found.")
        for i, p in enumerate(g.players):                       # reconnection
            if d.get("token") and p["token"] == d["token"]:
                seat(g, i); emit("joined", {"code": g.code, "token": p["token"], "idx": i}); return push(g)
        if g.status != "lobby": return err("room_full", "Match already started.")
        idx = g.add_player(_name(d.get("name")))
        if idx is None: return err("room_full", "Room is full.")
        seat(g, idx); emit("joined", {"code": g.code, "token": g.players[idx]["token"], "idx": idx}); push(g)

    @sio.on("ready")
    def ready(d):
        g, i = auth(d)
        if g: g.set_ready(i); push(g)

    @sio.on("move")
    def move(d):
        g, i = auth(d)
        if not g: return
        ok, code, msg = g.submit(i, str(d.get("word", ""))[:12])
        if not ok: return err(code, msg)
        finish_save(g); push(g)

    @sio.on("disconnect")
    def disc():
        s = sessions.pop(request.sid, None); hits.pop(request.sid, None); cancel()
        g = s and manager.get(s[0])
        if g: g.set_connected(s[1], False); push(g)

    queue = []

    @sio.on("quick_match")
    def quick(d):
        if _limited(): return err("rate_limit", "Slow down.")
        name = _name(d.get("name")); queue[:] = [q for q in queue if q[0] != request.sid]
        if not queue:
            queue.append((request.sid, name)); return emit("queued", {})
        sid2, name2 = queue.pop(0)
        s, t = random.choice(config.CHALLENGES[random.choice(list(config.CHALLENGES))])
        g = manager.create(s, t, 30)
        for sid, nm in ((sid2, name2), (request.sid, name)):
            i = g.add_player(nm); sessions[sid] = (g.code, i); join_room(g.code, sid=sid); g.set_connected(i, True)
            sio.emit("joined", {"code": g.code, "token": g.players[i]["token"], "idx": i}, to=sid)
        g.set_ready(0); g.set_ready(1); push(g)

    @sio.on("cancel_match")
    def cancel(d=None): queue[:] = [q for q in queue if q[0] != request.sid]

    @sio.on("rematch")
    def rematch(d):
        g, i = auth(d)
        if g and g.rematch(i): push(g)

    @sio.on("react")
    def react(d):
        g, i = auth(d)
        if g and d.get("e") in ("👏", "😮", "😂", "🔥", "😈"): sio.emit("react", {"idx": i, "e": d["e"]}, to=g.code)

    @sio.on("chat")
    def chat(d):
        g, i = auth(d)
        if not g: return
        msg = str(d.get("msg", "")).strip()[:120]
        if not msg: return
        name = g.players[i]["name"]
        sio.emit("chat", {"idx": i, "name": name, "msg": msg}, to=g.code)

    def loop():
        n = 0
        while True:
            sio.sleep(1); n += 1
            for g in list(manager.games.values()):
                ev = g.tick()
                if ev:
                    finish_save(g); push(g)
                    if ev == "timeout": sio.emit("toast", {"code": "timeout", "msg": "Time expired. Turn skipped."}, to=g.code)
            if n % 600 == 0: manager.cleanup()
    sio.start_background_task(loop)

    @sio.on("random_challenge")
    def rnd(d):
        n = d.get("length") if d.get("length") in config.CHALLENGES else 4
        s, t = random.choice(config.CHALLENGES[n]); emit("challenge", {"start": s, "target": t})
