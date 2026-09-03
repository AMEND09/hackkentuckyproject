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
  platform_admin: "/dashboard",
  district_admin: "/dashboard",
  planner: "/planner",
  dispatcher: "/dispatch",
  driver: "/drive",
  guardian: "/dashboard",
};
