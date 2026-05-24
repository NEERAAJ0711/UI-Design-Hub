import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND_BLUE  = [26, 54, 93]    as const;
const BRAND_GOLD  = [180, 120, 30]  as const;
const LIGHT_GRAY  = [245, 246, 248] as const;
const MID_GRAY    = [100, 110, 130] as const;
const TEXT_DARK   = [30, 35, 45]    as const;
const GREEN       = [34, 130, 84]   as const;
const AMBER       = [180, 120, 30]  as const;
const RED         = [200, 50, 50]   as const;

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, w, 28, "F");
  doc.setFillColor(...BRAND_GOLD);
  doc.rect(0, 28, w, 2, "F");
  doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
  doc.text("RPS Infrastructure Limited", 14, 11);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(200, 210, 230);
  doc.text("KRA & KPI Management System", 14, 18);
  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
  doc.text(title, w - 14, 12, { align: "right" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(200, 210, 230);
  doc.text(subtitle, w - 14, 19, { align: "right" });
}

function addFooter(doc: jsPDF, pageCount: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(0, h - 12, w, 12, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...MID_GRAY);
    doc.text(
      `Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · RPS Infrastructure Limited`,
      14, h - 4.5
    );
    doc.text(`Page ${i} of ${pageCount}`, w - 14, h - 4.5, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, y: number, text: string) {
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...BRAND_BLUE);
  doc.text(text.toUpperCase(), 14, y);
  doc.setDrawColor(...BRAND_GOLD); doc.setLineWidth(0.5);
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5);
  return y + 7;
}

function statBox(
  doc: jsPDF, x: number, y: number, w: number,
  label: string, value: string,
  color: readonly [number, number, number] = BRAND_BLUE
) {
  doc.setFillColor(...LIGHT_GRAY); doc.roundedRect(x, y, w, 18, 2, 2, "F");
  doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(...color);
  doc.text(value, x + w / 2, y + 11, { align: "center" });
  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...MID_GRAY);
  doc.text(label, x + w / 2, y + 16.5, { align: "center" });
}

type DeptPerf = {
  departmentName?: string | null; employeeCount?: number | null; avgKpiScore?: number | null;
  taskCompletionRate?: number | null; delayedTaskCount?: number | null;
};
type TopPerformer = {
  employeeName?: string | null; departmentName?: string | null;
  kpiScore?: number | null; tasksCompleted?: number | null;
};
type KpiRecord = {
  employeeName?: string | null; departmentName?: string | null; month?: number | null;
  year?: number | null; totalScore?: number | null; rating?: string | null;
};
type TaskRecord = {
  title?: string | null; assignedToName?: string | null; departmentName?: string | null;
  status?: string | null; priority?: string | null; dueDate?: string | null;
  progressPct?: number | null; completedAt?: string | null; createdAt?: string;
};
type KraRecord = {
  title?: string | null; weightage?: number; kraStatus?: string | null;
  achievementPct?: number | null; frequency?: string | null; dueDate?: string | null;
  createdAt?: string;
};

export function generateCompanyOverviewPDF(
  summary: { totalEmployees?: number | null; totalTasks?: number | null; completedTasks?: number | null; delayedTasks?: number | null; avgKpiScore?: number | null },
  deptPerf: DeptPerf[], topPerformers: TopPerformer[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const period = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  addHeader(doc, "Company Overview Report", period);
  let y = 38;
  y = sectionTitle(doc, y, "Key Metrics");
  const completionRate = summary.totalTasks
    ? Math.round(((summary.completedTasks ?? 0) / summary.totalTasks) * 100) : 0;
  const pw = doc.internal.pageSize.getWidth() - 28;
  const bw = (pw - 12) / 4;
  statBox(doc, 14, y, bw, "Total Employees", String(summary.totalEmployees ?? "—"), BRAND_BLUE);
  statBox(doc, 14 + bw + 4, y, bw, "Task Completion", `${completionRate}%`,
    completionRate >= 70 ? GREEN : completionRate >= 40 ? AMBER : RED);
  statBox(doc, 14 + (bw + 4) * 2, y, bw, "Avg KPI Score",
    String(Math.round((summary.avgKpiScore ?? 0) * 10) / 10),
    (summary.avgKpiScore ?? 0) >= 75 ? GREEN : AMBER);
  statBox(doc, 14 + (bw + 4) * 3, y, bw, "Delayed Tasks",
    String(summary.delayedTasks ?? 0), (summary.delayedTasks ?? 0) > 0 ? RED : GREEN);
  y += 24;
  y = sectionTitle(doc, y, "Department Performance");
  autoTable(doc, {
    startY: y,
    head: [["Department", "Employees", "Avg KPI Score", "Task Completion", "Delayed Tasks"]],
    body: deptPerf.map((d) => [
      d.departmentName ?? "—", d.employeeCount ?? 0,
      (Math.round((d.avgKpiScore ?? 0) * 10) / 10).toString(),
      `${Math.round(d.taskCompletionRate ?? 0)}%`, d.delayedTaskCount ?? 0,
    ]),
    headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [...TEXT_DARK] },
    alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;
  if (y > 240) { doc.addPage(); y = 20; }
  y = sectionTitle(doc, y, "Top Performers");
  autoTable(doc, {
    startY: y,
    head: [["Rank", "Employee", "Department", "KPI Score", "Tasks Completed"]],
    body: topPerformers.slice(0, 10).map((p, i) => [
      i + 1, p.employeeName ?? "—", p.departmentName ?? "—",
      (Math.round((p.kpiScore ?? 0) * 10) / 10).toString(), p.tasksCompleted ?? 0,
    ]),
    headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [...TEXT_DARK] },
    alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
    columnStyles: { 0: { halign: "center", cellWidth: 15 }, 3: { halign: "center" }, 4: { halign: "center" } },
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
    doc.setFillColor(...BRAND_BLUE); doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 8, 1.5, 1.5, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(dept.departmentName ?? "—", 18, y + 5.5);
    y += 12;
    const bw = (doc.internal.pageSize.getWidth() - 28 - 12) / 4;
    const completion = Math.round(dept.taskCompletionRate ?? 0);
    const kpi = Math.round((dept.avgKpiScore ?? 0) * 10) / 10;
    statBox(doc, 14, y, bw, "Employees", String(dept.employeeCount ?? 0), BRAND_BLUE);
    statBox(doc, 14 + bw + 4, y, bw, "Avg KPI Score", String(kpi), kpi >= 75 ? GREEN : kpi >= 50 ? AMBER : RED);
    statBox(doc, 14 + (bw + 4) * 2, y, bw, "Task Completion", `${completion}%`, completion >= 70 ? GREEN : completion >= 40 ? AMBER : RED);
    statBox(doc, 14 + (bw + 4) * 3, y, bw, "Delayed Tasks", String(dept.delayedTaskCount ?? 0), (dept.delayedTaskCount ?? 0) > 0 ? RED : GREEN);
    y += 24;
  });
  addFooter(doc, doc.getNumberOfPages());
  doc.save(`RPS_Department_Performance_${new Date().toISOString().slice(0, 10)}.pdf`);
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ratingColor: Record<string, readonly [number, number, number]> = {
  excellent: GREEN, good: [59, 130, 200], average: AMBER, poor: RED,
};

export function generateKpiReportPDF(kpis: KpiRecord[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const period = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  addHeader(doc, "Employee KPI Report", period);
  autoTable(doc, {
    startY: 38,
    head: [["Employee", "Department", "Period", "Score", "Rating"]],
    body: kpis.map((k) => [
      k.employeeName ?? "—", k.departmentName ?? "—",
      k.month && k.year ? `${MONTHS[(k.month ?? 1) - 1]} ${k.year}` : "—",
      (Math.round((k.totalScore ?? 0) * 10) / 10).toString(),
      (k.rating ?? "—").charAt(0).toUpperCase() + (k.rating ?? "").slice(1),
    ]),
    headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [...TEXT_DARK] },
    alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
    columnStyles: { 0: { fontStyle: "bold" }, 3: { halign: "center" }, 4: { halign: "center" } },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const rating = String(data.cell.raw ?? "").toLowerCase();
        const color = ratingColor[rating] ?? MID_GRAY;
        doc.setTextColor(...color); doc.setFont("helvetica", "bold");
        doc.text(String(data.cell.raw ?? ""), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1.5, { align: "center" });
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
    acc[s] = tasks.filter((t) => t.status === s); return acc;
  }, {});
  autoTable(doc, {
    startY: 38,
    head: [["Status", "Count"]],
    body: statusOrder.map((s) => [statusLabel[s] ?? s, grouped[s].length]),
    headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [...TEXT_DARK] },
    alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
    columnStyles: { 0: { cellWidth: 60 }, 1: { halign: "center", cellWidth: 30 } },
    tableWidth: 94, margin: { left: 14 },
  });
  let y = (doc as any).lastAutoTable.finalY + 10;
  for (const status of statusOrder) {
    const rows = grouped[status];
    if (!rows.length) continue;
    if (y > 170) { doc.addPage(); y = 20; }
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...BRAND_BLUE);
    doc.text(`${statusLabel[status] ?? status} (${rows.length})`, 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Title", "Assigned To", "Department", "Priority", "Due Date"]],
      body: rows.map((t) => [
        t.title ?? "—", t.assignedToName ?? "—", t.departmentName ?? "—",
        (t.priority ?? "—").charAt(0).toUpperCase() + (t.priority ?? "").slice(1),
        t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
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

export function generateEmployeeDatewiseReportPDF(params: {
  employeeName: string;
  departmentName: string;
  designation?: string | null;
  fromDate: Date;
  toDate: Date;
  tasks: TaskRecord[];
  kras: KraRecord[];
  kpis: KpiRecord[];
}) {
  const { employeeName, departmentName, designation, fromDate, toDate, tasks, kras, kpis } = params;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const fmtStr = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const dateRange = `${fmtDate(fromDate)} – ${fmtDate(toDate)}`;

  addHeader(doc, "Employee Performance Report", dateRange);

  // Employee info card
  let y = 34;
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 20, 2, 2, "F");
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...BRAND_BLUE);
  doc.text(employeeName, 20, y + 8);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...MID_GRAY);
  doc.text(`Department: ${departmentName}`, 20, y + 14);
  if (designation) doc.text(`Designation: ${designation}`, 20, y + 18.5);

  // Summary stat boxes
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const delayedTasks = tasks.filter((t) => t.status === "delayed").length;
  const avgKra = kras.length
    ? Math.round((kras.reduce((s, k) => s + (k.achievementPct ?? 0), 0) / kras.length) * 10) / 10
    : 0;
  const latestKpi = kpis.length
    ? Math.round([...kpis].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.month ?? 0) - (a.month ?? 0))[0].totalScore ?? 0)
    : 0;

  y += 25;
  const pw = doc.internal.pageSize.getWidth() - 28;
  const bw = (pw - 12) / 4;
  statBox(doc, 14, y, bw, "Total Tasks", String(tasks.length), BRAND_BLUE);
  statBox(doc, 14 + bw + 4, y, bw, "Completed", String(completedTasks), completedTasks > 0 ? GREEN : MID_GRAY);
  statBox(doc, 14 + (bw + 4) * 2, y, bw, "Avg KRA Achievement", `${avgKra}%`, avgKra >= 70 ? GREEN : avgKra >= 40 ? AMBER : RED);
  statBox(doc, 14 + (bw + 4) * 3, y, bw, "Latest KPI Score", String(latestKpi),
    latestKpi >= 75 ? GREEN : latestKpi >= 50 ? AMBER : RED);
  y += 24;

  // Tasks section
  if (tasks.length > 0) {
    y = sectionTitle(doc, y, `Tasks (${tasks.length})`);
    autoTable(doc, {
      startY: y,
      head: [["Title", "Status", "Priority", "Due Date", "Progress", "Completed On"]],
      body: tasks.map((t) => [
        t.title ?? "—",
        (t.status ?? "—").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        (t.priority ?? "—").charAt(0).toUpperCase() + (t.priority ?? "").slice(1),
        t.dueDate ? fmtStr(t.dueDate) : "—",
        `${t.progressPct ?? 0}%`,
        t.completedAt ? fmtStr(t.completedAt) : "—",
      ]),
      headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5, textColor: [...TEXT_DARK] },
      alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
      columnStyles: {
        1: { halign: "center" }, 2: { halign: "center" },
        3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" },
      },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 1) {
          const s = String(data.cell.raw ?? "").toLowerCase().replace(/ /g, "_");
          const colors: Record<string, readonly [number, number, number]> = {
            completed: GREEN, delayed: RED, in_progress: [80, 100, 220], blocked: AMBER, todo: MID_GRAY,
          };
          const col = colors[s] ?? MID_GRAY;
          doc.setTextColor(...col); doc.setFont("helvetica", "bold");
          doc.text(String(data.cell.raw ?? ""), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1.5, { align: "center" });
          data.cell.text = [];
        }
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (y > 240) { doc.addPage(); y = 20; }

  // KRAs section
  if (kras.length > 0) {
    y = sectionTitle(doc, y, `KRAs (${kras.length})`);
    autoTable(doc, {
      startY: y,
      head: [["KRA Title", "Frequency", "Weightage", "Status", "Achievement", "Due Date"]],
      body: kras.map((k) => [
        k.title ?? "—",
        (k.frequency ?? "—").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        `${k.weightage ?? 0}%`,
        (k.kraStatus ?? "—").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        k.achievementPct != null ? `${k.achievementPct}%` : "—",
        k.dueDate ? fmtStr(k.dueDate) : "—",
      ]),
      headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5, textColor: [...TEXT_DARK] },
      alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
      columnStyles: {
        0: { fontStyle: "bold" }, 2: { halign: "center" },
        3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (y > 240) { doc.addPage(); y = 20; }

  // KPI scores section
  if (kpis.length > 0) {
    y = sectionTitle(doc, y, `KPI Scores (${kpis.length} records)`);
    autoTable(doc, {
      startY: y,
      head: [["Period", "Total Score", "Rating"]],
      body: [...kpis]
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.month ?? 0) - (a.month ?? 0))
        .map((k) => [
          k.month && k.year ? `${MONTHS[(k.month ?? 1) - 1]} ${k.year}` : "—",
          (Math.round((k.totalScore ?? 0) * 10) / 10).toString(),
          (k.rating ?? "—").charAt(0).toUpperCase() + (k.rating ?? "").slice(1),
        ]),
      headStyles: { fillColor: [...BRAND_BLUE], textColor: 255, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8, textColor: [...TEXT_DARK] },
      alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
      columnStyles: { 0: { cellWidth: 45 }, 1: { halign: "center", cellWidth: 30 }, 2: { halign: "center", cellWidth: 30 } },
      tableWidth: 105,
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const r = String(data.cell.raw ?? "").toLowerCase();
          const col = ratingColor[r] ?? MID_GRAY;
          doc.setTextColor(...col); doc.setFont("helvetica", "bold");
          doc.text(String(data.cell.raw ?? ""), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1.5, { align: "center" });
          data.cell.text = [];
        }
      },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc, doc.getNumberOfPages());
  const safeName = employeeName.replace(/\s+/g, "_");
  doc.save(`RPS_Employee_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
