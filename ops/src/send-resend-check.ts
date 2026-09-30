import { Resend } from 'resend';
import { buildCheckEmail } from './resend-check.ts';

const { RESEND_API_KEY, RESEND_FROM, RESEND_CHECK_TO } = process.env;
if (!RESEND_API_KEY || !RESEND_FROM || !RESEND_CHECK_TO) {
  console.error('Set RESEND_API_KEY, RESEND_FROM and RESEND_CHECK_TO in .env.local');
  process.exit(1);
}

const { data, error } = await new Resend(RESEND_API_KEY).emails.send(buildCheckEmail(RESEND_FROM, RESEND_CHECK_TO));
if (error) {
  console.error(`Resend refused the message: ${error.message}`);
  process.exit(1);
}
console.log(`Sent. Resend id: ${data?.id}. Now check the headers in Gmail (see the plan, Task 9 Step 7).`);
