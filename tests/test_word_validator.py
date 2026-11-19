import sys, os, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from game.word_validator import *
class T(unittest.TestCase):
    def test_helpers(self):
        self.assertEqual(count_changed_letters("FIRE", "HIRE"), 1)
        self.assertEqual(get_changed_position("FIRE", "FIRM"), 3)
        self.assertIsNone(get_changed_position("FIRE", "HIDE"))
        self.assertEqual(get_locked_positions("RODE", "COLD"), [1])
        self.assertTrue(is_locked_position(1, [1])); self.assertFalse(validate_word_length("A", "AB"))
if __name__ == "__main__": unittest.main()
