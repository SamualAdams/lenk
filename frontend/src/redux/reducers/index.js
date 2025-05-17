import { combineReducers } from 'redux';
import socialReducer from './socialReducer';
// import other reducers as needed, for example:
// import cognitionReducer from './cognitionReducer';

const rootReducer = combineReducers({
  // cognition: cognitionReducer, // example
  social: socialReducer,
  // add other reducers here
});

export default rootReducer;
