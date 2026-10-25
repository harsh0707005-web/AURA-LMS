"use client";

import React from "react";
import Topbar from "@/components/layout/Topbar";
import AnnouncementsWorkspace from "@/components/announcements/AnnouncementsWorkspace";

export default function AdminAnnouncementsPage() {
  return <><Topbar title="Announcements" subtitle="Institutional communication" /><AnnouncementsWorkspace role="ADMIN" /></>;
}
