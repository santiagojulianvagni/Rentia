import type { NextConfig } from 'next';

// Encabezados de seguridad para todo el sitio: nadie puede mostrar Rentia dentro de otra
// página (evita engaños con clics), el navegador no adivina tipos de archivo y no se
// comparten direcciones completas con otros sitios. Vercel ya fuerza HTTPS (HSTS).
const securityHeaders=[
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Content-Security-Policy',value:"frame-ancestors 'none'"},
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
];

const nextConfig: NextConfig = {
  async headers() {
    return [{source:'/:path*',headers:securityHeaders}];
  },
};

export default nextConfig;
