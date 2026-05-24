import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND_BLUE = [26, 54, 93] as const;
const BRAND_GOLD = [180, 120, 30] as const;
const LIGHT_GRAY = [245, 246, 248] as const;
const MID_GRAY = [100, 110, 130] as const;
const TEXT_DARK = [30, 35, 45] as const;

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, w, 28, "F");
  doc.setFillColor(...BRAND_GOLD);
  doc.rect(0, 28, w, 2, "F");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("RPS Infrastructure Limited", 14, 11);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 210, 230);
  doc.text("KRA & KPI Management System", 14, 18);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title, w - 14, 12, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 210, 230);
  doc.text(subtitle, w - 14, 19, { align: "right" });
}

function addFooter(doc: jsPDF, pageCount: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(0, h - 12, w, 12, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MID_GRAY);
    doc.text(
      `Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · RPS Infrastructure Limited`,
      14,
      h - 4.5
    );
    doc.text(`Page ${i} of ${pageCount}`, w - 14, h - 4.5, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, y: number, text: string) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_BLUE);
  doc.text(text.toUpperCase(), 14, y);
  doc.setDrawColor(...BRAND_GOLD);
  doc.setLineWidth(0.5);
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5);
  return y + 7;
}

function statBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  color: readonly [number, number, number] = BRAND_BLUE
) {
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(x, y, w, 18, 2, 2, "F");
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...color);
  doc.text(value, x + w / 2, y + 11, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MID_GRAY);
  doc.text(label, x + w / 2, y + 16.5, { align: "center" });
}

type DeptPerf = {
  departmentName?: string | null;
  employeeCount?: number | null;
  avgKpiScore?: number | null;
  taskCompletionRate?: number | null;
  delayedTaskCount?: number | null;
};

type TopPerformer = {
  employeeName?: string | null;
  departmentName?: string | null;
  kpiScore?: number | null;
  tasksCompleted?: number | null;
};

type KpiRecord = {
  employeeName?: string | null;
  departmentName?: string | null;
  month?: number | null;
  year?: number | null;
  totalScore?: number | null;
  rating?: string | null;
};

type TaskRecord = {
  title?: string | null;
  assignedToName?: string | null;
  departmentName?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
};

type Summary = {
  totalEmployees?: number | null;
  totalTasks?: number | null;
  completedTasks?: number | null;
  delayedTasks?: number | null;
  avgKpiScore?: number | null;
};

export function generateCompanyOverviewPDF(
  summary: Summary,
  deptPerf: DeptPerf[],
  topPerformers: TopPerformer[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const period = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  addHeader(doc, "Company Overview Report", period);

  let y = 38;

  y = sectionTitle(doc, y, "Key Metrics");
  const bw = 42;
  const gap = 4;
  const totalW = doc.internal.pageSize.getWidth() - 28;
  const boxW = (totalW - gap * 3) / 4;
  const completionRate = summary.totalTasks
    ? Math.round(((summary.completedTasks ?? 0) / summary.totalTasks) * 100)
    : 0;

  statBox(doc, 14, y, boxW, "Total Employees", String(summary.totalEmployees ?? "—"), BRAND_BLUE);
  statBox(doc, 14 + boxW + gap, y, boxW, "Task Completion", `${completionRate}%`,
    completionRate >= 70 ? [34, 130, 84] : completionRate >= 40 ? [180, 120, 30] : [200, 50, 50]);
  statBox(doc, 14 + (boxW + gap) * 2, y, boxW, "Avg KPI Score",
    String(Math.round((summary.avgKpiScore ?? 0) * 10) / 10),
    (summary.avgKpiScore ?? 0) >= 75 ? [34, 130, 84] : [180, 120, 30]);
  statBox(doc, 14 + (boxW + gap) * 3, y, boxW, "Delayed Tasks",
    String(summary.delayedTasks ?? 0),
    (summary.delayedTasks ?? 0) > 0 ? [200, 50, 50] : [34, 130, 84]);

  y += 24;

  y = sectionTitle(doc, y, "Department Performance");
  autoTable(doc, {
    startY: y,
    head: [["Department", "Employees", "Avg KPI Score", "Task Completion", "Delayed Tasks"]],
    body: deptPerf.map((d) => [
      d.departmentName ?? "—",
      d.employeeCount ?? 0,
      (Math.round((d.avgKpiScore ?? 0) * 10) / 10).toString(),
      `${Math.round(d.taskCompletionRate ?? 0)}%`,
      d.delayedTaskCount ?? 0,
    ]),
    headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [...TEXT_DARK] },
    alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  if (y > 240) { doc.addPage(); y = 20; }

  y = sectionTitle(doc, y, "Top Performers");
  autoTable(doc, {
    startY: y,
    head: [["Rank", "Employee", "Department", "KPI Score", "Tasks Completed"]],
    body: topPerformers.slice(0, 10).map((p, i) => [
      i + 1,
      p.employeeName ?? "—",
      p.departmentName ?? "—",
      (Math.round((p.kpiScore ?? 0) * 10) / 10).toString(),
      p.tasksCompleted ?? 0,
    ]),
    headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [...TEXT_DARK] },
    alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
    columnStyles: {
      0: { halign: "center", cellWidth: 15 },
      3: { halign: "center" },
      4: { halign: "center" },
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, doc.getNumberOfPages());
  doc.save(`RPS_Company_Overview_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateDepartmentReportPDF(deptPerf: DeptPerf[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const period = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  addHeader(doc, "Department Performance Report", period);

  let y = 38;

  deptPerf.forEach((dept, idx) => {
    if (idx > 0 && y > 230) { doc.addPage(); y = 20; }

    doc.setFillColor(...BRAND_BLUE);
    doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 8, 1.5, 1.5, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(dept.departmentName ?? "—", 18, y + 5.5);
    y += 12;

    const bw = (doc.internal.pageSize.getWidth() - 28 - 12) / 4;
    const completion = Math.round(dept.taskCompletionRate ?? 0);
    const kpi = Math.round((dept.avgKpiScore ?? 0) * 10) / 10;

    statBox(doc, 14, y, bw, "Employees", String(dept.employeeCount ?? 0), BRAND_BLUE);
    statBox(doc, 14 + bw + 4, y, bw, "Avg KPI Score", String(kpi),
      kpi >= 75 ? [34, 130, 84] : kpi >= 50 ? [180, 120, 30] : [200, 50, 50]);
    statBox(doc, 14 + (bw + 4) * 2, y, bw, "Task Completion", `${completion}%`,
      completion >= 70 ? [34, 130, 84] : completion >= 40 ? [180, 120, 30] : [200, 50, 50]);
    statBox(doc, 14 + (bw + 4) * 3, y, bw, "Delayed Tasks",
      String(dept.delayedTaskCount ?? 0),
      (dept.delayedTaskCount ?? 0) > 0 ? [200, 50, 50] : [34, 130, 84]);

    y += 24;
  });

  addFooter(doc, doc.getNumberOfPages());
  doc.save(`RPS_Department_Performance_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateKpiReportPDF(kpis: KpiRecord[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const period = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  addHeader(doc, "Employee KPI Report", period);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const ratingColor: Record<string, [number, number, number]> = {
    excellent: [34, 130, 84],
    good: [59, 130, 200],
    average: [180, 120, 30],
    poor: [200, 50, 50],
  };

  autoTable(doc, {
    startY: 38,
    head: [["Employee", "Department", "Period", "Score", "Rating"]],
    body: kpis.map((k) => [
      k.employeeName ?? "—",
      k.departmentName ?? "—",
      k.month && k.year ? `${MONTHS[(k.month ?? 1) - 1]} ${k.year}` : "—",
      (Math.round((k.totalScore ?? 0) * 10) / 10).toString(),
      (k.rating ?? "—").charAt(0).toUpperCase() + (k.rating ?? "").slice(1),
    ]),
    headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [...TEXT_DARK] },
    alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
    columnStyles: {
      0: { fontStyle: "bold" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const rating = String(data.cell.raw ?? "").toLowerCase();
        const color = ratingColor[rating] ?? MID_GRAY;
        doc.setTextColor(...color);
        doc.setFont("helvetica", "bold");
        doc.text(
          String(data.cell.raw ?? ""),
          data.cell.x + data.cell.width / 2,
          data.cell.y + data.cell.height / 2 + 1.5,
          { align: "center" }
        );
        data.cell.text = [];
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, doc.getNumberOfPages());
  doc.save(`RPS_KPI_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateTaskReportPDF(tasks: TaskRecord[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const period = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  addHeader(doc, "Task Status Report", period);

  const statusOrder = ["todo", "in_progress", "completed", "delayed", "blocked", "awaiting_hod_approval"];
  const statusLabel: Record<string, string> = {
    todo: "To Do", in_progress: "In Progress", completed: "Completed",
    delayed: "Delayed", blocked: "Blocked", awaiting_hod_approval: "Awaiting Approval",
  };

  const grouped = statusOrder.reduce<Record<string, TaskRecord[]>>((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {});

  const totalByStatus = statusOrder.map((s) => [statusLabel[s] ?? s, grouped[s].length]);
  const w = doc.internal.pageSize.getWidth();

  autoTable(doc, {
    startY: 38,
    head: [["Status", "Count"]],
    body: totalByStatus,
    headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [...TEXT_DARK] },
    alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
    columnStyles: { 0: { cellWidth: 60 }, 1: { halign: "center", cellWidth: 30 } },
    tableWidth: 94,
    margin: { left: 14 },
  });

  let y = (doc as any).lastAutoTable.finalY + 10;

  for (const status of statusOrder) {
    const rows = grouped[status];
    if (!rows.length) continue;

    if (y > 170) { doc.addPage(); y = 20; }

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_BLUE);
    doc.text(`${statusLabel[status] ?? status} (${rows.length})`, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Title", "Assigned To", "Department", "Priority", "Due Date"]],
      body: rows.map((t) => [
        t.title ?? "—",
        t.assignedToName ?? "—",
        t.departmentName ?? "—",
        (t.priority ?? "—").charAt(0).toUpperCase() + (t.priority ?? "").slice(1),
        t.dueDate
          ? new Date(t.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "—",
      ]),
      headStyles: { fillColor: [60, 80, 120], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5, textColor: [...TEXT_DARK] },
      alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  addFooter(doc, doc.getNumberOfPages());
  doc.save(`RPS_Task_Status_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
