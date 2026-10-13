"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DashboardData } from "../types";

export interface DashboardRecentActivityProps {
  topExams: DashboardData["topExams7"];
  latestAttempts: DashboardData["latestAttempts"];
  loading: boolean;
}

export function DashboardRecentActivity({
  topExams,
  latestAttempts,
  loading,
}: DashboardRecentActivityProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Top Exámenes */}
      <Card>
        <CardHeader>
          <CardTitle>Top exámenes (7 días)</CardTitle>
          <CardDescription>Por cantidad de envíos y promedio de calificación.</CardDescription>
        </CardHeader>
        <CardContent>
          {topExams.length ? (
            <div className="space-y-3">
              {topExams.map((row) => (
                <div
                  key={`${row.exam}-${row.group}`}
                  className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 p-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                        {row.exam}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {row.group}
                      </p>
                    </div>
                    <div className="text-right text-xs shrink-0">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {row.submissions}
                        </span>{" "}
                        <span className="text-slate-500">envíos</span>
                      </div>
                      <div className="mt-1 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                        {row.avg}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-8 text-center text-xs text-slate-500">
              {loading ? "Cargando métricas..." : "Aún no hay datos para el top de exámenes."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimos Resultados */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos resultados</CardTitle>
          <CardDescription>Monitoreo en tiempo real de evaluaciones recientes.</CardDescription>
        </CardHeader>
        <CardContent>
          {latestAttempts.length ? (
            <>
              {/* Vista Móvil (Cards) */}
              <div className="space-y-3 sm:hidden">
                {latestAttempts.map((row) => (
                  <div
                    key={`${row.when}-${row.exam}-${row.student}`}
                    className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 p-3.5 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">
                          {row.exam}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">{row.student}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">{row.when}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {row.grade}
                        </span>
                        <Badge
                          variant={row.status.includes("fraud") ? "danger" : "default"}
                          size="sm"
                        >
                          {row.status}
                        </Badge>
                      </div>
                      {row.fraud > 0 ? (
                        <Badge variant="warning" size="sm">
                          Fraude: {row.fraud}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Vista Desktop (Tabla usando Primitiva del Design System) */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[15%]">Fecha</TableHead>
                      <TableHead className="w-[35%]">Examen</TableHead>
                      <TableHead className="w-[28%]">Estudiante</TableHead>
                      <TableHead className="w-[12%] text-right">Nota</TableHead>
                      <TableHead className="w-[10%] text-center">Fraude</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestAttempts.map((row) => (
                      <TableRow key={`${row.when}-${row.exam}-${row.student}`}>
                        <TableCell className="text-slate-400 text-[11px]">{row.when}</TableCell>
                        <TableCell>
                          <div className="truncate font-medium text-slate-900 dark:text-white">
                            {row.exam}
                          </div>
                          <div className="truncate text-[11px] text-slate-400">{row.status}</div>
                        </TableCell>
                        <TableCell className="truncate">{row.student}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {row.grade}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.fraud > 0 ? (
                            <Badge variant="warning" size="sm">
                              {row.fraud}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-[11px]">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-8 text-center text-xs text-slate-500">
              {loading ? "Cargando resultados..." : "Aún no hay envíos registrados para mostrar."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
