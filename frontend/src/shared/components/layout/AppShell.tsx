import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  LayoutDashboard, Receipt, Users, Building2, BarChart3,
  TrendingUp, FileDown, LogOut, Sun, Moon, ChevronLeft, ChevronRight,
  Wallet, Globe, User, ShieldCheck, Settings,
  Package, Store, Tag, ScrollText,
} from 'lucide-react';
import { ROUTES } from '@/core/constants/constants';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const USER_NAV: NavItem[] = [
  { label: 'Dashboard', to: ROUTES.USER_DASHBOARD, icon: LayoutDashboard },
  { label: 'My Expenses', to: ROUTES.EXPENSES, icon: Receipt },
  { label: 'Bundles', to: ROUTES.BUNDLES, icon: Package },
  { label: 'Profile', to: ROUTES.PROFILE, icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', to: ROUTES.ADMIN_DASHBOARD, icon: LayoutDashboard },
  { label: 'Expenses', to: ROUTES.ADMIN_EXPENSES, icon: Receipt },
  { label: 'Bundles', to: ROUTES.ADMIN_BUNDLES, icon: Package },
  { label: 'Users', to: ROUTES.ADMIN_USERS, icon: Users },
  { label: 'Departments', to: ROUTES.ADMIN_DEPARTMENTS, icon: Building2 },
  { label: 'Analytics', to: ROUTES.ADMIN_ANALYTICS, icon: BarChart3 },
  { label: 'Exchange Rates', to: ROUTES.ADMIN_EXCHANGE_RATES, icon: TrendingUp },
  { label: 'Reports', to: ROUTES.ADMIN_REPORTS, icon: FileDown },
  { label: 'Merchants', to: ROUTES.ADMIN_MERCHANTS, icon: Store },
  { label: 'Categories', to: ROUTES.ADMIN_CATEGORIES, icon: Tag },
  { label: 'Policies', to: ROUTES.ADMIN_POLICIES, icon: ShieldCheck },
  { label: 'Audit Log', to: ROUTES.ADMIN_AUDIT_LOG, icon: ScrollText },
  { label: 'Profile', to: ROUTES.PROFILE, icon: Settings },
];

const SA_NAV: NavItem[] = [
  { label: 'Organizations', to: ROUTES.SA_ORGANIZATIONS, icon: Globe },
  { label: 'All Users', to: ROUTES.SA_USERS, icon: Users },
  { label: 'Profile', to: ROUTES.PROFILE, icon: User },
];

function getNav(role: string | undefined): NavItem[] {
  if (role === 'super_admin') return SA_NAV;
  if (role === 'admin') return ADMIN_NAV;
  return USER_NAV;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const { logout } = useLogout();
  const { theme, toggleTheme } = useTheme();
  const nav = getNav(user?.role);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-2.5 px-4 h-16 border-b border-[var(--sidebar-border)]', collapsed && 'justify-center px-2')}>
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 dark:bg-brand-500">
          <Wallet className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-[var(--foreground)] text-lg">Expensly</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-brand-600 dark:bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]',
              )
            }
          >
            <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className={cn('border-t border-[var(--sidebar-border)] p-2 space-y-0.5')}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title="Toggle theme"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-all',
            collapsed && 'justify-center px-2',
          )}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
          {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>

        {/* Logout */}
        <button
          onClick={() => setLogoutConfirm(true)}
          title="Logout"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--muted-foreground)] hover:bg-danger-50 hover:text-danger-500 dark:hover:bg-danger-500/10 transition-all',
            collapsed && 'justify-center px-2',
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      <ConfirmDialog
        open={logoutConfirm}
        onOpenChange={setLogoutConfirm}
        title="Log out?"
        description="You'll be signed out of your account. Any unsaved changes will be lost."
        confirmLabel="Log out"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => { setLogoutConfirm(false); logout(); }}
      />

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] shadow-sm transition"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}

interface TopBarProps {
  title?: string;
}

function TopBar({ title }: TopBarProps) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const roleLabel = user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'User';

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-[var(--border)] bg-[var(--card)]">
      <h1 className="text-base font-semibold text-[var(--foreground)]">{title}</h1>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(ROUTES.PROFILE)}
          className="flex items-center gap-2.5 rounded-xl px-3 py-1.5 hover:bg-[var(--accent)] transition"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900">
            <span className="text-xs font-bold text-brand-700 dark:text-brand-300">
              {user?.name?.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-[var(--foreground)] leading-none">{user?.name}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{roleLabel}</p>
          </div>
        </button>
      </div>
    </header>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AppShell({ children, title }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <div className="relative flex-shrink-0">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((p) => !p)} />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
