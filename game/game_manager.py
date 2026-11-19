import random, secrets, string, threading, time
import config
from game.word_validator import validate_game_move, get_locked_positions, get_changed_position, default_service, is_valid_english_word, DictionaryUnavailable

class Game:
    def __init__(self, code, start, target, timer):
        self.code, self.start, self.target, self.timer = code, start.upper(), target.upper(), timer
        self.current, self.used, self.moves = self.start, {self.start}, []
        self.players = []            # dicts: name, token, connected, ready
        self.turn, self.status, self.winner, self.reason = 0, "lobby", None, None
        self.deadline, self.created, self.ended, self.disc_at = None, time.time(), None, {}
        self.lock = threading.RLock()

    def add_player(self, name):
        if len(self.players) >= 2:
            return None
        p = {"name": name, "token": secrets.token_urlsafe(16), "connected": True, "ready": False}
        self.players.append(p); return len(self.players) - 1

    def set_ready(self, idx):
        with self.lock:
            self.players[idx]["ready"] = True
            if len(self.players) == 2 and all(p["ready"] for p in self.players) and self.status == "lobby":
                self.status, self.turn = "active", random.randint(0, 1)
                self._reset_clock()

    def _reset_clock(self):
        self.deadline = time.time() + self.timer if self.timer else None

    def submit(self, idx, word, service=None):
        with self.lock:
            ok, code, msg = validate_game_move(self, idx, word, service)
            if not ok:
                return False, code, msg                      # no state change, turn not consumed
            w = word.strip().upper()
            self.moves.append({"player": idx, "word": w, "pos": get_changed_position(self.current, w), "t": time.time()})
            self.current = w; self.used.add(w)
            if w == self.target:
                self.finish(idx, "target")
            else:
                self.turn = 1 - idx; self._reset_clock()
            return True, "ok", ""

    def rematch(self, idx):
        with self.lock:
            if self.status != "finished": return False
            self.players[idx]["rematch"] = True
            if all(p.get("rematch") for p in self.players):
                loser = 1 - self.winner
                self.current, self.used, self.moves = self.start, {self.start}, []
                self.winner = self.reason = self.ended = None
                self.created, self.disc_at, self.status, self.turn = time.time(), {}, "active", loser
                for p in self.players: p["rematch"] = False
                self._reset_clock()
            return True

    def finish(self, winner, reason):
        self.status, self.winner, self.reason, self.ended, self.deadline = "finished", winner, reason, time.time(), None

    def tick(self, now=None):
        """Handle timeouts / disconnect forfeits. Returns event name or None."""
        now = now or time.time()
        with self.lock:
            if self.status != "active":
                return None
            for i, t in list(self.disc_at.items()):
                if now - t > config.RECONNECT_GRACE:
                    self.finish(1 - i, "disconnect"); return "finished"
            if self.deadline and now > self.deadline:
                if config.TIMEOUT_RULE == "forfeit":
                    self.finish(1 - self.turn, "timeout"); return "finished"
                self.turn = 1 - self.turn; self._reset_clock(); return "timeout"
        return None

    def set_connected(self, idx, val, now=None):
        with self.lock:
            self.players[idx]["connected"] = val
            if val: self.disc_at.pop(idx, None)
            else: self.disc_at[idx] = now or time.time()

    def public(self):
        return {"code": self.code, "start": self.start, "target": self.target, "current": self.current,
                "locked": get_locked_positions(self.current, self.target), "turn": self.turn, "status": self.status,
                "winner": self.winner, "reason": self.reason, "timer": self.timer, "deadline": self.deadline,
                "now": time.time(), "moves": self.moves, "used": sorted(self.used),
                "duration": (self.ended or time.time()) - self.created,
                "players": [{"name": p["name"], "connected": p["connected"], "ready": p["ready"], "rematch": p.get("rematch", False)} for p in self.players]}

class GameManager:
    def __init__(self):
        self.games, self.lock = {}, threading.Lock()

    def create(self, start, target, timer):
        with self.lock:
            while True:
                code = "".join(random.choices(string.ascii_uppercase, k=5))
                if code not in self.games: break
            g = self.games[code] = Game(code, start, target, timer); return g

    def get(self, code):
        return self.games.get((code or "").upper())

    def cleanup(self, max_age=7200):
        with self.lock:
            for c in [c for c, g in self.games.items() if time.time() - g.created > max_age]:
                del self.games[c]

def check_setup(start, target, service=None):
    s, t = (start or "").strip().upper(), (target or "").strip().upper()
    if not (s.isascii() and s.isalpha() and t.isascii() and t.isalpha()): return "Words must contain letters only."
    if len(s) != len(t) or not 3 <= len(s) <= 6: return "Both words need the same length (3-6 letters)."
    if s == t: return "Start and target must differ."
    try:
        for w in (s, t):
            if not is_valid_english_word(w, service): return f"{w} is not a valid English word."
    except DictionaryUnavailable:
        return "Dictionary unreachable. Try again."
    return None

manager = GameManager()
