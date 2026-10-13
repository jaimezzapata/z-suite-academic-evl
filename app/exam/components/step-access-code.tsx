"use client";

import { Smartphone, LockKeyhole, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OTPInput } from "./otp-input";

export interface StepAccessCodeProps {
  code: string;
  onChangeCode: (code: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}

export function StepAccessCode({
  code,
  onChangeCode,
  onSubmit,
  loading,
  error,
}: StepAccessCodeProps) {
  const isComplete = code.trim().length === 6;

  return (
    <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-8 shadow-sm transition-all duration-300">
      <div className="text-center">
        {/* Icon Circle */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
          <Smartphone className="h-7 w-7" />
        </div>

        {/* Brand Pill */}
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/60 px-3.5 py-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-bold text-white">
            ZS
          </div>
          <span className="text-xs font-semibold text-indigo-900 tracking-tight">
            Z-Suite Academic Eval
          </span>
        </div>

        {/* Title & Description */}
        <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Verificación de Examen
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
          Ingresa el código OTP de 6 dígitos proporcionado por tu docente o evaluador.
        </p>

        {/* Notice Badge */}
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800 border border-amber-200/60">
          <LockKeyhole className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span>Examen individual y de intento único</span>
        </div>
      </div>

      {/* OTP Input */}
      <div className="mt-7">
        <OTPInput value={code} onChange={onChangeCode} />
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2 text-center text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <div className="mt-7 flex justify-center">
        <Button
          variant="primary"
          size="lg"
          onClick={onSubmit}
          disabled={loading || !isComplete}
          isLoading={loading}
          rightIcon={<ArrowRight className="h-4 w-4" />}
          className="w-full sm:w-auto min-w-[200px]"
        >
          {loading ? "Verificando..." : "Acceder al Examen"}
        </Button>
      </div>
    </section>
  );
}
