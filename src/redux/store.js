import { createStore, applyMiddleware} from 'redux';
import { composeWithDevTools } from 'redux-devtools-extension/developmentOnly';
import logger from 'redux-logger';
import thunk from 'redux-thunk';
import rootReducer from './rootReducer';

const store = createStore(
    rootReducer,
    process.env.REACT_APP_STATUS == 'development' 
    ? composeWithDevTools(applyMiddleware(thunk, logger))
    : applyMiddleware(thunk)
);

export default store