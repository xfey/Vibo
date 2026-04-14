import { bootstrapApplication } from '@main/app/bootstrap';

void bootstrapApplication().catch((error) => {
  console.error('Failed to bootstrap Vibo.', error);
});
