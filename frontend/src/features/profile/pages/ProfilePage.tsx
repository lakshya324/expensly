import { Moon, Sun, User, Building2, Shield, Mail, Calendar } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useTheme } from '@/shared/providers/ThemeProvider';
import { formatDate } from '@/core/utils/formatters';


const ROLE_LABEL: Record<string, string> = {
  user: 'Employee',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

const ROLE_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  user: 'default',
  admin: 'info',
  super_admin: 'warning',
};

const THEME_OPTIONS: { value: 'light' | 'dark'; label: string; icon: React.FC<{ className?: string }> }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <AppShell title="My Profile">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Avatar + Name */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-brand-600 text-white flex items-center justify-center text-2xl font-bold select-none flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-foreground truncate">{user.name}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5" />
                  {user.email}
                </p>
                <div className="mt-2">
                  <Badge variant={ROLE_COLOR[user.role] ?? 'default'}>
                    {ROLE_LABEL[user.role] ?? user.role}
                  </Badge>
                  {user.isDisabled && (
                    <Badge variant="danger" className="ml-2">Disabled</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-brand-600" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Name" value={user.name} />
              <Row label="Email" value={user.email} />
              <Row
                label="Department"
                value={user.department?.name ?? <span className="text-muted-foreground italic">Unassigned</span>}
              />
              <Row
                label="Manager"
                value={user.managerId?.name ?? <span className="text-muted-foreground italic">None</span>}
              />
              <Row
                label="Member since"
                value={
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(user.createdAt)}
                  </span>
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-600" />
                Permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <PermissionRow
                label="View all expenses"
                value={user.permissions?.canViewAllTickets}
              />
              <PermissionRow
                label="Approve expenses"
                value={user.permissions?.canApprove}
              />
            </CardContent>
          </Card>
        </div>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sun className="w-4 h-4 text-brand-600" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Choose how Expensly looks to you.
            </p>
            <div className="flex gap-3 flex-wrap">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={[
                    'flex flex-col items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-medium transition-all',
                    theme === value
                      ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Org info (admin only shows org details) */}
        {(user.role === 'admin' || user.role === 'super_admin') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600" />
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <Row label="Org ID" value={<code className="text-xs bg-muted px-1.5 py-0.5 rounded">{user.orgId ?? 'N/A'}</code>} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  );
}

function PermissionRow({ label, value }: { label: string; value: boolean | null | undefined }) {
  const isGranted = value === true;
  const isDefault = value === null || value === undefined;
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {isDefault ? (
        <Badge variant="muted">Default</Badge>
      ) : isGranted ? (
        <Badge variant="success">Granted</Badge>
      ) : (
        <Badge variant="danger">Denied</Badge>
      )}
    </div>
  );
}
