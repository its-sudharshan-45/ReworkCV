import React from 'react';
import { ResumePage } from '@/features/resume/components/ResumePage';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

export function ResumeAnalysisPage() {
  return (
    <DashboardLayout>
      <ResumePage />
    </DashboardLayout>
  );
}
