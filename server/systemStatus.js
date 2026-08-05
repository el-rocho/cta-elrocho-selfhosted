import fs from 'fs';
import os from 'os';

const ACTIVITY_WINDOW_MS = 60_000;
const ACTIVITY_RETENTION_MS = 5 * 60_000;

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentage(used, total) {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return null;
  return round(Math.min(100, Math.max(0, (used / total) * 100)));
}

function contentLength(headers) {
  const value = Number(headers?.['content-length']);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function createApiActivityMonitor(now = () => Date.now()) {
  let samples = [];

  const prune = (timestamp) => {
    const oldestAllowed = timestamp - ACTIVITY_RETENTION_MS;
    samples = samples.filter((sample) => sample.finishedAt >= oldestAllowed);
  };

  return {
    middleware(req, res, next) {
      const startedAt = now();
      const receivedBytes = contentLength(req.headers);

      res.on('finish', () => {
        const finishedAt = now();
        samples.push({
          finishedAt,
          durationMs: Math.max(0, finishedAt - startedAt),
          receivedBytes,
          sentBytes: contentLength(res.getHeaders?.() || {}),
        });
        prune(finishedAt);
      });

      next();
    },

    snapshot() {
      const timestamp = now();
      prune(timestamp);
      const recent = samples.filter((sample) => sample.finishedAt >= timestamp - ACTIVITY_WINDOW_MS);
      const totalDuration = recent.reduce((sum, sample) => sum + sample.durationMs, 0);

      return {
        requestsLastMinute: recent.length,
        averageResponseTimeMs: recent.length ? round(totalDuration / recent.length) : 0,
        receivedBytesLastMinute: recent.reduce((sum, sample) => sum + sample.receivedBytes, 0),
        sentBytesLastMinute: recent.reduce((sum, sample) => sum + sample.sentBytes, 0),
      };
    },
  };
}

export function createProcessCpuSampler() {
  let previousUsage = process.cpuUsage();
  let previousTime = process.hrtime.bigint();

  return function sampleProcessCpu() {
    const currentTime = process.hrtime.bigint();
    const elapsedMicroseconds = Number(currentTime - previousTime) / 1_000;
    const currentUsage = process.cpuUsage();
    const usage = {
      user: currentUsage.user - previousUsage.user,
      system: currentUsage.system - previousUsage.system,
    };
    previousUsage = currentUsage;
    previousTime = currentTime;

    if (elapsedMicroseconds <= 0) return null;
    const usedMicroseconds = usage.user + usage.system;
    const logicalCores = Math.max(1, os.cpus().length);
    return {
      scope: 'process',
      usagePercent: round(Math.min(logicalCores * 100, (usedMicroseconds / elapsedMicroseconds) * 100)),
      logicalCores,
    };
  };
}

async function readFirstAvailable(paths) {
  for (const candidate of paths) {
    try {
      return (await fs.promises.readFile(candidate, 'utf8')).trim();
    } catch {
      // El archivo depende de la versión de cgroups disponible en el contenedor.
    }
  }
  return null;
}

export async function readMemoryStats() {
  const processMemory = process.memoryUsage();
  const usedRaw = await readFirstAvailable([
    '/sys/fs/cgroup/memory.current',
    '/sys/fs/cgroup/memory/memory.usage_in_bytes',
  ]);
  const limitRaw = await readFirstAvailable([
    '/sys/fs/cgroup/memory.max',
    '/sys/fs/cgroup/memory/memory.limit_in_bytes',
  ]);
  const containerUsed = Number(usedRaw);
  const containerLimit = limitRaw === 'max' ? NaN : Number(limitRaw);
  const hasContainerLimit = Number.isFinite(containerUsed)
    && Number.isFinite(containerLimit)
    && containerLimit > 0
    && containerLimit < Number.MAX_SAFE_INTEGER;

  return {
    scope: hasContainerLimit ? 'container' : 'process',
    usedBytes: hasContainerLimit ? containerUsed : processMemory.rss,
    limitBytes: hasContainerLimit ? containerLimit : null,
    usagePercent: hasContainerLimit ? percentage(containerUsed, containerLimit) : null,
    processRssBytes: processMemory.rss,
    heapUsedBytes: processMemory.heapUsed,
    heapTotalBytes: processMemory.heapTotal,
  };
}

export async function readDiskStats(dataDir) {
  const stats = await fs.promises.statfs(dataDir);
  const totalBytes = Number(stats.blocks) * Number(stats.bsize);
  const freeBytes = Number(stats.bavail) * Number(stats.bsize);
  const usedBytes = Math.max(0, totalBytes - freeBytes);

  return {
    scope: 'dataVolume',
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: percentage(usedBytes, totalBytes),
  };
}

export async function readDatabaseSize(databasePath) {
  const files = [databasePath, `${databasePath}-wal`, `${databasePath}-shm`];
  const sizes = await Promise.all(files.map(async (filePath) => {
    try {
      return (await fs.promises.stat(filePath)).size;
    } catch (error) {
      if (error?.code === 'ENOENT') return 0;
      throw error;
    }
  }));
  return sizes.reduce((sum, size) => sum + size, 0);
}

function settledValue(result) {
  return result.status === 'fulfilled' ? result.value : null;
}

export function createSystemStatusHandler({
  getDatabase,
  dataDir,
  databasePath,
  appVersion,
  apiActivity,
  sampleCpu = createProcessCpuSampler(),
  getMemoryStats = readMemoryStats,
  getDiskStats = readDiskStats,
  getDatabaseSize = readDatabaseSize,
  getUptime = () => process.uptime(),
  now = () => new Date(),
}) {
  return async function systemStatusHandler(_req, res) {
    try {
      const dbStartedAt = process.hrtime.bigint();
      const db = await getDatabase();
      const result = await db.get('SELECT 1 AS ok');
      if (result?.ok !== 1) throw new Error('Database status check failed');
      const databaseResponseTimeMs = round(Number(process.hrtime.bigint() - dbStartedAt) / 1_000_000);

      const backup = await db.get(`
        SELECT
          MAX(last_backup_timestamp) AS lastBackupTimestamp,
          MAX(last_full_backup_timestamp) AS lastFullBackupTimestamp
        FROM settings
      `);

      const [memoryResult, diskResult, databaseSizeResult] = await Promise.allSettled([
        getMemoryStats(),
        getDiskStats(dataDir),
        getDatabaseSize(databasePath),
      ]);

      return res.json({
        status: 'ok',
        checkedAt: now().toISOString(),
        version: appVersion,
        uptimeSeconds: Math.max(0, Math.floor(getUptime())),
        database: {
          status: 'ok',
          responseTimeMs: databaseResponseTimeMs,
          sizeBytes: settledValue(databaseSizeResult),
        },
        cpu: sampleCpu(),
        memory: settledValue(memoryResult),
        disk: settledValue(diskResult),
        api: apiActivity.snapshot(),
        backup: {
          lastAt: backup?.lastBackupTimestamp || null,
          lastFullAt: backup?.lastFullBackupTimestamp || null,
        },
      });
    } catch (error) {
      console.error('Error al obtener el estado detallado del servidor:', error);
      return res.status(503).json({ error: 'No se pudo obtener el estado detallado del servidor.' });
    }
  };
}
