/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DashboardContent } from "@/app/admin/dashboard/page";
import type { OrchestratorOutput } from "trigger/types";

const baseRun: OrchestratorOutput = {
  discoveredCount: 5,
  filteredCount: 2,
  relevantCount: 3,
  duplicateCount: 1,
  queuedForSendingCount: 3,
  executionTimeMs: 1234,
  timestamp: new Date().toISOString(),
  channels: [
    {
      channelId: "default",
      discoveredCount: 5,
      filteredCount: 2,
      relevantCount: 3,
      duplicateCount: 1,
      queuedForSendingCount: 3,
      status: "success",
    },
  ],
};

describe("DashboardContent", () => {
  it("renders metrics and channel summary", () => {
    render(<DashboardContent data={{ lastRun: baseRun, recentRuns: [baseRun] }} />);

    expect(screen.getByText(/Dashboard RS News/)).toBeInTheDocument();
    expect(screen.getByText(/Descobertas: 5/)).toBeInTheDocument();
    expect(screen.getByText(/Canal/)).toBeInTheDocument();
    expect(screen.getByText(/default: success/)).toBeInTheDocument();
  });

  it("handles empty state", () => {
    render(<DashboardContent data={{ lastRun: null, recentRuns: [] }} />);
    expect(screen.getByText(/Nenhuma execução registrada/)).toBeInTheDocument();
  });
});
