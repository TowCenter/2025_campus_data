# Backend API & Caching Deployment Guide

## Overview
This guide walks you through implementing the complete backend API with database and caching strategy to handle a crap ton of concurrent users.

## Quick Start (Local Development)

### 1. Prerequisites
```bash
# Install Node.js 18+
node --version  # Should be 18+

# Install PostgreSQL
# macOS: brew install postgresql
# Ubuntu: sudo apt install postgresql postgresql-contrib

# Install Redis
# macOS: brew install redis  
# Ubuntu: sudo apt install redis-server
```

### 2. Set Up Database
```bash
# Start PostgreSQL
brew services start postgresql  # macOS

# Create database
createdb university_tracker

# Run schema migration
psql university_tracker < database_schema.sql
```

### 3. Set Up Backend API
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
DATABASE_URL=postgresql://postgres:password@localhost:5432/university_tracker
REDIS_URL=redis://localhost:6379

# Run migration (move data from S3 to database)
npm install node-fetch@2  # Required for migration script
node migrate.js

# Start the server
npm run dev  # Development mode
npm start    # Production mode
```

### 4. Update Frontend
Replace your current `Database.svelte` with `Database-API.svelte` and add this to your `.env`:
```bash
VITE_API_URL=http://localhost:3001/api
```

## Production Deployment Options

### Option 1: Docker Deployment (Recommended)
```bash
# Build and start all services
docker-compose up -d

# Scale API instances for high traffic
docker-compose up --scale api=3 -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Option 2: Cloud Deployment

#### Vercel (Frontend) + Railway (Backend)
```bash
# Deploy backend to Railway
1. Push code to GitHub
2. Connect GitHub repo to Railway
3. Add environment variables in Railway dashboard
4. Deploy automatically

# Deploy frontend to Vercel
1. Connect Svelte app to Vercel
2. Set VITE_API_URL to your Railway API URL
3. Deploy automatically
```

#### AWS Deployment
```bash
# Use AWS ECS for containers
# Use RDS for PostgreSQL
# Use ElastiCache for Redis
# Use CloudFront for CDN
```

## Database Setup Options

### Option 1: Supabase (Recommended for startups)
```javascript
// Free PostgreSQL with 500MB storage
// Built-in connection pooling
// Automatic backups

// .env configuration
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
```

### Option 2: Railway
```JS
// $5/month PostgreSQL
// Easy scaling
// Built-in monitoring

// Automatically provides DATABASE_URL
```

### Option 3: Self-hosted PostgreSQL
```bash
# Install and configure PostgreSQL
# Set up backups and monitoring
# Configure connection pooling with PgBouncer
```

## Redis Cache Setup Options

### Option 1: Upstash (Recommended)
```javascript
// Serverless Redis
// Pay-per-request pricing
// Global edge locations

// .env configuration  
REDIS_URL=redis://:[password]@[host]:[port]
```

### Option 2: Railway Redis
```javascript
// $2/month Redis
// Easy setup
// Good performance
```

### Option 3: AWS ElastiCache
```javascript
// Enterprise-grade caching
// Multiple availability zones
// Automatic failover
```

## Performance Testing

### Load Testing with Artillery
```bash
# Install artillery
npm install -g artillery

# Create test config
cat > load-test.yml << 'EOF'
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120  
      arrivalRate: 50
scenarios:
  - name: "API Load Test"
    requests:
      - get:
          url: "/api/responses?page=1&limit=50"
      - get:
          url: "/api/schools"
EOF

# Run load test
artillery run load-test.yml
```

### Expected Performance
With proper setup, you should see:
- **API Response Time**: <200ms for cached requests
- **Database Queries**: <100ms for indexed queries  
- **Concurrent Users**: 10,000+ with proper scaling
- **Memory Usage**: <100MB per API instance

## Monitoring Setup

### Option 1: Built-in Health Checks
```javascript
// Health check endpoint available at /health
// Monitor with uptime services like:
// - Pingdom
// - StatusCake  
// - UptimeRobot
```

### Option 2: Application Monitoring
```javascript
// Add to your package.json
"dependencies": {
  "@sentry/node": "^7.0.0",
  "newrelic": "^9.0.0"
}

// Initialize in server.js
require('newrelic');
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

## Scaling Strategy

### Horizontal Scaling
```bash
# Scale API instances
docker-compose up --scale api=5 -d

# Use load balancer (nginx)
# Configure multiple app instances
```

### Database Optimization
```sql
-- Add more indexes as needed
CREATE INDEX CONCURRENTLY idx_responses_search 
ON responses USING gin(to_tsvector('english', title || ' ' || content));

-- Monitor slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### Cache Optimization
```javascript
// Implement cache warming
async function warmCache() {
  await fetchWithCache('/api/schools', 24 * 60 * 60 * 1000); // 24h cache
  await fetchWithCache('/api/months', 24 * 60 * 60 * 1000);
}

// Schedule cache warming
setInterval(warmCache, 12 * 60 * 60 * 1000); // Every 12 hours
```

## CDN Setup (Critical for Global Performance)

### Cloudflare (Free)
```javascript
// Add these headers to your API responses
res.set({
  'Cache-Control': 'public, max-age=300', // 5 minutes
  'CDN-Cache-Control': 'max-age=3600',    // 1 hour on CDN
  'Vary': 'Accept-Encoding'
});
```

### AWS CloudFront
```javascript
// Configure CloudFront distribution
// Point to your API origin
// Set up caching rules for different endpoints
```

## Security Considerations

### Rate Limiting
```javascript
// Already included in server.js
// Adjust limits based on your needs
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // requests per window
});
```

### API Security
```javascript
// Add helmet for security headers
app.use(helmet());

// Add API key authentication for admin endpoints
app.use('/api/admin', authenticateApiKey);
```

## Cost Estimates

### Startup Tier (0-10K users/month)
- **Database**: Supabase Free ($0) or Railway ($5/month)
- **Cache**: Upstash Free ($0) or Railway ($2/month)  
- **API Hosting**: Railway ($5/month) or Vercel Pro ($20/month)
- **CDN**: Cloudflare Free ($0)
- **Total**: $0-30/month

### Growth Tier (10K-100K users/month)
- **Database**: Railway ($15/month) or AWS RDS ($50/month)
- **Cache**: Upstash Pro ($10/month) or AWS ElastiCache ($30/month)
- **API Hosting**: Multiple instances ($50-100/month)
- **CDN**: Cloudflare Pro ($20/month)
- **Total**: $125-200/month

### Scale Tier (100K+ users/month)
- **Database**: AWS RDS Multi-AZ ($200+/month)
- **Cache**: AWS ElastiCache cluster ($100+/month)
- **API Hosting**: Auto-scaling group ($200+/month)
- **CDN**: CloudFront ($50+/month)
- **Total**: $550+/month

## Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check Node.js memory usage
node --max-old-space-size=2048 server.js

# Monitor with htop or Activity Monitor
```

#### Slow Database Queries
```sql
-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'responses';

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM responses WHERE org = 'Harvard';
```

#### Cache Issues
```bash
# Check Redis connection
redis-cli ping

# Monitor cache hit rate
redis-cli info stats | grep keyspace
```

## Next Steps

1. **Start with local development** using the provided files
2. **Test with your existing S3 data** using the migration script
3. **Deploy to staging** environment (Railway/Supabase)
4. **Load test** to verify performance improvements
5. **Set up monitoring** and alerts
6. **Deploy to production** with CDN and scaling

The new system should reduce your page load times from 5-10 seconds to under 2 seconds and support thousands of concurrent users instead of hundreds.

## Support

If you run into issues:
1. Check the health endpoint: `GET /health`
2. Review application logs
3. Monitor database performance
4. Check cache hit rates
5. Verify CDN configuration

This implementation will transform your site from a client-side data processing app to a proper scalable web application ready for high traffic.
