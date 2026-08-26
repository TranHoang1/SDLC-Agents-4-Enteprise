/**
 * SA4E-215 — MCP Server CRUD Routes.
 * Implements: FR-001 to FR-013, FR-015 (FSD.md)
 * Routes: GET/POST /api/sa4e-215/mcp-servers, GET/PUT/DELETE /api/sa4e-215/mcp-servers/:id
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Logger } from 'pino';
import { PrismaClient } from '@prisma/client';

export function createMcpServerRoute(prisma: PrismaClient, logger: Logger) {
  const app = new Hono();

  // GET /api/sa4e-215/mcp-servers
  app.get('/', async (c: Context) => {
    const projectId = c.req.query('project_id') ? Number(c.req.query('project_id')) : undefined;
    const page = c.req.query('page') ? Number(c.req.query('page')) : 1;
    const pageSize = c.req.query('page_size') ? Number(c.req.query('page_size')) : 20;

    const where = projectId
      ? { project_id: projectId }
      : {};

    const [servers, total] = await prisma.$transaction([
      prisma.mcp_server.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      prisma.mcp_server.count({ where }),
    ]);

    return c.json({
      success: true,
      data: servers,
      meta: {
        total,
        page,
        page_size: pageSize,
      },
    });
  });

  // GET /api/sa4e-215/mcp-servers/:id
  app.get('/:id', async (c: Context) => {
    const id = Number(c.req.param('id'));

    const server = await prisma.mcp_server.findUnique({
      where: { id },
    });

    if (!server) {
      return c.json(
        { success: false, error: { code: 'ERR_004', message: 'MCP server not found' } },
        404
      );
    }

    return c.json({
      success: true,
      data: server,
    });
  });

  // POST /api/sa4e-215/mcp-servers
  app.post('/', async (c: Context) => {
    const data = await c.req.json();

    // Validate required fields
    if (!data.name || !data.project_id || !data.transport_type) {
      return c.json(
        { success: false, error: { code: 'ERR_001', message: 'name, project_id, transport_type are required' } },
        400
      );
    }

    // Check uniqueness: name must be unique per project_id
    const existing = await prisma.mcp_server.findFirst({
      where: { name: data.name, project_id: data.project_id },
    });

    if (existing) {
      return c.json(
        { success: false, error: { code: 'ERR_001', message: 'Name must be unique per project' } },
        409
      );
    }

    // Use transaction for atomicity
    const server = await prisma.$transaction(async (tx) => {
      return await tx.mcp_server.create({
        data: {
          name: data.name,
          project_id: data.project_id,
          transport_type: data.transport_type,
          url: data.url,
          command: data.command,
          args: data.args || {},
          env: data.env || {},
          disabled: data.disabled ?? false,
          auto_approve: data.auto_approve || {},
          tools: data.tools || {},
        },
      });
    });

    return c.json({
      success: true,
      data: server,
    });
  });

  // PUT /api/sa4e-215/mcp-servers/:id
  app.put('/:id', async (c: Context) => {
    const id = Number(c.req.param('id'));
    const data = await c.req.json();

    // Use transaction for atomicity
    const server = await prisma.$transaction(async (tx) => {
      // Check if server exists
      const existing = await tx.mcp_server.findUnique({
        where: { id },
      });

      if (!existing) {
        return c.json(
          { success: false, error: { code: 'ERR_004', message: 'MCP server not found' } },
          404
        );
      }

      // If updating name, check uniqueness per project
      if (data.name && data.name !== existing.name) {
        const nameExists = await tx.mcp_server.findFirst({
          where: { name: data.name, project_id: data.project_id },
        });

        if (nameExists) {
          return c.json(
            { success: false, error: { code: 'ERR_001', message: 'Name must be unique per project' } },
            409
          );
        }
      }

      // Update server
      const updated = await tx.mcp_server.update({
        where: { id },
        data: {
          name: data.name ?? existing.name,
          project_id: data.project_id ?? existing.project_id,
          transport_type: data.transport_type ?? existing.transport_type,
          url: data.url ?? existing.url,
          command: data.command ?? existing.command,
          args: data.args ?? existing.args,
          env: data.env ?? existing.env,
          disabled: data.disabled ?? existing.disabled,
          auto_approve: data.auto_approve ?? existing.auto_approve,
          tools: data.tools ?? existing.tools,
          updated_at: new Date(),
        },
      });

      return updated;
    });

    return c.json({
      success: true,
      data: server,
    });
  });

  // DELETE /api/sa4e-215/mcp-servers/:id
  app.delete('/:id', async (c: Context) => {
    const id = Number(c.req.param('id'));

    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Soft delete: set disabled=1
      await tx.mcp_server.update({
        where: { id },
        data: { disabled: true, updated_at: new Date() },
      });
    });

    return c.json({
      success: true,
      message: 'MCP server soft-deleted (disabled)',
    });
  });

  return app;
}

export type { createMcpServerRoute };