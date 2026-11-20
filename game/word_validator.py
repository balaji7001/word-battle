"""Word validation + dead-end detection. DictionaryService is swappable."""
import json, threading, urllib.request, urllib.error
import config


class DictionaryUnavailable(Exception):
    pass


class DictionaryService:
    def __init__(self, wordlist_path="", use_api=True):
        self.cache, self.lock, self.use_api, self.words = {}, threading.Lock(), use_api, None
        if wordlist_path:
            with open(wordlist_path, encoding="utf-8") as f:
                self.words = {w.strip().lower() for w in f if w.strip().isalpha()}

    def is_word(self, word):
        w = word.lower()
        if not (w.isascii() and w.isalpha()):
            return False
        if self.words is not None:
            return w in self.words
        with self.lock:
            if w in self.cache:
                return self.cache[w]
        if not self.use_api:
            raise DictionaryUnavailable("no dictionary configured")
        try:
            with urllib.request.urlopen(config.DICTIONARY_API_URL.format(w), timeout=config.API_TIMEOUT) as r:
                ok = r.status == 200 and bool(json.load(r))
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise DictionaryUnavailable(str(e))
            ok = False
        except Exception as e:
            raise DictionaryUnavailable(str(e))
        with self.lock:
            self.cache[w] = ok
        return ok


default_service = DictionaryService(config.WORDLIST_PATH, config.USE_DICTIONARY_API)


def is_valid_english_word(word, service=None):
    return (service or default_service).is_word(word)


def validate_word_length(old, new):
    return len(old) == len(new)


def count_changed_letters(old, new):
    return sum(a != b for a, b in zip(old, new)) if len(old) == len(new) else max(len(old), len(new))


def get_changed_position(old, new):
    diff = [i for i, (a, b) in enumerate(zip(old, new)) if a != b]
    return diff[0] if len(diff) == 1 else None


def get_locked_positions(current, target):
    return [i for i, (a, b) in enumerate(zip(current.upper(), target.upper())) if a == b]


def is_locked_position(position, locked):
    return position in locked


def get_next_hints(current, target, used, service=None, n=3):
    """Return up to n valid one-letter changes from current toward target that haven't been used."""
    svc = service or default_service
    locked = get_locked_positions(current, target)
    hints = []
    # First prioritise moves that match a target letter
    for i, (c, t) in enumerate(zip(current, target)):
        if i in locked or c == t:
            continue
        candidate = current[:i] + t + current[i+1:]
        if candidate.upper() not in used and svc.is_word(candidate.lower()):
            hints.append(candidate.upper())
        if len(hints) >= n:
            return hints
    # Then any other valid move
    if len(hints) < n and svc.words:
        alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        for i in range(len(current)):
            if i in locked:
                continue
            for ch in alphabet:
                if ch == current[i]:
                    continue
                candidate = current[:i] + ch + current[i+1:]
                if candidate.upper() not in used and svc.is_word(candidate.lower()):
                    if candidate.upper() not in hints:
                        hints.append(candidate.upper())
                if len(hints) >= n:
                    return hints
    return hints


def can_progress(current, target, used, service=None):
    """Return True if at least one valid unused one-letter change exists from current."""
    svc = service or default_service
    locked = get_locked_positions(current, target)
    if not svc.words:
        return True  # can't check without wordlist — optimistic
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    for i in range(len(current)):
        if i in locked:
            continue
        for ch in alphabet:
            if ch == current[i]:
                continue
            candidate = current[:i] + ch + current[i+1:]
            if candidate.upper() not in used and svc.is_word(candidate.lower()):
                return True
    return False


def validate_game_move(g, player_idx, new_word, service=None):
    """Returns (ok, code, message). Never mutates state."""
    if g.status != "active":
        return False, "not_active", "The match is not in progress."
    if player_idx != g.turn:
        return False, "not_your_turn", "It's not your turn."
    w = (new_word or "").strip().upper()
    if not (w.isascii() and w.isalpha()):
        return False, "invalid_chars", "Use letters A-Z only."
    if not validate_word_length(g.current, w):
        return False, "bad_length", f"The word must have {len(g.current)} letters."
    n = count_changed_letters(g.current, w)
    if n == 0:
        return False, "no_change", "Change one letter."
    if n > 1:
        return False, "multi_change", "Change exactly one letter."
    pos = get_changed_position(g.current, w)
    if is_locked_position(pos, get_locked_positions(g.current, g.target)):
        return False, "locked", "That letter is locked."
    if w in g.used:
        return False, "repeat", "That word was already used."
    try:
        if not is_valid_english_word(w, service):
            return False, "not_a_word", f"{w} is not a valid English word."
    except DictionaryUnavailable:
        return False, "dictionary_unavailable", "Dictionary unreachable. Try again."
    return True, "ok", ""
