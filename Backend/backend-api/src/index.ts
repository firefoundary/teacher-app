import express from 'express';
import cors from 'cors';
import dashboardRoutes from './dashboard-routes.js';
import adminRoutes from './admin-routes.js';

const app = express();


const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http:/127.0.0.1:3000',
      'http://10.158.55.102:8080',
      'http://10.158.55.102:5173',
    ];

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log(`[CORS] CORS allowed: ${origin}`);
      return callback(null, true);
    }

    console.error(`[CORS] BLOCKED: ${origin}`);
    return callback(new Error('CORS blocked'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'org-id'],
  exposedHeaders: ['Content-Type', 'Content-Range', 'X-Content-Range', 'org-id'],
  optionsSuccessStatus: 200,
  maxAge: 86400
};


app.use(cors(corsOptions));


// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);


// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});


// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});


const PORT = parseInt(process.env.PORT || '3000', 10);


app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nBackend running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://0.0.0.0:${PORT}`);
  console.log('\nCORS enabled for:');
  console.log('  - http://localhost:5173');
  console.log('  - http://127.0.0.1:5173');
  console.log('  - http://10.158.55.102:8080');
  console.log('  - http://10.158.55.102:5173');
  console.log('\n');
});