import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Session Cockpit — new narrative-driven primary interface
const SessionCockpit = lazy(() => import("@/shell/SessionCockpitShell"));

// Legacy pages (kept for backward compatibility)
const OsDashboard = lazy(() => import("@/pages/OsDashboard"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Broker = lazy(() => import("@/pages/Broker"));
const AgentLoop = lazy(() => import("@/pages/AgentLoop"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        {/* Legacy routes */}
        <Route path="/analytics" component={Analytics} />
        <Route path="/broker" component={Broker} />
        <Route path="/agent-loop" component={AgentLoop} />

        {/* Old SMC Pulse OS routes — kept for backward compatibility */}
        <Route path="/overview" component={OsDashboard} />
        <Route path="/market" component={OsDashboard} />
        <Route path="/analyze" component={OsDashboard} />
        <Route path="/trade" component={OsDashboard} />
        <Route path="/learn" component={OsDashboard} />
        <Route path="/evaluate" component={OsDashboard} />
        <Route path="/agent" component={OsDashboard} />

        {/* New Session Cockpit — narrative-driven primary interface */}
        <Route path="/cockpit" component={SessionCockpit} />

        {/* Default: Session Cockpit */}
        <Route path="/" component={SessionCockpit} />

        {/* 404 catch-all */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  // Force dark mode
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
