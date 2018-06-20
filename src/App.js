import "./rxjsImports";
import React from "react";
import { AppRoutes } from "./AppRoutes";
import { Provider } from "react-redux";
import store from "./redux/store";
import { ConnectedRouter, push } from "connected-react-router";
import routerHistory from "./redux/routerHistory.js";
import { withRouter } from "react-router-dom";
import { connect } from "react-redux";

class App extends React.Component {
  state = { isShowApp: false };
  componentDidMount() {
    const { dispatch, location } = this.props;

    if (location.pathname === "/") {
      dispatch(push("/demo")); // go to home page
    }

    // TODO - do something before app start here

    this.setState(() => ({
      isShowApp: true
    }));
  }
  render() {
    const { isShowApp } = this.state;
    return isShowApp ? (
      <div>
        <AppRoutes />
      </div>
    ) : (
      <div>Loading ...</div>
    );
  }
}

App = withRouter(connect()(App));

const ConnectedApp = () => (
  <Provider store={store}>
    <ConnectedRouter history={routerHistory}>
      <App />
    </ConnectedRouter>
  </Provider>
);
export default ConnectedApp;
