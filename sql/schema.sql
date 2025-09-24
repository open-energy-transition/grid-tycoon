-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.indian_territories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  name_en character varying,
  iso_code character varying UNIQUE,
  osm_relation_id bigint NOT NULL UNIQUE,
  place_type character varying NOT NULL CHECK (place_type::text = ANY (ARRAY['state'::character varying, 'territory'::character varying, 'union_territory'::character varying]::text[])),
  area_km2 numeric,
  population integer,
  capital character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT indian_territories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name character varying NOT NULL,
  osm_username character varying NOT NULL,
  session_id character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT participants_pkey PRIMARY KEY (id),
  CONSTRAINT participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.sessions (
  id character varying NOT NULL,
  name character varying,
  description text,
  status character varying DEFAULT 'registering'::character varying CHECK (status::text = ANY (ARRAY['registering'::character varying, 'teams_formed'::character varying, 'active'::character varying, 'completed'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  teams_formed_at timestamp with time zone,
  CONSTRAINT sessions_pkey PRIMARY KEY (id)
);
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
CREATE TABLE public.team_territories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id character varying NOT NULL,
  team_id uuid NOT NULL,
  territory_id uuid NOT NULL,
  status character varying DEFAULT 'available'::character varying CHECK (status::text = ANY (ARRAY['available'::character varying, 'current'::character varying, 'completed'::character varying]::text[])),
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
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id character varying NOT NULL,
  team_name character varying NOT NULL,
  team_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
