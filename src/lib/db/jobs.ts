import 'server-only';
import { createAdminClient } from './admin';

/** Records a job outcome in job_runs (service role only). Never throws into the job. */
export async function logRun(job: 'readings' | 'bulletin', status: 'ok' | 'error', message: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from('job_runs').insert({ job, status, message });
    if (error) console.error('logRun failed', error.message);
  } catch (e) {
    console.error('logRun failed', e instanceof Error ? e.message : e);
  }
}
