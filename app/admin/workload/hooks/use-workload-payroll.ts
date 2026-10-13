"use client";

import { useEffect, useMemo, useState } from "react";
import { useFeedback } from "@/app/feedback-provider";
import { reportFormError } from "@/lib/form-feedback";
import type {
  PayrollStatementItem,
  PayrollStatementRow,
  PayrollSummary,
  TeachingLoadRow,
} from "../types";
import {
  buildPayrollOccurrences,
  currentFortnightRange,
  formatScheduleSummary,
  isSecondFortnightRange,
  parseLocalDate,
  roundHours,
  safeNumberFromInput,
  shiftFortnightRange,
} from "../services/workload-date-utils";
import {
  deletePayrollStatementFromDb,
  savePayrollStatementToDb,
} from "../services/workload-service";

const DEFAULT_PAYROLL_VALUES = {
  cesdeHourlyRate: "0",
  senaMonthlySalary: "0",
};

export function useWorkloadPayroll({
  filteredRows,
  setError,
  setSuccess,
}: {
  filteredRows: TeachingLoadRow[];
  setError: (err: string | null) => void;
  setSuccess: (msg: string | null) => void;
}) {
  const feedback = useFeedback();
  const [payrollRangeStart, setPayrollRangeStart] = useState(() => currentFortnightRange().start);
  const [payrollRangeEnd, setPayrollRangeEnd] = useState(() => currentFortnightRange().end);
  const [cesdeHourlyRate, setCesdeHourlyRate] = useState(DEFAULT_PAYROLL_VALUES.cesdeHourlyRate);
  const [senaMonthlySalary, setSenaMonthlySalary] = useState(DEFAULT_PAYROLL_VALUES.senaMonthlySalary);
  const [selectedPayrollStatement, setSelectedPayrollStatement] = useState<PayrollStatementRow | null>(null);

  // Carga inicial desde localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("workload-payroll-sim");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        cesdeHourlyRate: string;
        senaMonthlySalary: string;
        payrollRangeStart: string;
        payrollRangeEnd: string;
      }>;
      if (typeof parsed.cesdeHourlyRate === "string") setCesdeHourlyRate(parsed.cesdeHourlyRate);
      if (typeof parsed.senaMonthlySalary === "string") setSenaMonthlySalary(parsed.senaMonthlySalary);
      if (typeof parsed.payrollRangeStart === "string") setPayrollRangeStart(parsed.payrollRangeStart);
      if (typeof parsed.payrollRangeEnd === "string") setPayrollRangeEnd(parsed.payrollRangeEnd);
    } catch {}
  }, []);

  // Guardado reactivo en localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "workload-payroll-sim",
        JSON.stringify({
          cesdeHourlyRate,
          senaMonthlySalary,
          payrollRangeStart,
          payrollRangeEnd,
        }),
      );
    } catch {}
  }, [cesdeHourlyRate, payrollRangeEnd, payrollRangeStart, senaMonthlySalary]);

  const payrollHourlyRateValue = useMemo(() => safeNumberFromInput(cesdeHourlyRate), [cesdeHourlyRate]);
  const senaMonthlySalaryValue = useMemo(() => safeNumberFromInput(senaMonthlySalary), [senaMonthlySalary]);

  function movePayrollFortnight(direction: -1 | 1) {
    const nextRange = shiftFortnightRange(payrollRangeStart || payrollRangeEnd, direction);
    setPayrollRangeStart(nextRange.start);
    setPayrollRangeEnd(nextRange.end);
  }

  const payrollSummary = useMemo<PayrollSummary>(() => {
    const cesdeRows = filteredRows.filter((row) => (row.institution || "CESDE").toUpperCase() === "CESDE");
    const senaRows = filteredRows.filter((row) => (row.institution || "CESDE").toUpperCase() === "SENA");
    const isSecondFortnight = isSecondFortnightRange(payrollRangeStart, payrollRangeEnd);

    const cesdeBreakdown = cesdeRows
      .map((row) => {
        const occurrences = buildPayrollOccurrences(row, payrollRangeStart, payrollRangeEnd, payrollHourlyRateValue);
        const programmedHours = roundHours(occurrences.reduce((sum, item) => sum + item.academicHours, 0));
        const estimatedValue = roundHours(occurrences.reduce((sum, item) => sum + item.estimatedValue, 0));
        return {
          row,
          occurrences: occurrences.length,
          programmedHours,
          estimatedValue,
          scheduleSummary: formatScheduleSummary(row),
        };
      })
      .filter((item) => item.occurrences > 0)
      .sort((a, b) => b.estimatedValue - a.estimatedValue || b.programmedHours - a.programmedHours);

    const cesdeHours = roundHours(cesdeBreakdown.reduce((sum, item) => sum + item.programmedHours, 0));
    const cesdeEstimated = roundHours(cesdeBreakdown.reduce((sum, item) => sum + item.estimatedValue, 0));
    const senaMonthlyReference = senaRows.length ? senaMonthlySalaryValue : 0;
    const senaQuincenaReference = roundHours(senaMonthlyReference / 2);
    const totalMixedReference = roundHours(isSecondFortnight ? cesdeEstimated + senaMonthlyReference : cesdeEstimated);
    const totalMixedLabel = isSecondFortnight ? "Total mes estimado" : "CESDE estimado";
    const totalMixedHint = isSecondFortnight
      ? "CESDE segunda quincena + SENA mensual completo"
      : "Primera quincena: solo CESDE";

    return {
      cesdeBreakdown,
      cesdeLoads: cesdeBreakdown.length,
      cesdeHours,
      cesdeEstimated,
      senaLoads: senaRows.length,
      senaMonthlyReference,
      senaQuincenaReference,
      isSecondFortnight,
      totalMixedReference,
      totalMixedLabel,
      totalMixedHint,
    };
  }, [filteredRows, payrollHourlyRateValue, payrollRangeEnd, payrollRangeStart, senaMonthlySalaryValue]);

  const currentPayrollStatementItems = useMemo<PayrollStatementItem[]>(
    () =>
      filteredRows
        .filter((row) => (row.institution || "CESDE").toUpperCase() === "CESDE")
        .flatMap((row) => buildPayrollOccurrences(row, payrollRangeStart, payrollRangeEnd, payrollHourlyRateValue))
        .sort((a, b) => `${a.date}|${a.startTime}|${a.subjectName}`.localeCompare(`${b.date}|${b.startTime}|${b.subjectName}`, "es")),
    [filteredRows, payrollHourlyRateValue, payrollRangeEnd, payrollRangeStart],
  );

  function showValidationError(message: string) {
    return reportFormError({ message, feedback, setMessage: setError });
  }

  async function savePayrollStatement() {
    if (!payrollRangeStart || !payrollRangeEnd) {
      showValidationError("Debes definir el rango quincenal para guardar la colilla.");
      return;
    }
    const payrollStartDate = parseLocalDate(payrollRangeStart);
    const payrollEndDate = parseLocalDate(payrollRangeEnd);
    if (!payrollStartDate || !payrollEndDate) {
      showValidationError("Las fechas de la quincena no tienen un formato válido.");
      return;
    }
    if (payrollEndDate.getTime() < payrollStartDate.getTime()) {
      showValidationError("La fecha final de la quincena no puede ser menor a la fecha inicial.");
      return;
    }
    if (!payrollHourlyRateValue) {
      showValidationError("Debes indicar el valor hora CESDE para guardar la colilla.");
      return;
    }
    if (!currentPayrollStatementItems.length) {
      showValidationError("No hay jornadas CESDE en el rango seleccionado para generar la colilla.");
      return;
    }

    try {
      await savePayrollStatementToDb({
        rangeStart: payrollRangeStart,
        rangeEnd: payrollRangeEnd,
        hourlyRate: payrollHourlyRateValue,
        items: currentPayrollStatementItems,
      });
      feedback.success("Colilla quincenal guardada en el historial.");
      setSuccess("Colilla quincenal guardada correctamente.");
    } catch {
      reportFormError({
        message: "No fue posible guardar la colilla quincenal.",
        feedback,
        setMessage: setError,
      });
    }
  }

  async function removePayrollStatement(statement: PayrollStatementRow) {
    const confirmed = await feedback.confirm({
      title: "Eliminar colilla",
      description: `Se eliminará la colilla del periodo ${statement.rangeStart} - ${statement.rangeEnd}. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar colilla",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await deletePayrollStatementFromDb(statement.id);
      feedback.success("Colilla eliminada del historial.");
      setSuccess("Colilla eliminada correctamente.");
    } catch {
      reportFormError({
        message: "No fue posible eliminar la colilla.",
        feedback,
        setMessage: setError,
      });
    }
  }

  return {
    payrollRangeStart,
    setPayrollRangeStart,
    payrollRangeEnd,
    setPayrollRangeEnd,
    cesdeHourlyRate,
    setCesdeHourlyRate,
    senaMonthlySalary,
    setSenaMonthlySalary,
    selectedPayrollStatement,
    setSelectedPayrollStatement,
    payrollHourlyRateValue,
    senaMonthlySalaryValue,
    payrollSummary,
    currentPayrollStatementItems,
    movePayrollFortnight,
    savePayrollStatement,
    removePayrollStatement,
  };
}
