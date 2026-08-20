import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { appearanceInitScript } from "@/lib/appearance";
import { getMobileRouteRedirect } from "@/lib/mobileExperience";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const mobileRedirect = getMobileRouteRedirect(location.pathname);
    if (mobileRedirect) throw redirect({ to: mobileRedirect });
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SIPI — Sistema de Inquéritos Policiais" },
      { name: "description", content: "Painel operacional de inquéritos policiais." },
      { property: "og:title", content: "SIPI — Sistema de Inquéritos Policiais" },
      { name: "twitter:title", content: "SIPI — Sistema de Inquéritos Policiais" },
      { property: "og:description", content: "Painel operacional de inquéritos policiais." },
      { name: "twitter:description", content: "Painel operacional de inquéritos policiais." },
      { name: "twitter:card", content: "summary" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/sipi-badge.png?v=original" },
      { rel: "apple-touch-icon", href: "/sipi-badge.png?v=original" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className="dark"
      data-theme="default"
      data-appearance="default"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
