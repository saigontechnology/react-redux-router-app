import { combineReducers } from 'redux';
import * as demo from '../modules/demo';
/**
 * This place is to register all reducers of the app.
 */

export default combineReducers({
  demo: demo.demoReducer
});
