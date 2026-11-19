import os
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
ASYNC_MODE = os.environ.get("ASYNC_MODE", "gevent")   # gevent for production WebSocket support
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")        # set to your https origin in production
DB_PATH = os.environ.get("DB_PATH", "wordbattle.db")
WORDLIST_PATH = os.environ.get("WORDLIST_PATH", "words.txt")  # local wordlist (3-6 letter English words)
USE_DICTIONARY_API = os.environ.get("USE_DICTIONARY_API", "0") == "1"  # disabled; using local list
DICTIONARY_API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/{}"
API_TIMEOUT = 3
TIMEOUT_RULE = os.environ.get("TIMEOUT_RULE", "skip")     # "skip" turn or "forfeit"
RECONNECT_GRACE = 30                                      # seconds before disconnect = forfeit
RATE_LIMIT = (12, 5)                                      # events per seconds, per socket
TIMERS = (15, 30, 60, 0)                                  # 0 = unlimited
CHALLENGES = {
    3: [("CAT","DOG"),("HAT","BED"),("PIG","FOX"),("SUN","BUS"),("BAT","RUN"),("HOT","COD"),("BIG","LOW"),("MAP","TIN"),
        ("PEN","CUP"),("RED","TAN"),("BOY","GUM"),("ANT","EEL"),("SIT","RUN"),("TOP","BAG"),("WET","DRY")],
    4: [("FIRE","COLD"),("LOVE","HATE"),("WARM","COOL"),("HEAD","TAIL"),("DARK","LIFE"),("WIND","RAIN"),("GOOD","EVIL"),
        ("SAND","SEAS"),("MILK","COOL"),("BOOK","LOOK"),("LAMP","PINE"),("CARD","WORD"),("COIN","GOLD"),("FISH","BIRD"),
        ("RICE","MEAT"),("TIME","LONG"),("FAST","SLOW"),("HARD","SOFT"),("DAWN","DUSK"),("SHIP","BOAT")],
    5: [("WATER","EARTH"),("LIGHT","NIGHT"),("STONE","PLANT"),("BREAD","CRUMB"),("HEART","BRAIN"),("SMILE","FROWN"),
        ("CLEAN","DIRTY"),("HAPPY","ANGRY"),("MONEY","HONEY"),("TRAIN","PLANE"),("GRASS","FIELD"),("SWEET","SHEET"),
        ("PIANO","VIOLA"),("BEACH","OCEAN"),("STORM","CLOUD"),("TIGER","LEMON"),("HORSE","HOUSE"),("PAINT","BRUSH")],
}
