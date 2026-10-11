// app/admin/page.tsx
//
// Admin panel. The page exists ONLY for emails listed in ADMIN_EMAILS:
// for everyone else (and for signed-out visitors) it is a normal 404.

import { notFound } from "next/navigation"
import { getAdminUser } from "@/lib/server/admin"
import AdminDashboard from "@/components/admin/AdminDashboard"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin", robots: { index: false, follow: false } }

export default async function AdminPage() {
  const admin = await getAdminUser().catch(() => null)
  if (!admin) notFound()
  return <AdminDashboard />
}