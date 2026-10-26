# ShieldNex Email Deliverability Checker

A web application that checks a list of email addresses and estimates whether each address is likely to be delivered, likely to bounce, or has an unknown delivery status.

The project was developed as part of the Software Development internship task for ShieldNex Aerospace.

## Features

- **Bulk email validation:** Paste multiple email addresses for checking.
- **Syntax validation:** Detect incorrectly formatted email addresses.
- **DNS and MX checks:** Check whether the domain has mail-routing records.
- **Three result categories:** Likely Delivered, Likely Bounce, and Unknown.
- **Result explanations:** Display the reason behind each classification.
- **Search and filtering:** Find addresses and filter results by status.
- **CSV export:** Export checked results for further analysis.
- **Responsive interface:** Use the application on desktop and mobile devices.
- **Privacy-conscious processing:** Email addresses are not intentionally stored in a database.
- **Automated tests:** Test backend behaviour, including validation and DNS-related scenarios.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Node.js, Express |
| Email validation | validator |
| DNS lookup | Node.js DNS APIs |
| API testing | Jest, Supertest |
| Deployment | Render |
| Version control | Git and GitHub |

## How It Works

The application processes each submitted address through the following checks:

1. **Input processing:** Trim whitespace and process the submitted email addresses.
2. **Syntax validation:** Check whether each address follows an acceptable email format.
3. **Domain verification:** Query DNS for the domain's MX records.
4. **Mail-routing fallback:** If MX records are absent, check for applicable A/AAAA records.
5. **Classification:** Assign a result based on the available evidence.
6. **Result presentation:** Return the results to the frontend with an explanation for each address.

### Classification Logic

| Status | Description |
|---|---|
| Likely Delivered | Used only when the available verification evidence supports this classification. It does not guarantee successful delivery. |
| Likely Bounce | Used for clearly invalid addresses or confirmed domains without an applicable mail-routing path. |
| Unknown | Used when mailbox existence cannot be established, DNS checks are inconclusive, or verification is unavailable. |

A valid email format or the presence of MX records does not prove that a particular mailbox exists.

## Getting Started

### Prerequisites

Install the following software:

- Node.js and npm
- Git
- A code editor such as Visual Studio Code

### 1. Clone the Repository

```bash
git clone https://github.com/Sai-Sri-Sashank/shieldnex-email-checker.git
cd shieldnex-email-checker
```

### 2. Install Backend Dependencies

```bash
cd server
npm install
```

### 3. Install Frontend Dependencies

Open a second terminal from the project root, then run:

```bash
cd client
npm install
```

### 4. Start the Backend

From the `server` directory, run:

```bash
npm start
```

The backend uses the port configured in the application. In production, it should listen on the port supplied by the hosting provider.

### 5. Start the Frontend

From the `client` directory, run:

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal.

**Note:** If the frontend and backend use separate local ports, configure the development proxy or API URL according to the project's existing configuration.

## API Documentation

### Health Check

**Endpoint:** `GET /api/health`

Checks whether the backend service is responding.

Example response:

```json
{
  "status": "ok"
}
```

### Check Email Addresses

**Endpoint:** `POST /api/check-emails`

Accepts a list of email addresses and returns a result for each address.

Example request:

```json
{
  "emails": [
    "alice@example.com",
    "invalid-email"
  ]
}
```

The exact request and response schema should match the implementation in `server/index.js`.

Each result should communicate the email address, syntax status, mail-server information, classification, and explanation where those fields are provided by the API.

## Running Tests

From the `server` directory, run:

```bash
npm test
```

The automated tests cover backend validation and API behaviour. DNS-dependent cases should use mocked DNS responses where appropriate so that tests do not depend on live network access.

## Production Build

From the `client` directory, run:

```bash
npm run build
```

Vite generates the production frontend files in `client/dist`.

In production, the Express server serves the built frontend and the API endpoints from the deployed application.

## Deployment

The application is configured for deployment as a Node.js web service on Render.

The deployment process includes:

1. Connecting the GitHub repository to Render.
2. Installing the frontend and backend dependencies.
3. Building the React frontend.
4. Starting the Express backend.
5. Serving the production frontend and API from the deployed service.

The deployment must use the current build and start commands configured for the repository. The service should use the hosting provider's assigned port.

**Live Application:** [https://shieldnex-email-checker-2pst.onrender.com/]

**GitHub Repository:** https://github.com/Sai-Sri-Sashank/shieldnex-email-checker

## Limitations

Email deliverability cannot be guaranteed through syntax validation and DNS/MX lookups alone.

- Syntax validation checks the structure of an address, not mailbox existence.
- MX records identify mail-routing infrastructure, not individual mailboxes.
- Some mail servers conceal recipient validity or reject verification attempts.
- Some hosting providers restrict outbound SMTP connections.
- A mail server may accept a message initially and still generate a later bounce.

When the available evidence is insufficient, the application returns **Unknown** rather than making an unsupported claim.

The application does not send emails to addresses to verify them. Its classifications are estimates and should not be interpreted as guarantees of delivery.

## Privacy and Security

- Email addresses are processed to perform the requested checks.
- The application does not require a user account or database for its core functionality.
- Submitted addresses should not be unnecessarily logged or retained.
- API request limits and input validation help protect the service against excessive or malformed requests.
- Environment variables and credentials must not be committed to the public repository.

## Future Improvements

- Optional integration with a reputable email verification provider.
- Improved DNS caching and retry handling.
- More detailed verification diagnostics.
- Additional automated tests for network failures and edge cases.

## Assignment

**Organization:** ShieldNex Aerospace

**Department:** Software Development

**Project:** Email Deliverability Checker

This project demonstrates frontend and backend development, REST API integration, DNS-based validation, error handling, automated testing, and deployment.

---

**Disclaimer:** This tool estimates email deliverability based on available verification evidence. It cannot guarantee that a mailbox exists or that an email will be successfully delivered.