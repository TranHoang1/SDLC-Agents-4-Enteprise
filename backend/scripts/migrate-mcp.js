/**
 * SA4E-215 — Migration Script.
 * migrates MCP server configuration from orchestration.json to Database.
 * One-time execution. Verifies data integrity after migration.
 * 
 * Usage: node scripts/migrate-mcp.js
 */

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ORCHESTRATION_PATH = './orchestration.json';

/**
 * Schema for a single MCP server entry in orchestration.json
 */
type OrchestrationServer = {
  name: string;
  transport_type: string;
  url?: string;
  command?: string;
  args?: object;
  env?: object;
  disabled?: boolean;
  auto_approve?: object;
  tools?: object;
  project_id?: number;
};

/**
 * Main migration function
 */
async function migrate() {
  console.log('=== SA4E-215 MCP Server Migration ===');
  console.log(`Reading from: ${ORCHESTRATION_PATH}`);

  // Read orchestration.json
  let orchestrationData;
  try {
    orchestrationData = JSON.parse(fs.readFileSync(ORCHESTRATION_PATH, 'utf8'));
    console.log('✓ Successfully read orchestration.json');
  } catch (error) {
    console.error('✗ Failed to read orchestration.json:', error.message);
    process.exit(1);
  }

  const servers: OrchestrationServer[] = orchestrationData.mcpServers || [];
  console.log(`Found ${servers.length} MCP servers in orchestration.json`);

  if (servers.length === 0) {
    console.log('⚠ No MCP servers found in orchestration.json. Nothing to migrate.');
    process.exit(0);
  }

  // Connect to database
  try {
    await prisma.$connect();
    console.log('✓ Database connected');
  } catch (error) {
    console.error('✗ Failed to connect to database:', error.message);
    process.exit(1);
  }

  // Ensure tables exist
  try {
    // Tables should already be created via Prisma schema
    // Just verify they exist by counting
    const serverCount = await prisma.mcp_server.count();
    const projectCount = await prisma.project.count();
    console.log(`✓ Database tables verified - Servers: ${serverCount}, Projects: ${projectCount}`);
  } catch (error) {
    console.error('✗ Database schema verification failed:', error.message);
    process.exit(1);
  }

  // Migration: process each server
  const results = {
    added: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  for (const server of servers) {
    try {
      // Determine project_id (use default or find/create)
      let projectId = server.project_id;
      if (projectId === undefined) {
        // Try to find or create a default project
        const defaultProject = await prisma.project.findFirst({
          where: { name: 'default' },
        });
        projectId = defaultProject?.id || 1;
      }

      // Check if server already exists (by name + project_id)
      const existing = await prisma.mcp_server.findFirst({
        where: { name: server.name, project_id: projectId },
      });

      if (existing) {
        // Update existing server
        await prisma.mcp_server.update({
          where: { id: existing.id },
          data: {
            transport_type: server.transport_type,
            url: server.url,
            command: server.command,
            args: server.args,
            env: server.env,
            disabled: server.disabled ?? false,
            auto_approve: server.auto_approve,
            tools: server.tools,
            updated_at: new Date(),
          },
        });
        results.updated++;
      } else {
        // Create new server
        await prisma.mcp_server.create({
          data: {
            name: server.name,
            project_id: projectId,
            transport_type: server.transport_type,
            url: server.url,
            command: server.command,
            args: server.args,
            env: server.env,
            disabled: server.disabled ?? false,
            auto_approve: server.auto_approve,
            tools: server.tools,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        results.added++;
      }
    } catch (error) {
      results.errors++;
      console.error(`✗ Error migrating server "${server.name}":`, error.message);
    }
  }

  // Generate migration report
  console.log('\n=== Migration Results ===');
  console.log(`Added:   ${results.added}`);
  console.log(`Updated: ${results.updated}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Errors:  ${results.errors}`);
  console.log('========================');

  // Verify data integrity: compare count
  const dbCount = await prisma.mcp_server.count();
  const fileCount = servers.length;
  console.log(`\nDatabase server count: ${dbCount}`);
  console.log(`File server count:     ${fileCount}`);

  if (dbCount === fileCount) {
    console.log('✓ Data integrity verified: Count matches');
  } else {
    console.log('⚠ Data integrity warning: Count mismatch');
  }

  // Disconnect from database
  await prisma.$disconnect();
  console.log('\n=== Migration Complete ===');
}

// Run migration
migrate().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});