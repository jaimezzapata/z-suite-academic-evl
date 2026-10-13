"use client";

import { useAiDocs } from "./hooks/use-ai-docs";
import { AiDocsHeader } from "./components/ai-docs-header";
import { ReadmePanel } from "./components/readme-panel";
import { BatchPanel } from "./components/batch-panel";
import { ExamPanel } from "./components/exam-panel";
import { ReadmePreviewModal } from "./components/readme-preview-modal";

export default function AdminAiDocsPage() {
  const {
    tab,
    setTab,
    geminiVariant,
    setGeminiVariant,
    readmeTemplate,
    setReadmeTemplate,
    topics,
    criteria,
    loading,
    error,
    markdown,
    setMarkdown,
    previewModalOpen,
    setPreviewModalOpen,
    subjects,
    groups,
    fichas,
    moments,
    sites,
    shifts,
    subjectId,
    setSubjectId,
    questionCount,
    setQuestionCount,
    allowedQuestionTypes,
    toggleAllowedType,
    batchLoading,
    batchError,
    batchJson,
    batchModelUsed,
    importingToBank,
    bankImportSuccessCount,
    canGenerate,
    canGenerateBatch,
    generate,
    generateQuestionBatch,
    importToBank,
    clearReadme,
    clearBatch,
    // Step 3 exam
    examForm,
    creatingExam,
    examResult,
    examError,
    updateExamFormField,
    createExamTemplateFromPipeline,
    // Auto-save topics
    lastAutoSaved,
    loadingTopics,
    handleUpdateTopics,
    handleUpdateCriteria,
  } = useAiDocs();

  return (
    <div className="space-y-6">
      {/* Encabezado con Stepper Progresivo de 3 Pasos */}
      <AiDocsHeader
        tab={tab}
        onSelectTab={setTab}
        hasReadme={Boolean(markdown.trim())}
        hasBatch={Boolean(batchJson.trim())}
      />

      {/* Sección 1: Documentación & Temario (Auto-guardado permanente) */}
      {tab === "readme" ? (
        <ReadmePanel
          markdown={markdown}
          loading={loading}
          canGenerate={canGenerate}
          error={error}
          subjectId={subjectId}
          subjects={subjects}
          topics={topics}
          criteria={criteria}
          geminiVariant={geminiVariant}
          readmeTemplate={readmeTemplate}
          lastAutoSaved={lastAutoSaved}
          loadingTopics={loadingTopics}
          onSetSubjectId={setSubjectId}
          onUpdateTopics={handleUpdateTopics}
          onUpdateCriteria={handleUpdateCriteria}
          onSelectGeminiVariant={setGeminiVariant}
          onSelectReadmeTemplate={setReadmeTemplate}
          onSetMarkdown={setMarkdown}
          onGenerate={generate}
          onOpenPreview={() => setPreviewModalOpen(true)}
          onClear={clearReadme}
          onContinueToQuestions={() => setTab("batch")}
        />
      ) : null}

      {/* Sección 2: Preguntas IA */}
      {tab === "batch" ? (
        <BatchPanel
          batchJson={batchJson}
          batchLoading={batchLoading}
          canGenerateBatch={canGenerateBatch}
          batchError={batchError}
          batchModelUsed={batchModelUsed}
          markdown={markdown}
          questionCount={questionCount}
          allowedQuestionTypes={allowedQuestionTypes}
          importingToBank={importingToBank}
          bankImportSuccessCount={bankImportSuccessCount}
          onSetQuestionCount={setQuestionCount}
          onToggleAllowedType={toggleAllowedType}
          onClear={clearBatch}
          onGenerateBatch={generateQuestionBatch}
          onImportToBank={importToBank}
          onGoToReadme={() => setTab("readme")}
          onContinueToExam={() => setTab("exam")}
        />
      ) : null}

      {/* Sección 3: Crear Examen */}
      {tab === "exam" ? (
        <ExamPanel
          examForm={examForm}
          markdown={markdown}
          subjects={subjects}
          groups={groups}
          fichas={fichas}
          moments={moments}
          sites={sites}
          shifts={shifts}
          creatingExam={creatingExam}
          examResult={examResult}
          examError={examError}
          onUpdateExamField={updateExamFormField}
          onCreateExam={createExamTemplateFromPipeline}
          onGoBackToQuestions={() => setTab("batch")}
        />
      ) : null}

      {/* Modal de vista previa completa Markdown */}
      <ReadmePreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        markdown={markdown}
      />
    </div>
  );
}
