import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Dashboard de Autogestión - Informática y Varios",
  description: "Subdirección de Contrataciones - Consejo de la Magistratura",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
