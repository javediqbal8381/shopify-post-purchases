import cron from 'node-cron';

/**
 * Background cron jobs for processing delayed cashback emails
 * 
 * This runs inside the Node.js process, so it works:
 * - Locally during development (npm run dev)
 * - On VPS deployment
 * - No external cron setup needed!
 */

// Prevent duplicate cron instances (Vite HMR reloads entry.server.jsx multiple times)
if (globalThis.__cronInitialized) {
  // Already running, skip
} else {
  globalThis.__cronInitialized = true;
  initCron();
}

function initCron() {

// Auto-detect the correct port from environment or use common dev port
const PORT = process.env.PORT || 59060;
const CASHBACK_ENDPOINT = process.env.CASHBACK_ENDPOINT || `http://localhost:${PORT}/api/process-cashback`;

console.log('🕐 Initializing cashback cron jobs...');

// =============================================================================
// TESTING SCHEDULE: Every 1 minute
// =============================================================================
// Uncomment this for testing (checks every minute for pending cashbacks)

cron.schedule('* * * * *', async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n🕐 [${timestamp}] Running cashback cron check...`);
  
  try {
    const response = await fetch(CASHBACK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const result = await response.json();
    
    if (result.processed > 0) {
      console.log(`✅ Processed ${result.succeeded} cashback(s), ${result.failed} failed`);
    } else {
      console.log(`ℹ️  No cashbacks ready to process`);
    }
    
  } catch (error) {
    console.error('❌ Cron job error:', error.message);
  }
});

console.log('✅ Cron job active: Every 1 minute (TESTING MODE)');
console.log('💡 To change to production schedule, edit app/cron.server.js');


// =============================================================================
// PRODUCTION SCHEDULE: Daily at 10:00 AM
// =============================================================================
// Uncomment this for production (runs once daily at 10 AM)

/*
cron.schedule('0 10 * * *', async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n🕐 [${timestamp}] Running daily cashback processing...`);
  
  try {
    const response = await fetch(CASHBACK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const result = await response.json();
    console.log(`✅ Daily run complete: ${result.succeeded} sent, ${result.failed} failed`);
    
  } catch (error) {
    console.error('❌ Daily cron error:', error.message);
  }
});

console.log('✅ Cron job active: Daily at 10:00 AM (PRODUCTION)');
*/


// =============================================================================
// Other Schedule Examples (Uncomment to use)
// =============================================================================

// Every 5 minutes
// cron.schedule('*/5 * * * *', async () => { ... });

// Every hour
// cron.schedule('0 * * * *', async () => { ... });

// Twice daily (6 AM and 6 PM)
// cron.schedule('0 6,18 * * *', async () => { ... });

// Every 6 hours
// cron.schedule('0 */6 * * *', async () => { ... });


} // end initCron

export default cron;
