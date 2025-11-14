// server.js - Express.js backend API
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const Redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis cache connection
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redis.connect();

// Cache middleware
const cache = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      
      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data) {
        redis.setEx(key, duration, JSON.stringify(data));
        originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache error:', error);
      next();
    }
  };
};

// API Routes

// Get list of schools with metadata
app.get('/api/schools', cache(3600), async (req, res) => {
  try {
    const query = `
      SELECT 
        org as name,
        COUNT(*) as response_count,
        MIN(date) as first_response,
        MAX(date) as last_response,
        MAX(updated_at) as last_run
      FROM responses 
      WHERE org IS NOT NULL 
      GROUP BY org 
      ORDER BY org
    `;
    
    const result = await pool.query(query);
    
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schools:', error);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

// Get paginated responses with filtering
app.get('/api/responses', cache(300), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      schools,
      months,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;
    const validSortColumns = ['date', 'org', 'title'];
    const validSortOrders = ['asc', 'desc'];
    
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'date';
    const sortDirection = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';
    
    // Build WHERE clause
    const conditions = [];
    const values = [];
    let paramCount = 0;
    
    if (schools) {
      const schoolList = schools.split(',').map(s => s.trim()).filter(Boolean);
      if (schoolList.length > 0) {
        paramCount++;
        conditions.push(`org = ANY($${paramCount})`);
        values.push(schoolList);
      }
    }
    
    if (months) {
      const monthList = months.split(',').map(m => m.trim()).filter(Boolean);
      if (monthList.length > 0) {
        // Convert month names back to date ranges
        const dateConditions = monthList.map(month => {
          const [monthName, year] = month.split(' ');
          const monthNum = new Date(`${monthName} 1, ${year}`).getMonth();
          const startDate = new Date(year, monthNum, 1);
          const endDate = new Date(year, monthNum + 1, 0);
          paramCount += 2;
          return `(date >= $${paramCount - 1} AND date <= $${paramCount})`;
        });
        
        monthList.forEach(month => {
          const [monthName, year] = month.split(' ');
          const monthNum = new Date(`${monthName} 1, ${year}`).getMonth();
          const startDate = new Date(year, monthNum, 1);
          const endDate = new Date(year, monthNum + 1, 0);
          values.push(startDate, endDate);
        });
        
        conditions.push(`(${dateConditions.join(' OR ')})`);
      }
    }
    
    if (search) {
      paramCount++;
      conditions.push(`(
        title ILIKE $${paramCount} OR 
        org ILIKE $${paramCount} OR 
        content ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM responses 
      ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    paramCount += 2;
    const dataQuery = `
      SELECT 
        id, title, org, url, date, content,
        CASE 
          WHEN LENGTH(content) > 250 
          THEN SUBSTRING(content FROM 1 FOR 250) || '...'
          ELSE content 
        END as excerpt
      FROM responses 
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection.toUpperCase()}
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;
    
    values.push(parseInt(limit), offset);
    
    const dataResult = await pool.query(dataQuery, values);
    
    const totalPages = Math.ceil(total / limit);
    
    res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache
    res.json({
      data: dataResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// Export filtered data
app.get('/api/export', async (req, res) => {
  try {
    const {
      schools,
      months,
      search,
      format = 'json'
    } = req.query;
    
    // Build WHERE clause (same logic as /api/responses)
    const conditions = [];
    const values = [];
    let paramCount = 0;
    
    if (schools) {
      const schoolList = schools.split(',').map(s => s.trim()).filter(Boolean);
      if (schoolList.length > 0) {
        paramCount++;
        conditions.push(`org = ANY($${paramCount})`);
        values.push(schoolList);
      }
    }
    
    if (months) {
      const monthList = months.split(',').map(m => m.trim()).filter(Boolean);
      if (monthList.length > 0) {
        const dateConditions = monthList.map(month => {
          const [monthName, year] = month.split(' ');
          const monthNum = new Date(`${monthName} 1, ${year}`).getMonth();
          const startDate = new Date(year, monthNum, 1);
          const endDate = new Date(year, monthNum + 1, 0);
          paramCount += 2;
          return `(date >= $${paramCount - 1} AND date <= $${paramCount})`;
        });
        
        monthList.forEach(month => {
          const [monthName, year] = month.split(' ');
          const monthNum = new Date(`${monthName} 1, ${year}`).getMonth();
          const startDate = new Date(year, monthNum, 1);
          const endDate = new Date(year, monthNum + 1, 0);
          values.push(startDate, endDate);
        });
        
        conditions.push(`(${dateConditions.join(' OR ')})`);
      }
    }
    
    if (search) {
      paramCount++;
      conditions.push(`(
        title ILIKE $${paramCount} OR 
        org ILIKE $${paramCount} OR 
        content ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get all matching records (exclude internal fields)
    const query = `
      SELECT 
        id, title, org, url, date, content
      FROM responses 
      ${whereClause}
      ORDER BY date DESC
    `;
    
    const result = await pool.query(query, values);
    
    if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(result.rows);
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="university_responses_${new Date().toISOString().split('T')[0]}.csv"`
      });
      res.send(csv);
    } else {
      // Return JSON
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="university_responses_${new Date().toISOString().split('T')[0]}.json"`
      });
      res.json(result.rows);
    }
    
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Get unique months for filter dropdown
app.get('/api/months', cache(3600), async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT 
        TO_CHAR(date, 'Month YYYY') as month_year,
        date_trunc('month', date) as month_date
      FROM responses 
      WHERE date IS NOT NULL 
      ORDER BY month_date DESC
    `;
    
    const result = await pool.query(query);
    const months = result.rows.map(row => row.month_year.trim());
    
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    res.json(months);
  } catch (error) {
    console.error('Error fetching months:', error);
    res.status(500).json({ error: 'Failed to fetch months' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Utility function to convert data to CSV
function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;