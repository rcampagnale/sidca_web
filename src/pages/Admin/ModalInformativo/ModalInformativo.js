import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { FileUpload } from 'primereact/fileupload';
import { ProgressBar } from 'primereact/progressbar';
import { confirmDialog } from 'primereact/confirmdialog';

import { uploadImg } from '../../../redux/reducers/novedades/actions';
import {
  desactivarModal,
  eliminarModal,
  guardarBorradorModal,
  guardarYActivarModal,
  listarModalInformativos,
} from '../../../services/modalInformativosService';
import {
  enviarModalInformativoPrueba,
  enviarNotificacionPushMasiva,
} from '../../../services/pushNotificationsService';
import styles from './styles.module.css';

const MAX_IMAGE_SIZE = 1000000;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];

const estadoLabel = {
  activo: 'ACTIVO',
  borrador: 'BORRADOR',
  inactivo: 'INACTIVO',
};

const formatearFecha = (valor) => {
  const fecha = valor?.toDate?.() || (valor ? new Date(valor) : null);
  if (!fecha || Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

const extractoDescripcion = (valor) => {
  const texto = String(valor || '').trim();
  return texto.length > 180 ? `${texto.slice(0, 177)}...` : texto;
};

const mensajeOperacion = (error, fallback) => {
  console.error('[ModalInformativo]', error);
  const detalle = String(error?.message || error || '');
  if (detalle.includes("reading 'path'") || detalle.includes('reading \\"path\\"')) {
    return 'No se pudo completar la operación. Intentá nuevamente.';
  }
  return detalle || fallback;
};

const ModalInformativo = () => {
  const dispatch = useDispatch();
  const novedadesState = useSelector((state) => state.novedades || {});
  const uploadRequested = useRef(false);
  const [modales, setModales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [formId, setFormId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imagen, setImagen] = useState('');
  const [link, setLink] = useState('');
  const [token, setToken] = useState('');
  const [resultado, setResultado] = useState('');
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState(null);

  const cargarModales = async () => {
    setCargando(true);
    try {
      setModales(await listarModalInformativos());
      setError('');
    } catch (requestError) {
      setError(mensajeOperacion(requestError, 'No se pudo cargar el historial de modales.'));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarModales();
  }, []);

  useEffect(() => {
    if (uploadRequested.current && novedadesState.status === 'SUCCESS_UPLOAD_IMG' && novedadesState.img) {
      setImagen(novedadesState.img);
      uploadRequested.current = false;
      setError('');
    }
    if (uploadRequested.current && novedadesState.status === 'FAILURE_UPLOAD_IMG') {
      uploadRequested.current = false;
      setError(novedadesState.msg || 'No se pudo subir la imagen.');
    }
  }, [novedadesState.status, novedadesState.img, novedadesState.msg]);

  const validarLink = (valor) => {
    if (!valor.trim()) return true;
    try {
      const url = new URL(valor.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const limpiarFormulario = () => {
    setFormId('');
    setTitulo('');
    setDescripcion('');
    setImagen('');
    setLink('');
    setResultado('');
    setResumen(null);
    setError('');
  };

  const editar = (modal) => {
    setFormId(modal.id);
    setTitulo(modal.titulo);
    setDescripcion(modal.descripcion);
    setImagen(modal.imagen);
    setLink(modal.link);
    setResultado('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prepararPrueba = (modal) => {
    editar(modal);
    setResultado('Modal cargado para enviar una prueba.');
    window.setTimeout(() => document.getElementById('modal-test-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };

  const validarFormulario = () => {
    if (!titulo.trim() || !descripcion.trim()) {
      setError('Completá el título y la descripción.');
      return false;
    }
    if (!validarLink(link)) {
      setError('El link debe comenzar con http:// o https://.');
      return false;
    }
    return true;
  };

  const guardar = async (activar) => {
    if (!validarFormulario()) return;
    setGuardando(true);
    setError('');
    setResultado('');
    try {
      const datos = { id: formId, titulo, descripcion, imagen, link };
      const id = activar ? await guardarYActivarModal(datos) : await guardarBorradorModal(datos);
      setFormId(id);
      setResultado(activar ? 'Modal guardado y activado correctamente.' : 'Borrador guardado correctamente.');
      await cargarModales();
    } catch (requestError) {
      setError(mensajeOperacion(requestError, 'No se pudo guardar el modal.'));
    } finally {
      setGuardando(false);
    }
  };

  const confirmarDesactivacion = (modal) => {
    confirmDialog({
      header: 'Desactivar Modal informativo',
      message: 'La información dejará de estar vigente, pero conservará su historial.',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          await desactivarModal(modal.id);
          if (formId === modal.id) limpiarFormulario();
          setResultado('Modal informativo desactivado.');
          await cargarModales();
        } catch (requestError) {
          setError(mensajeOperacion(requestError, 'No se pudo desactivar el modal.'));
        }
      },
    });
  };

  const confirmarEliminacion = (modal) => {
    confirmDialog({
      header: 'Eliminar Modal informativo',
      message: 'Esta acción eliminará el registro administrativo. ¿Deseás continuar?',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          await eliminarModal(modal.id);
          if (formId === modal.id) limpiarFormulario();
          await cargarModales();
        } catch (requestError) {
          setError(mensajeOperacion(requestError, 'No se pudo eliminar el modal.'));
        }
      },
    });
  };

  const activar = async (modal) => {
    setGuardando(true);
    setError('');
    try {
      await guardarYActivarModal(modal);
      setResultado('Modal informativo activado.');
      await cargarModales();
    } catch (requestError) {
      setError(mensajeOperacion(requestError, 'No se pudo activar el modal.'));
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEnvioMasivo = (modal) => {
    if (!modal?.id) {
      setError('Guardá el modal antes de enviarlo a todos.');
      return;
    }
    confirmDialog({
      header: 'Confirmar envío masivo',
      message: (
        <div className={styles.confirmContent}>
          <p>Esta información será enviada a todos los usuarios con notificaciones habilitadas. ¿Deseás continuar?</p>
          <strong>Título: {modal.titulo}</strong>
          <span>Extracto: {extractoDescripcion(modal.descripcion)}</span>
          <span>Destino: Modal informativo</span>
        </div>
      ),
      acceptLabel: 'Enviar a todos',
      rejectLabel: 'Cancelar',
      accept: async () => {
        setGuardando(true);
        setError('');
        setResultado('');
        setResumen(null);
        try {
          const respuesta = await enviarNotificacionPushMasiva({
            title: 'SiDCa - Tu Sindicato',
            body: 'Tenemos una nueva información para vos.',
            data: {
              type: 'news_modal',
              titulo: modal.titulo,
              descripcion: modal.descripcion,
              imagen: modal.imagen || '',
              link: modal.link || '',
              newsId: modal.id,
            },
          });
          setResumen(respuesta?.estadisticas || null);
          setResultado('Envío masivo del modal completado correctamente.');
        } catch (requestError) {
          setError(mensajeOperacion(requestError, 'No se pudo enviar el modal a todos.'));
        } finally {
          setGuardando(false);
        }
      },
    });
  };

  const seleccionarImagen = (event) => {
    const archivo = event.files?.[0];
    if (!archivo) return;
    if (!ALLOWED_IMAGE_TYPES.includes(archivo.type)) {
      setError('Formato no permitido. Usá imágenes JPG, PNG o WEBP.');
      return;
    }
    if (archivo.size > MAX_IMAGE_SIZE) {
      setError('La imagen no puede superar 1 MB.');
      return;
    }
    setError('');
    uploadRequested.current = true;
    dispatch(uploadImg(archivo));
    event.options?.clear?.();
  };

  const enviarPrueba = () => {
    if (!formId) {
      setError('Guardá el modal antes de enviar una prueba.');
      return;
    }
    const tokenLimpio = token.trim();
    if (!tokenLimpio) {
      setError('Completá el Expo Push Token.');
      return;
    }
    if (!validarFormulario()) {
      return;
    }
    confirmDialog({
      header: 'Enviar modal informativo de prueba',
      message: (
        <div className={styles.confirmContent}>
          <strong>{titulo}</strong>
          <span>{descripcion}</span>
          <p>Esta información se enviará al token indicado de la APP SIDCA.</p>
        </div>
      ),
      acceptLabel: 'Enviar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        setGuardando(true);
        setError('');
        setResultado('');
        try {
          await enviarModalInformativoPrueba({ token: tokenLimpio, titulo, descripcion, imagen, link, newsId: formId });
          setResultado('Notificación de prueba enviada correctamente.');
        } catch (requestError) {
          setError(mensajeOperacion(requestError, 'No se pudo enviar la prueba.'));
        } finally {
          setGuardando(false);
        }
      },
    });
  };

  const modalActivo = modales.find((modal) => modal.estado === 'activo');
  const imagenSubiendo = novedadesState.uploading === true;
  const previewTitulo = titulo.trim() || 'Título de la información';
  const previewDescripcion = descripcion.trim() || 'La descripción aparecerá aquí.';

  return (
    <section className={styles.container} aria-labelledby="modal-informativo-title">
      <header className={styles.header}>
        <div>
          <h2 id="modal-informativo-title">Modal informativo</h2>
          <p>Creá una información destacada para mostrar en la APP SIDCA.</p>
        </div>
        <i className="pi pi-info-circle" aria-hidden="true" />
      </header>

      <section className={styles.activePanel} aria-labelledby="modal-activo-title">
        <h3 id="modal-activo-title">Modal activo</h3>
        {modalActivo ? (
          <div className={styles.activeContent}>
            {modalActivo.imagen ? <img src={modalActivo.imagen} alt="" className={styles.activeImage} /> : <div className={styles.activeImageFallback}><i className="pi pi-image" aria-hidden="true" /></div>}
            <div className={styles.activeDetails}>
              <span className={`${styles.statusBadge} ${styles.statusActive}`}>ACTIVO</span>
              <strong>{modalActivo.titulo}</strong>
              <p>{modalActivo.descripcion}</p>
              <small>Fecha de activación: {formatearFecha(modalActivo.activadoEn)}</small>
            </div>
            <div className={styles.inlineActions}>
              <Button label="Editar" icon="pi pi-pencil" onClick={() => editar(modalActivo)} disabled={guardando} />
              <Button label="Enviar prueba" icon="pi pi-send" severity="secondary" onClick={() => prepararPrueba(modalActivo)} disabled={guardando} />
              <Button label="Enviar a todos" icon="pi pi-users" onClick={() => confirmarEnvioMasivo(modalActivo)} disabled={guardando} />
              <Button label="Desactivar" icon="pi pi-ban" severity="secondary" onClick={() => confirmarDesactivacion(modalActivo)} disabled={guardando} />
            </div>
          </div>
        ) : (
          <div className={styles.activeEmpty}>
            <p>No hay un Modal informativo activo.</p>
            <small>Podés crear uno nuevo o activar uno desde el historial.</small>
          </div>
        )}
      </section>

      <div className={styles.workspace}>
        <section className={styles.card} aria-labelledby="nueva-informacion-title">
          <div className={styles.cardHeader}>
            <h3 id="nueva-informacion-title">{formId ? 'Editar información' : 'Nueva información'}</h3>
            <Button label="Limpiar" icon="pi pi-refresh" className="p-button-text" onClick={limpiarFormulario} disabled={guardando} />
          </div>
          <label className={styles.field} htmlFor="modal-titulo">
            <span>Título*</span>
            <InputText id="modal-titulo" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Información importante" disabled={guardando} />
          </label>
          <label className={styles.field} htmlFor="modal-descripcion">
            <span>Descripción*</span>
            <InputTextarea id="modal-descripcion" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Escribí el contenido que verá el usuario." rows={6} autoResize disabled={guardando} />
            <small>{descripcion.length} caracteres</small>
          </label>
          <div className={styles.field}>
            <span>Imagen opcional</span>
            <FileUpload mode="basic" accept="image/png,image/jpeg,image/webp" maxFileSize={MAX_IMAGE_SIZE} chooseLabel={imagenSubiendo ? 'Subiendo...' : 'Seleccionar imagen'} customUpload uploadHandler={seleccionarImagen} disabled={guardando || imagenSubiendo} auto />
            {imagen && <small className={styles.uploadedImage}>Imagen lista para enviar.</small>}
            {imagenSubiendo && <ProgressBar value={novedadesState.progress || 0} showValue />}
          </div>
          <label className={styles.field} htmlFor="modal-link">
            <span>Link opcional</span>
            <InputText id="modal-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://sidcagremio.com/..." disabled={guardando} />
          </label>
          <div className={styles.formActions}>
            <Button label="Guardar borrador" icon="pi pi-save" severity="secondary" onClick={() => guardar(false)} disabled={guardando || imagenSubiendo} />
            <Button label="Guardar y activar" icon="pi pi-check" onClick={() => guardar(true)} disabled={guardando || imagenSubiendo} />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="preview-title">
          <h3 id="preview-title">Vista previa en la APP</h3>
          <article className={styles.preview}>
            {imagen ? <img src={imagen} alt="Vista previa de la información" className={styles.previewImage} /> : <div className={styles.previewFallback}><i className="pi pi-image" aria-hidden="true" /> Sin imagen</div>}
            <h4>{previewTitulo}</h4>
            <p className={!titulo.trim() ? styles.previewPlaceholder : ''}>{previewDescripcion}</p>
            {link.trim() && validarLink(link) && <span className={styles.previewLink}>VER MÁS <i className="pi pi-external-link" aria-hidden="true" /></span>}
          </article>
        </section>
      </div>

      <section className={styles.card} id="modal-test-section" aria-labelledby="test-title">
        <h3 id="test-title">Enviar prueba</h3>
        <label className={styles.field} htmlFor="modal-expo-token">
          <span>Expo Push Token</span>
          <InputText id="modal-expo-token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="ExponentPushToken[...]" disabled={guardando} autoComplete="off" />
        </label>
        <Button label={guardando ? 'Procesando...' : 'Enviar prueba'} icon={guardando ? undefined : 'pi pi-send'} onClick={enviarPrueba} disabled={guardando || !formId} className={styles.testButton} />
        {error && <p className={styles.error} role="alert">{error}</p>}
        {resultado && <p className={styles.success} role="status">{resultado}</p>}
        {resumen && (
          <div className={styles.summary} role="status">
            <h3>Envío completado</h3>
            <span>Usuarios consultados: {resumen.usuariosConsultados}</span>
            <span>Usuarios con notificaciones: {resumen.usuariosConTokens}</span>
            <span>Tokens válidos: {resumen.tokensValidos}</span>
            <span>Enviados: {resumen.enviados}</span>
            <span>Fallidos: {resumen.fallidos}</span>
            <span>Dispositivos no registrados: {resumen.deviceNotRegistered}</span>
          </div>
        )}
      </section>

      <section className={styles.history} aria-labelledby="history-title">
        <h3 id="history-title">Historial de Modal informativos</h3>
        {cargando ? <p className={styles.muted}>Cargando historial...</p> : !modales.length ? <p className={styles.muted}>Todavía no hay modales guardados.</p> : (
          <div className={styles.historyList}>
            {modales.map((modal) => (
              <article className={styles.historyItem} key={modal.id}>
                <div className={styles.historyInfo}>
                  <strong>{modal.titulo || 'Sin título'}</strong>
                  <span className={`${styles.statusBadge} ${styles[`status${modal.estado[0].toUpperCase()}${modal.estado.slice(1)}`]}`}>{estadoLabel[modal.estado] || modal.estado}</span>
                  <small>Creado: {formatearFecha(modal.creadoEn)} · Actualizado: {formatearFecha(modal.actualizadoEn)}</small>
                </div>
                <div className={styles.historyActions}>
                  <Button label="Editar" icon="pi pi-pencil" onClick={() => editar(modal)} disabled={guardando} />
                  {modal.estado === 'activo' && <Button label="Enviar a todos" icon="pi pi-users" onClick={() => confirmarEnvioMasivo(modal)} disabled={guardando} />}
                  {modal.estado === 'activo' ? <Button label="Desactivar" icon="pi pi-ban" severity="secondary" onClick={() => confirmarDesactivacion(modal)} disabled={guardando} /> : <Button label="Activar" icon="pi pi-check" onClick={() => activar(modal)} disabled={guardando} />}
                  {modal.estado !== 'activo' && <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={() => confirmarEliminacion(modal)} disabled={guardando} />}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
};

export default ModalInformativo;
