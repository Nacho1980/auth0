import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import axios from "axios";
import React, { useEffect, useState } from "react";
import Loading from "../components/Loading"; // Your loading component
import { getConfig } from "../config";

const config = getConfig();
const ReportPage = () => {
  const { getAccessTokenSilently, isAuthenticated, getIdTokenClaims } =
    useAuth0();

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [isManager, setIsManager] = useState(false);

  // --- Configuration ---
  const requiredRole = process.env.REACT_APP_REQUIRED_ROLE; //"Manager"; // The role required to view this page
  // This namespace MUST match the one used in your Auth0 Login Action
  const rolesClaimNamespace = process.env.REACT_APP_ROLES_CLAIM_NAMESPACE; //"http://schemas.myapp.com/roles";

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Get the access token for YOUR backend API
        // The audience here must match AUTH0_AUDIENCE_YOUR_API in your backend .env
        const audience = config.audience; //process.env.REACT_APP_AUTH0_AUDIENCE; // Ensure your React app loads this env var
        if (!audience) {
          throw new Error("REACT_APP_AUTH0_AUDIENCE is not set.");
        }

        const accessToken = await getAccessTokenSilently({
          authorizationParams: {
            audience: audience,
            // If you need specific scopes for this backend endpoint, add them here
            // scope: 'read:reports',
          },
        });
        //console.log("Access Token:", accessToken); // For debugging

        // 2. Call your backend endpoint
        const response = await axios.get("/api/report/applications-actions", {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Include the user's token for backend authentication
          },
        });

        // 4. Handle backend response (check for 403 Forbidden or other errors)
        if (response.status === 200) {
          setIsManager(true);
          const result = response.data;
          setReportData(result);
        }
        //console.log("Backend response:", response); // For debugging
      } catch (err) {
        if (err.status === 403) {
          // This handles the case where the backend denied access (e.g., role check failed)
          setError(
            new Error("Access Denied: You do not have the Manager role.")
          );
          setLoading(false);
          setIsManager(false);
          return; // Stop processing
        } else {
          console.error("Error fetching report data:", err);
          setError(err);
        }
        // If the error was due to not being authenticated, the HOC will redirect
      } finally {
        setLoading(false);
      }
    };

    // Fetch data only if authenticated (ProtectedRoute handles the initial check)
    // The role check inside useEffect prevents fetching if not Manager
    if (isAuthenticated) {
      fetchReportData();
    }
  }, [
    isAuthenticated,
    getAccessTokenSilently,
    getIdTokenClaims,
    rolesClaimNamespace,
    requiredRole,
  ]); // Dependencies

  // --- Conditional Rendering based on Loading, Error, and Role ---

  if (loading) {
    return <Loading />;
  }

  if (error) {
    // Handle specific error messages, e.g., Access Denied
    return (
      <div>
        <h2>Error</h2>
        <p>{error.message}</p>
        {/* Optionally show roles if available and denied access */}
        {!isManager && userRoles.length > 0 && (
          <p>Your roles: {userRoles.join(", ")}</p>
        )}
      </div>
    );
  }

  // If authenticated but not Manager (handled here and by backend 403)
  if (isAuthenticated && !isManager && !loading) {
    return (
      <div>
        <h2>Access Denied</h2>
        <p>
          You do not have the necessary role ("{requiredRole}") to view this
          report.
        </p>
        {userRoles.length > 0 && <p>Your roles: {userRoles.join(", ")}</p>}
      </div>
    );
  }

  // If authenticated AND is Manager AND data is loaded successfully
  //console.log(`Report Data:`, reportData); // For debugging
  if (isAuthenticated && isManager && reportData) {
    return (
      <div>
        <h3>Applications</h3>
        {reportData.applications && reportData.applications.length > 0 ? (
          <table className={"table-of-apps mb-2"}>
            <thead>
              <tr>
                <th>Application (id)</th>
                <th>Actions (type)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.applications.map((app) => (
                <tr key={app.client_id}>
                  <td>
                    <strong>{app.name}</strong> ({app.client_id})
                  </td>
                  <td>
                    {app.app_actions.map((action) => (
                      <span key={action.id}>
                        {action.name} (
                        {action.triggers &&
                          action.triggers.length > 0 &&
                          action.triggers[0]}
                        )
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No applications found.</p>
        )}
      </div>
    );
  }

  // Default state if not authenticated or other unexpected state
  return <Loading />;
};

// Wrap the component with the HOC to ensure authentication first
export default withAuthenticationRequired(ReportPage, {
  onRedirecting: () => <Loading />,
});
