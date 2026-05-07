# BagdadiPics

A photo gallery built on Azure. You sign up, upload photos, and they show up in a masonry gallery for everyone to browse. It's the second piece of coursework for my cloud computing module.

Live: `https://bagdadipics-fyfhdxgdfcgkbnft.francecentral-01.azurewebsites.net`

## Stack

- Node.js 18+ / Express
- Plain HTML, CSS, vanilla JS — no framework
- Azure Blob Storage for the image files
- Azure Cosmos DB (NoSQL) for metadata + users
- Azure App Service (Linux, Node 20) for hosting
- Azure Application Insights for telemetry
- Azure Logic Apps for a parallel REST API (5 workflows, full CRUD)
- GitHub Actions for CI/CD

## Architecture

```
              ┌──────────────────────────┐
              │     Browser (HTML/JS)    │
              └────────────┬─────────────┘
                           │ HTTPS
              ┌────────────▼─────────────┐
              │ Express on App Service   │
              │  /api/auth   /api/photos │
              └─────┬──────────────┬─────┘
                    │              │
         ┌──────────▼─┐    ┌───────▼──────┐
         │ Blob       │    │ Cosmos DB    │
         │ Storage    │    │ photos+users │
         └────────────┘    └──────────────┘
                    │
         ┌──────────▼──────────┐
         │ Application Insights│
         └─────────────────────┘
```

A photo upload moves through three resources: Multer parses the multipart request, the file goes to Blob Storage, and a metadata document (id, title, description, tags, location, photographer, dateTaken, blobName, blobUrl, uploadedBy, createdAt) is written to Cosmos. The gallery loads metadata from Cosmos and uses each `blobUrl` straight as an `<img src>`.

Delete is the reverse: read the doc, delete the blob, delete the doc.

## Repo layout

```
.
├── public/
│   └── index.html              # entire frontend (single file)
├── src/
│   ├── server.js               # Express bootstrap + App Insights init
│   ├── middleware/
│   │   └── auth.js             # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js             # signup / login / me
│   │   └── photos.js           # CRUD on photos
│   └── services/
│       ├── blobService.js      # Azure Blob Storage wrapper
│       ├── cosmosService.js    # photos container
│       └── userService.js      # users container
├── .github/
│   └── workflows/
│       └── azure-deploy.yml    # build + deploy to App Service
├── .env.example
├── package.json
└── README.md
```

## Run it locally

```bash
npm install
cp .env.example .env
# fill in the Azure credentials in .env
npm start
```

Open http://localhost:3000.

You need:

- Node 18 or newer
- An Azure subscription with a Storage Account, Cosmos DB (NoSQL API), and Application Insights resource

The `.env.example` lists every variable. The container, database, and individual containers in Cosmos are created on first call, so you don't need to provision them by hand.

## REST API

All routes live under `/api`. Auth-protected routes need an `Authorization: Bearer <token>` header.

| Method | Path                  | Auth   | Notes                           |
| ------ | --------------------- | ------ | ------------------------------- |
| POST   | `/api/auth/signup`    | no     | email, password, firstName, lastName |
| POST   | `/api/auth/login`     | no     | email, password → JWT           |
| GET    | `/api/auth/me`        | yes    | current user                    |
| GET    | `/api/photos`         | no     | list all                        |
| GET    | `/api/photos/:id`     | no     | one                             |
| POST   | `/api/photos`         | yes    | multipart upload                |
| PUT    | `/api/photos/:id`     | yes    | owner only                      |
| DELETE | `/api/photos/:id`     | yes    | owner only                      |
| GET    | `/health`             | no     | warmup probe                    |

Tokens are signed JWTs (HS256), seven-day expiry, secret in `JWT_SECRET`. Passwords are bcrypt-hashed (cost 10).

The owner check on PUT/DELETE compares `req.user.email` against the photo doc's `uploadedBy`. Frontend hides the buttons too, but the server is the actual boundary.

## Logic Apps (parallel REST API)

The brief calls out Logic Apps explicitly, so the same CRUD surface exists as five Consumption-tier workflows:

| Workflow                       | Method | Path           | Action used inside              |
| ------------------------------ | ------ | -------------- | ------------------------------- |
| `bagdadipics-list-logic`       | GET    | `/`            | Query documents V5              |
| `bagdadipics-get-logic`        | GET    | `/photos/{id}` | Query documents V5 (`WHERE c.id =`) |
| `bagdadipics-create-logic`     | POST   | `/`            | Create or update document V3    |
| `bagdadipics-update-logic`     | PUT    | `/photos/{id}` | Compose → upsert (V3)           |
| `bagdadipics-delete-logic`     | DELETE | `/photos/{id}` | Delete a document V2            |

Each workflow has an HTTP trigger that points at the same Cosmos container the Express API uses. The point isn't to replace Express — it's to show the pattern. Logic Apps gives you visual workflow design and built-in connectors; Express gives you fine-grained code control. Both produce the same result against the same data.

## Auth flow

1. POST `/api/auth/signup` with `{ email, firstName, lastName, password }`
2. Server validates, bcrypts the password, writes a doc to the `users` container (id = email)
3. Returns `{ token, user }` — token is a JWT
4. Client stores the token in `localStorage` and sends it as `Authorization: Bearer <token>` on protected requests
5. Login is the same flow without the create step

## Deploy

`.github/workflows/azure-deploy.yml` runs on push to `main`. It:

1. Installs deps with `npm ci --omit=dev`
2. Zips the project
3. Calls `azure/webapps-deploy@v3` with the publish profile (stored in the repo's `AZURE_WEBAPP_PUBLISH_PROFILE` secret)

To wire your own:

1. Create the App Service in the portal, grab its publish profile.
2. Add it as a secret called `AZURE_WEBAPP_PUBLISH_PROFILE` in your fork.
3. Push to `main`. Build runs in ~2 minutes.

## Application settings on App Service

The same env vars from `.env.example` need to exist in App Service → Configuration:

```
AZURE_STORAGE_CONNECTION_STRING
AZURE_STORAGE_CONTAINER=photos
COSMOS_ENDPOINT
COSMOS_KEY
COSMOS_DATABASE=bagdadipics
COSMOS_CONTAINER=photos
APPLICATIONINSIGHTS_CONNECTION_STRING
JWT_SECRET
WEBSITE_NODE_DEFAULT_VERSION=~20
SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

Forgetting `JWT_SECRET` falls back to an insecure dev value with a warning in the log — don't ship without it.

## Cost notes

Everything sits comfortably in free / serverless tiers:

- Cosmos DB: serverless, 1000 RU/s included
- App Service: F1 free tier (limited CPU minutes but fine for a coursework demo)
- Blob Storage: pay-per-GB, the demo's photos cost cents
- Logic Apps Consumption: paid per execution, cents per thousand runs

After submission everything gets deleted from the resource group in one go.

## Access control note

For a public-by-default gallery this works fine. For private content you'd swap the Blob container access from `blob` (anonymous read on individual blobs) to `private` and serve photos through an API endpoint that issues SAS tokens scoped to the requester.

## Things that aren't there on purpose

- No password reset flow (out of scope for the brief)
- No image resizing — uploads go to Blob Storage as-is, capped at 15 MB by Multer
- No background jobs — uploads are synchronous and block the request until both Blob and Cosmos succeed; if the Cosmos write fails after the blob upload you'd get an orphaned blob, which is acceptable for a demo

## Acknowledgements

Coursework brief, lab materials, and Microsoft Learn docs for the Azure SDKs.
