"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, UserCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StepStudentInfoProps {
  examName: string;
  questionCount: number;
  timeLimitMinutes: number;
  firstName: string;
  onChangeFirstName: (val: string) => void;
  lastName: string;
  onChangeLastName: (val: string) => void;
  documentId: string;
  onChangeDocumentId: (val: string) => void;
  email: string;
  onChangeEmail: (val: string) => void;
  onComplete: () => void;
  onBackToCode: () => void;
}

export function StepStudentInfo({
  examName,
  questionCount,
  timeLimitMinutes,
  firstName,
  onChangeFirstName,
  lastName,
  onChangeLastName,
  documentId,
  onChangeDocumentId,
  email,
  onChangeEmail,
  onComplete,
  onBackToCode,
}: StepStudentInfoProps) {
  const [fieldIndex, setFieldIndex] = useState(0);

  const fields = [
    {
      key: "firstName",
      title: "¿Cuál es tu nombre?",
      hint: "Escribe tu primer nombre tal como aparece en tu registro académico.",
      value: firstName,
      onChange: onChangeFirstName,
      placeholder: "Ej: Carlos",
      type: "text",
      inputMode: "text" as const,
      isValid: firstName.trim().length >= 2,
    },
    {
      key: "lastName",
      title: "¿Cuáles son tus apellidos?",
      hint: "Tus apellidos completos para asociar tu intento de examen.",
      value: lastName,
      onChange: onChangeLastName,
      placeholder: "Ej: Gómez Zapata",
      type: "text",
      inputMode: "text" as const,
      isValid: lastName.trim().length >= 2,
    },
    {
      key: "documentId",
      title: "Documento de identidad",
      hint: "Cédula, tarjeta de identidad o código institucional.",
      value: documentId,
      onChange: onChangeDocumentId,
      placeholder: "Ej: 1020304050",
      type: "text",
      inputMode: "numeric" as const,
      isValid: documentId.trim().length >= 4,
    },
    {
      key: "email",
      title: "Correo electrónico institucional o personal",
      hint: "Debe ser un correo válido para el registro del intento único.",
      value: email,
      onChange: onChangeEmail,
      placeholder: "estudiante@institucion.edu.co",
      type: "email",
      inputMode: "email" as const,
      isValid: email.trim().includes("@") && email.trim().includes("."),
    },
  ];

  const safeIndex = Math.min(Math.max(fieldIndex, 0), fields.length - 1);
  const currentField = fields[safeIndex];
  const progressPct = Math.round(((safeIndex + 1) / fields.length) * 100);

  function handleNext() {
    if (!currentField.isValid) return;
    if (safeIndex < fields.length - 1) {
      setFieldIndex((i) => Math.min(fields.length - 1, i + 1));
    } else {
      onComplete();
    }
  }

  function handlePrev() {
    if (safeIndex > 0) {
      setFieldIndex((i) => Math.max(0, i - 1));
    } else {
      onBackToCode();
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-9 shadow-sm transition-all duration-300">
      {/* Header Info */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
              <UserCheck className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Registro del estudiante
            </p>
          </div>
          <h2 className="mt-1.5 text-base font-bold text-slate-900 truncate">
            {examName}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {questionCount} preguntas • {timeLimitMinutes} min límite
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 shrink-0">
          Paso {safeIndex + 1} de {fields.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Dynamic Wizard Field */}
      <div className="mt-8">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {currentField.title}
        </h3>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          {currentField.hint}
        </p>

        <div className="mt-6">
          <input
            value={currentField.value}
            onChange={(e) => currentField.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && currentField.isValid) {
                handleNext();
              }
            }}
            type={currentField.type}
            inputMode={currentField.inputMode}
            className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-4.5 text-lg text-slate-900 shadow-xs outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            placeholder={currentField.placeholder}
            autoFocus
          />
          {!currentField.isValid && currentField.value.length > 0 && (
            <p className="mt-2 text-xs font-medium text-rose-600">
              Por favor ingresa un formato válido para continuar.
            </p>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="mt-10 flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
        <Button
          variant="outline"
          size="md"
          onClick={handlePrev}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          {safeIndex === 0 ? "Cambiar Código" : "Anterior"}
        </Button>

        <Button
          variant="primary"
          size="md"
          onClick={handleNext}
          disabled={!currentField.isValid}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {safeIndex < fields.length - 1 ? "Siguiente" : "Continuar a Reglas"}
        </Button>
      </div>
    </section>
  );
}
