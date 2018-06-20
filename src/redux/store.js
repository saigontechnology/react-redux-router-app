import {createStore, applyMiddleware, compose} from 'redux'
import thunk from 'redux-thunk'
import rootReducer from './rootReducer'
import routerHistory from './routerHistory.js';
import { connectRouter, routerMiddleware } from 'connected-react-router';

/**
 *  Redux Store configuration
 */

const middlewares = [
    thunk,
    routerMiddleware(routerHistory)
]

//create store
let store = createStore(connectRouter(routerHistory)(rootReducer), {}, 
	compose(
		applyMiddleware(...middlewares),
		process.env.NODE_ENV === "development" && window.devToolsExtension ? window.devToolsExtension() : f => f
	)
)

export default store;