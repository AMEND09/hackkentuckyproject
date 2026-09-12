export type Role =
  | "platform_admin"
  | "district_admin"
  | "planner"
  | "dispatcher"
  | "driver"
  | "guardian";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  district: string | null;
  district_name?: string;
}

export const ROLE_HOME: Record<Role, string> = {
  platform_admin: "/app/dashboard",
  district_admin: "/app/dashboard",
  planner: "/app/planner",
  dispatcher: "/app/dispatch",
  driver: "/app/drive",
  guardian: "/app/dashboard",
};

// Louisville Metro / LOJIC open-data layers (apps.geodata) — see backend/apps/geodata.

export interface RiskFactor {
  code: string;
  text: string;
}

export interface ActiveConstruction {
  permit_no: string;
  work_type: string;
  street_address: string;
  to_date: string | null;
}

export interface SafetyContext {
  high_injury_km: number;
  high_injury_corridors: string[];
  high_injury_worst_priority: number | null;
  signal_crossings: number;
  active_construction: ActiveConstruction[];
  snow_route_coverage: number;
}

export interface HighInjurySegment {
  id: string;
  road_name: string;
  corridor_name: string;
  priority_rank: number | null;
  geometry: [number, number][];
}

export interface PublicSchoolSite {
  id: string;
  name: string;
  level: string;
  loc_type: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
}

export interface ConstructionPermit {
  id: string;
  permit_no: string;
  work_type: string;
  street_address: string;
  to_date: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
}
