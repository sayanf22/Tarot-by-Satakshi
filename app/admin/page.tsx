import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/admin-app";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// A static shell. Everything it shows comes from /api/admin/*, which checks the
// session cookie on every call, so the page itself holds no data.
export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-ivory">
      <AdminApp />
    </div>
  );
}
