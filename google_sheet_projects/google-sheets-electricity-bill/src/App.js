import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import "./App.css";
import Login from "./components/Login";
import ElectricityForm from "./components/ElectricityForm";
import BillDetails from "./components/BillDetails";
import TenantList from "./components/TenantList";
import ThemeToggle from "./components/ThemeToggle";
import Tabs from "./components/Tabs";
import { ThemeContext } from "./components/ThemeContext";
// import BillCalculator from './components/BillCalculator';

// Use environment variables for sensitive information
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const DISCOVERY_DOC =
  "https://sheets.googleapis.com/$discovery/rest?version=v4";
const SCOPES =
  "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";

function App() {
  const { theme } = useContext(ThemeContext);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [billData, setBillData] = useState(null);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [gapiInited, setGapiInited] = useState(false);
  const [gisInited, setGisInited] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [shouldRefreshTable, setShouldRefreshTable] = useState(0);
  const [currentBill, setCurrentBill] = useState(null);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [selectedSpreadsheetId] = useState(SPREADSHEET_ID);

  // Handle authentication errors
  const handleAuthError = useCallback((error) => {
    console.error("Authentication error detected:", error);

    // Check if the error is a 401 UNAUTHENTICATED error
    if (
      error.code === 401 ||
      error.status === "UNAUTHENTICATED" ||
      (error.message && error.message.includes("authentication credentials")) ||
      (typeof error === "string" && error.includes("authentication"))
    ) {
      console.log("Session expired or authentication error, logging out");
      // Clear token and reset auth state
      sessionStorage.removeItem("gapi_token");
      setIsAuthenticated(false);
      setUser(null);
      setBillData(null);

      // Show a user-friendly error message
      setError("Your session has expired. Please sign in again.");

      // Optional: Auto-clear the error message after 5 seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
    } else {
      // For other errors, just set the error message
      setError(error.message || "An error occurred");
    }
  }, []);

  // Fetch user info - define this before initializeGapiClient
  const fetchUserInfo = useCallback(async () => {
    try {
      console.log("Fetching user info");
      const token = window.gapi.client.getToken();

      if (!token || !token.access_token) {
        console.error("No access token available");
        throw new Error("Authentication required. Please sign in.");
      }

      console.log(
        "Token available:",
        token.access_token.substring(0, 10) + "..."
      );

      // Try to use the Google Identity Services to get user info
      try {
        // Load the People API client
        await window.gapi.client.load("oauth2", "v2");
        console.log("OAuth2 API loaded");

        // Use the GAPI client to fetch user info
        const userInfoResponse = await window.gapi.client.oauth2.userinfo.get();
        const userInfo = userInfoResponse.result;

        console.log("User info from GAPI:", userInfo);

        setUser({
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          imageUrl: userInfo.picture,
        });
        return;
      } catch (gApiErr) {
        console.error("Error using GAPI for user info:", gApiErr);
        // Fall back to direct fetch if GAPI method fails
      }

      // Fall back to the userinfo endpoint directly
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        }
      );

      if (!response.ok) {
        console.error(
          "Failed user info response:",
          response.status,
          response.statusText
        );
        const errorData = await response.json().catch(() => ({}));
        console.error("Error data:", errorData);

        if (response.status === 401) {
          throw new Error("Authentication token expired");
        }
        throw new Error(
          `Failed to fetch user info: ${response.status} ${response.statusText}`
        );
      }

      const userInfo = await response.json();
      console.log("User info from direct fetch:", userInfo);

      setUser({
        id: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        imageUrl: userInfo.picture,
      });
    } catch (err) {
      console.error("Error fetching user info:", err);
      handleAuthError(err);
    }
  }, [handleAuthError]);

  // Handle token response - define this before useEffect
  const handleTokenResponse = useCallback(
    (response) => {
      if (response.error) {
        console.error("Token response error:", response);
        handleAuthError({ message: `Authentication error: ${response.error}` });
        return;
      }

      console.log("Token received");
      console.log("Token response:", response);

      // Verify we have the token
      const token = window.gapi.client.getToken();
      if (!token || !token.access_token) {
        console.error("No token received in gapi client");
        handleAuthError({ message: "Failed to receive authentication token" });
        return;
      }

      console.log("Token verified");
      setIsAuthenticated(true);

      // Save token to session storage for persistence
      if (token) {
        sessionStorage.setItem("gapi_token", JSON.stringify(token));
        // Save the timestamp when the token was obtained
        sessionStorage.setItem("gapi_token_timestamp", Date.now().toString());
      }

      // Get user info
      fetchUserInfo();
    },
    [fetchUserInfo, handleAuthError]
  );

  // Initialize the API client
  const initializeGapiClient = useCallback(async () => {
    try {
      console.log("Initializing GAPI client");
      await window.gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });
      console.log("GAPI client initialized");
      setGapiInited(true);

      // Now check if both are initialized
      if (gisInited) {
        console.log("Both GAPI and GIS initialized");
        setIsInitializing(false);
      }

      // Check if we have a token stored in session storage
      const token = sessionStorage.getItem("gapi_token");
      if (token) {
        try {
          const parsedToken = JSON.parse(token);

          // Check if token might be expired (tokens usually last for 1 hour)
          const tokenTimestamp = sessionStorage.getItem("gapi_token_timestamp");
          const now = Date.now();

          if (
            tokenTimestamp &&
            now - parseInt(tokenTimestamp) > 55 * 60 * 1000
          ) {
            console.log(
              "Token likely expired, clearing and requiring re-authentication"
            );
            sessionStorage.removeItem("gapi_token");
            sessionStorage.removeItem("gapi_token_timestamp");
            setIsAuthenticated(false);
            setUser(null);
            return;
          }

          window.gapi.client.setToken(parsedToken);
          console.log("Restored auth token from session storage");
          setIsAuthenticated(true);
          fetchUserInfo();
        } catch (err) {
          console.error("Failed to restore auth token:", err);
          sessionStorage.removeItem("gapi_token");
        }
      }
    } catch (err) {
      console.error("Error initializing GAPI client:", err);
      setError(`Error initializing Google API client: ${err.message}`);
      setIsInitializing(false);
    }
  }, [fetchUserInfo, gisInited]);

  // Add gapi error handler
  useEffect(() => {
    if (window.gapi && window.gapi.client) {
      // Override the gapi.client.request method to catch auth errors
      const originalRequest = window.gapi.client.request;
      window.gapi.client.request = function (args) {
        return originalRequest.call(this, args).then(
          (response) => {
            return response;
          },
          (err) => {
            console.log("GAPI request error:", err);
            // Check if this is an auth error (401)
            if (
              err &&
              (err.status === 401 ||
                (err.result &&
                  err.result.error &&
                  err.result.error.code === 401))
            ) {
              handleAuthError(err.result ? err.result.error : err);
            }
            return Promise.reject(err);
          }
        );
      };
    }
  }, [handleAuthError, isAuthenticated]);

  // Load Google API and Identity Services
  useEffect(() => {
    // Load Google API
    const loadGapi = () => {
      console.log("Loading GAPI");
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.onload = () => {
        console.log("GAPI loaded");
        window.gapi.load("client", initializeGapiClient);
      };
      script.onerror = () => {
        console.error("Error loading GAPI");
        setError("Failed to load Google API");
        setIsInitializing(false);
      };
      document.body.appendChild(script);
    };

    // Load Google Identity Services
    const loadGis = () => {
      console.log("Loading GIS");
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.onload = () => {
        console.log("GIS loaded");
        try {
          // Initialize token client with all necessary OAuth scopes
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            // Request specific scopes needed for both sheets and user info
            scope: SCOPES,
            callback: handleTokenResponse,
            // Always prompt for consent to ensure fresh token with all scopes
            prompt: "consent",
            // This ensures we get back all scopes the user has previously granted
            include_granted_scopes: true,
            // Use popup to avoid page reload issues
            ux_mode: "popup",
          });

          setTokenClient(client);
          setGisInited(true);

          // Check if both are initialized
          if (gapiInited) {
            console.log("Both GAPI and GIS initialized");
            setIsInitializing(false);
          }
        } catch (err) {
          console.error("Error initializing GIS:", err);
          setError(
            `Error initializing Google Identity Services: ${err.message}`
          );
          setIsInitializing(false);
        }
      };
      script.onerror = () => {
        console.error("Error loading GIS");
        setError("Failed to load Google Identity Services");
        setIsInitializing(false);
      };
      document.body.appendChild(script);
    };

    loadGapi();
    loadGis();

    return () => {
      // Cleanup
      document
        .querySelectorAll(
          'script[src="https://apis.google.com/js/api.js"], script[src="https://accounts.google.com/gsi/client"]'
        )
        .forEach(
          (script) => script.parentNode && document.body.removeChild(script)
        );
    };
  }, [initializeGapiClient, gapiInited, handleTokenResponse]);

  // Handle sign in
  const handleSignIn = useCallback(() => {
    console.log("Sign in clicked");
    if (!tokenClient) {
      console.error("Token client not initialized");
      setError("Authentication not ready. Please try again in a moment.");
      return;
    }

    console.log("Starting sign-in flow");

    // Completely clear any existing state
    setError(null);
    setUser(null);
    setIsAuthenticated(false);
    setBillData(null);

    // Clear ALL related items from session storage
    sessionStorage.removeItem("gapi_token");
    sessionStorage.removeItem("gapi_token_timestamp");
    sessionStorage.removeItem("gapi_session");

    try {
      // Reset the GAPI token if exists
      if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken(null);
      }

      // Request a completely new token with all required scopes
      tokenClient.requestAccessToken({
        prompt: "consent",
        include_granted_scopes: true,
      });

      console.log("Token request initiated");
    } catch (err) {
      console.error("Error in sign-in process:", err);
      setError(
        `Authentication error: ${err.message}. Please try refreshing the page.`
      );
    }
  }, [tokenClient]);

  // Handle sign out
  const handleSignOut = useCallback(() => {
    console.log("Sign out clicked");
    const token = window.gapi.client.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        console.log("Token revoked");
        window.gapi.client.setToken(null);
        setIsAuthenticated(false);
        setUser(null);
        setBillData(null);
        // Remove token from session storage
        sessionStorage.removeItem("gapi_token");
      });
    } else {
      setIsAuthenticated(false);
      setUser(null);
      setBillData(null);
      sessionStorage.removeItem("gapi_token");
    }
  }, []);

  // Handle form submission and add a new entry to Google Sheet
  const handleFormSubmit = useCallback(
    async (formData) => {
      try {
        // Special case for clearing bill data (used for "Enter More Readings" functionality)
        if (formData.clearBillData) {
          setShowBillDetails(false);
          return;
        }

        // Special case for auth errors
        if (formData.authError) {
          handleAuthError(formData.authError);
          return;
        }

        // Helper function to parse values and treat empty strings as 0
        const parseValue = (value) => {
          if (value === "" || value === undefined || value === null) return 0;
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        };

        // Calculate units consumed
        const previousReading = parseValue(formData.previousReading);
        const currentReading = parseValue(formData.currentReading);
        const unitsConsumed = currentReading - previousReading;

        // Calculate bill amount
        const costPerUnit = parseValue(formData.costPerUnit);
        let totalBill = unitsConsumed * costPerUnit;

        // Create row data for submission
        const formattedDate = new Date().toISOString().split("T")[0];

        // Default water values
        let waterUnits = 0;
        let waterCost = 0;

        // If form includes water data and is for a family, add the water cost to the bill
        if (formData.includesWater) {
          waterUnits = parseValue(formData.waterUnits);
          waterCost = parseValue(formData.waterCost);

          // Add water cost to total bill
          totalBill += waterCost;

          console.log(`Including water data: ${formData.tenantName}`, {
            waterUnits,
            waterCost,
            rawUnits: formData.waterUnits,
            rawCost: formData.waterCost,
          });
        }

        // Create the values array for Google Sheets
        const values = [
          formData.tenantName,
          previousReading,
          currentReading,
          unitsConsumed,
          costPerUnit,
          totalBill,
          formattedDate,
          waterUnits, // Always include water units (0 if not applicable)
          waterCost, // Always include water cost (0 if not applicable)
        ];

        console.log("Final values for Google Sheets:", values);

        // First, check if we need to initialize the column headers
        try {
          const headersResponse =
            await window.gapi.client.sheets.spreadsheets.values.get({
              spreadsheetId: selectedSpreadsheetId,
              range: "Sheet1!A1:I1",
            });

          const headerValues = headersResponse.result.values || [];

          // If no headers or insufficient columns, add them
          if (headerValues.length === 0 || headerValues[0].length < 9) {
            await window.gapi.client.sheets.spreadsheets.values.update({
              spreadsheetId: selectedSpreadsheetId,
              range: "Sheet1!A1:I1",
              valueInputOption: "RAW",
              resource: {
                values: [
                  [
                    "Tenant Name",
                    "Previous Reading",
                    "Current Reading",
                    "Units Consumed",
                    "Cost per Unit",
                    "Total Bill",
                    "Date",
                    "Water Units",
                    "Water Cost",
                  ],
                ],
              },
            });
          }
        } catch (err) {
          console.warn("Could not check/update headers:", err);
          // Check if this is an auth error
          if (
            err &&
            (err.status === 401 ||
              (err.result && err.result.error && err.result.error.code === 401))
          ) {
            handleAuthError(err.result ? err.result.error : err);
            return;
          }
          // Continue with submission even if header check fails
        }

        // Add the row to Google Sheet
        const response =
          await window.gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: selectedSpreadsheetId,
            range: "Sheet1!A:I", // Ensure the range includes all columns
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            resource: {
              values: [values],
            },
          });

        // Create bill detail object for UI display
        const billDetail = {
          tenantName: formData.tenantName,
          previousReading: formData.previousReading,
          currentReading: formData.currentReading,
          unitsConsumed: unitsConsumed,
          costPerUnit: formData.costPerUnit,
          totalBill: totalBill,
          date: formattedDate,
        };

        // Add water details if applicable
        if (formData.includesWater) {
          billDetail.waterUnits = formData.waterUnits || 0;
          billDetail.waterCost = formData.waterCost || 0;
        } else {
          billDetail.waterUnits = 0;
          billDetail.waterCost = 0;
        }

        setCurrentBill(billDetail);
        setShowBillDetails(true);

        // Update the tenant list to reflect the new data
        setShouldRefreshTable((prev) => prev + 1);

        return response;
      } catch (error) {
        console.error("Error submitting form:", error);

        // Check if this is an auth error
        if (
          error &&
          (error.status === 401 ||
            (error.result &&
              error.result.error &&
              error.result.error.code === 401) ||
            (error.error && error.error.code === 401))
        ) {
          handleAuthError(
            error.result ? error.result.error : error.error || error
          );
        } else {
          alert("Error submitting form. Please try again.");
        }
      } finally {
        // setIsLoading(false);
      }
    },
    [selectedSpreadsheetId, handleAuthError]
  );

  // Handle return to form
  const handleReturnToForm = useCallback(() => {
    setShowBillDetails(false);
  }, []);

  // Create tabs for the main application content
  const renderMainContent = useCallback(() => {
    // Define the tabs
    const mainTabs = [
      {
        label: "Calculate & Save Reading",
        icon: "📝",
        content: (
          <div className="form-section">
            {showBillDetails ? (
              <BillDetails billData={currentBill} onBack={handleReturnToForm} />
            ) : (
              <ElectricityForm
                onSubmit={handleFormSubmit}
                spreadsheetId={selectedSpreadsheetId}
                onAuthError={handleAuthError}
              />
            )}
          </div>
        ),
      },
      {
        label: "Electricity Usage Reports",
        icon: "📊",
        content: (
          <div className="reports-section">
            <TenantList
              spreadsheetId={selectedSpreadsheetId}
              shouldRefresh={shouldRefreshTable}
              onAuthError={handleAuthError}
            />
          </div>
        ),
      },
    ];

    return <Tabs tabs={mainTabs} defaultTab={0} />;
  }, [
    showBillDetails,
    currentBill,
    handleReturnToForm,
    handleFormSubmit,
    selectedSpreadsheetId,
    shouldRefreshTable,
    handleAuthError,
  ]);

  // Memoize the main content rendering to prevent unnecessary re-renders
  const memoizedMainContent = useMemo(
    () => renderMainContent(),
    [renderMainContent]
  );

  // Memoize the rendered content to prevent unnecessary re-renders when theme changes
  const memoizedContent = useMemo(() => {
    return (
      <div className="app-content">
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        {isInitializing ? (
          <div className="loading">Initializing Google API...</div>
        ) : !isAuthenticated ? (
          <Login onSignIn={handleSignIn} />
        ) : (
          memoizedMainContent
        )}
      </div>
    );
  }, [
    error,
    isInitializing,
    isAuthenticated,
    handleSignIn,
    memoizedMainContent,
  ]);

  return (
    <div className="app" data-theme={theme}>
      <div className="app-header">
        <h1>⚡ Electricity Bill Management</h1>
        <div className="header-actions">
          {isAuthenticated && user && (
            <div className="user-info">
              <img
                src={user.imageUrl}
                alt={user.name}
                className="user-avatar"
              />
              <span>{user.name}</span>
              <button onClick={handleSignOut} className="sign-out-btn">
                Sign Out
              </button>
            </div>
          )}
          <ThemeToggle />
        </div>
      </div>

      {memoizedContent}
    </div>
  );
}

export default App;
