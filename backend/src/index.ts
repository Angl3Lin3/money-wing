// Load .env before anything else: route and service modules read
// process.env as soon as they are imported.
import 'dotenv/config';
import app from './app';
import { ensureDevAdmin } from './services/dev-admin.service';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`MoneyWing API server running on port ${PORT}`);
    ensureDevAdmin(); // local developer account from .env, if set
});
