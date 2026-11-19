import sys, os, time, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config
from game.game_manager import Game
from game.word_validator import DictionaryService, DictionaryUnavailable, get_locked_positions

WORDS = "fire hire hide ride rode role pole poll toll told cold hare".split()
class Fake(DictionaryService):
    def __init__(self): self.words, self.down = set(WORDS), False
    def is_word(self, w):
        if self.down: raise DictionaryUnavailable("down")
        return w.lower() in self.words

def new(timer=30):
    g = Game("ABCDE", "FIRE", "COLD", timer); g.add_player("a"); g.add_player("b")
    g.set_ready(0); g.set_ready(1); g.turn = 0; return g

class Rules(unittest.TestCase):
    def setUp(self): self.s = Fake(); self.g = new()
    def mv(self, i, w): return self.g.submit(i, w, self.s)
    def test_valid(self): self.assertTrue(self.mv(0, "HIRE")[0]); self.assertEqual(self.g.turn, 1)
    def test_invalid_word(self): self.assertEqual(self.mv(0, "FIRX")[1], "not_a_word"); self.assertEqual(self.g.turn, 0)
    def test_multi(self): self.assertEqual(self.mv(0, "HIDE")[1], "multi_change")
    def test_nochange(self): self.assertEqual(self.mv(0, "FIRE")[1], "no_change")
    def test_wrong_turn(self): self.assertEqual(self.mv(1, "HIRE")[1], "not_your_turn")
    def test_repeat(self):
        self.mv(0, "HIRE"); self.mv(1, "FIRE" if False else "HARE" if False else "HIDE")
        self.assertEqual(self.mv(0, "HIRE")[1], "repeat")
    def test_locked_and_full_game(self):
        for i, w in enumerate("HIRE HIDE RIDE RODE ROLE POLE POLL TOLL TOLD".split()):
            self.assertTrue(self.mv(i % 2, w)[0], w)
        self.assertEqual(get_locked_positions("TOLD", "COLD"), [1, 2, 3])
        self.assertEqual(self.mv(1, "TOLL")[1], "locked")
        self.assertTrue(self.mv(1, "COLD")[0])
        self.assertEqual((self.g.status, self.g.winner), ("finished", 1))
        self.assertEqual(self.mv(0, "HIRE")[1], "not_active")
    def test_locked_letter(self):
        for i, w in enumerate("HIRE HIDE RIDE RODE".split()): self.mv(i % 2, w)
        self.s.words.add("rude"); self.assertEqual(self.mv(0, "RUDE")[1], "locked")
    def test_dictionary_down(self):
        self.s.down = True; self.assertEqual(self.mv(0, "HIRE")[1], "dictionary_unavailable"); self.assertEqual(self.g.current, "FIRE")
    def test_timeout_skip_and_forfeit(self):
        self.assertEqual(self.g.tick(time.time() + 99), "timeout"); self.assertEqual(self.g.turn, 1)
        config.TIMEOUT_RULE = "forfeit"
        try: self.g.tick(time.time() + 199); self.assertEqual(self.g.winner, 0)
        finally: config.TIMEOUT_RULE = "skip"
    def test_disconnect_reconnect(self):
        self.g.set_connected(1, False, now=time.time()); self.g.set_connected(1, True)
        self.assertIsNone(self.g.tick(time.time() + 99 if False else None))
        self.g.set_connected(1, False, now=time.time() - 100); self.g.tick(); self.assertEqual(self.g.winner, 0)
    def test_capacity(self): self.assertIsNone(self.g.add_player("c"))




class Extras(unittest.TestCase):
    def test_rematch_resets_and_loser_starts(self):
        g = new(); s = Fake(); g.finish(1, "target")
        g.rematch(0); self.assertEqual(g.status, "finished"); g.rematch(1)
        self.assertEqual((g.status, g.current, g.turn, g.winner), ("active", "FIRE", 0, None))
    def test_elo_and_leaderboard(self):
        import tempfile; config.DB_PATH = tempfile.mktemp(); from database import db; db.init_db()
        g = new(); g.finish(0, "target"); db.save_match(g)
        self.assertEqual(db.stats("a")["rating"], 1016); self.assertEqual(db.leaderboard()[0]["name"], "a")
if __name__ == "__main__": unittest.main()
