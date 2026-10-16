/** @type {import('next').NextConfig} */

// Encabezados de seguridad para todas las respuestas. La política de
// contenido (CSP) no restringe scripts ni estilos (Next.js necesita los
// suyos en línea); sí impide que otro sitio meta la web en un iframe, que
// se cambie la base de los enlaces, que los formularios manden datos a
// otro dominio y que se carguen plugins.
const ENCABEZADOS_SEGURIDAD = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  // Sin "X-Powered-By: Next.js": no hace falta anunciar con qué está hecha.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: ENCABEZADOS_SEGURIDAD }];
  },
};

module.exports = nextConfig;
