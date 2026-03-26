import { Resend } from "resend";
import { SITE_DOMAIN, SITE_NAME } from "./config";

const FROM_EMAIL = `${SITE_NAME} <noreply@${SITE_DOMAIN}>`;

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendApplicationApproved(
  to: string,
  branchName: string
) {
  if (!process.env.RESEND_API_KEY) return;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `You've been accepted to ${branchName}`,
    text: `Congrats! Your application to join ${branchName} on The Master Branch has been approved. You now have member access including traces.\n\nHack on.`,
  });
}

export async function sendNewEvent(
  to: string[],
  branchName: string,
  eventTitle: string,
  eventUrl?: string
) {
  if (!process.env.RESEND_API_KEY || to.length === 0) return;

  await getResend().batch.send(
    to.map((email) => ({
      from: FROM_EMAIL,
      to: email,
      subject: `New event in ${branchName}: ${eventTitle}`,
      text: `A new event has been posted in ${branchName}: ${eventTitle}${eventUrl ? `\n\nRSVP: ${eventUrl}` : ""}`,
    }))
  );
}
