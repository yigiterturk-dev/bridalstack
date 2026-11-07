import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { siteBase, siteMetadata } from "@/lib/seo";

export const metadata: Metadata = siteMetadata({
  base: siteBase(),
  path: "/privacy",
  title: "Privacy",
  description:
    "What data Bridal Stack stores for a bridal boutique, where it is processed, who can see it, and how to have it deleted.",
});

// Metin ürünün gerçekten yaptığı işi anlatır: sağlayıcılar ve saklanan veri
// kodla birlikte değişirse burası da değişmeli.
export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      updated="September 9, 2026"
      intro="Bridal Stack stores the records a bridal shop needs to run: brides, appointments, orders, payments and stock. This page says plainly what is kept, where it runs, and how to get it removed."
      sections={[
        {
          heading: "What we store",
          body: [
            "For the account holder: name, email address and a hashed password. Passwords are never stored in a readable form and cannot be recovered, only reset.",
            "For your customers: whatever your shop enters — name, contact details, appointments, orders, payment records, fitting notes and any photos you upload. This is your data. We process it so the product can show it back to you.",
            "We do not sell data, and we do not use the records inside a shop's workspace to advertise to anyone.",
          ],
        },
        {
          heading: "Where it runs",
          body: [
            "The application and its database run on a server in Nuremberg, Germany (EU). Email is sent through Resend and uploaded images are stored in Vercel Blob, both in the United States. Card payments, when you subscribe to a paid module, are handled by Dodo Payments — card numbers never reach our servers.",
            "Each shop's records are isolated by workspace. Every query is scoped to the workspace of the signed-in user; staff you invite see only your workspace, and only what their role permits.",
          ],
        },
        {
          heading: "Public links",
          body: [
            "Some features produce links that work without a login — an online booking page, a customer portal link, a contract to sign. Those links carry a long random token rather than a guessable id, and they open only the record they were issued for. Treat them the way you would treat a password: anyone holding the link can open that record.",
          ],
        },
        {
          heading: "Deletion and export",
          body: [
            "You can delete individual records at any time from inside the product. To have an entire workspace and everything in it deleted, email hello@bridalstack.com from the account's email address; deletion is permanent and removes the associated customer records too.",
            "If you want a copy of your data before deleting, ask in the same email and we will provide an export.",
          ],
        },
        {
          heading: "Contact",
          body: [
            "Questions about this page, or about data held for a specific bride: hello@bridalstack.com.",
          ],
        },
      ]}
    />
  );
}
