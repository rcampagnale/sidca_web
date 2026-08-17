// src/components/AdminSession/AdminSessionGuard.js
//
// Vigila la inactividad del ADMINISTRADOR y cierra la sesión por completo
// cuando se cumplen las 5 horas sin actividad real.
//
// Se monta una sola vez, arriba de todo. No renderiza nada.
//
// Qué cuenta como actividad: pointerdown, keydown y touchstart, o sea gestos
// reales de la persona. Toda operación manual (Guardar, Eliminar, Consultar,
// Emitir) empieza con uno de esos eventos, así que el contador se reinicia
// ANTES de que salga el request y la sesión no puede cerrarse en mitad de una
// acción recién iniciada.
//
// Qué NO cuenta: renovación del token de Firebase, polling, timers, renders
// de React y cualquier request de fondo. Ninguno pasa por estos listeners.
//
// No aplica al usuario normal de SIDCA: todo el módulo se activa únicamente
// si sessionStorage.es_admin === "true".

import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { auth } from "../../firebase/firebase-config";
import { cerrarSesionAdmin } from "../../redux/reducers/user/actions";
import {
  CHEQUEO_INACTIVIDAD_MS,
  MOTIVO_INACTIVIDAD,
  esSesionAdmin,
  registrarActividadAdmin,
  sesionAdminExpirada,
  sincronizarAccessToken,
} from "../../utils/adminSession";

const EVENTOS_ACTIVIDAD = ["pointerdown", "keydown", "touchstart"];

/** Ruta explícita del login administrativo (PublicRoute en Routes.js). */
const RUTA_LOGIN_ADMIN = "/admin/login";

const AdminSessionGuard = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    let cerrando = false;

    const cerrarPorInactividad = async () => {
      // Una sola vez: el intervalo y el evento de foco pueden coincidir.
      if (cerrando) return;
      cerrando = true;

      detener();

      await dispatch(cerrarSesionAdmin({ motivo: MOTIVO_INACTIVIDAD }));

      // Redirección dura a la ruta explícita del login administrativo. Es a
      // propósito: recarga la página entera y garantiza que no sobreviva
      // ningún estado en memoria de la sesión anterior.
      window.location.replace(RUTA_LOGIN_ADMIN);
    };

    const alHaberActividad = () => {
      if (cerrando) return;

      // Si el plazo ya venció, el gesto NO renueva nada: cierra.
      if (sesionAdminExpirada()) {
        cerrarPorInactividad();
        return;
      }

      registrarActividadAdmin();
    };

    const revisar = () => {
      if (cerrando) return;
      if (!esSesionAdmin()) return;
      if (sesionAdminExpirada()) cerrarPorInactividad();
    };

    for (const evento of EVENTOS_ACTIVIDAD) {
      window.addEventListener(evento, alHaberActividad, { passive: true });
    }

    // Al volver a la pestaña se revisa de inmediato: los timers de una pestaña
    // en segundo plano se ralentizan y podrían tardar en detectar el
    // vencimiento.
    document.addEventListener("visibilitychange", revisar);
    window.addEventListener("focus", revisar);

    const intervalo = window.setInterval(revisar, CHEQUEO_INACTIVIDAD_MS);

    // Firebase renueva el ID Token solo (aprox. cada hora). Cada vez que lo
    // hace se refresca la copia legacy de sessionStorage.user.accessToken,
    // que AdminRoute todavía consulta. Esto NO cuenta como actividad: la
    // renovación es automática y no debe extender las 5 horas.
    const desuscribirToken = auth.onIdTokenChanged(async (usuario) => {
      if (!usuario || !esSesionAdmin()) return;

      try {
        sincronizarAccessToken(await usuario.getIdToken());
      } catch (error) {
        /* si falla, el próximo request lo resuelve con getAdminIdToken */
      }
    });

    function detener() {
      for (const evento of EVENTOS_ACTIVIDAD) {
        window.removeEventListener(evento, alHaberActividad);
      }
      document.removeEventListener("visibilitychange", revisar);
      window.removeEventListener("focus", revisar);
      window.clearInterval(intervalo);
      desuscribirToken();
    }

    // Chequeo inicial: cubre el caso de recargar la página con una sesión que
    // ya venció mientras la pestaña estaba cerrada.
    revisar();

    return detener;
  }, [dispatch]);

  return null;
};

export default AdminSessionGuard;
