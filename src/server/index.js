import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import wishesRouter from './routes/wishes.js';
import adminRouter from './routes/admin.js';
import usersRouter from './routes/users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', usersRouter);
app.use('/api/wishes', wishesRouter);
app.use('/api/admin', adminRouter);

const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`Wishboard server listening on http://localhost:${PORT}`);
  });
}

export default app;
