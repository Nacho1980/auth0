import React, { useEffect, useState } from "react";
import { Col, Container, Row } from "reactstrap";

import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import Highlight from "../components/Highlight";
import Loading from "../components/Loading";

export const ProfileComponent = () => {
  const { user, isAuthenticated, getIdTokenClaims } = useAuth0();
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [hasRequiredRole, setHasRequiredRole] = useState(false);

  // --- Configuration ---
  const requiredRole = process.env.REACT_APP_REQUIRED_ROLE; //"Manager"; // The role required to view this page
  // This namespace MUST match the one used in your Auth0 Login Action
  const rolesClaimNamespace = process.env.REACT_APP_ROLES_CLAIM_NAMESPACE; //"http://schemas.myapp.com/roles";

  useEffect(() => {
    const getUserRoles = async () => {
      // We only need to fetch claims if the user is authenticated
      if (isAuthenticated) {
        console.log("User is authenticated");
        try {
          setLoadingRoles(true);
          // getIdTokenClaims is async
          const claims = await getIdTokenClaims();
          //console.log("ID token claims:", claims);

          // Check if the custom claim exists and is an array
          if (claims && Array.isArray(claims[rolesClaimNamespace])) {
            const userRoles = claims[rolesClaimNamespace];
            //console.log("User roles from claims:", userRoles);
            setRoles(userRoles);
            // Check if the user's roles include the required role
            setHasRequiredRole(userRoles.includes(requiredRole));
          } else {
            // Claim not found or not an array, user has no roles via this claim
            setRoles([]);
            setHasRequiredRole(false);
          }
        } catch (e) {
          console.error("Error getting ID token claims:", e);
          setRoles([]);
          setHasRequiredRole(false);
        } finally {
          setLoadingRoles(false);
        }
      } else {
        console.warn("User is not authenticated");
        // Not authenticated, no roles or access
        setRoles([]);
        setHasRequiredRole(false);
        setLoadingRoles(false);
      }
    };

    // Fetch roles when authentication state changes
    getUserRoles();
  }, [isAuthenticated, getIdTokenClaims, rolesClaimNamespace, requiredRole]);

  return (
    <Container className="mb-5">
      <Row className="align-items-center profile-header mb-5 text-center text-md-left">
        <Col md={2}>
          <img
            src={user.picture}
            alt="Profile"
            className="rounded-circle img-fluid profile-picture mb-3 mb-md-0"
          />
        </Col>
        <Col md>
          <h2>{user.name}</h2>
          <p className="lead text-muted">{user.email}</p>
          {roles.length > 0 && (
            <p className="lead text-muted">
              <b>Roles:</b> {roles.join(", ")}
            </p>
          )}
        </Col>
      </Row>
      <Row>
        <Highlight>{JSON.stringify(user, null, 2)}</Highlight>
      </Row>
    </Container>
  );
};

export default withAuthenticationRequired(ProfileComponent, {
  onRedirecting: () => <Loading />,
});
