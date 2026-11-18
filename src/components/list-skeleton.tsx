"use client"

import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ListSkeletonProps = {
  columns?: number
  rows?: number
  cardHeight?: string
}

/**
 * List loading placeholder that matches the real page layout:
 * - mobile: card grid skeleton (same shape as the mobile item cards)
 * - desktop: table skeleton rows (same shape as the desktop table)
 */
export function ListSkeleton({
  columns = 6,
  rows = 5,
  cardHeight = "h-48",
}: ListSkeletonProps = {}) {
  return (
    <>
      {/* Mobile: card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className={`${cardHeight} animate-pulse rounded-xl bg-muted`} />
        ))}
      </div>

      {/* Desktop: table */}
      <CardTableSkeleton columns={columns} rows={rows} />
    </>
  )
}

function CardTableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <Card className="hidden overflow-hidden lg:block">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            {[...Array(columns)].map((_, i) => (
              <TableHead key={i} className="h-11">
                <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(rows)].map((_, i) => (
            <TableRow key={i}>
              {[...Array(columns)].map((_, j) => (
                <TableCell key={j}>
                  <div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
