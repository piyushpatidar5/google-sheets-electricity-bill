# Electricity Bill Management Application

A React application that helps manage electricity readings and bills for tenants, integrating with Google Sheets API for data storage.

[View Demo](https://piyushpatidar5.github.io/google-sheets-electricity-bill)

## Features

- Google OAuth 2.0 authentication
- Submit electricity meter readings
- Automatic calculation of consumption and bills
- Direct integration with Google Sheets
- Dark/Light theme toggle
- Ability to add, update, and delete spreadsheets
- Responsive design

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/piyushpatidar5/google-sheets-electricity-bill.git
cd google-sheets-electricity-bill
npm install
```

### 2. Google Cloud Platform Setup

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Sheets API and Drive API
3. Create OAuth 2.0 credentials (Web application type)
4. Add http://localhost:3000 to the authorized JavaScript origins for local development
5. Add https://piyushpatidar5.github.io to the authorized JavaScript origins for production

### 3. Configure Environment Variables

Create a `.env.local` file in the root of your project with the following variables:

```
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
REACT_APP_GOOGLE_API_KEY=your-api-key
REACT_APP_SPREADSHEET_ID=your-default-spreadsheet-id
```

### 4. Run the Application

```bash
npm start
```

The application will be available at http://localhost:3000.

### 5. Deploy to GitHub Pages

```bash
npm run deploy
```

## Usage

1. Sign in with your Google account
2. Create or select a spreadsheet
3. Enter electricity readings for tenants
4. View the calculated bill details
5. Generate reports based on historical data

## Built With

- React - Front-end framework
- Google Sheets API - Data storage
- Google Drive API - Spreadsheet management
- GitHub Pages - Hosting