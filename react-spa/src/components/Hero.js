import React from "react";

const Hero = () => (
  <div className="hero my-5">
    {/* <img className="mb-3 app-logo" src={logo} alt="React logo" width="120" /> */}
    <h1 className="mb-4 text-center">List of applications</h1>

    <p className="lead mb-4">
      Log in to check a report listing all the applications that are registered
      in the Auth0 tenant and their actions.
    </p>
    <p className="text-center text-green-500 font-weight-bold mb-2">
      Only users with the role "Manager" can access the report.
    </p>

    {/*     <p>
      Based on the React quickstart from Auth0{" "}
      <a href="https://auth0.com/docs/quickstart/spa/react/interactive">
        https://auth0.com/docs/quickstart/spa/react/interactive
      </a>
    </p> */}
  </div>
);

export default Hero;
