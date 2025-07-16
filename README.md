## Request method sample app

This sample app demonstrates [request method](https://developers-dev.freshworks.com/docs/app-sdk/v3.0/common/advanced-interfaces/request-method/) on Platform version 3.0 in different modules.

### Features

- **Dynamic Host Support**: Demonstrates request method invocation with dynamic host substitution (SMI)
- **Dynamic Query Parameters**: Shows how to use dynamic query parameters in API calls
- **Ticket Filtering**: Filters tickets by status and priority using Freshdesk API
- **Company Contacts**: **NEW** - Lists all contacts for the company associated with the current ticket

| Module | Works in Product |
| ----- | ------- |
| `common` | Common full page app |
| `support_ticket` | Freshdesk |
| `deal` | Freshworks CRM, Freshsales Suite |

### Files and Folders
    .
    ├── README.md                 A file for your future self and developer friends to learn about app
    ├── app                       A folder to place all assets required for frontend components
    │   ├── index.html            A landing page for the user to use the app
    │   ├── scripts               JavaScript to place files frontend components business logic
    │   │   └── app.js
    │   └── styles                A folder to place all the styles for app
    │       ├── images
    │       │   └── icon.svg
    │       └── style.css
    ├── config                    A folder to place all the configuration files
    │   └── iparams.json
    │   └── requests.json
    ├── server                    A folder to place all the configuration files
    │   └── server.js
    └── manifest.json             A JSON file holding meta data for app to run on platform

Explore [more of app sample apps](https://community.developers.freshworks.com/t/freshworks-sample-apps/3604) on the Freshworks github respository.
