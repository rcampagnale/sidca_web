// src/redux/rootReducer.js
import { combineReducers } from 'redux';

// Reducers “clásicos”
import afiliadoReducer from './reducers/afiliados/reducers';
import asesoramientoReducer from './reducers/asesoramiento/reducers';
import categoriasReducer from './reducers/categorias/reducers';
import cuotasReducer from './reducers/cuotas/reducers';
import cursosReducer from './reducers/cursos/reducers';
import enlaceReducer from './reducers/enlaces/reducers';
import novedadesReducer from './reducers/novedades/reducers';
import transaccionesReducer from './reducers/transacciones/reducers';
import userReducer from './reducers/user/reducers';

// Slice con Redux Toolkit
import afiliadoActualizadoReducer from './reducers/afiliadoActualizado/slice';

const rootReducer = combineReducers({
  user: userReducer,
  afiliado: afiliadoReducer,
  enlace: enlaceReducer,
  cursos: cursosReducer,
  asesoramiento: asesoramientoReducer,
  novedades: novedadesReducer,
  cuotas: cuotasReducer,
  transacciones: transaccionesReducer,
  categorias: categoriasReducer,

  // ⬇️ Nuevo slice RTK
  afiliadoActualizado: afiliadoActualizadoReducer,
});

export default rootReducer;
