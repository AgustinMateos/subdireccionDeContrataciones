// Solo servidor: acceso al Plan de Obras.

import { EMAIL_JEFA_SUBDIRECCION } from "./resoluciones";
import { sesionResoluciones } from "./resolucionesServidor";

// La sesión si es de la jefa de la Subdirección (el Plan de Obras es solo
// suyo); si no, null.
export async function sesionJefa() {
  const session = await sesionResoluciones();
  return session?.user.email === EMAIL_JEFA_SUBDIRECCION ? session : null;
}
