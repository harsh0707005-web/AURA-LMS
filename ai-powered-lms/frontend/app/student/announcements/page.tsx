"use client";

import React from "react";
import Topbar from "@/components/layout/Topbar";
import AnnouncementsWorkspace from "@/components/announcements/AnnouncementsWorkspace";

export default function StudentAnnouncementsPage() {
  return <><Topbar title="Announcements" subtitle="Course and institutional updates" /><AnnouncementsWorkspace role="STUDENT" /></>;
}
