import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Bus,
  GitCompare,
  LayoutDashboard,
  LogOut,
  Map,
  Navigation,
  Radio,
  School,
  Settings,
  Sparkles,
  Upload,
  Users,
  Waypoints,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import type { Role } from "../../types";

const links: { to: string; label: string; icon: typeof Map; roles?: Role[] }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/drive", label: "Route guide", icon: Navigation },
  { to: "/onboarding", label: "Onboarding", icon: Upload, roles: ["platform_admin", "district_admin", "planner"] },
  { to: "/schools", label: "Schools", icon: School, roles: ["platform_admin", "district_admin", "planner", "dispatcher"] },
  { to: "/students", label: "Students", icon: Users, roles: ["platform_admin", "district_admin", "planner", "dispatcher"] },
  { to: "/fleet", label: "Fleet", icon: Bus, roles: ["platform_admin", "district_admin", "planner", "dispatcher"] },
  { to: "/drivers", label: "Drivers", icon: Users, roles: ["platform_admin", "district_admin", "planner", "dispatcher"] },
  { to: "/planner", label: "Route planner", icon: Waypoints, roles: ["platform_admin", "district_admin", "planner"] },
  { to: "/compare", label: "Compare plans", icon: GitCompare, roles: ["platform_admin", "district_admin", "planner"] },
  { to: "/twin", label: "Digital twin", icon: Sparkles, roles: ["platform_admin", "district_admin", "planner"] },
  { to: "/dispatch", label: "Dispatcher", icon: Radio, roles: ["platform_admin", "district_admin", "planner", "dispatcher", "driver"] },
  { to: "/admin", label: "Administration", icon: Settings, roles: ["platform_admin", "district_admin"] },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const immersive = loc.pathname.startsWith("/drive/");
  const visible = links.filter((l) => !l.roles || (user && (l.roles.includes(user.role) || user.role === "platform_admin")));
  return (
    <div className="min-h-screen flex bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 bg-white z-50">
        Skip to content
      </a>
      <aside className="w-[17rem] shrink-0 flex flex-col bg-navy text-white shadow-nav">
        <div className="px-5 py-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-route flex items-center justify-center shadow-lg shadow-route/30">
              <Bus size={20} className="text-white" aria-hidden />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">RouteWise</div>
              <p className="text-[10px] text-white/50 mt-0.5 uppercase tracking-widest font-semibold">Transport POC</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Primary">
          {visible.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium min-h-10 transition-all ${
                    isActive
                      ? "bg-white/12 text-white shadow-inset border border-white/10"
                      : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                  }`
                }
              >
                <Icon size={16} strokeWidth={2} aria-hidden />
                {l.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 m-3 rounded-xl bg-white/[0.06] border border-white/[0.08]">
          <div className="font-semibold text-sm">
            {user?.first_name} {user?.last_name}
          </div>
          <div className="text-white/50 capitalize text-xs mt-0.5">{user?.role.replace("_", " ")}</div>
          <button
            className="mt-3 flex items-center gap-2 text-white/70 hover:text-white text-xs font-semibold"
            onClick={async () => {
              await logout();
              nav("/login");
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-paper/90 backdrop-blur-md border-b border-navy/[0.06] flex items-center justify-between px-6 shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-2.5 text-sm text-slate">
            <Map size={15} className="text-route" />
            <span className="font-medium text-ink">Jefferson Demo Schools</span>
            <span className="badge-warn !text-[10px]">Demo</span>
          </div>
          <button type="button" className="p-2 rounded-xl hover:bg-canvas text-slate transition" aria-label="Notifications">
            <Bell size={17} />
          </button>
        </header>
        <main id="main" className={immersive ? "flex-1 p-0 overflow-hidden" : "flex-1 p-5 lg:p-8 overflow-auto"}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
