# Electricity Bill Management Application

This is a React application that helps manage electricity readings and bills for tenants, integrating with Google Sheets API for data storage.

## Features

- Google OAuth 2.0 authentication
- Submit electricity meter readings
- Automatic calculation of consumption and bills
- Direct integration with Google Sheets
- Responsive design

## Important Update

**January 2024**: Google has deprecated the older gapi.auth2 library. This application has been updated to use the new Google Identity Services (GIS) library. If you encounter authentication errors, please use the "Recommended Test (GIS)" page available in the application header.

## Setup Instructions

### 1. Google Sheets Setup

1. Create a new Google Sheet with the following columns:
   - Tenant Name
   - Previous Reading
   - Current Reading
   - Total Units Consumed
   - Electricity Cost per Unit
   - Total Bill
   - Date

2. Note down the Spreadsheet ID from the URL:
   - In `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`, copy the `SPREADSHEET_ID` part.

### 2. Using Your Google API Credentials

1. You already have a credentials file (`client_secret_588609015375-8cbigi7l2tojbd8tgnljen0gm419bv9n.apps.googleusercontent.com.json`). This contains your OAuth 2.0 client ID.

2. You still need to obtain an API Key from the Google Cloud Console:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Select your project
   - Navigate to APIs & Services > Credentials
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key

3. Configure the application environment:
   - Create a `.env` file in the root of the project with the following content:
   ```
   REACT_APP_GOOGLE_CLIENT_ID=588609015375-8cbigi7l2tojbd8tgnljen0gm419bv9n.apps.googleusercontent.com
   REACT_APP_GOOGLE_API_KEY=YOUR_API_KEY
   REACT_APP_SPREADSHEET_ID=YOUR_SPREADSHEET_ID
   ```
   - Replace `YOUR_API_KEY` with the API key you generated
   - Replace `YOUR_SPREADSHEET_ID` with your Google Sheet ID

### 3. Run the Application

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Deployment

1. Build the application for production:
   ```
   npm run build
   ```

2. Deploy the contents of the `build` folder to your preferred hosting service (GitHub Pages, Netlify, Vercel, etc.)

3. Update the authorized JavaScript origins in your Google Developer Console to include your deployed URL.

## Security Considerations

1. In a production environment, it's recommended to use a backend service to handle OAuth tokens securely.

2. The current implementation has API credentials in the client-side code, which is acceptable for personal or internal applications, but not ideal for public-facing production applications.

## License

MIT