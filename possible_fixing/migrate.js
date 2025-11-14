// scripts/migrate.js - Migration script to move data from S3 JSON to PostgreSQL
require('dotenv').config();
const { Pool } = require('pg');
const fetch = require('node-fetch'); // You may need to install: npm install node-fetch@2

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const S3_BUCKET_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/data.json';

async function migrateData() {
  console.log('Starting data migration from S3 to PostgreSQL...');
  
  try {
    // Fetch data from S3
    console.log('Fetching data from S3...');
    const response = await fetch(S3_BUCKET_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Found ${data.length} records to migrate`);
    
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Clear existing data (optional - remove this if you want to append)
      console.log('Clearing existing data...');
      await client.query('DELETE FROM responses');
      
      // Prepare insert statement
      const insertQuery = `
        INSERT INTO responses (title, org, url, date, content)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      console.log('Inserting records...');
      let successCount = 0;
      let errorCount = 0;
      
      // Insert data in batches
      const batchSize = 100;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            // Handle date conversion
            let date = null;
            if (record.date && record.date.$date) {
              date = new Date(record.date.$date);
            } else if (record.date) {
              date = new Date(record.date);
            }
            
            await client.query(insertQuery, [
              record.title || null,
              record.org || null,
              record.url || null,
              date,
              record.content || null
            ]);
            
            successCount++;
          } catch (error) {
            console.error(`Error inserting record ${record.title}:`, error.message);
            errorCount++;
          }
        }
        
        console.log(`Processed ${Math.min(i + batchSize, data.length)} / ${data.length} records`);
      }
      
      await client.query('COMMIT');
      
      console.log('\nMigration completed!');
      console.log(`✅ Successfully migrated: ${successCount} records`);
      console.log(`❌ Failed to migrate: ${errorCount} records`);
      
      // Update materialized view
      console.log('Refreshing materialized views...');
      await client.query('REFRESH MATERIALIZED VIEW monthly_stats');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateData();
}

module.exports = { migrateData };