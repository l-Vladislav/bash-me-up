-- One row per page view or command. No IP addresses, no full user agents.
CREATE TABLE IF NOT EXISTS events (
  id       INTEGER PRIMARY KEY,
  at       INTEGER NOT NULL, -- milliseconds since the epoch
  day      TEXT    NOT NULL, -- YYYY-MM-DD, UTC
  type     TEXT    NOT NULL, -- 'view' or 'command'
  name     TEXT    NOT NULL, -- page (and ?run= command) or command name
  visitor  TEXT    NOT NULL, -- salted hash of IP and user agent, new every day
  country  TEXT,
  region   TEXT,
  city     TEXT,
  network  TEXT,             -- provider or company that owns the IP range
  referrer TEXT,             -- host the visitor came from, null for direct
  device   TEXT,
  browser  TEXT,
  os       TEXT,
  lang     TEXT,
  screen   TEXT
);

CREATE INDEX IF NOT EXISTS events_type_at ON events (type, at);
