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
