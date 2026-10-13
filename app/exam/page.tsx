"use client";

import { ArrowLeft } from "lucide-react";
import { IconButton } from "@/app/admin/ui/icon-button";
import { useExamSession } from "./hooks/use-exam-session";
import { StepAccessCode } from "./components/step-access-code";
import { StepStudentInfo } from "./components/step-student-info";
import { StepExamRules } from "./components/step-exam-rules";
import { StepActiveExam } from "./components/step-active-exam";
import { StepExamResult } from "./components/step-exam-result";

export default function ExamPublicPage() {
  const session = useExamSession();

  const centeredEntryStep =
    session.step === "code" || session.step === "student" || session.step === "rules";
  const centeredExamStep = session.step === "exam";

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6">
      <div
        className={`mx-auto w-full ${
          centeredEntryStep
            ? "relative max-w-5xl min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center gap-4"
            : centeredExamStep
              ? "w-[96%] max-w-[120rem] min-h-[calc(100vh-3rem)] flex flex-col justify-center gap-4 2xl:max-w-[128rem]"
              : "max-w-6xl space-y-4"
        }`}
      >
        {/* Botón superior de retroceso en pasos iniciales */}
        <header
          className={`flex w-full justify-end ${centeredEntryStep ? "absolute right-0 top-0 max-w-2xl" : ""}`}
        >
          <IconButton
            onClick={() => {
              if (session.step === "exam") return;
              if (session.step === "student") session.setStep("code");
              else if (session.step === "rules") session.setStep("student");
            }}
            className="h-10 w-10"
            aria-label="Volver"
            title="Volver"
            disabled={session.step === "code" || session.step === "exam" || session.step === "result"}
          >
            <ArrowLeft className="h-4 w-4" />
          </IconButton>
        </header>

        {/* Mensaje de anulación de examen por el docente */}
        {session.annulReason ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {session.annulReason}
          </div>
        ) : null}

        {/* Paso 1: Código de acceso de 6 dígitos */}
        {session.step === "code" ? (
          <StepAccessCode
            code={session.code}
            onChangeCode={session.setCode}
            onSubmit={session.loadExamByCode}
            loading={session.loading}
            error={session.error}
          />
        ) : null}

        {/* Paso 2: Datos del estudiante */}
        {session.step === "student" && session.exam ? (
          <StepStudentInfo
            examName={session.exam.name}
            questionCount={session.questions.length}
            timeLimitMinutes={session.exam.timeLimitMinutes}
            firstName={session.firstName}
            onChangeFirstName={session.setFirstName}
            lastName={session.lastName}
            onChangeLastName={session.setLastName}
            documentId={session.documentId}
            onChangeDocumentId={session.setDocumentId}
            email={session.email}
            onChangeEmail={session.setEmail}
            onComplete={() => session.setStep("rules")}
            onBackToCode={() => session.setStep("code")}
          />
        ) : null}

        {/* Paso 3: Reglas del examen y antifraude */}
        {session.step === "rules" && session.exam ? (
          <StepExamRules
            exam={session.exam}
            rulesAccepted={session.rulesAccepted}
            onToggleRulesAccepted={session.setRulesAccepted}
            onStartAttempt={session.startAttempt}
            submitting={session.submitting}
            onBackToStudent={() => session.setStep("student")}
          />
        ) : null}

        {/* Paso 4: Examen activo */}
        {session.step === "exam" && session.exam ? (
          <StepActiveExam
            exam={session.exam}
            displayQuestions={session.displayQuestions}
            currentQuestionIndex={session.currentQuestionIndex}
            onSelectQuestionIndex={session.setCurrentQuestionIndex}
            answers={session.answers}
            onSetAnswer={session.setAnswer}
            remainingMs={session.remainingMs}
            formatRemaining={session.formatRemaining}
            fraudTabSwitches={session.fraudTabSwitches}
            fraudClipboardAttempts={session.fraudClipboardAttempts}
            graceUsedToastVisible={session.graceUsedToastVisible}
            onDismissGraceToast={session.dismissGraceToast}
            error={session.error}
            onClearError={() => session.setError(null)}
            submitting={session.submitting}
            onSubmitAttempt={() => void session.submitAttempt(false)}
            adminMessage={session.adminMessage}
            adminMessageKey={session.adminMessageKey}
            dismissedAdminMessageKey={session.dismissedAdminMessageKey}
            onDismissAdminMessage={session.dismissAdminMessage}
          />
        ) : null}

        {/* Paso 5: Resultados de la evaluación */}
        {session.step === "result" && session.result ? (
          <StepExamResult
            examName={session.exam?.name ?? "Examen"}
            result={session.result}
            resultsReviewBlocked={session.resultsReviewBlocked}
            resultsReviewBlockReason={session.resultsReviewBlockReason}
            resultsReviewRemainingMs={session.resultsReviewRemainingMs}
            reviewTotalMs={session.RESULTS_REVIEW_TOTAL_MS}
            formatReviewClock={session.formatReviewClock}
            questionOrder={session.questionOrder}
            displayQuestions={
              session.questionOrder.length
                ? session.questionOrder
                    .map((id) => session.displayQuestions.find((q) => q.questionId === id))
                    .filter((q): q is typeof session.displayQuestions[number] => Boolean(q))
                : session.displayQuestions
            }
            openQuestionIds={session.resultOpenQuestionIds}
            onToggleQuestion={session.toggleResultQuestion}
            onOpenAll={session.openAllResultQuestions}
            onCloseAll={session.closeAllResultQuestions}
            answers={session.answers}
          />
        ) : null}
      </div>
    </div>
  );
}
