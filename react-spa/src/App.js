import React from "react";
import { Route, Router, Switch } from "react-router-dom";
import { Container } from "reactstrap";

import { useAuth0 } from "@auth0/auth0-react";
import Footer from "./components/Footer";
import Loading from "./components/Loading";
import NavBar from "./components/NavBar";
import history from "./utils/history";
import ExternalApi from "./views/ExternalApi";
import Home from "./views/Home";
import Profile from "./views/Profile";
import ReportPage from "./views/ReportPage";

// styles
import "./App.css";

// fontawesome
import initFontAwesome from "./utils/initFontAwesome";
initFontAwesome();

const App = () => {
  const { isLoading, error } = useAuth0();

  if (error) {
    return <div>Oops... {error.message}</div>;
  }

  if (isLoading) {
    return <Loading />;
  }

  return (
    <Router history={history}>
      <div id="app" className="d-flex flex-column h-100">
        <NavBar />
        <Container className="flex-grow-1 mt-5">
          <Switch>
            <Route path="/" exact component={Home} />
            <Route path="/profile" component={Profile} />
            <Route path="/external-api" component={ExternalApi} />
            <Route path="/report" component={ReportPage} />
          </Switch>
        </Container>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
