import { createStore, applyMiddleware} from 'redux';
import logger from 'redux-logger';
import thunk from 'redux-thunk';
import rootReducer from './rootReducer';

const store = createStore(
    rootReducer,
    process.env.REACT_APP_STATUS == 'development' 
    ? applyMiddleware(thunk, logger)
    : applyMiddleware(thunk)
);

export default store