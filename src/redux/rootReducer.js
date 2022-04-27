import { combineReducers } from 'redux';
import afiliadoReducer from './reducers/afiliados/reducers';
import asesoramientoReducer from './reducers/asesoramiento/reducers';
import cuotasReducer from './reducers/cuotas/reducers';
import cursosReducer from './reducers/cursos/reducers';
import enlaceReducer from './reducers/enlaces/reducers';
import novedadesReducer from './reducers/novedades/reducers';
import transaccionesReducer from './reducers/transacciones/reducers';
import userReducer from './reducers/user/reducers';

const rootReducer = combineReducers({
    user: userReducer,
    afiliado: afiliadoReducer,
    enlace: enlaceReducer,
    cursos: cursosReducer,
    asesoramiento: asesoramientoReducer,
    novedades: novedadesReducer,
    cuotas: cuotasReducer,
    transacciones: transaccionesReducer,
});

export default rootReducer