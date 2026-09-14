-- Daily Digest — structured store
-- All IDs are deterministic so re-running a day is idempotent:
--   edition  ed_<date>
--   story    st_<date>_<slug>
--   source   src_<story_id>_<n>
-- Counts are never denormalised; use the views at the bottom.

-- ---------------------------------------------------------------- editions

CREATE TABLE editions (
  id              TEXT PRIMARY KEY,
  date            TEXT NOT NULL UNIQUE,          -- YYYY-MM-DD, Melbourne local
  lede            TEXT,
  notion_page_id  TEXT,
  model           TEXT,
  run_started_at  TEXT,
  run_finished_at TEXT,
  raw_json        TEXT,                          -- full payload, for replay/rerender
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------- threads

-- A running story that spans editions ("Astra, day two", the rogue-agent saga).
CREATE TABLE threads (
  id       TEXT PRIMARY KEY,
  slug     TEXT NOT NULL UNIQUE,
  title    TEXT NOT NULL,
  summary  TEXT,
  status   TEXT NOT NULL DEFAULT 'open'          -- open | dormant | closed
             CHECK (status IN ('open','dormant','closed'))
);

-- ---------------------------------------------------------------- stories

CREATE TABLE stories (
  id         TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  thread_id  TEXT REFERENCES threads(id) ON DELETE SET NULL,
  slug       TEXT NOT NULL,
  position   INTEGER NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'feature'
               CHECK (kind IN ('lede','feature','brief','ledger','quick_hit','local')),
  headline   TEXT NOT NULL,
  dek        TEXT,                               -- the italic one-liner
  body       TEXT NOT NULL,                      -- markdown
  word_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (edition_id, slug)
);

CREATE INDEX idx_stories_edition ON stories(edition_id, position);
CREATE INDEX idx_stories_thread  ON stories(thread_id);

-- ---------------------------------------------------------------- sources

CREATE TABLE sources (
  id               TEXT PRIMARY KEY,
  story_id         TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL DEFAULT 0,
  role             TEXT NOT NULL DEFAULT 'primary'
                     CHECK (role IN ('primary','original','discussion','secondary')),
  title            TEXT,
  url              TEXT NOT NULL,
  domain           TEXT,
  readwise_id      TEXT,
  readwise_url     TEXT,
  hn_item_id       TEXT,
  hn_comment_count INTEGER
);

CREATE INDEX idx_sources_story    ON sources(story_id, position);
CREATE INDEX idx_sources_domain   ON sources(domain);
CREATE INDEX idx_sources_readwise ON sources(readwise_id);

-- ---------------------------------------------------------------- tags

CREATE TABLE tags (
  slug  TEXT PRIMARY KEY,
  label TEXT,
  color TEXT                                     -- mirrors the Notion multi-select
);

CREATE TABLE story_tags (
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  tag_slug TEXT NOT NULL REFERENCES tags(slug)   ON DELETE CASCADE,
  PRIMARY KEY (story_id, tag_slug)
);

CREATE INDEX idx_story_tags_tag ON story_tags(tag_slug);

-- ---------------------------------------------------------------- entities

CREATE TABLE entities (
  id   TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'person'
         CHECK (kind IN ('person','org','product','place','publication'))
);

CREATE TABLE story_entities (
  story_id  TEXT NOT NULL REFERENCES stories(id)   ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id)  ON DELETE CASCADE,
  role      TEXT,                                  -- author | subject | mentioned
  PRIMARY KEY (story_id, entity_id)
);

CREATE INDEX idx_story_entities_entity ON story_entities(entity_id);

-- ---------------------------------------------------------- links & clicks

-- code is a deterministic hash of story_slug + url, so re-ingesting a day
-- keeps the same short link and the click history survives.
CREATE TABLE links (
  code       TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  story_id   TEXT REFERENCES stories(id)  ON DELETE SET NULL,
  source_id  TEXT REFERENCES sources(id)  ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_links_story ON links(story_id);

CREATE TABLE link_clicks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL REFERENCES links(code) ON DELETE CASCADE,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
  surface    TEXT,                                -- notion | web | email | tui | audio
  user_agent TEXT,
  country    TEXT
);

CREATE INDEX idx_link_clicks_code ON link_clicks(code, clicked_at);

-- ------------------------------------------------------------- candidates

-- Everything the run considered, included or not. This is what makes the
-- selection prompt improvable later.
CREATE TABLE candidates (
  id          TEXT PRIMARY KEY,
  edition_id  TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  readwise_id TEXT,
  title       TEXT,
  url         TEXT,
  domain      TEXT,
  included    INTEGER NOT NULL DEFAULT 0,
  score       REAL,
  reason      TEXT
);

CREATE INDEX idx_candidates_edition ON candidates(edition_id, included);

-- -------------------------------------------------------------------- FTS

-- Standalone (not external-content) so re-ingest is a plain delete + insert.
CREATE VIRTUAL TABLE stories_fts USING fts5(
  story_id UNINDEXED,
  headline,
  dek,
  body,
  tokenize = 'porter unicode61'
);

-- ------------------------------------------------------------------ views

CREATE VIEW tag_usage AS
SELECT st.tag_slug        AS tag,
       COUNT(*)           AS uses,
       MIN(e.date)        AS first_used,
       MAX(e.date)        AS last_used
FROM story_tags st
JOIN stories  s ON s.id = st.story_id
JOIN editions e ON e.id = s.edition_id
GROUP BY st.tag_slug;

CREATE VIEW thread_timeline AS
SELECT th.slug  AS thread_slug,
       th.title AS thread_title,
       e.date   AS date,
       s.id     AS story_id,
       s.headline,
       s.dek
FROM stories s
JOIN threads  th ON th.id = s.thread_id
JOIN editions e  ON e.id  = s.edition_id;

CREATE VIEW entity_mentions AS
SELECT en.slug AS entity_slug,
       en.name AS entity_name,
       e.date  AS date,
       s.id    AS story_id,
       s.headline
FROM story_entities se
JOIN entities en ON en.id = se.entity_id
JOIN stories  s  ON s.id  = se.story_id
JOIN editions e  ON e.id  = s.edition_id;

CREATE VIEW link_performance AS
SELECT l.code,
       l.url,
       e.date,
       s.headline,
       COUNT(c.id) AS clicks
FROM links l
LEFT JOIN link_clicks c ON c.code = l.code
LEFT JOIN stories  s ON s.id = l.story_id
LEFT JOIN editions e ON e.id = s.edition_id
GROUP BY l.code, l.url, e.date, s.headline;

-- The feedback loop: which tags you actually open versus which you just collect.
CREATE VIEW tag_engagement AS
SELECT st.tag_slug                AS tag,
       COUNT(DISTINCT s.id)       AS stories,
       COUNT(c.id)                AS clicks,
       ROUND(CAST(COUNT(c.id) AS REAL) / COUNT(DISTINCT s.id), 2) AS clicks_per_story
FROM story_tags st
JOIN stories s ON s.id = st.story_id
LEFT JOIN links       l ON l.story_id = s.id
LEFT JOIN link_clicks c ON c.code     = l.code
GROUP BY st.tag_slug;
