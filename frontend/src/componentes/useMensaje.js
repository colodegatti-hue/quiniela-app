import { useEffect, useState } from 'react';

// Mensaje corto que se borra solo (por ejemplo, "Copiado")
export default function useMensaje(duracion = 2500) {
  const [mensaje, setMensaje] = useState(null);
  useEffect(() => {
    if (!mensaje) return undefined;
    const id = setTimeout(() => setMensaje(null), duracion);
    return () => clearTimeout(id);
  }, [mensaje, duracion]);
  return [mensaje, setMensaje];
}
