import { combineReducers } from 'redux';
import afiliadoReducer from './reducers/afiliados/reducers';
import asesoramientoReducer from './reducers/asesoramiento/reducers';
import cursosReducer from './reducers/cursos/reducers';
import enlaceReducer from './reducers/enlaces/reducers';
import userReducer from './reducers/user/reducers';

const rootReducer = combineReducers({
    user: userReducer,
    afiliado: afiliadoReducer,
    enlace: enlaceReducer,
    cursos: cursosReducer,
    asesoramiento: asesoramientoReducer,
});

export default rootReducer