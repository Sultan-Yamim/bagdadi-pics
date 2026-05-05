// BagdadiPics - Cloud-native photo manager (CW2)
// Entry point. Loads env, initialises App Insights, mounts API + static frontend.

require('dotenv').config();

// --- Application Insights (advanced service) ---
// Must be required and started BEFORE other modules so it can hook them.
const appInsightsConnStr = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
if (appInsightsConnStr) {
  const appInsights = require('applicationinsights');
  appInsights
    .setup(appInsightsConnStr)
    .setAutoCollectRequests(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true, true)
    .setSendLiveMetrics(true)
    .start();
  console.log('[startup] Application Insights enabled');
} else {
  console.log('[startup] APPLICATIONINSIGHTS_CONNECTION_STRING not set; telemetry disabled');
}

const path = require('path');
const express = require('express');
const photosRouter = require('./routes/photos');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health route - useful for App Service warmup probes and the demo video
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bagdadi-pics', time: new Date().toISOString() });
});

app.use('/api/photos', photosRouter);

// Friendly error handler
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[startup] BagdadiPics listening on port ${port}`);
});
