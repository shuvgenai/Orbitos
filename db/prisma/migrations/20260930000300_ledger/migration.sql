-- Ledger tables (DAT-1, DAT-2, DAT-9). Kept in their own schema so Prisma never models or
-- diffs them; access goes through db/src/ledger.ts. Bounds are UTC (compose sets timezone=UTC).
CREATE SCHEMA ledger;

CREATE SEQUENCE ledger.events_id_seq;
CREATE TABLE ledger.events (
  id           bigint      NOT NULL DEFAULT nextval('ledger.events_id_seq'),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  type         text        NOT NULL,
  actor        text        NOT NULL,
  lead_id      uuid,
  approval_id  uuid,
  data         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX events_workspace_time ON ledger.events (workspace_id, occurred_at);
CREATE INDEX events_approval ON ledger.events (approval_id) WHERE approval_id IS NOT NULL;

CREATE SEQUENCE ledger.llm_calls_id_seq;
CREATE TABLE ledger.llm_calls (
  id                  bigint      NOT NULL DEFAULT nextval('ledger.llm_calls_id_seq'),
  workspace_id        uuid        NOT NULL REFERENCES public.workspaces(id),
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  caller              text        NOT NULL,
  provider            text        NOT NULL,
  model               text        NOT NULL,
  lead_id             uuid,
  input_tokens        integer     NOT NULL,
  cached_input_tokens integer     NOT NULL DEFAULT 0,
  output_tokens       integer     NOT NULL,
  latency_ms          integer     NOT NULL,
  cost_usd            numeric(12, 6) NOT NULL,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE SEQUENCE ledger.decision_calls_id_seq;
CREATE TABLE ledger.decision_calls (
  id             bigint      NOT NULL DEFAULT nextval('ledger.decision_calls_id_seq'),
  workspace_id   uuid        NOT NULL REFERENCES public.workspaces(id),
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  caller         text        NOT NULL,
  provider       text        NOT NULL,
  question_type  text        NOT NULL,
  redacted_state jsonb       NOT NULL,
  question       text        NOT NULL,
  answer         text,
  confidence     numeric(4, 3),
  latency_ms     integer,
  cost_usd       numeric(12, 6),
  human_verdict  text CHECK (human_verdict IN ('agreed', 'overridden')),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Append-only: rows can be inserted, never changed. Retention removes whole partitions (DAT-3).
CREATE FUNCTION ledger.reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger.% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE ON ledger.events
  FOR EACH ROW EXECUTE FUNCTION ledger.reject_change();
CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON ledger.events
  FOR EACH STATEMENT EXECUTE FUNCTION ledger.reject_change();
CREATE TRIGGER llm_calls_append_only BEFORE UPDATE OR DELETE ON ledger.llm_calls
  FOR EACH ROW EXECUTE FUNCTION ledger.reject_change();
CREATE TRIGGER llm_calls_no_truncate BEFORE TRUNCATE ON ledger.llm_calls
  FOR EACH STATEMENT EXECUTE FUNCTION ledger.reject_change();

-- Creates monthly partitions for all three tables; safe to call repeatedly.
CREATE FUNCTION ledger.ensure_month_partitions(p_from date, p_months integer) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  t       text;
  m       date;
  part    text;
  created integer := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['events', 'llm_calls', 'decision_calls'] LOOP
    FOR i IN 0 .. p_months - 1 LOOP
      m := (date_trunc('month', p_from) + make_interval(months => i))::date;
      part := format('%s_%s', t, to_char(m, 'YYYY_MM'));
      IF to_regclass(format('ledger.%I', part)) IS NULL THEN
        EXECUTE format(
          'CREATE TABLE ledger.%I PARTITION OF ledger.%I FOR VALUES FROM (%L) TO (%L)',
          part, t, m, (m + interval '1 month')::date);
        created := created + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN created;
END $$;

SELECT ledger.ensure_month_partitions(DATE '2026-09-01', 12);
