import { z } from "zod";
import { phonePattern } from "./booking";

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name")
    .max(80, "Please keep your name under 80 characters"),
  email: z
    .string()
    .trim()
    .max(254, "That email is too long")
    .pipe(z.email("Please enter a valid email address")),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || phonePattern.test(v), "Please enter a valid phone number"),
  message: z
    .string()
    .trim()
    .min(10, "Please write a little more")
    .max(2000, "Please keep your message under 2,000 characters"),
});

export type ContactInput = z.infer<typeof contactSchema>;
