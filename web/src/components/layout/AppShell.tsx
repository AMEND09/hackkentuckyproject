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
  Search,
  Settings,
  Sparkles,
  Upload,
  Users,
  Waypoints,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import type { Role } from "../../types";
import { Logo } from "../brand/Logo";

const links: { to: string; label: string; icon: typeof Map; roles?: Role[] }[] = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/drive", label: "Route guide", icon: Navigation },
  { to: "/app/onboarding", label: "Onboarding", icon: Upload, roles: ["platform_admin", "district_admin", "planner"] },
  { to: "/app/schools", label: "Schools", icon: School, roles: ["platform_admin", "district_admin", "planner", "dispatcher"] },
  { to: "/app/students", label: "Students", icon: Users, roles: ["platform_admin", "district_admin", "planner", "dispatcher"] },
  { to: "/app/fleet", label: "Fleet", icon: Bus, roles: ["platform_admin", "district_admin", "planner", "dispatcher"] },
  { to: "/app/drivers", label: "Drivers", icon: Users, roles: ["platform_admin", "district_admin", "planner", "dispatcher"] },
  { to: "/app/planner", label: "Route planner", icon: Waypoints, roles: ["platform_admin", "district_admin", "planner"] },
  { to: "/app/compare", label: "Compare plans", icon: GitCompare, roles: ["platform_admin", "district_admin", "planner"] },
  { to: "/app/twin", label: "Digital twin", icon: Sparkles, roles: ["platform_admin", "district_admin", "planner"] },
  { to: "/app/dispatch", label: "Dispatcher", icon: Radio, roles: ["platform_admin", "district_admin", "planner", "dispatcher", "driver"] },
  { to: "/app/admin", label: "Administration", icon: Settings, roles: ["platform_admin", "district_admin"] },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const immersive = loc.pathname.startsWith("/app/drive/");
  const visible = links.filter(
    (l) => !l.roles || (user && (l.roles.includes(user.role) || user.role === "platform_admin")),
  );

  return (
    <div className="min-h-screen flex bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 bg-white z-50">
        Skip to content
      </a>

      {/* Sidebar */}
      <aside className="w-[16.5rem] shrink-0 flex flex-col bg-paper border-r border-line">
        <div className="h-16 px-5 flex items-center border-b border-line">
          <Logo size={26} showTagline />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Primary">
          {visible.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-lg pl-4 pr-3 py-2.5 text-[13px] font-medium min-h-10 transition-colors ${
                    isActive ? "bg-accent-soft text-route" : "text-slate hover:bg-canvas hover:text-ink"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Dart-inspired directional active indicator */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-1/2 -translate-y-1/2 transition-opacity ${
                        isActive ? "opacity-100" : "opacity-0"
                      }`}
                      style={{
                        width: 0,
                        height: 0,
                        borderTop: "5px solid transparent",
                        borderBottom: "5px solid transparent",
                        borderLeft: "6px solid #2563EB",
                      }}
                    />
                    <Icon
                      size={17}
                      strokeWidth={2}
                      className={isActive ? "text-route" : "text-slate group-hover:text-ink"}
                      aria-hidden
                    />
                    {l.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-line">
          <div className="rounded-xl border border-line bg-canvas px-3.5 py-3">
            <div className="text-sm font-semibold text-ink truncate">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="text-slate capitalize text-xs mt-0.5">{user?.role.replace("_", " ")}</div>
            <button
              className="mt-2.5 inline-flex items-center gap-1.5 text-slate hover:text-ink text-xs font-semibold transition-colors"
              onClick={async () => {
                await logout();
                nav("/");
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-paper border-b border-line flex items-center justify-between gap-4 px-6 shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-3 min-w-0">
            <Map size={16} className="text-route shrink-0" aria-hidden />
            <span className="font-semibold text-ink truncate">{user?.district_name ?? "District console"}</span>
            <span className="badge-info">Demo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                placeholder="Search routes, students…"
                aria-label="Search"
                className="input !py-2 !pl-9 w-64"
              />
            </div>
            <button
              type="button"
              className="p-2.5 rounded-lg border border-line text-slate hover:text-ink hover:bg-canvas transition-colors"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>
          </div>
        </header>

        <main id="main" className={immersive ? "flex-1 p-0 overflow-hidden" : "flex-1 p-5 lg:p-8 overflow-auto"}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
