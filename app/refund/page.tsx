import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { siteBase, siteMetadata } from "@/lib/seo";
import { TRIAL_DAYS } from "@/lib/trial";

export const metadata: Metadata = siteMetadata({
  base: siteBase(),
  path: "/refund",
  title: "Refund policy",
  description:
    "How cancellations and refunds work for Bridal Stack paid modules: the free trial, cancelling a subscription, and when a charge is refunded.",
});

export default function Refund() {
  return (
    <LegalPage
      title="Refund and cancellation policy"
      updated="November 8, 2026"
      intro="How cancelling works, and when we refund a charge. If your situation is not covered here, write to us before you open a dispute with your bank."
      sections={[
        {
          heading: "Try before you pay",
          body: [
            `The free plan costs nothing, and every new account gets a ${TRIAL_DAYS}-day trial of the paid modules without a card. You are only charged once you choose to subscribe to a module, so you can judge the product before any money changes hands.`,
          ],
        },
        {
          heading: "Cancelling a subscription",
          body: [
            "Each paid module is its own subscription. You can cancel any of them at any time from Settings, through the billing portal. A cancelled module stays unlocked until the end of the period you have already paid for, then it is not renewed and you are not charged again.",
            "Cancelling never deletes your records. The module's screens lock, and the data reappears if you subscribe again.",
          ],
        },
        {
          heading: "When we refund",
          body: [
            "We refund in full any charge made in error: a duplicate charge, a renewal that went through after you had cancelled, or a charge for a module you did not subscribe to.",
            "We also refund if a paid module could not be used for reasons on our side and we were not able to fix it after you reported it.",
          ],
        },
        {
          heading: "When we do not refund",
          body: [
            "Outside the cases above, a billing period that has already started is not refunded, in full or in part. This applies to monthly and yearly subscriptions alike: cancelling stops the next charge, it does not return the current one.",
          ],
        },
        {
          heading: "How to request a refund",
          body: [
            "Email hello@bridalstack.com from the address on your account, with the date and amount of the charge. We reply by email and tell you what we decided.",
            "Payments for Bridal Stack are processed by Dodo Payments, our merchant of record. Approved refunds are issued through Dodo Payments to the card or payment method you paid with; how long the money takes to appear depends on your bank.",
          ],
        },
      ]}
    />
  );
}
