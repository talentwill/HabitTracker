import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  Navigate,
} from "react-router";
import { AuthProvider, useAuth } from "./auth/AuthContext";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-full grid place-items-center">
        <div className="paper px-5 py-4 text-sm text-muted">加载中…</div>
      </div>
    );
  }

  // Allow login page without auth
  if (location.pathname === "/login") {
    if (user) return <Navigate to="/" replace />;
    return <Outlet />;
  }

  // All other routes require auth
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export default function App() {
  return <AuthGate />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="paper p-8 max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-2">{message}</h1>
        <p className="text-muted">{details}</p>
        {stack && (
          <pre className="mt-4 text-xs text-left overflow-x-auto text-muted">
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
