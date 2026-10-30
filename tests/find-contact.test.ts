import { describe, expect, it } from "vitest";
import { contactPageLinks, extractEmails, isForTheAct } from "@/lib/book/find-contact";
import { dmText } from "@/components/reach-map";

const site = "https://someact.com/";

describe("finding how to reach an act", () => {
  it("labels addresses by what they're for, booking first, and skips the noise", () => {
    const html = `
      <p>Press: press@someact.com</p>
      <p>For live bookings contact <a href="mailto:jo@bigagency.com">Jo</a></p>
      <p>Management: team@someact-mgmt.com</p>
      <p>hello [at] someact [dot] com</p>
      <img src="logo@2x.png"> <a href="mailto:noreply@someact.com">x</a>`;
    expect(extractEmails(html, site).map((e) => `${e.kind}:${e.address}`)).toEqual([
      "booking:jo@bigagency.com",
      "management:team@someact-mgmt.com",
      "general:hello@someact.com",
    ]);
  });

  it("keeps a general inbox only on the act's own domain or contact page", () => {
    const label = { address: "info@biglabel.com", kind: "general" as const, source: site };
    expect(isForTheAct(label, site)).toBe(false);
    expect(isForTheAct({ ...label, source: "https://someact.com/contact" }, site)).toBe(true);
    expect(isForTheAct({ ...label, address: "hi@someact.com" }, site)).toBe(true);
    expect(isForTheAct({ ...label, kind: "booking" }, site)).toBe(true);
  });

  it("finds contact pages on the same site only", () => {
    const html = `<a href="/contact">Contact</a><a href="https://other.com/booking">Book</a><a href="/shop">Shop</a>`;
    expect(contactPageLinks(html, site)).toEqual(["https://someact.com/contact"]);
  });

  it("writes a DM that asks the opener to open, with no pronouns", () => {
    const dm = dmText({
      headliner: "Fern Static",
      opener: null,
      openFor: "The Paper Gulls",
      venueLabel: "Natural wine bar, 80 seats",
      address: "12 Harbour Row",
      cityLabel: "Port Ellis",
      neighborhoods: [],
      styleTags: ["indie folk"],
      rows: [],
    });
    expect(dm).toBe(
      "Hi Fern Static, I run a natural wine bar in Port Ellis where the regulars love indie folk. We'd love to have you open for The Paper Gulls on [date]. Who's the best person to talk to about booking? Thanks, [owner name]",
    );
  });
});
