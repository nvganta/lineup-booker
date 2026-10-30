import { describe, expect, it } from "vitest";
import { bookingPrompt, bookingProblems, parseBookingEmail, templateBookingEmail, type BookingInput } from "@/lib/book/booking-email";

const input: BookingInput = {
  headliner: "The Paper Gulls",
  opener: "Fern Static",
  venueLabel: "Natural wine bar",
  address: "12 Harbour Row, Port Ellis",
  cityLabel: "Port Ellis",
  neighborhoods: ["Harbour Flats", "Old Mill"],
  styleTags: ["indie folk"],
  rows: [
    { label: "Natural wine", kind: "drink", fans: 30, city: 20 },
    { label: "Burgers", kind: "food", fans: 25, city: 22 },
    { label: "Late night", kind: "late", fans: 18, city: 12 },
  ],
};
const ok = "Hello,\n\nWe'd like to book The Paper Gulls on [date] with Fern Static opening. We can offer [offer].\n\nThanks,\n[owner name]";

describe("booking email checks", () => {
  it("accepts a plain draft", () => {
    expect(bookingProblems("Booking enquiry", ok, input)).toEqual([]);
  });

  it.each([
    ["confirmed", ok.replace("We'd like to book", "We've confirmed")],
    ["a fee", ok.replace("[offer]", "$500")],
    ["a score", ok + "\nTheir fans are in the 90th percentile."],
    ["a contact", ok + "\nmanager@example.com"],
    ["a phone", ok + "\nCall 604-555-0100"],
    ["a dropped placeholder", ok.replace("[date]", "Friday")],
    ["an invented number", ok + "\nAbout 300 fans nearby."],
    ["an invented placeholder", ok.replace("Hello,", "Hello [venue name],")],
    ["a merged row", ok + "\nThe crowd loves late-night burgers."],
    ["a guessed pronoun", ok.replace("We can offer", "His fans live nearby. We can offer")],
  ])("rejects %s", (_, body) => {
    expect(bookingProblems("Booking enquiry", body, input).length).toBeGreaterThan(0);
  });

  it("parses JSON from the model and refuses a bad one", () => {
    expect(parseBookingEmail(JSON.stringify({ subject: "Booking enquiry", body: ok }), input)?.source).toBe("agent");
    expect(parseBookingEmail(JSON.stringify({ subject: "Booked!", body: ok }), input)).toBeNull();
  });

  it("the template passes its own checks", () => {
    const t = templateBookingEmail(input);
    expect(bookingProblems(t.subject, t.body, input)).toEqual([]);
  });

  it("asks the opener to open for the headliner, not to headline", () => {
    const forOpener: BookingInput = { ...input, headliner: "Fern Static", opener: null, openFor: "The Paper Gulls" };
    expect(bookingPrompt(forOpener)).toContain("We want Fern Static to open for The Paper Gulls");
    expect(bookingPrompt(forOpener)).not.toContain("Headliner we want");
    const t = templateBookingEmail(forOpener);
    expect(t.body).toContain("Fern Static to open for The Paper Gulls");
    expect(bookingProblems(t.subject, t.body, forOpener)).toEqual([]);
  });
});
