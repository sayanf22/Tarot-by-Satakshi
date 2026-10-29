import { z } from "zod";

// Shared by the booking form and (later) the Worker, so both validate the same way.

export const topics = [
  { value: "love", label: "Love & relationships" },
  { value: "career", label: "Career" },
  { value: "money", label: "Money & business" },
  { value: "family", label: "Family" },
  { value: "health", label: "Health & wellbeing" },
  { value: "spiritual", label: "Spiritual growth" },
  { value: "general", label: "General reading" },
] as const;

const topicValues = ["love", "career", "money", "family", "health", "spiritual", "general"] as const;
export type Topic = (typeof topicValues)[number];

export const phonePattern = /^\+?[0-9][0-9\s-]{7,15}$/;

const detailsBase = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(80, "Please keep your name under 80 characters"),
  email: z
    .string()
    .trim()
    .max(254, "That email is too long")
    .pipe(z.email("Please enter a valid email address")),
  phone: z
    .string()
    .trim()
    .regex(phonePattern, "Please enter a valid number, with country code for numbers outside India"),
  topic: z.enum(topicValues, { error: "Please choose a topic" }),
  question: z.string().trim().max(1000, "Please keep your question under 1,000 characters"),
  birthDate: z.string().trim(),
  birthTime: z.string().trim(),
  birthTimeUnknown: z.boolean(),
  birthTimeApprox: z.string().trim().max(80, "Please keep this short"),
  birthPlace: z.string().trim().max(120, "Please keep this under 120 characters"),
});

export type BookingDetails = z.infer<typeof detailsBase>;

/** Today's date as YYYY-MM-DD in the visitor's local time. */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Astrology readings also need birth details. */
export function detailsSchema(needsBirthDetails: boolean) {
  return detailsBase.superRefine((v, ctx) => {
    if (!needsBirthDetails) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.birthDate)) {
      ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Please enter your date of birth" });
    } else if (v.birthDate > todayIso()) {
      ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Date of birth can't be in the future" });
    }
    if (!v.birthTimeUnknown && !/^\d{2}:\d{2}$/.test(v.birthTime)) {
      ctx.addIssue({
        code: "custom",
        path: ["birthTime"],
        message: "Please enter your birth time, or tick \u201cI don't know my exact time\u201d",
      });
    }
    if (v.birthPlace.length < 2) {
      ctx.addIssue({ code: "custom", path: ["birthPlace"], message: "Please enter your place of birth" });
    }
  });
}

export function topicLabel(value: Topic) {
  return topics.find((t) => t.value === value)?.label ?? value;
}
