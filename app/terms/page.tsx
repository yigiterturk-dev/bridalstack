import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { siteBase, siteMetadata } from "@/lib/seo";
import { TRIAL_DAYS } from "@/lib/trial";

export const metadata: Metadata = siteMetadata({
  base: siteBase(),
  path: "/terms",
  title: "Terms",
  description:
    "The terms of using Bridal Stack: what the free plan includes, how the trial and paid modules work, and what each side is responsible for.",
});

export default function Terms() {
  return (
    <LegalPage
      title="Terms of service"
      updated="November 8, 2026"
      intro="Plain terms for using Bridal Stack. If anything here is unclear, ask before you rely on it."
      sections={[
        {
          heading: "The account",
          body: [
            "You need an account to use the product. You are responsible for what happens under it, including anything done by staff you invite. Keep the password to yourself and remove staff who leave.",
            "One account belongs to one business. You may invite as many staff members as your shop needs.",
          ],
        },
        {
          heading: "Free plan, trial and paid modules",
          body: [
            `Every new account opens with a ${TRIAL_DAYS}-day trial of the paid modules. When the trial ends nothing is deleted: the paid modules lock and the free plan keeps running with your records intact.`,
            "Paid modules are billed per module, monthly or yearly, at the prices shown on the pricing page. You can add or remove modules at any time; cancelling one locks its screens at the end of the period you have paid for.",
            "Our order process is conducted by our online reseller Dodo Payments, the merchant of record for all our orders. Dodo Payments handles payment, invoicing, sales tax and refunds on our behalf.",
            "Prices can change. If they do, we will tell you by email before the change applies to your account.",
          ],
        },
        {
          heading: "Your data stays yours",
          body: [
            "The records you enter belong to your business. We store and process them to run the service, and we will provide an export if you ask. See the privacy page for detail.",
            "You are responsible for having the right to store the customer details you enter, and for what you send from the product — booking confirmations, reminders and contracts go out in your shop's name.",
          ],
        },
        {
          heading: "What we do not promise",
          body: [
            "The service is provided as it is. We work to keep it available and correct, but we do not guarantee uninterrupted service, and we are not liable for lost business resulting from downtime, an error in the software, or data entered incorrectly.",
            "Keep your own record of anything you could not afford to lose. Nothing here replaces your own bookkeeping obligations.",
          ],
        },
        {
          heading: "Ending the agreement",
          body: [
            "You can stop using the product at any time; cancelling paid modules stops future charges. Refunds follow the refund policy page. We may close an account that is used to break the law, to send unsolicited mail, or to attack the service — in that case we will tell you and give you a chance to export your data unless doing so would cause further harm.",
          ],
        },
      ]}
    />
  );
}
