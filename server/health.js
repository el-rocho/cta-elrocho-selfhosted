export function createHealthHandler(getDatabase) {
  return async function healthHandler(_req, res) {
    try {
      const db = await getDatabase();
      const result = await db.get('SELECT 1 AS ok');
      if (result?.ok !== 1) throw new Error('Database health check failed');

      return res.json({ status: 'ok' });
    } catch (error) {
      console.error('Error al comprobar la salud del servidor:', error);
      return res.status(503).json({ status: 'unavailable' });
    }
  };
}
