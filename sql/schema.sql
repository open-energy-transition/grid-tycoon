-- ============================================================================
-- GRID TYCOON DATABASE SCHEMA
-- ============================================================================
-- This schema creates all tables in the correct dependency order
-- Safe to run in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- BASE TABLES (no foreign key dependencies)
-- ============================================================================

-- Table: sessions
-- Purpose: Stores mapping session information
CREATE TABLE public.sessions (
  id character varying NOT NULL,
  name character varying,
  description text,
  status character varying DEFAULT 'registering'::character varying
    CHECK (status::text = ANY (ARRAY['registering'::character varying, 'teams_formed'::character varying, 'active'::character varying, 'completed'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  teams_formed_at timestamp with time zone,
  CONSTRAINT sessions_pkey PRIMARY KEY (id)
);

-- Table: indian_territories
-- Purpose: Stores information about Indian states and union territories
CREATE TABLE public.indian_territories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  name_en character varying,
  iso_code character varying UNIQUE,
  osm_relation_id bigint NOT NULL UNIQUE,
  place_type character varying NOT NULL
    CHECK (place_type::text = ANY (ARRAY['state'::character varying, 'territory'::character varying, 'union_territory'::character varying]::text[])),
  area_km2 numeric,
  population integer,
  capital character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT indian_territories_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- DEPENDENT TABLES (with foreign keys)
-- ============================================================================

-- Table: participants
-- Purpose: Stores participant registration information
-- Depends on: sessions
CREATE TABLE public.participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name character varying NOT NULL,
  osm_username character varying NOT NULL,
  session_id character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT participants_pkey PRIMARY KEY (id),
  CONSTRAINT participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);

-- Table: teams
-- Purpose: Stores team information for each session
-- Depends on: sessions
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id character varying NOT NULL,
  team_name character varying NOT NULL,
  team_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);

-- Table: team_members
-- Purpose: Assigns participants to teams with specific roles
-- Depends on: teams, participants
-- Note: participant_id is UNIQUE to ensure each participant is in only one team
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  participant_id uuid NOT NULL UNIQUE,
  role_name character varying NOT NULL,
  role_description text NOT NULL,
  role_icon character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT team_members_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id)
);

-- Table: team_territories
-- Purpose: Assigns territories to teams and tracks mapping progress
-- Depends on: sessions, teams, indian_territories, participants
CREATE TABLE public.team_territories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id character varying NOT NULL,
  team_id uuid NOT NULL,
  territory_id uuid NOT NULL,
  status character varying DEFAULT 'available'::character varying
    CHECK (status::text = ANY (ARRAY['available'::character varying, 'current'::character varying, 'completed'::character varying]::text[])),
  assigned_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  completed_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  territory_name character varying,
  territory_osm_id bigint,
  CONSTRAINT team_territories_pkey PRIMARY KEY (id),
  CONSTRAINT team_territories_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT team_territories_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT team_territories_territory_id_fkey FOREIGN KEY (territory_id) REFERENCES public.indian_territories(id),
  CONSTRAINT team_territories_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.participants(id)
);

-- ============================================================================
-- SCHEMA CREATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✓ Grid Tycoon schema created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables created in order:';
    RAISE NOTICE '  1. sessions (base table)';
    RAISE NOTICE '  2. indian_territories (base table)';
    RAISE NOTICE '  3. participants (depends on sessions)';
    RAISE NOTICE '  4. teams (depends on sessions)';
    RAISE NOTICE '  5. team_members (depends on teams, participants)';
    RAISE NOTICE '  6. team_territories (depends on sessions, teams, territories, participants)';
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Run sql/functions.sql to create database functions';
    RAISE NOTICE '';
END $$;
