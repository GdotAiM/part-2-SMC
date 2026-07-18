import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import OsDashboard from "@/pages/OsDashboard";
import Analytics from "@/pages/Analytics";
import Broker from "@/pages/Broker";
import AgentLoop from "@/pages/AgentLoop";

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
    <Switch>
      {/* Legacy routes (keep these first so they match before OS routes) */}
      <Route path="/analytics" component={Analytics} />
      <Route path="/broker" component={Broker} />
      <Route path="/agent-loop" component={AgentLoop} />
      {/* SMC Pulse OS routes — each is a deep-linkable view */}
      <Route path="/overview" component={OsDashboard} />
      <Route path="/market" component={OsDashboard} />
      <Route path="/analyze" component={OsDashboard} />
      <Route path="/trade" component={OsDashboard} />
      <Route path="/learn" component={OsDashboard} />
      <Route path="/evaluate" component={OsDashboard} />
      <Route path="/agent" component={OsDashboard} />
      {/* Default OS route */}
      <Route path="/" component={OsDashboard} />
      {/* 404 catch-all */}
      <Route component={NotFound} />
    </Switch>
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
