import random, secrets, string, threading, time
import config
from game.word_validator import (
    validate_game_move, get_locked_positions, get_changed_position,
    default_service, is_valid_english_word, DictionaryUnavailable,
    get_next_hints, can_progress
)

MAX_HINTS = 3   # hints per player per game


class Game:
    def __init__(self, code, start, target, timer):
        self.code    = code
        self.start   = start.upper()
        self.target  = target.upper()
        self.timer   = timer
        self.current = self.start
        self.used    = {self.start}
        self.moves   = []
        self.players = []          # dicts: name, token, connected, ready
        self.turn    = 0
        self.status  = "lobby"     # lobby | active | paused | finished
        self.winner  = None
        self.reason  = None        # target | timeout | disconnect | forfeit | draw | reset
        self.deadline    = None
        self.pause_left  = None    # seconds remaining when paused
        self.created     = time.time()
        self.ended       = None
        self.disc_at     = {}
        self.hints_used  = [0, 0]  # per player
        self.reset_votes = set()   # player indices who voted to reset
        self.lock        = threading.RLock()

    # ── players ────────────────────────────────────────────────────────────
    def add_player(self, name):
        if len(self.players) >= 2:
            return None
        p = {"name": name, "token": secrets.token_urlsafe(16),
             "connected": True, "ready": False}
        self.players.append(p)
        return len(self.players) - 1

    # ── ready / start ───────────────────────────────────────────────────────
    def set_ready(self, idx):
        with self.lock:
            self.players[idx]["ready"] = True
            if (len(self.players) == 2
                    and all(p["ready"] for p in self.players)
                    and self.status == "lobby"):
                self.status = "active"
                self.turn   = random.randint(0, 1)
                self._reset_clock()

    def _reset_clock(self):
        self.deadline = time.time() + self.timer if self.timer else None

    # ── move ────────────────────────────────────────────────────────────────
    def submit(self, idx, word, service=None):
        with self.lock:
            ok, code, msg = validate_game_move(self, idx, word, service)
            if not ok:
                return False, code, msg
            w = word.strip().upper()
            self.moves.append({
                "player": idx,
                "word":   w,
                "pos":    get_changed_position(self.current, w),
                "t":      time.time()
            })
            self.current = w
            self.used.add(w)

            if w == self.target:
                self.finish(idx, "target")
                return True, "ok", ""

            # check dead-end after the move
            if not can_progress(self.current, self.target, self.used, service):
                self.finish(None, "draw")
                return True, "ok", ""

            self.turn = 1 - idx
            self._reset_clock()
            return True, "ok", ""

    # ── hints ───────────────────────────────────────────────────────────────
    def use_hint(self, idx, service=None):
        with self.lock:
            if self.status != "active":
                return None, "Game is not active."
            if idx != self.turn:
                return None, "It's not your turn."
            if self.hints_used[idx] >= MAX_HINTS:
                return None, "No hints left!"
            hints = get_next_hints(self.current, self.target, self.used, service, n=3)
            if not hints:
                return None, "No hints available right now."
            self.hints_used[idx] += 1
            return hints, ""

    # ── pause / resume ──────────────────────────────────────────────────────
    def pause(self, idx):
        with self.lock:
            if self.status != "active":
                return False, "Game is not active."
            self.status = "paused"
            if self.deadline and self.timer:
                self.pause_left = max(0, self.deadline - time.time())
            else:
                self.pause_left = None
            self.deadline = None
            return True, ""

    def resume(self, idx):
        with self.lock:
            if self.status != "paused":
                return False, "Game is not paused."
            self.status = "active"
            if self.pause_left is not None and self.timer:
                self.deadline = time.time() + self.pause_left
            elif self.timer:
                self.deadline = time.time() + self.timer
            else:
                self.deadline = None
            self.pause_left = None
            return True, ""

    # ── reset ───────────────────────────────────────────────────────────────
    def vote_reset(self, idx):
        with self.lock:
            if self.status not in ("active", "paused"):
                return False, "Game is not in progress."
            self.reset_votes.add(idx)
            if len(self.reset_votes) == 2:
                # both agreed — reset the game
                self.current    = self.start
                self.used       = {self.start}
                self.moves      = []
                self.winner     = None
                self.reason     = None
                self.ended      = None
                self.hints_used = [0, 0]
                self.reset_votes= set()
                self.status     = "active"
                self.turn       = random.randint(0, 1)
                self._reset_clock()
                return True, "reset"
            return True, "waiting"

    def cancel_reset(self, idx):
        with self.lock:
            self.reset_votes.discard(idx)

    # ── forfeit ─────────────────────────────────────────────────────────────
    def forfeit(self, idx):
        with self.lock:
            if self.status not in ("active", "paused"):
                return False
            self.finish(1 - idx, "forfeit")
            return True

    # ── finish ──────────────────────────────────────────────────────────────
    def finish(self, winner, reason):
        self.status   = "finished"
        self.winner   = winner
        self.reason   = reason
        self.ended    = time.time()
        self.deadline = None

    # ── rematch ─────────────────────────────────────────────────────────────
    def rematch(self, idx):
        with self.lock:
            if self.status != "finished":
                return False
            self.players[idx]["rematch"] = True
            if all(p.get("rematch") for p in self.players):
                loser = (1 - self.winner) if self.winner is not None else random.randint(0, 1)
                self.current    = self.start
                self.used       = {self.start}
                self.moves      = []
                self.winner     = None
                self.reason     = None
                self.ended      = None
                self.hints_used = [0, 0]
                self.reset_votes= set()
                self.created    = time.time()
                self.disc_at    = {}
                self.status     = "active"
                self.turn       = loser
                for p in self.players:
                    p["rematch"] = False
                self._reset_clock()
            return True

    # ── tick (timeout / disconnect) ─────────────────────────────────────────
    def tick(self, now=None):
        now = now or time.time()
        with self.lock:
            if self.status != "active":
                return None
            for i, t in list(self.disc_at.items()):
                if now - t > config.RECONNECT_GRACE:
                    self.finish(1 - i, "disconnect")
                    return "finished"
            if self.deadline and now > self.deadline:
                if config.TIMEOUT_RULE == "forfeit":
                    self.finish(1 - self.turn, "timeout")
                    return "finished"
                self.turn = 1 - self.turn
                self._reset_clock()
                return "timeout"
        return None

    def set_connected(self, idx, val, now=None):
        with self.lock:
            self.players[idx]["connected"] = val
            if val:
                self.disc_at.pop(idx, None)
            else:
                self.disc_at[idx] = now or time.time()

    # ── public state ────────────────────────────────────────────────────────
    def public(self):
        return {
            "code":        self.code,
            "start":       self.start,
            "target":      self.target,
            "current":     self.current,
            "locked":      get_locked_positions(self.current, self.target),
            "turn":        self.turn,
            "status":      self.status,
            "winner":      self.winner,
            "reason":      self.reason,
            "timer":       self.timer,
            "deadline":    self.deadline,
            "now":         time.time(),
            "moves":       self.moves,
            "used":        sorted(self.used),
            "duration":    (self.ended or time.time()) - self.created,
            "hints_used":  self.hints_used,
            "hints_max":   MAX_HINTS,
            "reset_votes": list(self.reset_votes),
            "players":     [
                {
                    "name":      p["name"],
                    "connected": p["connected"],
                    "ready":     p["ready"],
                    "rematch":   p.get("rematch", False)
                }
                for p in self.players
            ]
        }


# ── GameManager ─────────────────────────────────────────────────────────────
class GameManager:
    def __init__(self):
        self.games = {}
        self.lock  = threading.Lock()

    def create(self, start, target, timer):
        with self.lock:
            while True:
                code = "".join(random.choices(string.ascii_uppercase, k=5))
                if code not in self.games:
                    break
            g = self.games[code] = Game(code, start, target, timer)
            return g

    def get(self, code):
        return self.games.get((code or "").upper())

    def cleanup(self, max_age=7200):
        with self.lock:
            for c in [c for c, g in self.games.items()
                      if time.time() - g.created > max_age]:
                del self.games[c]


def check_setup(start, target, service=None):
    s = (start  or "").strip().upper()
    t = (target or "").strip().upper()
    if not (s.isascii() and s.isalpha() and t.isascii() and t.isalpha()):
        return "Words must contain letters only."
    if len(s) != len(t) or not 3 <= len(s) <= 6:
        return "Both words need the same length (3-6 letters)."
    if s == t:
        return "Start and target must differ."
    try:
        for w in (s, t):
            if not is_valid_english_word(w, service):
                return f"{w} is not a valid English word."
    except DictionaryUnavailable:
        return "Dictionary unreachable. Try again."
    return None


manager = GameManager()
