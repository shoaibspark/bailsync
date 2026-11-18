"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type TableSkeletonProps = {
  columns?: number
  rows?: number
}

/**
 * Table-shaped loading placeholder. Shown while a list page is loading and no
 * cached data exists yet, so the layout matches the real table once data lands.
 */
export function TableSkeleton({ columns = 6, rows = 5 }: TableSkeletonProps = {}) {
  return (
    <div className="overflow-x-auto">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            {[...Array(columns)].map((_, i) => (
              <TableHead key={i} className="h-8">
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
    </div>
  )
}
