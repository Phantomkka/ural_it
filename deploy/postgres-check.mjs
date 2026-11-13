// Run only in the Docker build/check stage, against an isolated test schema.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const url=new URL('postgresql://db:5432/netcity');url.username=process.env.DB_USER??'netcity';url.pathname='/'+(process.env.DB_NAME??'netcity');url.password=(await readFile('/run/secrets/postgres_password','utf8')).trim();
const result=spawnSync(process.execPath,['--import','tsx','--test','apps/server/src/progress.postgres.integration.ts'],{stdio:'inherit',env:{...process.env,TEST_DATABASE_URL:url.toString()}});
process.exitCode=result.status??1;
