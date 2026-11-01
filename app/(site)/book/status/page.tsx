import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingStatus } from "@/components/booking/booking-status";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Booking status",
  robots: { index: false },
};

export default function BookingStatusPage() {
  return (
    <Container className="py-24 lg:py-32">
      <Suspense fallback={<p className="text-center text-ink-muted">Checking your booking…</p>}>
        <BookingStatus />
      </Suspense>
    </Container>
  );
}
