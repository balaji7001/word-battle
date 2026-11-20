import re, time, random
from collections import defaultdict, deque
from flask import request
from flask_socketio import emit, join_room
import config
from database import db
from game.game_manager import manager, check_setup

sessions, hits = {}, defaultdict(deque)


def _name(n):
    return re.sub(r"[^A-Za-z0-9 _-]", "", str(n or ""))[:16].strip() or "Guest"


def _limited():
    q, now = hits[request.sid], time.time()
    while q and now - q[0] > config.RATE_LIMIT[1]:
        q.popleft()
    q.append(now)
    return len(q) > config.RATE_LIMIT[0]


def register(sio):
    def err(code, msg): emit("err", {"code": code, "msg": msg})
    def push(g):        sio.emit("state", g.public(), to=g.code)
    def finish_save(g):
        if g.status == "finished":
            db.save_match(g)

    def auth(d):
        if _limited():
            err("rate_limit", "Slow down.")
            return None, None
        g = manager.get(d.get("code"))
        if not g:
            err("no_room", "Room not found.")
            return None, None
        for i, p in enumerate(g.players):
            if p["token"] == d.get("token"):
                return g, i
        err("unauthorized", "You are not in this room.")
        return None, None

    def seat(g, idx):
        sessions[request.sid] = (g.code, idx)
        join_room(g.code)
        g.set_connected(idx, True)

    # ── room management ──────────────────────────────────────────────────────
    @sio.on("create_room")
    def create_room(d):
        if _limited(): return err("rate_limit", "Slow down.")
        e = check_setup(d.get("start"), d.get("target"))
        if e: return err("bad_setup", e)
        timer = d.get("timer") if d.get("timer") in config.TIMERS else 30
        g = manager.create(d["start"], d["target"], timer)
        idx = g.add_player(_name(d.get("name")))
        seat(g, idx)
        emit("joined", {"code": g.code, "token": g.players[idx]["token"], "idx": idx})
        push(g)

    @sio.on("join_room")
    def join(d):
        if _limited(): return err("rate_limit", "Slow down.")
        g = manager.get(d.get("code"))
        if not g: return err("no_room", "Room not found.")
        for i, p in enumerate(g.players):
            if d.get("token") and p["token"] == d["token"]:
                seat(g, i)
                emit("joined", {"code": g.code, "token": p["token"], "idx": i})
                return push(g)
        if g.status != "lobby": return err("room_full", "Match already started.")
        idx = g.add_player(_name(d.get("name")))
        if idx is None: return err("room_full", "Room is full.")
        seat(g, idx)
        emit("joined", {"code": g.code, "token": g.players[idx]["token"], "idx": idx})
        push(g)

    @sio.on("ready")
    def ready(d):
        g, i = auth(d)
        if g:
            g.set_ready(i)
            push(g)

    # ── move ─────────────────────────────────────────────────────────────────
    @sio.on("move")
    def move(d):
        g, i = auth(d)
        if not g: return
        ok, code, msg = g.submit(i, str(d.get("word", ""))[:12])
        if not ok: return err(code, msg)
        finish_save(g)
        push(g)
        # if game just ended by draw, notify with reason
        if g.status == "finished" and g.reason == "draw":
            sio.emit("toast", {"code": "draw", "msg": "No more valid moves — it's a draw! 🤝"}, to=g.code)

    # ── hint ─────────────────────────────────────────────────────────────────
    @sio.on("hint")
    def hint(d):
        g, i = auth(d)
        if not g: return
        hints, msg = g.use_hint(i)
        if hints is None:
            return err("hint_fail", msg)
        # Send hint only to the requesting player (not opponent)
        emit("hint", {
            "hints":      hints,
            "hints_left": g.hints_max - g.hints_used[i]
        })
        push(g)   # update hints_used count for both UIs

    # ── pause / resume ────────────────────────────────────────────────────────
    @sio.on("pause")
    def pause(d):
        g, i = auth(d)
        if not g: return
        ok, msg = g.pause(i)
        if not ok: return err("pause_fail", msg)
        push(g)
        sio.emit("toast", {"code": "paused", "msg": f"⏸ {g.players[i]['name']} paused the game."}, to=g.code)

    @sio.on("resume")
    def resume(d):
        g, i = auth(d)
        if not g: return
        ok, msg = g.resume(i)
        if not ok: return err("resume_fail", msg)
        push(g)
        sio.emit("toast", {"code": "resumed", "msg": f"▶ {g.players[i]['name']} resumed the game!"}, to=g.code)

    # ── reset (both must vote) ────────────────────────────────────────────────
    @sio.on("vote_reset")
    def vote_reset(d):
        g, i = auth(d)
        if not g: return
        ok, result = g.vote_reset(i)
        if not ok: return err("reset_fail", result)
        if result == "waiting":
            push(g)
            sio.emit("toast", {"code": "reset_vote",
                                "msg": f"🔄 {g.players[i]['name']} wants to reset. Waiting for opponent…"},
                     to=g.code)
        elif result == "reset":
            push(g)
            sio.emit("toast", {"code": "reset_done", "msg": "🔄 Both agreed — game reset!"}, to=g.code)

    @sio.on("cancel_reset")
    def cancel_reset(d):
        g, i = auth(d)
        if not g: return
        g.cancel_reset(i)
        push(g)
        sio.emit("toast", {"code": "reset_cancel",
                            "msg": f"❌ {g.players[i]['name']} cancelled the reset."}, to=g.code)

    # ── forfeit ───────────────────────────────────────────────────────────────
    @sio.on("forfeit")
    def forfeit(d):
        g, i = auth(d)
        if not g: return
        if g.forfeit(i):
            finish_save(g)
            push(g)

    # ── disconnect ────────────────────────────────────────────────────────────
    @sio.on("disconnect")
    def disc():
        s = sessions.pop(request.sid, None)
        hits.pop(request.sid, None)
        cancel_match_inner()
        g = s and manager.get(s[0])
        if g:
            g.set_connected(s[1], False)
            push(g)

    queue = []

    def cancel_match_inner():
        queue[:] = [q for q in queue if q[0] != request.sid]

    # ── quick match ───────────────────────────────────────────────────────────
    @sio.on("quick_match")
    def quick(d):
        if _limited(): return err("rate_limit", "Slow down.")
        name = _name(d.get("name"))
        queue[:] = [q for q in queue if q[0] != request.sid]
        if not queue:
            queue.append((request.sid, name))
            return emit("queued", {})
        sid2, name2 = queue.pop(0)
        s, t = random.choice(config.CHALLENGES[random.choice(list(config.CHALLENGES))])
        g = manager.create(s, t, 30)
        for sid, nm in ((sid2, name2), (request.sid, name)):
            idx = g.add_player(nm)
            sessions[sid] = (g.code, idx)
            join_room(g.code, sid=sid)
            g.set_connected(idx, True)
            sio.emit("joined", {"code": g.code, "token": g.players[idx]["token"], "idx": idx}, to=sid)
        g.set_ready(0)
        g.set_ready(1)
        push(g)

    @sio.on("cancel_match")
    def cancel_match(d=None):
        cancel_match_inner()

    # ── rematch ───────────────────────────────────────────────────────────────
    @sio.on("rematch")
    def rematch(d):
        g, i = auth(d)
        if g and g.rematch(i):
            push(g)

    # ── react ─────────────────────────────────────────────────────────────────
    @sio.on("react")
    def react(d):
        g, i = auth(d)
        if g and d.get("e") in ("👏", "😮", "😂", "🔥", "😈", "🤯", "💪", "😤", "🎉", "👀"):
            sio.emit("react", {"idx": i, "e": d["e"]}, to=g.code)

    # ── chat ──────────────────────────────────────────────────────────────────
    @sio.on("chat")
    def chat(d):
        g, i = auth(d)
        if not g: return
        msg = str(d.get("msg", "")).strip()[:120]
        if not msg: return
        sio.emit("chat", {"idx": i, "name": g.players[i]["name"], "msg": msg}, to=g.code)

    # ── random challenge ──────────────────────────────────────────────────────
    @sio.on("random_challenge")
    def rnd(d):
        n = d.get("length") if d.get("length") in config.CHALLENGES else 4
        s, t = random.choice(config.CHALLENGES[n])
        emit("challenge", {"start": s, "target": t})

    # ── background loop ───────────────────────────────────────────────────────
    def loop():
        n = 0
        while True:
            sio.sleep(1)
            n += 1
            for g in list(manager.games.values()):
                ev = g.tick()
                if ev:
                    finish_save(g)
                    push(g)
                    if ev == "timeout":
                        sio.emit("toast", {"code": "timeout",
                                           "msg": "⏱ Time expired — turn skipped!"}, to=g.code)
            if n % 600 == 0:
                manager.cleanup()

    sio.start_background_task(loop)
