# Automata Controls Nexus BMS - Frontend Documentation

## Table of Contents

1. [Frontend Architecture](#frontend-architecture)
2. [Technology Stack](#technology-stack)
3. [App Router Structure](#app-router-structure)
4. [Component Architecture](#component-architecture)
5. [Dashboard System](#dashboard-system)
6. [Equipment Control System](#equipment-control-system)
7. [UI Component Library](#ui-component-library)
8. [API Integration](#api-integration)
9. [Authentication & Guards](#authentication--guards)
10. [Real-time Updates](#real-time-updates)
11. [Performance Features](#performance-features)
12. [Development Guide](#development-guide)

## Frontend Architecture

### Overview

The Automata Controls Nexus BMS frontend is built with **Next.js 15** using the **App Router** architecture, providing a modern, type-safe building management interface with real-time equipment monitoring and control capabilities.

### Technology Stack

```json
{
  "framework": "Next.js 15.1.0",
  "language": "TypeScript",
  "routing": "App Router",
  "styling": "Tailwind CSS",
  "ui_library": "shadcn/ui + Radix UI",
  "icons": "Lucide React",
  "charts": "Recharts",
  "authentication": "Firebase Auth",
  "state": "React Context + useState/useEffect"
}
```

### Application Structure

```
app/
├── layout.tsx                     # Root layout
├── page.tsx                       # Landing page
├── loading.tsx                    # Global loading UI
├── globals.css                    # Global styles
├── api/                          # API routes
├── login/                        # Authentication
└── dashboard/                    # Main application
    ├── layout.tsx               # Dashboard layout
    ├── page.tsx                 # Dashboard home
    ├── controls/                # Equipment controls
    ├── controls-overview/       # Control overview
    ├── analytics/               # Performance analytics
    ├── alarms/                  # Alarm management
    ├── control-logic/           # Logic monitoring
    ├── settings/                # Configuration
    └── location/[id]/           # Location-specific views
```

## App Router Structure

### Route Organization

**Root Routes:**
```typescript
app/
├── page.tsx                       # "/" - Landing page
├── login/page.tsx                 # "/login" - Authentication
└── dashboard/                     # "/dashboard" - Main app
```

**Dashboard Routes:**
```typescript
dashboard/
├── page.tsx                       # "/dashboard" - System overview
├── controls/page.tsx              # "/dashboard/controls" - Equipment control
├── controls-overview/page.tsx     # "/dashboard/controls-overview" - Control dashboard
├── analytics/page.tsx             # "/dashboard/analytics" - Performance data
├── alarms/page.tsx               # "/dashboard/alarms" - Alarm management
├── control-logic/page.tsx        # "/dashboard/control-logic" - Logic monitoring
├── settings/page.tsx             # "/dashboard/settings" - Configuration
└── location/[id]/page.tsx        # "/dashboard/location/[id]" - Location view
```

**API Routes:**
```typescript
api/
├── equipment/[id]/
│   ├── command/route.ts          # POST equipment commands
│   ├── state/route.ts            # GET equipment state
│   └── status/[jobId]/route.ts   # GET job status
├── influx/
│   ├── route.ts                  # Main InfluxDB queries
│   ├── control-data/route.ts     # Equipment control data
│   └── equipment-config/route.ts # Equipment configuration
└── send-alarm-email/route.ts     # Email notifications
```

### Layout System

**Root Layout:**
```tsx
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Dashboard Layout:**
```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
        <AppFooter />
      </div>
    </div>
  )
}
```

## Component Architecture

### Core Layout Components

**App Sidebar:**
```tsx
// components/app-sidebar.tsx
interface AppSidebarProps {
  // Sidebar configuration
}

export function AppSidebar() {
  return (
    <aside className="w-64 bg-card border-r">
      <div className="p-6">
        <Logo />
      </div>
      <nav className="space-y-2 px-4">
        <SidebarItem href="/dashboard" icon={<Home />}>
          Dashboard
        </SidebarItem>
        <SidebarItem href="/dashboard/controls" icon={<Settings />}>
          Controls
        </SidebarItem>
        <SidebarItem href="/dashboard/analytics" icon={<BarChart />}>
          Analytics
        </SidebarItem>
        <SidebarItem href="/dashboard/alarms" icon={<AlertTriangle />}>
          Alarms
        </SidebarItem>
      </nav>
    </aside>
  )
}
```

**App Header:**
```tsx
// components/app-header.tsx
export function AppHeader() {
  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Breadcrumb />
          <LocationSelector />
        </div>
        
        <div className="flex items-center gap-4">
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
```

### Equipment Control Components

Your system has specialized control components for each equipment type:

```tsx
// components/controls/ - Equipment-specific controls
├── air-handler-controls.tsx       # Air handler control interface
├── boiler-controls.tsx            # Boiler control interface  
├── chiller-controls.tsx           # Chiller control interface
├── fan-coil-controls.tsx          # Fan coil control interface
├── pump-controls.tsx              # Pump control interface
├── doas-controls.tsx              # DOAS unit controls
├── steam-bundle-controls.tsx      # Steam bundle controls
├── rtu-controls.tsx               # RTU controls
├── exhaust-fan-controls.tsx       # Exhaust fan controls
├── heating-system-controls.tsx    # Heating system controls
├── cooling-system-controls.tsx    # Cooling system controls
├── actuator-controls.tsx          # Actuator controls
├── specialized-controls.tsx       # Specialized equipment
└── default-controls.tsx           # Generic equipment controls
```

**Boiler Controls Example:**
```tsx
// components/controls/boiler-controls.tsx
interface BoilerControlsProps {
  equipmentId: string;
  equipmentData: EquipmentData;
  onUpdate: (settings: BoilerSettings) => void;
}

export function BoilerControls({ 
  equipmentId, 
  equipmentData, 
  onUpdate 
}: BoilerControlsProps) {
  const [settings, setSettings] = useState<BoilerSettings>({
    enabled: equipmentData.controls?.unitEnable || false,
    tempSetpoint: equipmentData.controls?.waterTempSetpoint || 140,
    isLead: equipmentData.controls?.isLead || false
  });

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/equipment/${equipmentId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'APPLY_CONTROL_SETTINGS',
          equipmentName: equipmentData.name,
          equipmentType: 'boiler',
          locationId: equipmentData.locationId,
          settings: settings,
          userId: 'current-user',
          userName: 'Current User'
        })
      });

      if (response.ok) {
        onUpdate(settings);
        toast.success('Boiler settings updated successfully');
      }
    } catch (error) {
      toast.error('Failed to update boiler settings');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Boiler Controls - {equipmentData.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between">
          <Label>Unit Enable</Label>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => 
              setSettings({ ...settings, enabled: checked })
            }
          />
        </div>

        {/* Temperature Setpoint */}
        <div className="space-y-2">
          <Label>Water Temperature Setpoint: {settings.tempSetpoint}°F</Label>
          <Slider
            value={[settings.tempSetpoint]}
            onValueChange={([value]) =>
              setSettings({ ...settings, tempSetpoint: value })
            }
            min={80}
            max={200}
            step={1}
            className="w-full"
          />
        </div>

        {/* Lead/Lag Status */}
        <div className="flex items-center justify-between">
          <Label>Lead Unit</Label>
          <Badge variant={settings.isLead ? 'default' : 'secondary'}>
            {settings.isLead ? 'LEAD' : 'LAG'}
          </Badge>
        </div>

        {/* Real-time Data Display */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-muted-foreground">Supply Temp</Label>
            <div className="text-2xl font-bold">
              {equipmentData.liveMetrics?.H20Supply || '--'}°F
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Return Temp</Label>
            <div className="text-2xl font-bold">
              {equipmentData.liveMetrics?.H20Return || '--'}°F
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleSave}>Apply Changes</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
          <Button variant="destructive" size="sm">
            Emergency Stop
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Dashboard System

### Main Dashboard Page

```tsx
// app/dashboard/page.tsx
export default function DashboardPage() {
  const [systemStats, setSystemStats] = useState({
    totalEquipment: 13,
    efficiency: 93,
    activeAlerts: 6,
    onlineEquipment: 12
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">System Overview</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Equipment</p>
                <p className="text-3xl font-bold">{systemStats.totalEquipment}</p>
              </div>
              <Cpu className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Efficiency</p>
                <p className="text-3xl font-bold">{systemStats.efficiency}%</p>
              </div>
              <Zap className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-3xl font-bold">{systemStats.activeAlerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online Status</p>
                <p className="text-3xl font-bold">
                  {systemStats.onlineEquipment}/{systemStats.totalEquipment}
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Equipment Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Equipment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <EquipmentStatusGrid />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Controls Overview Dashboard

```tsx
// app/dashboard/controls-overview/page.tsx
export default function ControlsOverviewPage() {
  const [equipmentData, setEquipmentData] = useState<EquipmentData[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/influx/control-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationIds: ['4'], // Huntington
            timeRange: '5m'
          })
        });

        const data = await response.json();
        setEquipmentData(data.data || []);
      } catch (error) {
        console.error('Failed to fetch control data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <ControlsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Equipment Controls</h1>
        <Badge variant="outline">
          Auto-refreshing every 60 seconds
        </Badge>
      </div>

      {/* Equipment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {equipmentData.map((equipment) => (
          <EquipmentControlCard
            key={equipment.equipmentId}
            equipment={equipment}
          />
        ))}
      </div>
    </div>
  );
}
```

## Equipment Control System

### Controls Content Component

```tsx
// components/controls-content.tsx
interface ControlsContentProps {
  equipmentData: EquipmentData;
}

export function ControlsContent({ equipmentData }: ControlsContentProps) {
  // Route to appropriate control component based on equipment type
  const renderControls = () => {
    switch (equipmentData.type?.toLowerCase()) {
      case 'boiler':
        return <BoilerControls equipmentData={equipmentData} />;
      case 'pump':
        return <PumpControls equipmentData={equipmentData} />;
      case 'fan-coil':
      case 'fancoil':
        return <FanCoilControls equipmentData={equipmentData} />;
      case 'chiller':
        return <ChillerControls equipmentData={equipmentData} />;
      case 'air-handler':
      case 'ahu':
        return <AirHandlerControls equipmentData={equipmentData} />;
      case 'doas':
        return <DOASControls equipmentData={equipmentData} />;
      case 'steam-bundle':
        return <SteamBundleControls equipmentData={equipmentData} />;
      case 'rtu':
        return <RTUControls equipmentData={equipmentData} />;
      case 'exhaust-fan':
        return <ExhaustFanControls equipmentData={equipmentData} />;
      case 'heating-system':
        return <HeatingSystemControls equipmentData={equipmentData} />;
      case 'cooling-system':
        return <CoolingSystemControls equipmentData={equipmentData} />;
      case 'actuator':
        return <ActuatorControls equipmentData={equipmentData} />;
      case 'specialized':
        return <SpecializedControls equipmentData={equipmentData} />;
      default:
        return <DefaultControls equipmentData={equipmentData} />;
    }
  };

  return (
    <div className="space-y-6">
      {renderControls()}
    </div>
  );
}
```

### Equipment Control Card

```tsx
// Individual equipment card component
interface EquipmentControlCardProps {
  equipment: EquipmentData;
}

export function EquipmentControlCard({ equipment }: EquipmentControlCardProps) {
  const statusColor = equipment.status === 'online' ? 'green' : 'red';
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{equipment.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{equipment.type}</p>
          </div>
          <Badge 
            variant={equipment.status === 'online' ? 'default' : 'destructive'}
          >
            {equipment.status?.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Real-time Metrics */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {Object.entries(equipment.liveMetrics || {}).map(([key, value]) => (
            <div key={key}>
              <p className="text-muted-foreground">{formatMetricName(key)}</p>
              <p className="font-medium">{formatMetricValue(key, value)}</p>
            </div>
          ))}
        </div>

        {/* Control Outputs */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Control Outputs:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(equipment.controlOutputs || {}).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span>{formatControlName(key)}:</span>
                <span className="font-medium">{formatControlValue(key, value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1">
            View Controls
          </Button>
          <Button size="sm" variant="outline">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

## UI Component Library

### shadcn/ui Components

Your system uses a comprehensive set of shadcn/ui components:

```typescript
// components/ui/ - Complete UI component library
├── accordion.tsx              # Collapsible content sections
├── alert-dialog.tsx           # Modal dialogs for confirmations
├── alert.tsx                  # Status and notification alerts
├── badge.tsx                  # Status indicators and labels
├── button.tsx                 # Primary action buttons
├── card.tsx                   # Content containers
├── chart.tsx                  # Data visualization components
├── dialog.tsx                 # Modal windows
├── form.tsx                   # Form handling components
├── input.tsx                  # Text input fields
├── select.tsx                 # Dropdown selections
├── slider.tsx                 # Range input controls
├── switch.tsx                 # Toggle switches
├── table.tsx                  # Data tables
├── tabs.tsx                   # Tabbed interfaces
├── toast.tsx                  # Notification toasts
└── tooltip.tsx                # Hover information
```

### Custom Components

**Zone Card Component:**
```tsx
// components/zone-card.tsx
interface ZoneCardProps {
  zoneId: string;
  zoneName: string;
  temperature: number;
  setpoint: number;
  equipment: EquipmentData[];
}

export function ZoneCard({ 
  zoneId, 
  zoneName, 
  temperature, 
  setpoint, 
  equipment 
}: ZoneCardProps) {
  const tempDifference = Math.abs(temperature - setpoint);
  const statusColor = tempDifference < 2 ? 'green' : 'orange';
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{zoneName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-2xl font-bold">{temperature}°F</p>
              <p className="text-sm text-muted-foreground">
                Setpoint: {setpoint}°F
              </p>
            </div>
            <Badge variant={statusColor === 'green' ? 'default' : 'secondary'}>
              {tempDifference < 2 ? 'In Range' : 'Adjusting'}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Equipment:</p>
            {equipment.map((eq) => (
              <div key={eq.equipmentId} className="flex justify-between text-sm">
                <span>{eq.name}</span>
                <Badge variant="outline" size="sm">
                  {eq.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Weather Display Component:**
```tsx
// components/weather-display.tsx
export function WeatherDisplay() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  
  useEffect(() => {
    // Fetch weather data
    fetchWeatherData();
  }, []);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Weather
        </CardTitle>
      </CardHeader>
      <CardContent>
        {weather && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{weather.temperature}°F</span>
              <WeatherIcon condition={weather.condition} />
            </div>
            <p className="text-sm text-muted-foreground">
              {weather.description}
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Humidity</p>
                <p className="font-medium">{weather.humidity}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Wind</p>
                <p className="font-medium">{weather.windSpeed} mph</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## API Integration

### Equipment Command API

```typescript
// API integration for equipment commands
export async function sendEquipmentCommand(
  equipmentId: string,
  command: EquipmentCommand
): Promise<CommandResponse> {
  const response = await fetch(`/api/equipment/${equipmentId}/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`Command failed: ${response.statusText}`);
  }

  return response.json();
}

// Get equipment state
export async function getEquipmentState(
  equipmentId: string
): Promise<EquipmentState> {
  const response = await fetch(`/api/equipment/${equipmentId}/state`);
  
  if (!response.ok) {
    throw new Error(`Failed to get state: ${response.statusText}`);
  }

  return response.json();
}

// Check command status
export async function getCommandStatus(
  equipmentId: string,
  jobId: string
): Promise<JobStatus> {
  const response = await fetch(`/api/equipment/${equipmentId}/status/${jobId}`);
  
  if (!response.ok) {
    throw new Error(`Status check failed: ${response.statusText}`);
  }

  return response.json();
}
```

### InfluxDB Data Fetching

```typescript
// InfluxDB control data API
export async function fetchControlData(
  locationIds: string[],
  timeRange: string = '5m'
): Promise<EquipmentData[]> {
  const response = await fetch('/api/influx/control-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locationIds,
      timeRange,
    }),
  });

  if (!response.ok) {
    throw new Error(`Data fetch failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}
```

## Authentication & Guards

### Authentication Components

```tsx
// components/auth-guard.tsx
interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (requireAuth && !user) {
    redirect('/login');
  }

  return <>{children}</>;
}

// components/admin-guard.tsx
interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user } = useAuth();

  if (!user || user.role !== 'admin') {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You don't have permission to access this section.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
```

### Auth Status Component

```tsx
// components/auth-status.tsx
export function AuthStatus() {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <Button asChild>
        <Link href="/login">Sign In</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {user.name?.charAt(0) || user.email?.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Real-time Updates

### Auto-refresh Hook

```typescript
// hooks/use-auto-refresh.ts
export function useAutoRefresh(
  fetchFunction: () => Promise<void>,
  interval: number = 60000,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchFunction();

    // Set up interval
    const intervalId = setInterval(fetchFunction, interval);

    return () => clearInterval(intervalId);
  }, [fetchFunction, interval, enabled]);
}
```

### Real-time Data Hook

```typescript
// hooks/use-equipment-data.ts
export function useEquipmentData(locationIds: string[]) {
  const [data, setData] = useState<EquipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const equipmentData = await fetchControlData(locationIds);
      setData(equipmentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [locationIds]);

  // Auto-refresh every 60 seconds
  useAutoRefresh(fetchData, 60000);

  return { data, loading, error, refetch: fetchData };
}
```

## Performance Features

### Loading States

```tsx
// components/skeletons/ - Loading state components
├── dashboard-skeleton.tsx     # Dashboard loading state
├── controls-skeleton.tsx      # Controls loading state
├── analytics-skeleton.tsx     # Analytics loading state
├── alarms-skeleton.tsx        # Alarms loading state
└── settings-skeleton.tsx      # Settings loading state
```

### Error Boundary

```tsx
// components/error-boundary.tsx
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            Please refresh the page or contact support if the problem persists.
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
```

## Development Guide

### Key Development Patterns

**1. Component Organization:**
- Keep equipment-specific components in `/components/controls/`
- Use loading skeletons for better UX
- Implement error boundaries for fault tolerance

**2. API Integration:**
- Use TypeScript interfaces for all API responses
- Implement proper error handling with try-catch
- Use auto-refresh for real-time data updates

**3. State Management:**
- Use React's built-in state for component-level data
- Use Context for global app state
- Cache API responses when appropriate

**4. Styling:**
- Use Tailwind CSS utility classes
- Follow shadcn/ui component patterns
- Maintain consistent spacing and typography

This frontend architecture provides a **professional, responsive, and real-time** building management interface that scales across multiple locations and equipment types! 🎯🏗️
