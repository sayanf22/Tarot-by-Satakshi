import type { Topic } from "@/lib/validation/booking";

// The topics on the booking form Satakshi approved.
export const topicCards: ReadonlyArray<{ value: Topic; title: string }> = [
  { value: "love", title: "Love & relationships" },
  { value: "career", title: "Career" },
  { value: "money", title: "Money & business" },
  { value: "family", title: "Family" },
  { value: "health", title: "Health & wellbeing" },
  { value: "spiritual", title: "Spiritual growth" },
  { value: "general", title: "General reading" },
];
