// Live mode: one Snowflake connection as the pack's least-privilege role. Server only.
// Every statement uses bind variables; nothing user-supplied is concatenated into SQL.
import snowflake from 'snowflake-sdk';

snowflake.configure({ logLevel: 'ERROR' });

const pool = new Map<string, Promise<snowflake.Connection>>();

export function isSnowflakeConfigured(): boolean {
  return !!(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USERNAME &&
    (process.env.SNOWFLAKE_PRIVATE_KEY_PATH || process.env.SNOWFLAKE_TOKEN || process.env.SNOWFLAKE_BROWSER_AUTH === 'true'));
}

function config(role: string): snowflake.ConnectionOptions {
  const base: snowflake.ConnectionOptions = {
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USERNAME!,
    role,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? 'QUORVANE_WH',
    database: process.env.SNOWFLAKE_DATABASE ?? 'UNDERWRITING_SUBMISSION_DEMO',
    schema: 'UW',
    clientSessionKeepAlive: true,
  };
  // Key-pair auth is recommended. A programmatic access token or browser SSO also work for local testing.
  if (process.env.SNOWFLAKE_PRIVATE_KEY_PATH) return { ...base, authenticator: 'SNOWFLAKE_JWT', privateKeyPath: process.env.SNOWFLAKE_PRIVATE_KEY_PATH };
  if (process.env.SNOWFLAKE_TOKEN) return { ...base, authenticator: 'PROGRAMMATIC_ACCESS_TOKEN', token: process.env.SNOWFLAKE_TOKEN };
  return { ...base, authenticator: 'EXTERNALBROWSER' };
}

async function connect(role: string): Promise<snowflake.Connection> {
  const conn = snowflake.createConnection(config(role));
  await new Promise<void>((resolve, reject) => {
    const cb = (err: snowflake.SnowflakeError | undefined) => (err ? reject(err) : resolve());
    if (process.env.SNOWFLAKE_BROWSER_AUTH === 'true' && !process.env.SNOWFLAKE_PRIVATE_KEY_PATH && !process.env.SNOWFLAKE_TOKEN) conn.connectAsync(cb);
    else conn.connect(cb);
  });
  // Only the pack role counts: no secondary roles.
  await run(conn, 'USE SECONDARY ROLES NONE');
  return conn;
}

function run<T>(conn: snowflake.Connection, sqlText: string, binds?: snowflake.Binds): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.execute({ sqlText, binds, complete: (err, _s, rows) => (err ? reject(new Error(err.message)) : resolve((rows ?? []) as T[])) });
  });
}

export const ROLE = process.env.SNOWFLAKE_ROLE ?? 'QUORVANE_DEMO_ROLE';

export async function query<T = Record<string, unknown>>(sqlText: string, binds?: snowflake.Binds, role: string = ROLE): Promise<T[]> {
  return queryAs<T>(role, sqlText, binds);
}

async function queryAs<T>(role: string, sqlText: string, binds?: snowflake.Binds): Promise<T[]> {
  let p = pool.get(role);
  if (!p) { p = connect(role); pool.set(role, p); p.catch(() => pool.delete(role)); }
  const conn = await p;
  if (!conn.isUp()) { pool.delete(role); return queryAs<T>(role, sqlText, binds); }
  return run<T>(conn, sqlText, binds);
}
