import { combineReducers } from 'redux';
import afiliadoReducer from './reducers/afiliados/reducers';
import cursosReducer from './reducers/cursos/reducers';
import enlaceReducer from './reducers/enlaces/reducers';
import userReducer from './reducers/user/reducers';

const rootReducer = combineReducers({
    user: userReducer,
    afiliado: afiliadoReducer,
    enlace: enlaceReducer,
    cursos: cursosReducer
});

export default rootReducer