# BagdadiPics — CW2 Cloud-Native Photo Manager

A photo asset manager built on Microsoft Azure for CW2.

- **Frontend**: plain HTML/JS gallery with upload, edit, delete
- **Backend**: Node.js + Express REST API (full CRUD)
- **Storage**: Azure Blob Storage for the photo files
- **Database**: Azure Cosmos DB (NoSQL) for metadata
- **Hosting**: Azure App Service
- **CI/CD**: GitHub Actions
- **Advanced service**: Azure Application Insights

---

## How the pieces fit together

```
Browser  ─► Express API  ─►  Cosmos DB (metadata)
                       └─►  Blob Storage (photo files)
                       └─►  App Insights (telemetry)
```

When you upload a photo:
1. Multer captures the file in memory.
2. The file is streamed to Blob Storage and gets a public URL.
3. A metadata document (id, title, description, tags, blobName, blobUrl, createdAt) is written to Cosmos DB.
4. The gallery loads photos from Cosmos and uses each `blobUrl` as the `<img src>`.

Delete is the reverse: read the doc, delete the blob, then delete the doc.

---

## Project structure

```
BagdadiPics/
├── package.json
├── .env.example                # template for local config
├── .gitignore
├── public/
│   └── index.html              # the demo UI
├── src/
│   ├── server.js               # Express bootstrap + App Insights
│   ├── routes/
│   │   └── photos.js           # CRUD routes
│   └── services/
│       ├── blobService.js      # Azure Blob Storage wrapper
│       └── cosmosService.js    # Cosmos DB wrapper
├── .github/
│   └── workflows/
│       └── azure-deploy.yml    # CI/CD to App Service
└── README.md
```

---

## Local setup

You need Node.js 18+ and an Azure account.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template:
   ```bash
   cp .env.example .env
   ```
3. Fill in the values from your Azure resources (see the next section), then run:
   ```bash
   npm start
   ```
4. Open http://localhost:3000

---

## Creating the Azure resources

You can use the Azure Portal (point-and-click) or the Azure CLI. Pick one resource group and put everything in it so it's easy to delete after submission.

### 1. Resource group
- Portal → Resource groups → Create. Name it `bagdadipics-rg`. Pick a region close to you.

### 2. Storage account (Blob)
- Portal → Storage accounts → Create. Put it in `bagdadipics-rg`. Pick a unique name (lowercase, e.g. `bagdadipicsstore01`).
- After creation: open it → **Access keys** → copy the **Connection string**.
- Paste it into `.env` as `AZURE_STORAGE_CONNECTION_STRING`.
- The container `photos` is created automatically by the app on first upload (with public-blob read access so the gallery can render images directly).

### 3. Cosmos DB (NoSQL / Core SQL API)
- Portal → Azure Cosmos DB → Create → **Azure Cosmos DB for NoSQL**.
- Resource group `bagdadipics-rg`, account name e.g. `bagdadipics-cosmos`.
- After creation: open it → **Keys** → copy the **URI** and **PRIMARY KEY**.
- Paste them into `.env` as `COSMOS_ENDPOINT` and `COSMOS_KEY`.
- The database `bagdadipics` and container `photos` are created automatically by the app on first call.

### 4. Application Insights (advanced service)
- Portal → Application Insights → Create. Name it `bagdadipics-insights`. Workspace-based.
- After creation: open it → **Overview** → copy the **Connection String**.
- Paste it into `.env` as `APPLICATIONINSIGHTS_CONNECTION_STRING`.

### 5. App Service (host)
- Portal → App Services → Create → Web App.
- Resource group `bagdadipics-rg`. Name e.g. `bagdadipics-app`.
- Publish: **Code**. Runtime: **Node 18 LTS**. OS: Linux. Plan: B1 or F1.
- After creation: **Configuration → Application settings**. Add the same env vars as in your `.env`:
  - `AZURE_STORAGE_CONNECTION_STRING`
  - `AZURE_STORAGE_CONTAINER` (set to `photos`)
  - `COSMOS_ENDPOINT`
  - `COSMOS_KEY`
  - `COSMOS_DATABASE` (`bagdadipics`)
  - `COSMOS_CONTAINER` (`photos`)
  - `APPLICATIONINSIGHTS_CONNECTION_STRING`
  - `WEBSITE_NODE_DEFAULT_VERSION` = `~18`
- Save and let it restart.

---

## Deploying

You have two options. Show whichever you prefer in the demo video — both meet the brief.

### Option A — Deploy from VS Code (fastest)
1. Install the **Azure App Service** extension in VS Code.
2. Sign in (Cmd+Shift+P → `Azure: Sign In`).
3. Right-click the `BagdadiPics` folder in VS Code → **Deploy to Web App…** → pick `bagdadipics-app`.
4. Wait ~2 minutes. Browse to `https://bagdadipics-app.azurewebsites.net`.

### Option B — GitHub Actions CI/CD (recommended for the rubric)
1. Push the project to a new GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/bagdadi-pics.git
   git push -u origin main
   ```
2. In the Azure Portal, open your App Service → **Get publish profile** (top toolbar). It downloads a `.PublishSettings` file.
3. In GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - Value: paste the entire contents of the `.PublishSettings` file.
4. Open `.github/workflows/azure-deploy.yml` and change `AZURE_WEBAPP_NAME` to your App Service name.
5. Commit and push. The **Actions** tab will show the build + deploy. Done.

---

## REST API

| Method | Path                  | Body                                                | Returns        |
| ------ | --------------------- | --------------------------------------------------- | -------------- |
| POST   | `/api/photos`         | multipart: `photo` (file), `title`, `description`, `tags` | 201 + photo   |
| GET    | `/api/photos`         | —                                                   | 200 + array    |
| GET    | `/api/photos/:id`     | —                                                   | 200 + photo    |
| PUT    | `/api/photos/:id`     | json: `{ title, description, tags }`                | 200 + photo    |
| DELETE | `/api/photos/:id`     | —                                                   | 204 No Content |
| GET    | `/health`             | —                                                   | 200 + status   |

### Quick test with curl
```bash
# Upload
curl -F "photo=@my.jpg" -F "title=My photo" -F "tags=a,b" \
     https://bagdadipics-app.azurewebsites.net/api/photos

# List
curl https://bagdadipics-app.azurewebsites.net/api/photos
```

---

## 5-minute demo video script

This is the order I'd film in to hit every rubric item without going over time.

1. **(0:00–0:30) Intro** — face on camera. "Hi, I'm <name>, this is my CW2 BagdadiPics demo on Azure."
2. **(0:30–1:30) Architecture** — pull up the resource group in the Portal, briefly point at the 4 resources (Storage, Cosmos, App Insights, App Service). One sentence each.
3. **(1:30–3:00) CRUD demo** — open the deployed site, upload a photo, edit its title/tags, delete one. Mention "all metadata went to Cosmos, the file went to Blob Storage."
4. **(3:00–3:45) Show the data in Azure** — Storage Explorer view of the `photos` container, then Cosmos DB Data Explorer showing the same item.
5. **(3:45–4:30) CI/CD** — open GitHub Actions, show a green deploy run.
6. **(4:30–5:00) Advanced — App Insights** — open Live Metrics or Failures, show traffic from your CRUD demo. Wrap up.

Stay under 5 minutes — there's a 10–20% penalty for going over.

---

## Cleaning up

After the deadline and feedback, delete the resource group to avoid charges:
- Portal → Resource groups → `bagdadipics-rg` → Delete.

---

## Notes on cost / access control (rubric mentions both)

- All four resources fit comfortably in Azure's free / student tier. Cosmos has a free 1000 RU/s tier; App Service F1 is free; Storage is pay-per-GB and a demo gallery costs cents.
- Access control: keys are stored as App Service application settings (server-side env vars), never shipped to the browser. The Blob container is set to anonymous-blob-read so URLs can render directly — fine for a public gallery; for private content you'd switch to SAS tokens or a private container with an API proxy.
