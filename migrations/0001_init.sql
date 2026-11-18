-- 질문 접수: 소속·성명·직급·질문만. 사번·이메일·전화 칸 없음.
-- 본문·작성자 칸 불변, 행 삭제 금지(삭제 = status 'hidden').
CREATE TABLE intake_questions (
  id          INTEGER PRIMARY KEY,
  affiliation TEXT NOT NULL,
  name        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  dedupe_key  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','hidden')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX intake_dedupe ON intake_questions(dedupe_key);
CREATE INDEX intake_order ON intake_questions(created_at, id);
CREATE TRIGGER intake_no_delete BEFORE DELETE ON intake_questions
  BEGIN SELECT RAISE(ABORT, 'intake_questions rows are never deleted'); END;
CREATE TRIGGER intake_content_fixed BEFORE UPDATE OF affiliation, name, title, body, dedupe_key, created_at ON intake_questions
  BEGIN SELECT RAISE(ABORT, 'intake_questions content is immutable; change status only'); END;

-- 접속자별 제출 횟수 제한용 (해시된 값만)
CREATE TABLE rate_hits (
  bucket TEXT NOT NULL,
  at     INTEGER NOT NULL
);
CREATE INDEX rate_hits_bucket ON rate_hits(bucket, at);
