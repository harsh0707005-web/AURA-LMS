"use client";

import React from "react";
import Topbar from "@/components/layout/Topbar";
import AnnouncementsWorkspace from "@/components/announcements/AnnouncementsWorkspace";

export default function FacultyAnnouncementsPage() {
  return <><Topbar title="Announcements" subtitle="Communicate with your course cohorts" /><AnnouncementsWorkspace role="FACULTY" /></>;
}
